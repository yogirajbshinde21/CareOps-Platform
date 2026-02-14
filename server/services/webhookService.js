// server/services/webhookService.js - Outgoing webhook integration (Slack + generic)
const supabase = require('../config/supabase');

/**
 * Format payload as Slack Block Kit message for rich notifications.
 */
function formatSlackPayload(eventType, payload, workspaceName) {
  const emoji = {
    booking_created: '📅',
    contact_created: '👤',
    form_submitted: '📝',
    inventory_low: '⚠️'
  }[eventType] || '🔔';

  const title = {
    booking_created: 'New Booking',
    contact_created: 'New Contact',
    form_submitted: 'Form Submitted',
    inventory_low: 'Low Stock Alert'
  }[eventType] || eventType;

  let fields = [];
  let color = '#4f46e5'; // indigo default

  if (eventType === 'booking_created') {
    color = '#059669';
    fields = [
      { title: 'Customer', value: payload.customer?.name || 'N/A', short: true },
      { title: 'Email', value: payload.customer?.email || 'N/A', short: true },
      { title: 'Service', value: payload.service || 'N/A', short: true },
      { title: 'Date & Time', value: `${payload.date} at ${payload.time}`, short: true },
      { title: 'Status', value: (payload.status || 'pending').toUpperCase(), short: true }
    ];
  } else if (eventType === 'contact_created') {
    color = '#2563eb';
    fields = [
      { title: 'Name', value: payload.name || 'N/A', short: true },
      { title: 'Email', value: payload.email || 'N/A', short: true },
      { title: 'Phone', value: payload.phone || 'N/A', short: true },
      { title: 'Source', value: payload.source || 'N/A', short: true }
    ];
  } else if (eventType === 'form_submitted') {
    color = '#7c3aed';
    fields = [
      { title: 'Form', value: payload.form_name || 'N/A', short: true },
      { title: 'Submitted', value: payload.submitted_at || new Date().toISOString(), short: true }
    ];
  } else if (eventType === 'inventory_low') {
    color = '#d97706';
    fields = [
      { title: 'Item', value: payload.name || 'N/A', short: true },
      { title: 'Current Stock', value: `${payload.quantity} ${payload.unit || ''}`, short: true },
      { title: 'Reorder Level', value: `${payload.reorder_level}`, short: true }
    ];
  }

  return {
    text: `${emoji} ${title} — ${workspaceName}`,
    attachments: [{
      color,
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `${emoji} *${title}*  |  _${workspaceName}_` }
        },
        {
          type: 'section',
          fields: fields.map(f => ({
            type: 'mrkdwn',
            text: `*${f.title}*\n${f.value}`
          }))
        },
        {
          type: 'context',
          elements: [{ type: 'mrkdwn', text: `CareOps • ${new Date().toLocaleString()}` }]
        }
      ]
    }]
  };
}

/**
 * Detect if a URL is a Slack webhook
 */
function isSlackWebhook(url) {
  return url && (url.includes('hooks.slack.com') || url.includes('hooks.slack-gov.com'));
}

/**
 * Fire outgoing webhooks for workspace events.
 * Auto-detects Slack URLs and formats as rich Slack messages.
 * For all other URLs, sends standard JSON payload.
 */
async function fireWebhook(workspaceId, eventType, payload) {
  try {
    console.log(`🔔 [DEBUG] fireWebhook called: workspaceId=${workspaceId}, eventType=${eventType}`);
    
    // Get workspace settings
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('settings, name')
      .eq('id', workspaceId)
      .single();

    if (wsError) {
      console.log(`🔔 [DEBUG] Error fetching workspace: ${wsError.message}`);
    }
    console.log(`🔔 [DEBUG] Workspace settings:`, JSON.stringify(workspace?.settings, null, 2));

    if (!workspace?.settings?.webhooks) {
      console.log(`🔔 [DEBUG] No webhooks configured - exiting`);
      return null; // Webhooks not configured
    }

    // Support both formats:
    // Object: { enabled: true, url: "...", events: [...] }
    // Array (from onboarding): [{ url: "...", events: [...], active: true }]
    let webhookConfig = workspace.settings.webhooks;
    console.log(`🔔 [DEBUG] webhookConfig (raw):`, JSON.stringify(webhookConfig, null, 2));
    
    if (Array.isArray(webhookConfig)) {
      const active = webhookConfig.find(w => w.active && w.url);
      console.log(`🔔 [DEBUG] Array format, active webhook:`, active);
      if (!active) {
        console.log(`🔔 [DEBUG] No active webhook found in array - exiting`);
        return null;
      }
      webhookConfig = { enabled: true, url: active.url, events: active.events || [] };
    }

    if (!webhookConfig.enabled || !webhookConfig.url) {
      console.log(`🔔 [DEBUG] Webhook not enabled or no URL - exiting`);
      return null; // Webhooks not enabled
    }

    const { url, events, secret } = webhookConfig;
    console.log(`🔔 [DEBUG] Will POST to: ${url}, events filter: ${events}`);

    // Normalize event type for comparison (support both formats: booking_created and booking.created)
    const normalizedEventType = eventType.replace('_', '.');
    
    // Check if this event type is enabled
    if (events && Array.isArray(events) && !events.includes(eventType) && !events.includes(normalizedEventType)) {
      console.log(`🔔 [DEBUG] Event '${eventType}' not in allowed events [${events.join(', ')}] - exiting`);
      return null; // Event not subscribed
    }

    const webhookPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      workspace: workspace.name,
      data: payload
    };

    // Determine body based on destination (Slack gets rich formatting)
    const isSlack = isSlackWebhook(url);
    const body = isSlack
      ? JSON.stringify(formatSlackPayload(eventType, payload, workspace.name))
      : JSON.stringify(webhookPayload);

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
      body,
      signal: controller.signal
    });

    clearTimeout(timeout);

    const success = response.ok;
    console.log(`🔔 Webhook [${eventType}] → ${url} — ${success ? '✅' : '❌'} ${response.status}`);

    // Log webhook delivery (best-effort, don't await)
    supabase
      .from('automation_rules')
      .insert({
        workspace_id: workspaceId,
        name: `Webhook: ${eventType}`,
        trigger: eventType,
        conditions: { url, status: response.status },
        actions: { delivered: success, timestamp: webhookPayload.timestamp },
        is_active: true
      })
      .then(() => {})
      .catch(() => {}); // Ignore logging errors

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
