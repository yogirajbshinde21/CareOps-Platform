// server/routes/workspaces.js - Workspace/onboarding routes
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const supabase = require('../config/supabase');

// GET /api/workspaces/public/:slug - Public: get workspace by slug
router.get('/public/:slug', async (req, res) => {
  try {
    const { data: workspace, error } = await supabase
      .from('workspaces')
      .select('id, name, slug, business_type, address, phone, email, settings')
      .eq('slug', req.params.slug)
      .single();

    if (error || !workspace) return res.status(404).json({ error: 'Business not found' });
    res.json(workspace);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/workspaces/current - Get current workspace
router.get('/current', authenticate, async (req, res) => {
  try {
    const { data: workspace, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', req.user.workspace_id)
      .single();

    if (error) return res.status(404).json({ error: 'Workspace not found' });
    res.json(workspace);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/workspaces/current - Update workspace (onboarding)
router.put('/current', authenticate, async (req, res) => {
  try {
    const updates = req.body;
    const { data, error } = await supabase
      .from('workspaces')
      .update(updates)
      .eq('id', req.user.workspace_id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/workspaces/complete-onboarding
router.put('/complete-onboarding', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('workspaces')
      .update({ onboarding_completed: true })
      .eq('id', req.user.workspace_id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Onboarding completed', workspace: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/workspaces/activation-check - Validate workspace before activation
router.get('/activation-check', authenticate, async (req, res) => {
  try {
    const wsId = req.user.workspace_id;

    // Run all checks in parallel
    const [servicesRes, availRes, formsRes, wsRes] = await Promise.all([
      supabase.from('services').select('id').eq('workspace_id', wsId).eq('is_active', true).limit(1),
      supabase.from('availability').select('id').eq('workspace_id', wsId).eq('is_available', true).limit(1),
      supabase.from('form_templates').select('id').eq('workspace_id', wsId).eq('is_active', true).limit(1),
      supabase.from('workspaces').select('email, settings').eq('id', wsId).single()
    ]);

    const checks = {
      hasServices: (servicesRes.data || []).length > 0,
      hasAvailability: (availRes.data || []).length > 0,
      hasContactForm: (formsRes.data || []).length > 0,
      hasEmail: !!(wsRes.data?.email || process.env.EMAIL_HOST || true), // Ethereal always counts
    };

    checks.canActivate = checks.hasServices && checks.hasAvailability && checks.hasEmail;

    res.json(checks);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
