import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

// SendGrid attachment format
export interface EmailAttachment {
  content: string; // Base64 encoded content
  filename: string;
  type: string; // MIME type
  disposition?: 'attachment' | 'inline';
  contentId?: string; // For inline images
}

export async function sendEmail({
  to,
  from,
  subject,
  text,
  html,
  replyTo,
  unsubscribeUrl,
  disableUnsubscribe,
  attachments,
}: {
  to: string;
  from?: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  unsubscribeUrl?: string;
  disableUnsubscribe?: boolean;
  attachments?: EmailAttachment[];
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
  if (attachments && attachments.length > 0) {
    msg.attachments = attachments.map(att => ({
      content: att.content,
      filename: att.filename,
      type: att.type,
      disposition: att.disposition || 'attachment',
      ...(att.contentId ? { content_id: att.contentId } : {}),
    }));
  }
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

  // Validate environment variables
  if (!process.env.SENDGRID_API_KEY) {
    const error = new Error('SENDGRID_API_KEY is not configured');
    console.error('SendGrid configuration error:', error.message);
    throw error;
  }
  if (!process.env.SENDGRID_FROM_EMAIL && !from) {
    const error = new Error('SENDGRID_FROM_EMAIL is not configured and no from address provided');
    console.error('SendGrid configuration error:', error.message);
    throw error;
  }

  try {
    console.log('Attempting to send email via SendGrid:', {
      to,
      from: msg.from,
      subject,
      hasHtml: !!html,
      hasText: !!text,
      replyTo: msg.replyTo,
      attachmentCount: attachments?.length || 0,
    });

    const result = await sgMail.send(msg);
    console.log('SendGrid email sent successfully:', {
      to,
      subject,
      statusCode: result[0]?.statusCode,
      headers: result[0]?.headers
    });
    return result;
  } catch (error: any) {
    // Log detailed SendGrid error information
    console.error('SendGrid send error:', {
      message: error?.message,
      code: error?.code,
      statusCode: error?.response?.statusCode,
      body: error?.response?.body,
      headers: error?.response?.headers,
      emailDetails: {
        to,
        from: msg.from,
        subject,
        replyTo: msg.replyTo
      }
    });

    // If SendGrid provides error details, include them
    if (error?.response?.body) {
      const errorDetails = typeof error.response.body === 'string' 
        ? error.response.body 
        : JSON.stringify(error.response.body);
      console.error('SendGrid error details:', errorDetails);
    }

    throw error;
  }
} 