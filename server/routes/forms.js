// server/routes/forms.js - Intake form template management
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const supabase = require('../config/supabase');
const { webhookEvents } = require('../services/webhookService');

// GET /api/forms - List form templates
router.get('/', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('form_templates')
      .select('*')
      .eq('workspace_id', req.user.workspace_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch forms' });
  }
});

// POST /api/forms - Create form template
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, description, fields } = req.body;
    if (!name || !fields || !Array.isArray(fields)) {
      return res.status(400).json({ error: 'Name and fields are required' });
    }

    const { data, error } = await supabase
      .from('form_templates')
      .insert({
        workspace_id: req.user.workspace_id,
        name,
        description: description || '',
        fields,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create form' });
  }
});

// PUT /api/forms/:id - Update form template
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { name, description, fields, is_active } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (fields) updates.fields = fields;
    if (typeof is_active === 'boolean') updates.is_active = is_active;

    const { data, error } = await supabase
      .from('form_templates')
      .update(updates)
      .eq('id', req.params.id)
      .eq('workspace_id', req.user.workspace_id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update form' });
  }
});

// DELETE /api/forms/:id - Delete form template
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { error } = await supabase
      .from('form_templates')
      .delete()
      .eq('id', req.params.id)
      .eq('workspace_id', req.user.workspace_id);

    if (error) throw error;
    res.json({ message: 'Form deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete form' });
  }
});

// GET /api/forms/:id/public - Public: get form for customer filling
router.get('/:id/public', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('form_templates')
      .select('id, name, description, fields')
      .eq('id', req.params.id)
      .eq('is_active', true)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Form not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/forms/:id/submit - Public: submit form response
router.post('/:id/submit', async (req, res) => {
  try {
    const { contact_id, workspace_id, booking_id, submission_id, data: formData } = req.body;

    // Verify form exists
    const { data: template } = await supabase
      .from('form_templates')
      .select('id, workspace_id, name')
      .eq('id', req.params.id)
      .single();

    if (!template) return res.status(404).json({ error: 'Form not found' });

    const wsId = workspace_id || template.workspace_id;

    // If we have an existing pending submission_id, update it instead of creating new
    if (submission_id) {
      const { data: updated, error: updateErr } = await supabase
        .from('form_submissions')
        .update({ data: formData, status: 'completed' })
        .eq('id', submission_id)
        .select()
        .single();

      if (!updateErr && updated) {
        // Fire webhook
        webhookEvents.formSubmitted(wsId, updated, template).catch(() => {});
        return res.status(200).json(updated);
      }
    }

    // Create new submission (no pending record exists)
    const { data, error } = await supabase
      .from('form_submissions')
      .insert({
        form_template_id: req.params.id,
        contact_id: contact_id || null,
        booking_id: booking_id || null,
        workspace_id: wsId,
        data: formData,
        status: 'completed'
      })
      .select()
      .single();

    if (error) throw error;

    // Fire webhook
    webhookEvents.formSubmitted(wsId, data, template).catch(() => {});

    res.status(201).json(data);
  } catch (err) {
    console.error('Form submission error:', err);
    res.status(500).json({ error: 'Failed to submit form' });
  }
});

// GET /api/forms/:id/submissions - List submissions for a form
router.get('/:id/submissions', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('form_submissions')
      .select('*, contacts(name, email)')
      .eq('form_template_id', req.params.id)
      .eq('workspace_id', req.user.workspace_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// GET /api/forms/stats - Dashboard form statistics
router.get('/stats/summary', authenticate, async (req, res) => {
  try {
    // Get all submissions for this workspace
    const { data: submissions, error } = await supabase
      .from('form_submissions')
      .select('id, status, created_at')
      .eq('workspace_id', req.user.workspace_id);

    if (error) throw error;

    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const pending = (submissions || []).filter(s => s.status === 'pending');
    const overdue = pending.filter(s => new Date(s.created_at) < twoDaysAgo);
    const completed = (submissions || []).filter(s => s.status === 'completed');

    res.json({
      pendingForms: pending.length,
      overdueForms: overdue.length,
      completedForms: completed.length,
      totalSubmissions: (submissions || []).length
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch form stats' });
  }
});

module.exports = router;
