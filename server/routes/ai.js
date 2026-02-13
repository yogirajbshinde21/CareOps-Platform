// server/routes/ai.js - AI-powered onboarding routes
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const supabase = require('../config/supabase');

const { processOnboardingInput, generateSmartReply, generateDashboardInsights, processBookingAssistant } = require('../services/aiService');

// POST /api/ai/process-voice - Process voice/text input for onboarding
router.post('/process-voice', authenticate, async (req, res) => {
  try {
    const { input, conversationHistory } = req.body;

    if (!input || !input.trim()) {
      return res.status(400).json({ error: 'Please provide some input about your business' });
    }

    const result = await processOnboardingInput(input.trim(), conversationHistory || []);
    res.json(result);
  } catch (err) {
    console.error('AI route error:', err);
    res.status(500).json({ error: 'AI processing failed' });
  }
});

// POST /api/ai/suggest-reply - Generate smart reply
router.post('/suggest-reply', authenticate, async (req, res) => {
  try {
    const { draft, conversationHistory } = req.body;
    if (!conversationHistory || !Array.isArray(conversationHistory)) {
      return res.status(400).json({ error: 'Conversation history is required' });
    }

    // Fetch workspace name for context
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', req.user.workspace_id)
      .single();

    const result = await generateSmartReply(draft || '', conversationHistory, workspace?.name || 'CareOps');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Smart reply failed' });
  }
});

// POST /api/ai/insights - Generate business insights
router.post('/insights', authenticate, async (req, res) => {
  try {
    const { businessData } = req.body;
    if (!businessData) {
      return res.status(400).json({ error: 'Business data is required' });
    }

    const result = await generateDashboardInsights(businessData);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Insights generation failed' });
  }
});

// POST /api/ai/booking-assistant - Public voice assistant for booking
router.post('/booking-assistant', async (req, res) => {
  try {
    const { message, history, context } = req.body;
    const result = await processBookingAssistant(message, history, context, null);
    res.json(result);
  } catch (err) {
    console.error('Booking Assistant Route Error:', err);
    res.status(500).json({ error: 'Booking assistant failed' });
  }
});

module.exports = router;
