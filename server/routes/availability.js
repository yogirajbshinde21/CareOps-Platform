// server/routes/availability.js - Working hours / availability
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const supabase = require('../config/supabase');

// GET /api/availability - Get workspace availability
router.get('/', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('availability')
      .select('*')
      .eq('workspace_id', req.user.workspace_id)
      .order('day_of_week');

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/availability/public/:workspaceId - Public: get business hours
router.get('/public/:workspaceId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('availability')
      .select('day_of_week, start_time, end_time, is_available')
      .eq('workspace_id', req.params.workspaceId)
      .order('day_of_week');

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/availability/slots/:workspaceId - Public: get REAL available slots for a date
// Checks availability hours AND existing bookings to prevent double-booking
router.get('/slots/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { date, serviceId } = req.query;

    if (!date || !serviceId) {
      return res.status(400).json({ error: 'date and serviceId query params are required' });
    }

    // 1. Get day-of-week availability
    const dayOfWeek = new Date(date).getDay();
    const { data: dayAvail, error: availErr } = await supabase
      .from('availability')
      .select('start_time, end_time, is_available')
      .eq('workspace_id', workspaceId)
      .eq('day_of_week', dayOfWeek)
      .single();

    if (availErr || !dayAvail || !dayAvail.is_available) {
      return res.json({ slots: [], closed: true });
    }

    // 2. Get service duration
    const { data: service } = await supabase
      .from('services')
      .select('duration')
      .eq('id', serviceId)
      .single();

    const duration = service?.duration || 60;

    // 3. Get workspace booking preferences (buffer_time, advance_booking_days)
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('settings')
      .eq('id', workspaceId)
      .single();

    const prefs = workspace?.settings?.booking_preferences || {};
    const bufferTime = prefs.buffer_time || 0;
    const advanceBookingDays = prefs.advance_booking_days || 30;
    const autoConfirm = prefs.auto_confirm || false;

    // 4. Enforce advance booking limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((selectedDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return res.json({ slots: [], past: true });
    }
    if (diffDays > advanceBookingDays) {
      return res.json({ slots: [], tooFarAhead: true, maxDays: advanceBookingDays });
    }

    // 5. Get existing bookings for this date (only active ones)
    const { data: existingBookings } = await supabase
      .from('bookings')
      .select('start_time, end_time')
      .eq('workspace_id', workspaceId)
      .eq('date', date)
      .in('status', ['pending', 'confirmed']);

    // Convert existing bookings to minute ranges (with buffer)
    const bookedRanges = (existingBookings || []).map(b => {
      const [sh, sm] = b.start_time.split(':').map(Number);
      const [eh, em] = b.end_time.split(':').map(Number);
      return {
        start: sh * 60 + sm - bufferTime,
        end: eh * 60 + em + bufferTime
      };
    });

    // 6. Generate all possible slots and filter out booked ones
    const [startH, startM] = dayAvail.start_time.split(':').map(Number);
    const [endH, endM] = dayAvail.end_time.split(':').map(Number);
    const dayStart = startH * 60 + startM;
    const dayEnd = endH * 60 + endM;

    const slots = [];
    let current = dayStart;

    while (current + duration <= dayEnd) {
      const slotEnd = current + duration;

      // Check if this slot overlaps with any existing booking (including buffer)
      const isBooked = bookedRanges.some(range =>
        current < range.end && slotEnd > range.start
      );

      // If date is today, skip past time slots
      const now = new Date();
      let isPast = false;
      if (date === now.toISOString().split('T')[0]) {
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        isPast = current <= nowMinutes;
      }

      if (!isBooked && !isPast) {
        const h = Math.floor(current / 60);
        const m = current % 60;
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }

      current += 30; // 30-min intervals
    }

    res.json({
      slots,
      bufferTime,
      advanceBookingDays,
      autoConfirm,
      totalSlots: slots.length
    });
  } catch (err) {
    console.error('Slot availability error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/availability/bulk - Set all availability (onboarding)
router.post('/bulk', authenticate, async (req, res) => {
  try {
    const { availability } = req.body;
    if (!availability || !Array.isArray(availability)) {
      return res.status(400).json({ error: 'Availability array is required' });
    }

    // Delete existing availability for this workspace
    await supabase
      .from('availability')
      .delete()
      .eq('workspace_id', req.user.workspace_id);

    // Insert new availability
    const rows = availability.map(a => ({
      workspace_id: req.user.workspace_id,
      day_of_week: a.day_of_week,
      start_time: a.start_time,
      end_time: a.end_time,
      is_available: a.is_available !== false
    }));

    const { data, error } = await supabase
      .from('availability')
      .insert(rows)
      .select();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
