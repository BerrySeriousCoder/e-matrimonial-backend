import { Resend } from 'resend';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { emailUnsubscribes, emailLogs } from '../db/schema';

const resend = new Resend(process.env.RESEND_API_KEY!);

// Attachment format (compatible with Resend)
export interface EmailAttachment {
  content: string; // Base64 encoded content
  filename: string;
  type: string; // MIME type
  disposition?: 'attachment' | 'inline';
  contentId?: string; // For inline images
}

export interface EmailLogMetadata {
  senderEmail: string;
  postId?: number;
  userId?: number;
  emailType: string;
  userMessage?: string;
  attachmentMeta?: { key: string; filename: string; mimeType: string; sizeBytes: number }[];
}

// Check if an email is unsubscribed
async function isUnsubscribed(email: string): Promise<boolean> {
  const result = await db.select().from(emailUnsubscribes).where(eq(emailUnsubscribes.email, email));
  return result.length > 0;
}

// Generate a signed unsubscribe URL for a given email
function generateUnsubscribeUrl(email: string): string {
  const token = jwt.sign({ email }, process.env.JWT_SECRET!, { expiresIn: '90d' });
  const baseUrl = process.env.CLIENT_BASE_URL || 'http://localhost:4000';
  const backendUrl = baseUrl.replace(':3000', ':4000');
  return `${backendUrl}/api/unsubscribe?token=${token}`;
}

async function logEmailTransaction(params: {
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  messageText?: string;
  messageHtml?: string;
  emailType: string;
  postId?: number;
  userId?: number;
  attachments?: { key: string; filename: string; mimeType: string; sizeBytes: number }[];
  resendMessageId?: string;
  status: string;
}): Promise<void> {
  try {
    await db.insert(emailLogs).values({
      senderEmail: params.senderEmail,
      recipientEmail: params.recipientEmail,
      subject: params.subject,
      messageText: params.messageText || null,
      messageHtml: params.messageHtml || null,
      emailType: params.emailType,
      postId: params.postId || null,
      userId: params.userId || null,
      attachments: params.attachments && params.attachments.length > 0 ? params.attachments : null,
      resendMessageId: params.resendMessageId || null,
      status: params.status,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to log email transaction:', err);
  }
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
  logMetadata,
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
  logMetadata?: EmailLogMetadata;
}) {
  if (!process.env.RESEND_API_KEY) {
    const error = new Error('RESEND_API_KEY is not configured');
    console.error('Resend configuration error:', error.message);
    throw error;
  }
  if (!process.env.RESEND_FROM_EMAIL && !from) {
    const error = new Error('RESEND_FROM_EMAIL is not configured and no from address provided');
    console.error('Resend configuration error:', error.message);
    throw error;
  }

  // Suppression check: skip sending if recipient has unsubscribed (only for non-transactional emails)
  if (!disableUnsubscribe) {
    const unsubscribed = await isUnsubscribed(to);
    if (unsubscribed) {
      console.log(`Email suppressed (unsubscribed): ${to}, subject: ${subject}`);

      if (logMetadata) {
        await logEmailTransaction({
          senderEmail: logMetadata.senderEmail,
          recipientEmail: to,
          subject,
          messageText: logMetadata.userMessage || text,
          messageHtml: html,
          emailType: logMetadata.emailType,
          postId: logMetadata.postId,
          userId: logMetadata.userId,
          attachments: logMetadata.attachmentMeta,
          status: 'suppressed',
        });
      }

      return { data: null, error: null, suppressed: true };
    }
  }

  // Build headers — auto-generate unsubscribe URL if not provided
  const headers: Record<string, string> = {};
  if (!disableUnsubscribe) {
    const autoUnsubUrl = unsubscribeUrl || generateUnsubscribeUrl(to);
    headers['List-Unsubscribe'] = `<${autoUnsubUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  // Build attachments for Resend format
  const resendAttachments = attachments?.map(att => ({
    content: Buffer.from(att.content, 'base64'),
    filename: att.filename,
  }));

  try {
    console.log('Attempting to send email via Resend:', {
      to,
      from: from || process.env.RESEND_FROM_EMAIL,
      subject,
      hasHtml: !!html,
      hasText: !!text,
      replyTo,
      attachmentCount: attachments?.length || 0,
    });

    const result = await resend.emails.send({
      from: from || process.env.RESEND_FROM_EMAIL!,
      to,
      subject,
      text,
      html: html || undefined,
      replyTo: replyTo || undefined,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      attachments: resendAttachments && resendAttachments.length > 0 ? resendAttachments : undefined,
    });

    if (result.error) {
      console.error('Resend send error:', {
        error: result.error,
        emailDetails: { to, from: from || process.env.RESEND_FROM_EMAIL, subject, replyTo },
      });

      if (logMetadata) {
        await logEmailTransaction({
          senderEmail: logMetadata.senderEmail,
          recipientEmail: to,
          subject,
          messageText: logMetadata.userMessage || text,
          messageHtml: html,
          emailType: logMetadata.emailType,
          postId: logMetadata.postId,
          userId: logMetadata.userId,
          attachments: logMetadata.attachmentMeta,
          status: 'failed',
        });
      }

      throw new Error(result.error.message);
    }

    console.log('Resend email sent successfully:', {
      to,
      subject,
      id: result.data?.id,
    });

    if (logMetadata) {
      await logEmailTransaction({
        senderEmail: logMetadata.senderEmail,
        recipientEmail: to,
        subject,
        messageText: logMetadata.userMessage || text,
        messageHtml: html,
        emailType: logMetadata.emailType,
        postId: logMetadata.postId,
        userId: logMetadata.userId,
        attachments: logMetadata.attachmentMeta,
        resendMessageId: result.data?.id,
        status: 'sent',
      });
    }

    return result;
  } catch (error: any) {
    console.error('Resend send error:', {
      message: error?.message,
      name: error?.name,
      statusCode: error?.statusCode,
      emailDetails: {
        to,
        from: from || process.env.RESEND_FROM_EMAIL,
        subject,
        replyTo,
      },
    });

    if (logMetadata && error?.message !== 'RESEND_API_KEY is not configured') {
      await logEmailTransaction({
        senderEmail: logMetadata.senderEmail,
        recipientEmail: to,
        subject,
        messageText: logMetadata.userMessage || text,
        messageHtml: html,
        emailType: logMetadata.emailType,
        postId: logMetadata.postId,
        userId: logMetadata.userId,
        attachments: logMetadata.attachmentMeta,
        status: 'failed',
      });
    }

    throw error;
  }
}

export { generateUnsubscribeUrl };