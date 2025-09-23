import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export async function sendEmail({
  to,
  from,
  subject,
  text,
  html,
  replyTo,
  unsubscribeUrl,
  disableUnsubscribe,
}: {
  to: string;
  from?: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  unsubscribeUrl?: string;
  disableUnsubscribe?: boolean;
}) {
  const msg: any = {
    to,
    from: from || process.env.SENDGRID_FROM_EMAIL!,
    subject,
    text,
    html,
    // Enable/disable SendGrid Subscription Tracking and ASM per email
    asm: !disableUnsubscribe && process.env.SENDGRID_UNSUB_GROUP_ID ? { groupId: Number(process.env.SENDGRID_UNSUB_GROUP_ID) } : undefined,
    trackingSettings: disableUnsubscribe ? { subscriptionTracking: { enable: false } } : { subscriptionTracking: { enable: true } },
    mailSettings: {
      sandboxMode: { enable: false },
    },
  };
  if (replyTo) msg.replyTo = replyTo;
  // Add List-Unsubscribe headers for native Gmail/Outlook UI
  // Prefer SendGrid-hosted unsubscribe (provided when Subscription Tracking is enabled)
  // If caller provides a fallback unsubscribeUrl, include it as well.
  if (!disableUnsubscribe) {
    const headers: Record<string, string> = {};
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    if (unsubscribeUrl) {
      headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`;
    }
    if (Object.keys(headers).length > 0) {
      msg.headers = { ...(msg.headers || {}), ...headers };
    }
  }
  await sgMail.send(msg);
} 