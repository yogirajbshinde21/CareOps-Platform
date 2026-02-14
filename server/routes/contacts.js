// server/routes/contacts.js - Contacts management
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const { sendWelcomeEmail } = require('../services/emailService');
const { webhookEvents } = require('../services/webhookService');

// POST /api/contacts/public - Public contact form
router.post('/public', async (req, res) => {
  try {
    const { workspace_slug, name, email, phone, message } = req.body;

    if (!workspace_slug || !name || (!email && !phone)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get workspace id from slug
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('slug', workspace_slug)
      .single();

    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    // Check if contact exists
    let contact_id;
    const { data: existing } = await supabase
      .from('contacts')
      .select('id')
      .eq('workspace_id', workspace.id)
      .eq('email', email?.toLowerCase())
      .single();

    if (existing) {
      contact_id = existing.id;
      // Update name/phone if changed
      await supabase.from('contacts').update({
        name,
        phone: phone || undefined
      }).eq('id', existing.id);
    } else {
      const { data: newContact, error: createError } = await supabase
        .from('contacts')
        .insert({
          workspace_id: workspace.id,
          name,
          email: email?.toLowerCase() || '',
          phone: phone || '',
          source: 'website_form'
        })
        .select()
        .single();
      
      if (createError) throw createError;
      contact_id = newContact.id;
    }

    // Reuse existing open conversation or create new one
    let conversation;
    const { data: existingConvo } = await supabase
      .from('conversations')
      .select('*')
      .eq('workspace_id', workspace.id)
      .eq('contact_id', contact_id)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existingConvo) {
      conversation = existingConvo;
      // Update last_message_at
      await supabase.from('conversations').update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', existingConvo.id);
    } else {
      const { data: newConvo, error: convError } = await supabase
        .from('conversations')
        .insert({
          workspace_id: workspace.id,
          contact_id,
          subject: message ? 'Contact Form Inquiry' : 'New Contact',
          status: 'open',
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      if (convError) throw convError;
      conversation = newConvo;
    }

    if (message) {
      const { error: msgError } = await supabase.from('messages').insert({
        conversation_id: conversation.id,
        sender_type: 'contact',
        content: message
      });
      if (msgError) console.error('Message insert error:', msgError);
    }

    // Send welcome email
    const { data: contact } = await supabase.from('contacts').select('*').eq('id', contact_id).single();
    sendWelcomeEmail(contact, workspace).catch(console.error);

    // Fire webhook with message included
    webhookEvents.contactCreated(workspace.id, { ...contact, message }).catch(() => {});

    res.status(201).json({ message: 'Message sent successfully' });
  } catch (err) {
    console.error('Public contact error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Protected routes
router.use(authenticate);
router.get('/', authenticate, async (req, res) => {
  try {
    const { search } = req.query;
    let query = supabase
      .from('contacts')
      .select('*')
      .eq('workspace_id', req.user.workspace_id)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/contacts/:id - Get single contact
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', req.params.id)
      .eq('workspace_id', req.user.workspace_id)
      .single();

    if (error) return res.status(404).json({ error: 'Contact not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/contacts - Create contact
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, email, phone, source, tags, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const { data, error } = await supabase
      .from('contacts')
      .insert({
        workspace_id: req.user.workspace_id,
        name,
        email: email?.toLowerCase() || '',
        phone: phone || '',
        source: source || 'manual',
        tags: tags || [],
        notes: notes || ''
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/contacts/:id/timeline - Customer journey timeline
router.get('/:id/timeline', authenticate, async (req, res) => {
  try {
    const { workspace_id } = req.user;
    const contact_id = req.params.id;
    const events = [];

    // 1. Contact created
    const { data: contact } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contact_id)
      .eq('workspace_id', workspace_id)
      .single();
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    events.push({ type: 'contact_created', title: 'Contact added', description: `Source: ${contact.source || 'manual'}`, timestamp: contact.created_at, icon: 'user-plus', color: '#6366f1' });

    // 2. Bookings
    const { data: bookings } = await supabase
      .from('bookings')
      .select('*, services:service_id(name)')
      .eq('contact_id', contact_id)
      .eq('workspace_id', workspace_id)
      .order('created_at', { ascending: true });
    (bookings || []).forEach(b => {
      const svcName = b.services?.name || 'Service';
      events.push({ type: 'booking_created', title: `Booking created — ${svcName}`, description: `${b.date} at ${b.start_time}`, timestamp: b.created_at, icon: 'calendar-plus', color: '#3b82f6' });
      if (b.status === 'confirmed') events.push({ type: 'booking_confirmed', title: `Booking confirmed — ${svcName}`, description: `${b.date} at ${b.start_time}`, timestamp: b.updated_at, icon: 'calendar-check', color: '#10b981' });
      if (b.status === 'completed') events.push({ type: 'booking_completed', title: `Booking completed — ${svcName}`, description: `${b.date}`, timestamp: b.updated_at, icon: 'check-circle', color: '#059669' });
      if (b.status === 'cancelled') events.push({ type: 'booking_cancelled', title: `Booking cancelled — ${svcName}`, description: `${b.date}`, timestamp: b.updated_at, icon: 'x-circle', color: '#ef4444' });
      if (b.status === 'no_show') events.push({ type: 'booking_noshow', title: `No-show — ${svcName}`, description: `${b.date}`, timestamp: b.updated_at, icon: 'alert-circle', color: '#f59e0b' });
    });

    // 3. Conversations & messages
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id, created_at, status')
      .eq('contact_id', contact_id)
      .eq('workspace_id', workspace_id)
      .order('created_at', { ascending: true });
    for (const conv of (conversations || [])) {
      events.push({ type: 'conversation_opened', title: 'Conversation started', description: 'New inbox thread opened', timestamp: conv.created_at, icon: 'message-square', color: '#8b5cf6' });
      // Get key messages (first contact msg, first staff reply)
      const { data: msgs } = await supabase
        .from('messages')
        .select('sender_type, content, created_at')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true })
        .limit(20);
      let staffReplied = false;
      (msgs || []).forEach(m => {
        if (m.sender_type === 'contact' && !staffReplied) {
          events.push({ type: 'message_received', title: 'Message received', description: m.content?.substring(0, 80) + (m.content?.length > 80 ? '…' : ''), timestamp: m.created_at, icon: 'mail', color: '#6366f1' });
        }
        if (m.sender_type === 'staff' && !staffReplied) {
          staffReplied = true;
          events.push({ type: 'staff_replied', title: 'Staff replied', description: m.content?.substring(0, 80) + (m.content?.length > 80 ? '…' : ''), timestamp: m.created_at, icon: 'reply', color: '#0ea5e9' });
        }
        if (m.sender_type === 'system') {
          events.push({ type: 'system_message', title: 'System notification', description: m.content?.substring(0, 80) + (m.content?.length > 80 ? '…' : ''), timestamp: m.created_at, icon: 'bell', color: '#64748b' });
        }
      });
    }

    // 4. Form submissions
    const { data: submissions } = await supabase
      .from('form_submissions')
      .select('*, form_templates:form_template_id(name)')
      .eq('contact_id', contact_id)
      .eq('workspace_id', workspace_id)
      .order('created_at', { ascending: true });
    (submissions || []).forEach(s => {
      const formName = s.form_templates?.name || 'Form';
      if (s.status === 'pending') {
        events.push({ type: 'form_sent', title: `Form sent — ${formName}`, description: 'Waiting for completion', timestamp: s.created_at, icon: 'file-text', color: '#f59e0b' });
      } else if (s.status === 'completed') {
        events.push({ type: 'form_completed', title: `Form completed — ${formName}`, description: 'All fields submitted', timestamp: s.created_at, icon: 'file-check', color: '#10b981' });
      } else {
        events.push({ type: 'form_overdue', title: `Form overdue — ${formName}`, description: 'Not yet completed', timestamp: s.created_at, icon: 'file-warning', color: '#ef4444' });
      }
    });

    // Sort by timestamp ascending
    events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    res.json({ contact, events });
  } catch (err) {
    console.error('Timeline error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/contacts/:id - Update contact
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .update(req.body)
      .eq('id', req.params.id)
      .eq('workspace_id', req.user.workspace_id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/contacts/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', req.params.id)
      .eq('workspace_id', req.user.workspace_id);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Contact deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
