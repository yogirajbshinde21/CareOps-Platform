// server/services/webhookService.js - Outgoing webhook integration
const supabase = require('../config/supabase');

/**
 * Fire outgoing webhooks for workspace events.
 * Reads webhook URLs from workspace.settings.webhooks
 * Expected settings structure:
 * {
 *   webhooks: {
 *     enabled: true,
 *     url: "https://example.com/webhook",
 *     events: ["booking_created", "contact_created", "form_submitted", "inventory_low"]
 *   }
 * }
 */
async function fireWebhook(workspaceId, eventType, payload) {
  try {
    // Get workspace settings
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('settings, name')
      .eq('id', workspaceId)
      .single();

    if (!workspace?.settings?.webhooks?.enabled || !workspace?.settings?.webhooks?.url) {
      return null; // Webhooks not configured
    }

    const { url, events, secret } = workspace.settings.webhooks;

    // Check if this event type is enabled
    if (events && Array.isArray(events) && !events.includes(eventType)) {
      return null; // Event not subscribed
    }

    const webhookPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      workspace: workspace.name,
      data: payload
    };

    // Send webhook with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const headers = {
      'Content-Type': 'application/json',
      'X-CareOps-Event': eventType,
      'X-CareOps-Timestamp': webhookPayload.timestamp
    };

    // Add HMAC signature if secret is configured
    if (secret) {
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(webhookPayload))
        .digest('hex');
      headers['X-CareOps-Signature'] = signature;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(webhookPayload),
      signal: controller.signal
    });

    clearTimeout(timeout);

    const success = response.ok;
    console.log(`🔔 Webhook [${eventType}] → ${url} — ${success ? '✅' : '❌'} ${response.status}`);

    // Log webhook delivery
    await supabase
      .from('automation_rules')
      .insert({
        workspace_id: workspaceId,
        name: `Webhook: ${eventType}`,
        trigger: eventType,
        conditions: { url, status: response.status },
        actions: { delivered: success, timestamp: webhookPayload.timestamp },
        is_active: true
      })
      .catch(() => {}); // Best-effort logging

    return { success, status: response.status };
  } catch (err) {
    console.error(`🔔 Webhook [${eventType}] failed:`, err.message);
    return { success: false, error: err.message };
  }
}

// Convenience methods for each event type
const webhookEvents = {
  bookingCreated: (workspaceId, booking, contact, service) =>
    fireWebhook(workspaceId, 'booking_created', {
      booking_id: booking.id,
      customer: { name: contact?.name, email: contact?.email },
      service: service?.name,
      date: booking.date,
      time: booking.start_time,
      status: booking.status
    }),

  contactCreated: (workspaceId, contact) =>
    fireWebhook(workspaceId, 'contact_created', {
      contact_id: contact.id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      source: contact.source
    }),

  formSubmitted: (workspaceId, submission, form) =>
    fireWebhook(workspaceId, 'form_submitted', {
      submission_id: submission.id,
      form_name: form?.name,
      contact_id: submission.contact_id,
      submitted_at: submission.created_at
    }),

  inventoryLow: (workspaceId, item) =>
    fireWebhook(workspaceId, 'inventory_low', {
      item_id: item.id,
      name: item.name,
      quantity: item.quantity,
      reorder_level: item.reorder_level,
      unit: item.unit
    })
};

module.exports = { fireWebhook, webhookEvents };
