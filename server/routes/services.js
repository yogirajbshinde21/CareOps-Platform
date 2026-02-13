// server/routes/services.js - Business services CRUD
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const supabase = require('../config/supabase');

// GET /api/services - List all services for workspace
router.get('/', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('workspace_id', req.user.workspace_id)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/services/public/:workspaceId - Public: list active services
router.get('/public/:workspaceId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('id, name, description, duration, price')
      .eq('workspace_id', req.params.workspaceId)
      .eq('is_active', true)
      .order('name');

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/services - Create service
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, description, duration, price } = req.body;
    if (!name || !duration) {
      return res.status(400).json({ error: 'Name and duration are required' });
    }

    const { data, error } = await supabase
      .from('services')
      .insert({
        workspace_id: req.user.workspace_id,
        name,
        description: description || '',
        duration: parseInt(duration),
        price: parseFloat(price) || 0,
        is_active: true
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/services/bulk - Create multiple services at once (onboarding)
router.post('/bulk', authenticate, async (req, res) => {
  try {
    const { services } = req.body;
    if (!services || !Array.isArray(services)) {
      return res.status(400).json({ error: 'Services array is required' });
    }

    // Delete existing services first to prevent duplicates on re-run
    await supabase.from('services').delete().eq('workspace_id', req.user.workspace_id);

    const rows = services.map(s => ({
      workspace_id: req.user.workspace_id,
      name: s.name,
      description: s.description || '',
      duration: parseInt(s.duration) || 60,
      price: parseFloat(s.price) || 0,
      is_active: true
    }));

    const { data, error } = await supabase
      .from('services')
      .insert(rows)
      .select();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/services/:id - Update service
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('services')
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

// DELETE /api/services/:id - Delete service
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', req.params.id)
      .eq('workspace_id', req.user.workspace_id);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Service deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
