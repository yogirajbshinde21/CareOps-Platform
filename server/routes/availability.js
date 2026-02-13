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
