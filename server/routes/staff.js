// server/routes/staff.js - Team member management routes
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const supabase = require('../config/supabase');
const bcrypt = require('bcryptjs');
const { sendStaffInvite } = require('../services/emailService');

// All routes require authentication
router.use(authenticate);

// GET /api/staff - List workspace staff members
router.get('/', async (req, res) => {
  try {
    const { data: staff, error } = await supabase
      .from('users')
      .select('id, name, email, role, avatar_url, is_active, created_at, permissions')
      .eq('workspace_id', req.user.workspace_id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Get service assignments for each staff member
    const { data: assignments } = await supabase
      .from('staff_services')
      .select('user_id, service_id, services(id, name)')
      .eq('workspace_id', req.user.workspace_id);

    // Attach assigned services to each staff
    const staffWithServices = staff.map(member => ({
      ...member,
      assigned_services: (assignments || [])
        .filter(a => a.user_id === member.id)
        .map(a => a.services)
    }));

    res.json(staffWithServices);
  } catch (err) {
    console.error('Staff list error:', err);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

// POST /api/staff/invite - Invite a new staff member
router.post('/invite', async (req, res) => {
  try {
    // Only owners/admins can invite
    if (req.user.role !== 'owner' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only owners and admins can invite staff' });
    }

    const { name, email, role = 'staff' } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email required' });
    }

    // Check if email already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      return res.status(400).json({ error: 'A user with this email already exists' });
    }

    // Create staff user with a temporary password
    const tempPassword = 'CareOps@' + Math.random().toString(36).slice(-6);
    const password_hash = await bcrypt.hash(tempPassword, 12);

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        workspace_id: req.user.workspace_id,
        name,
        email: email.toLowerCase(),
        password_hash,
        role: role === 'admin' ? 'admin' : 'staff',
        is_active: true
      })
      .select('id, name, email, role, is_active, created_at')
      .single();

    if (error) throw error;

    // Send invite email (fire-and-forget)
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', req.user.workspace_id)
      .single();

    sendStaffInvite(email.toLowerCase(), name, req.user.name, workspace?.name || 'CareOps', tempPassword)
      .then(result => {
        if (result?.previewUrl) console.log(`📧 Invite email: ${result.previewUrl}`);
      })
      .catch(() => {});

    res.status(201).json({
      ...newUser,
      temp_password: tempPassword,
      assigned_services: [],
      message: `Staff member invited! Temporary password: ${tempPassword}`
    });
  } catch (err) {
    console.error('Staff invite error:', err);
    res.status(500).json({ error: 'Failed to invite staff member' });
  }
});

// PUT /api/staff/:id - Update staff member
router.put('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'owner' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only owners and admins can update staff' });
    }

    const { name, role, is_active } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (role && role !== 'owner') updates.role = role; // Can't make someone owner
    if (typeof is_active === 'boolean') updates.is_active = is_active;

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.params.id)
      .eq('workspace_id', req.user.workspace_id)
      .select('id, name, email, role, is_active, created_at')
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Staff member not found' });

    res.json(data);
  } catch (err) {
    console.error('Staff update error:', err);
    res.status(500).json({ error: 'Failed to update staff member' });
  }
});

// DELETE /api/staff/:id - Remove staff member
router.delete('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ error: 'Only the owner can remove staff' });
    }

    // Prevent deleting yourself
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot remove yourself' });
    }

    // Remove service assignments first
    await supabase
      .from('staff_services')
      .delete()
      .eq('user_id', req.params.id)
      .eq('workspace_id', req.user.workspace_id);

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', req.params.id)
      .eq('workspace_id', req.user.workspace_id);

    if (error) throw error;
    res.json({ message: 'Staff member removed' });
  } catch (err) {
    console.error('Staff delete error:', err);
    res.status(500).json({ error: 'Failed to remove staff member' });
  }
});

// PUT /api/staff/:id/permissions - Update section permissions for staff member
router.put('/:id/permissions', async (req, res) => {
  try {
    if (req.user.role !== 'owner' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only owners and admins can update permissions' });
    }

    const { permissions } = req.body;
    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({ error: 'permissions object required' });
    }

    const { data, error } = await supabase
      .from('users')
      .update({ permissions })
      .eq('id', req.params.id)
      .eq('workspace_id', req.user.workspace_id)
      .select('id, name, email, role, permissions, is_active')
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Staff member not found' });

    res.json(data);
  } catch (err) {
    console.error('Permissions update error:', err);
    res.status(500).json({ error: 'Failed to update permissions' });
  }
});

// PUT /api/staff/:id/services - Assign services to staff member
router.put('/:id/services', async (req, res) => {
  try {
    if (req.user.role !== 'owner' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only owners and admins can assign services' });
    }

    const { service_ids } = req.body;
    if (!Array.isArray(service_ids)) {
      return res.status(400).json({ error: 'service_ids must be an array' });
    }

    // Clear existing assignments
    await supabase
      .from('staff_services')
      .delete()
      .eq('user_id', req.params.id)
      .eq('workspace_id', req.user.workspace_id);

    // Insert new assignments
    if (service_ids.length > 0) {
      const rows = service_ids.map(sid => ({
        user_id: req.params.id,
        service_id: sid,
        workspace_id: req.user.workspace_id
      }));

      const { error } = await supabase
        .from('staff_services')
        .insert(rows);

      if (error) throw error;
    }

    // Return updated assignments
    const { data: assignments } = await supabase
      .from('staff_services')
      .select('service_id, services(id, name)')
      .eq('user_id', req.params.id)
      .eq('workspace_id', req.user.workspace_id);

    res.json({
      user_id: req.params.id,
      assigned_services: (assignments || []).map(a => a.services)
    });
  } catch (err) {
    console.error('Service assignment error:', err);
    res.status(500).json({ error: 'Failed to assign services' });
  }
});

module.exports = router;
