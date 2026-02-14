// server/routes/bookings.js - Booking management
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const supabase = require('../config/supabase');
const { sendBookingConfirmation, sendBookingReminder, sendFormEmail } = require('../services/emailService');
const { webhookEvents } = require('../services/webhookService');

// GET /api/bookings - List bookings for workspace
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, date } = req.query;
    let query = supabase
      .from('bookings')
      .select('*, contacts(name, email, phone), services(name, duration, price)')
      .eq('workspace_id', req.user.workspace_id)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });

    if (status) query = query.eq('status', status);
    if (date) query = query.eq('date', date);

    // Staff members can only see bookings for their assigned services
    if (req.user.assigned_service_ids !== null) {
      if (req.user.assigned_service_ids.length === 0) {
        // Staff with no assigned services sees no bookings
        return res.json([]);
      }
      query = query.in('service_id', req.user.assigned_service_ids);
    }

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/bookings - Create booking (internal)
router.post('/', authenticate, async (req, res) => {
  try {
    const { contact_id, service_id, date, start_time, end_time, notes } = req.body;

    // Staff can only create bookings for their assigned services
    if (req.user.assigned_service_ids !== null && !req.user.assigned_service_ids.includes(service_id)) {
      return res.status(403).json({ error: 'You are not assigned to this service' });
    }

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        workspace_id: req.user.workspace_id,
        contact_id,
        service_id,
        date,
        start_time,
        end_time,
        notes: notes || '',
        status: 'confirmed'
      })
      .select('*, contacts(*), services(*)')
      .single();

    if (error) return res.status(400).json({ error: error.message });
    
    // Send confirmation email
    const { data: workspace } = await supabase.from('workspaces').select('*').eq('id', req.user.workspace_id).single();
    sendBookingConfirmation(data, data.contacts, data.services, workspace).catch(console.error);

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/bookings/:id/remind - Send manual reminder
router.post('/:id/remind', authenticate, async (req, res) => {
  try {
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*, contacts(*), services(*)')
      .eq('id', req.params.id)
      .eq('workspace_id', req.user.workspace_id)
      .single();

    if (error || !booking) return res.status(404).json({ error: 'Booking not found' });

    // Staff can only send reminders for their assigned services
    if (req.user.assigned_service_ids !== null && !req.user.assigned_service_ids.includes(booking.service_id)) {
      return res.status(403).json({ error: 'You do not have access to this booking' });
    }

    const { data: workspace } = await supabase.from('workspaces').select('*').eq('id', req.user.workspace_id).single();
    
    const result = await sendBookingReminder(booking, booking.contacts, booking.services, workspace);
    
    if (result?.success) {
      res.json({ message: 'Reminder sent successfully' });
    } else {
      res.status(500).json({ error: 'Failed to send email' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/bookings/public - Public booking (from booking page)
router.post('/public', async (req, res) => {
  try {
    const { workspace_id, service_id, date, start_time, end_time, customer } = req.body;

    if (!workspace_id || !service_id || !date || !start_time || !customer) {
      return res.status(400).json({ error: 'Missing required booking fields' });
    }

    // Create or find contact
    let contact;
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('*')
      .eq('workspace_id', workspace_id)
      .eq('email', customer.email.toLowerCase())
      .single();

    if (existingContact) {
      contact = existingContact;
    } else {
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          workspace_id,
          name: customer.name,
          email: customer.email.toLowerCase(),
          phone: customer.phone || '',
          source: 'booking'
        })
        .select()
        .single();

      if (contactError) return res.status(400).json({ error: 'Failed to create contact' });
      contact = newContact;
    }

    // Get service info for duration calculation
    const { data: service } = await supabase
      .from('services')
      .select('name, duration')
      .eq('id', service_id)
      .single();

    // ---- DOUBLE-BOOKING PREVENTION ----
    // Get workspace booking preferences (buffer_time)
    const { data: wsSettings } = await supabase
      .from('workspaces')
      .select('settings')
      .eq('id', workspace_id)
      .single();

    const prefs = wsSettings?.settings?.booking_preferences || {};
    const bufferTime = prefs.buffer_time || 0;
    const autoConfirm = prefs.auto_confirm || false;

    // Check for overlapping bookings on the same date
    const { data: existingBookings } = await supabase
      .from('bookings')
      .select('start_time, end_time')
      .eq('workspace_id', workspace_id)
      .eq('date', date)
      .in('status', ['pending', 'confirmed']);

    const [sh, sm] = start_time.split(':').map(Number);
    const slotStart = sh * 60 + sm;
    const slotEnd = slotStart + (service?.duration || 60);

    const hasConflict = (existingBookings || []).some(b => {
      const [bsh, bsm] = b.start_time.split(':').map(Number);
      const [beh, bem] = b.end_time.split(':').map(Number);
      const bStart = bsh * 60 + bsm - bufferTime;
      const bEnd = beh * 60 + bem + bufferTime;
      return slotStart < bEnd && slotEnd > bStart;
    });

    if (hasConflict) {
      return res.status(409).json({ error: 'This time slot is no longer available. Please choose another time.' });
    }
    // ---- END DOUBLE-BOOKING PREVENTION ----

    // Create booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        workspace_id,
        contact_id: contact.id,
        service_id,
        date,
        start_time,
        end_time: end_time || start_time,
        notes: customer.notes || '',
        status: autoConfirm ? 'confirmed' : 'pending'
      })
      .select()
      .single();

    if (bookingError) {
      console.error('Booking Insert Error:', bookingError);
      return res.status(400).json({ error: 'Failed to create booking: ' + bookingError.message });
    }

    // Reuse existing open conversation or create new one
    let conversation;
    const { data: existingConvo } = await supabase
      .from('conversations')
      .select('*')
      .eq('workspace_id', workspace_id)
      .eq('contact_id', contact.id)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existingConvo) {
      conversation = existingConvo;
      await supabase.from('conversations').update({
        last_message_at: new Date().toISOString()
      }).eq('id', existingConvo.id);
    } else {
      const { data: newConvo } = await supabase
        .from('conversations')
        .insert({
          workspace_id,
          contact_id: contact.id,
          subject: `Booking: ${service?.name || 'Service'} on ${date}`,
          status: 'open',
          last_message_at: new Date().toISOString()
        })
        .select()
        .single();
      conversation = newConvo;
    }

    // Add initial message
    if (conversation) {
      await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          sender_type: 'system',
          content: `New booking created by ${customer.name} for ${service?.name || 'a service'} on ${date} at ${start_time}.`
        });
    }

    // Send confirmation email (fire-and-forget)
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name, slug')
      .eq('id', workspace_id)
      .single();

    sendBookingConfirmation(booking, contact, service, workspace)
      .then(result => {
        if (result?.previewUrl) console.log(`📧 Customer email preview: ${result.previewUrl}`);
      })
      .catch(() => {});

    // Auto-send intake forms (find active form templates for this workspace)
    try {
      const { data: formTemplates } = await supabase
        .from('form_templates')
        .select('id, name, description')
        .eq('workspace_id', workspace_id)
        .eq('is_active', true)
        .limit(3); // Max 3 forms per booking

      if (formTemplates && formTemplates.length > 0) {
        const clientUrl = process.env.VITE_APP_URL || process.env.CLIENT_URL || 'http://localhost:5173';

        for (const form of formTemplates) {
          // Create a pending form submission record
          const { data: submission } = await supabase
            .from('form_submissions')
            .insert({
              form_template_id: form.id,
              contact_id: contact.id,
              booking_id: booking.id,
              workspace_id: workspace_id,
              data: {},
              status: 'pending'
            })
            .select()
            .single();

          // Build form URL with tracking params
          const formUrl = `${clientUrl}/form/${form.id}?bookingId=${booking.id}&contactId=${contact.id}&submissionId=${submission?.id || ''}`;

          // Send form email
          sendFormEmail(contact, form, booking, workspace, formUrl)
            .then(result => {
              if (result?.previewUrl) console.log(`📧 Form email preview: ${result.previewUrl}`);
            })
            .catch(err => console.error('Form email error:', err));
        }
      }
    } catch (formErr) {
      console.error('Auto-form error (non-fatal):', formErr);
    }

    // Fire webhook (fire-and-forget)
    console.log(`📢 [DEBUG] Triggering webhookEvents.bookingCreated for workspace ${workspace_id}`);
    webhookEvents.bookingCreated(workspace_id, booking, contact, service)
      .then(result => console.log(`📢 [DEBUG] Webhook result:`, result))
      .catch(err => console.error('📢 [DEBUG] Webhook error:', err));

    res.status(201).json({
      message: 'Booking created successfully',
      booking,
      contact
    });
  } catch (err) {
    console.error('Public booking error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/bookings/:id/status - Update booking status
router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'confirmed', 'cancelled', 'completed', 'no_show'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // First fetch the booking to check service assignment
    const { data: existing } = await supabase
      .from('bookings')
      .select('service_id')
      .eq('id', req.params.id)
      .eq('workspace_id', req.user.workspace_id)
      .single();

    if (!existing) return res.status(404).json({ error: 'Booking not found' });

    // Staff can only update bookings for their assigned services
    if (req.user.assigned_service_ids !== null && !req.user.assigned_service_ids.includes(existing.service_id)) {
      return res.status(403).json({ error: 'You do not have access to this booking' });
    }

    const { data, error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', req.params.id)
      .eq('workspace_id', req.user.workspace_id)
      .select('*, contacts(name, email, phone), services(name, duration, price)')
      .single();

    if (error) return res.status(400).json({ error: error.message });

    // Send email on confirm
    if (status === 'confirmed' && data.contacts?.email) {
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('name')
        .eq('id', req.user.workspace_id)
        .single();

      sendBookingConfirmation(data, data.contacts, data.services, workspace)
        .then(result => {
          if (result?.previewUrl) console.log(`📧 Confirmation email: ${result.previewUrl}`);
        })
        .catch(() => {});
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
