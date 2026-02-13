// server/routes/activity.js - Unified activity log from existing tables
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const supabase = require('../config/supabase');

// GET /api/activity - Fetch recent activity across all tables
router.get('/', authenticate, async (req, res) => {
  try {
    const wsId = req.user.workspace_id;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;

    // Query all tables in parallel for recent activity
    const [bookingsRes, contactsRes, conversationsRes, formsRes, inventoryRes, submissionsRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, date, start_time, status, notes, created_at, contact:contacts(name), service:services(name)')
        .eq('workspace_id', wsId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
      supabase
        .from('contacts')
        .select('id, name, email, phone, source, created_at')
        .eq('workspace_id', wsId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
      supabase
        .from('conversations')
        .select('id, subject, status, created_at, contact:contacts(name)')
        .eq('workspace_id', wsId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
      supabase
        .from('form_templates')
        .select('id, name, created_at')
        .eq('workspace_id', wsId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
      supabase
        .from('inventory_items')
        .select('id, name, quantity, reorder_level, created_at, updated_at')
        .eq('workspace_id', wsId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
      supabase
        .from('form_submissions')
        .select('id, status, created_at, form_template:form_templates(name), contact:contacts(name)')
        .eq('workspace_id', wsId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
    ]);

    // Transform each into unified activity items
    const activities = [];

    (bookingsRes.data || []).forEach(b => {
      activities.push({
        id: `booking-${b.id}`,
        type: 'booking',
        action: b.status === 'confirmed' ? 'Booking confirmed' : b.status === 'cancelled' ? 'Booking cancelled' : b.status === 'completed' ? 'Booking completed' : 'Booking created',
        description: `${b.contact?.name || 'Unknown'} — ${b.service?.name || 'Service'} on ${b.date}`,
        status: b.status,
        timestamp: b.created_at,
      });
    });

    (contactsRes.data || []).forEach(c => {
      activities.push({
        id: `contact-${c.id}`,
        type: 'contact',
        action: 'Contact added',
        description: `${c.name}${c.email ? ` (${c.email})` : ''}${c.source !== 'manual' ? ` via ${c.source}` : ''}`,
        status: 'created',
        timestamp: c.created_at,
      });
    });

    (conversationsRes.data || []).forEach(cv => {
      activities.push({
        id: `conversation-${cv.id}`,
        type: 'conversation',
        action: cv.status === 'closed' ? 'Conversation closed' : 'Conversation started',
        description: `${cv.contact?.name || 'Unknown'} — ${cv.subject || 'No subject'}`,
        status: cv.status,
        timestamp: cv.created_at,
      });
    });

    (formsRes.data || []).forEach(f => {
      activities.push({
        id: `form-${f.id}`,
        type: 'form',
        action: 'Form created',
        description: f.name,
        status: 'created',
        timestamp: f.created_at,
      });
    });

    (inventoryRes.data || []).forEach(inv => {
      const isLow = inv.quantity <= inv.reorder_level;
      activities.push({
        id: `inventory-${inv.id}`,
        type: 'inventory',
        action: isLow ? 'Low stock alert' : 'Inventory added',
        description: `${inv.name} — ${inv.quantity} in stock`,
        status: isLow ? 'warning' : 'created',
        timestamp: inv.created_at,
      });
    });

    (submissionsRes.data || []).forEach(s => {
      activities.push({
        id: `submission-${s.id}`,
        type: 'form_submission',
        action: s.status === 'completed' ? 'Form completed' : s.status === 'overdue' ? 'Form overdue' : 'Form submitted',
        description: `${s.contact?.name || 'Unknown'} — ${s.form_template?.name || 'Form'}`,
        status: s.status,
        timestamp: s.created_at,
      });
    });

    // Sort all by timestamp descending
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Return limited results
    res.json(activities.slice(0, limit));
  } catch (err) {
    console.error('Activity log error:', err);
    res.status(500).json({ error: 'Failed to fetch activity log' });
  }
});

module.exports = router;
