// server/routes/conversations.js - Unified inbox
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const supabase = require('../config/supabase');

// GET /api/conversations - List conversations
router.get('/', authenticate, async (req, res) => {
  try {
    const { status } = req.query;
    let query = supabase
      .from('conversations')
      .select('*, contacts(name, email)')
      .eq('workspace_id', req.user.workspace_id)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/conversations/:id/messages - Get messages for a conversation
router.get('/:id/messages', authenticate, async (req, res) => {
  try {
    // Verify conversation belongs to workspace
    const { data: convo } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', req.params.id)
      .eq('workspace_id', req.user.workspace_id)
      .single();

    if (!convo) return res.status(404).json({ error: 'Conversation not found' });

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', req.params.id)
      .order('created_at', { ascending: true });

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/conversations/:id/messages - Send message
router.post('/:id/messages', authenticate, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Message content is required' });

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: req.params.id,
        sender_type: 'staff',
        sender_id: req.user.id,
        content
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    // Update last_message_at on conversation
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', req.params.id);

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/conversations/:id/status - Update conversation status
router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['open', 'closed', 'archived'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const { data, error } = await supabase
      .from('conversations')
      .update({ status })
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

module.exports = router;
