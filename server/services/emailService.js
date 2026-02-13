// server/services/emailService.js - Email notifications via Nodemailer + Ethereal
const nodemailer = require('nodemailer');

let transporter = null;
let etherealAccount = null;

/**
 * Initialize the email transporter.
 * Uses Ethereal (fake SMTP) for dev/demo — real SMTP can be configured via env vars.
 */
async function getTransporter() {
  if (transporter) return transporter;

  // Check if real SMTP is configured
  if (process.env.EMAIL_HOST && process.env.EMAIL_USER) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    console.log('📧 Email: Using configured SMTP server');
    return transporter;
  }

  // Fallback: Ethereal (fake SMTP for demos)
  try {
    etherealAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: etherealAccount.user,
        pass: etherealAccount.pass
      }
    });
    console.log('📧 Email: Using Ethereal test account');
    console.log(`   📬 View emails at: https://ethereal.email/login`);
    console.log(`   👤 User: ${etherealAccount.user}`);
    console.log(`   🔑 Pass: ${etherealAccount.pass}`);
    return transporter;
  } catch (err) {
    console.error('📧 Email: Failed to create Ethereal account:', err.message);
    return null;
  }
}

/**
 * Common email header/footer template
 */
function emailWrapper(content, workspaceName = 'CareOps') {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:24px;">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:12px 12px 0 0;padding:24px 32px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">${workspaceName}</h1>
        <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px;">Powered by CareOps</p>
      </div>
      <!-- Body -->
      <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        ${content}
      </div>
      <!-- Footer -->
      <div style="text-align:center;padding:16px;color:#94a3b8;font-size:11px;">
        <p>This email was sent by ${workspaceName} via CareOps</p>
      </div>
    </div>
  </body>
  </html>`;
}

/**
 * Send booking confirmation email to customer
 */
async function sendBookingConfirmation(booking, contact, service, workspace) {
  const transport = await getTransporter();
  if (!transport || !contact?.email) return null;

  const statusColor = booking.status === 'confirmed' ? '#059669' : '#f59e0b';
  const statusLabel = booking.status === 'confirmed' ? 'Confirmed' : 'Pending Confirmation';
  const dateStr = new Date(booking.date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const content = `
    <h2 style="color:#1e293b;margin:0 0 8px;font-size:18px;">Booking ${booking.status === 'confirmed' ? 'Confirmed! ✅' : 'Received! 📋'}</h2>
    <p style="color:#64748b;margin:0 0 24px;font-size:14px;">
      ${booking.status === 'confirmed' ? 'Your appointment has been confirmed.' : 'We\'ve received your booking request. You\'ll receive a confirmation shortly.'}
    </p>
    
    <div style="background:#f8fafc;border-radius:8px;padding:20px;margin-bottom:20px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:13px;width:100px;">Status</td>
          <td style="padding:6px 0;font-size:13px;font-weight:600;">
            <span style="background:${statusColor}15;color:${statusColor};padding:2px 10px;border-radius:12px;font-size:12px;">${statusLabel}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:13px;">Service</td>
          <td style="padding:6px 0;color:#1e293b;font-size:13px;font-weight:500;">${service?.name || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:13px;">Date</td>
          <td style="padding:6px 0;color:#1e293b;font-size:13px;font-weight:500;">${dateStr}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:13px;">Time</td>
          <td style="padding:6px 0;color:#1e293b;font-size:13px;font-weight:500;">${booking.start_time}${booking.end_time ? ' - ' + booking.end_time : ''}</td>
        </tr>
        ${service?.price ? `
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:13px;">Price</td>
          <td style="padding:6px 0;color:#1e293b;font-size:13px;font-weight:500;">₹${service.price}</td>
        </tr>` : ''}
        ${service?.duration ? `
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:13px;">Duration</td>
          <td style="padding:6px 0;color:#1e293b;font-size:13px;font-weight:500;">${service.duration} min</td>
        </tr>` : ''}
      </table>
    </div>
    
    ${booking.notes ? `<p style="color:#64748b;font-size:13px;margin:0 0 20px;"><strong>Notes:</strong> ${booking.notes}</p>` : ''}
    
    <p style="color:#94a3b8;font-size:12px;margin:16px 0 0;text-align:center;">
      Need to make changes? Contact us directly.
    </p>`;

  const subject = booking.status === 'confirmed'
    ? `✅ Booking Confirmed — ${service?.name || 'Appointment'} on ${dateStr}`
    : `📋 Booking Received — ${service?.name || 'Appointment'} on ${dateStr}`;

  try {
    const info = await transport.sendMail({
      from: `"${workspace?.name || 'CareOps'}" <${etherealAccount?.user || process.env.EMAIL_USER || 'noreply@careops.app'}>`,
      to: contact.email,
      subject,
      html: emailWrapper(content, workspace?.name)
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`📧 Email preview: ${previewUrl}`);
    }

    return { success: true, messageId: info.messageId, previewUrl };
  } catch (err) {
    console.error('📧 Email send failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send booking reminder email
 */
async function sendBookingReminder(booking, contact, service, workspace) {
  const transport = await getTransporter();
  if (!transport || !contact?.email) return null;

  const dateStr = new Date(booking.date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const content = `
    <h2 style="color:#1e293b;margin:0 0 8px;font-size:18px;">Reminder: Upcoming Appointment ⏰</h2>
    <p style="color:#64748b;margin:0 0 24px;font-size:14px;">
      Just a friendly reminder about your upcoming appointment.
    </p>
    
    <div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0;color:#92400e;font-size:14px;font-weight:600;">${service?.name || 'Your Appointment'}</p>
      <p style="margin:4px 0 0;color:#92400e;font-size:13px;">${dateStr} at ${booking.start_time}</p>
    </div>
    
    <p style="color:#94a3b8;font-size:12px;margin:16px 0 0;text-align:center;">
      Need to reschedule? Contact us as soon as possible.
    </p>`;

  try {
    const info = await transport.sendMail({
      from: `"${workspace?.name || 'CareOps'}" <${etherealAccount?.user || process.env.EMAIL_USER || 'noreply@careops.app'}>`,
      to: contact.email,
      subject: `⏰ Reminder: ${service?.name || 'Appointment'} tomorrow — ${dateStr}`,
      html: emailWrapper(content, workspace?.name)
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log(`📧 Reminder preview: ${previewUrl}`);

    return { success: true, messageId: info.messageId, previewUrl };
  } catch (err) {
    console.error('📧 Reminder failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send staff invite email
 */
async function sendStaffInvite(email, staffName, inviterName, workspaceName, tempPassword) {
  const transport = await getTransporter();
  if (!transport) return null;

  const content = `
    <h2 style="color:#1e293b;margin:0 0 8px;font-size:18px;">You're Invited! 🎉</h2>
    <p style="color:#64748b;margin:0 0 24px;font-size:14px;">
      ${inviterName} has invited you to join <strong>${workspaceName}</strong> on CareOps.
    </p>
    
    <div style="background:#f0fdf4;border-radius:8px;padding:20px;margin-bottom:20px;">
      <p style="margin:0 0 12px;color:#166534;font-size:14px;font-weight:600;">Your Login Credentials</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:4px 0;color:#64748b;font-size:13px;width:100px;">Email</td>
          <td style="padding:4px 0;color:#1e293b;font-size:13px;font-weight:500;">${email}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#64748b;font-size:13px;">Password</td>
          <td style="padding:4px 0;color:#1e293b;font-size:13px;font-weight:500;font-family:monospace;">${tempPassword}</td>
        </tr>
      </table>
    </div>
    
    <p style="color:#dc2626;font-size:12px;margin:0 0 16px;">⚠️ Please change your password after first login.</p>`;

  try {
    const info = await transport.sendMail({
      from: `"${workspaceName}" <${etherealAccount?.user || process.env.EMAIL_USER || 'noreply@careops.app'}>`,
      to: email,
      subject: `🎉 You're invited to ${workspaceName} on CareOps`,
      html: emailWrapper(content, workspaceName)
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log(`📧 Invite preview: ${previewUrl}`);

    return { success: true, messageId: info.messageId, previewUrl };
  } catch (err) {
    console.error('📧 Invite email failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send welcome email to new contact
 */
async function sendWelcomeEmail(contact, workspace) {
  const transport = await getTransporter();
  if (!transport || !contact?.email) return null;

  const content = `
    <h2 style="color:#1e293b;margin:0 0 8px;font-size:18px;">Welcome to ${workspace?.name}! 👋</h2>
    <p style="color:#64748b;margin:0 0 24px;font-size:14px;">
      Thanks for reaching out to us. We've received your message and will get back to you shortly.
    </p>
    
    <div style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0;color:#1e40af;font-size:14px;font-weight:600;">Next Steps</p>
      <p style="margin:4px 0 0;color:#1e40af;font-size:13px;">Our team is reviewing your inquiry. In the meantime, feel free to browse our services or book an appointment directly.</p>
    </div>
    
    <p style="text-align:center;margin-top:24px;">
      <a href="${process.env.VITE_APP_URL || 'http://localhost:5173'}/book/${workspace?.slug}" style="background:#4f46e5;color:white;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600;">Book an Appointment</a>
    </p>`;

  try {
    const info = await transport.sendMail({
      from: `"${workspace?.name || 'CareOps'}" <${etherealAccount?.user || process.env.EMAIL_USER || 'noreply@careops.app'}>`,
      to: contact.email,
      subject: `👋 Welcome to ${workspace?.name}`,
      html: emailWrapper(content, workspace?.name)
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log(`📧 Welcome email preview: ${previewUrl}`);

    return { success: true, messageId: info.messageId, previewUrl };
  } catch (err) {
    console.error('📧 Welcome email failed:', err.message);
    return { success: false, error: err.message };
  }
}



/**
 * Send low stock alert to owner
 */
async function sendLowStockAlert(item, workspace) {
  const transport = await getTransporter();
  // In a real app we'd get the owner's email. For prototype we'll use a placeholder or the workspace email if available.
  // We'll just log it clearly for the demo if no email is easily available without an extra query.
  // Actually, let's assume we pass the email.
  const ownerEmail = workspace?.email || 'owner@careops.demo'; 
  
  if (!transport) return null;

  const content = `
    <h2 style="color:#b45309;margin:0 0 8px;font-size:18px;">⚠️ Low Stock Alert: ${item.name}</h2>
    <p style="color:#64748b;margin:0 0 24px;font-size:14px;">
      Inventory item <strong>${item.name}</strong> has fallen below the reorder level.
    </p>
    
    <div style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0;color:#92400e;font-size:14px;font-weight:600;">Current Stock Level</p>
      <div style="display:flex;align-items:center;gap:10px;margin-top:8px;">
        <span style="font-size:24px;font-weight:700;color:#b45309;">${item.quantity}</span>
        <span style="color:#92400e;font-size:14px;">${item.unit}</span>
      </div>
      <p style="margin:8px 0 0;color:#b45309;font-size:12px;">Reorder Level: ${item.reorder_level}</p>
    </div>
    
    <p style="text-align:center;margin-top:24px;">
      <a href="${process.env.VITE_APP_URL || 'http://localhost:5173'}/inventory" style="background:#f59e0b;color:white;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600;">Manage Inventory</a>
    </p>`;

  try {
    const info = await transport.sendMail({
      from: `"${workspace?.name || 'CareOps'}" <${etherealAccount?.user || process.env.EMAIL_USER || 'noreply@careops.app'}>`,
      to: ownerEmail,
      subject: `⚠️ Low Stock: ${item.name} is running low`,
      html: emailWrapper(content, workspace?.name)
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log(`📧 Low stock alert preview: ${previewUrl}`);

    return { success: true, messageId: info.messageId, previewUrl };
  } catch (err) {
    console.error('📧 Low stock alert failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send intake form email to customer after booking
 */
async function sendFormEmail(contact, form, booking, workspace, formUrl) {
  const transport = await getTransporter();
  if (!transport || !contact?.email) return null;

  const dateStr = booking?.date
    ? new Date(booking.date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  const content = `
    <h2 style="color:#1e293b;margin:0 0 8px;font-size:18px;">Please Complete Your Intake Form 📋</h2>
    <p style="color:#64748b;margin:0 0 24px;font-size:14px;">
      Hi ${contact.name || 'there'}, to make your upcoming appointment as smooth as possible, please fill out the form below.
    </p>
    
    ${dateStr ? `
    <div style="background:#f8fafc;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0;color:#64748b;font-size:12px;font-weight:500;">YOUR APPOINTMENT</p>
      <p style="margin:4px 0 0;color:#1e293b;font-size:14px;font-weight:600;">${dateStr} at ${booking.start_time}</p>
    </div>` : ''}
    
    <div style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0;color:#1e40af;font-size:14px;font-weight:600;">📝 ${form.name}</p>
      ${form.description ? `<p style="margin:4px 0 0;color:#1e40af;font-size:13px;">${form.description}</p>` : ''}
    </div>

    <p style="text-align:center;margin-top:24px;">
      <a href="${formUrl}" style="background:#4f46e5;color:white;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;display:inline-block;">Fill Out Form →</a>
    </p>
    
    <p style="color:#94a3b8;font-size:12px;margin:20px 0 0;text-align:center;">
      Please complete this form before your appointment.
    </p>`;

  try {
    const info = await transport.sendMail({
      from: `"${workspace?.name || 'CareOps'}" <${etherealAccount?.user || process.env.EMAIL_USER || 'noreply@careops.app'}>`,
      to: contact.email,
      subject: `📋 Please complete: ${form.name} — ${workspace?.name || 'CareOps'}`,
      html: emailWrapper(content, workspace?.name)
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log(`📧 Form email preview: ${previewUrl}`);

    return { success: true, messageId: info.messageId, previewUrl };
  } catch (err) {
    console.error('📧 Form email failed:', err.message);
    return { success: false, error: err.message };
  }
}

// Initialize transporter on startup
getTransporter().catch(() => {});

module.exports = { sendBookingConfirmation, sendBookingReminder, sendStaffInvite, sendWelcomeEmail, sendLowStockAlert, sendFormEmail, getTransporter };
