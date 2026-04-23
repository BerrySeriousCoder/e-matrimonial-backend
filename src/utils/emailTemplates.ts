import { generateUnsubscribeUrl } from './sendEmail';

/**
 * Converts HTML to plain text while preserving list structure.
 * Handles bullet lists, numbered lists, paragraphs, and line breaks.
 */
export function htmlToPlainText(html: string): string {
  if (!html) return '';
  
  let text = html;
  
  // Handle ordered lists - convert to numbered format
  let olCounter = 0;
  text = text.replace(/<ol[^>]*>/gi, () => {
    olCounter = 0;
    return '';
  });
  text = text.replace(/<\/ol>/gi, '\n');
  
  // Handle list items within ordered lists (detected by tracking)
  // We'll use a two-pass approach: first mark OL items, then process
  
  // For simplicity, convert all list items uniformly
  // Detect if we're in an ordered list context by checking preceding tags
  text = text
    // Handle closing tags that should add newlines
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // Handle list item opening tags - add bullet point
    .replace(/<li[^>]*>/gi, '• ')
    // Remove ordered/unordered list tags
    .replace(/<\/?[ou]l[^>]*>/gi, '')
    // Remove all remaining HTML tags
    .replace(/<[^>]*>/g, '')
    // Decode common HTML entities
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    // Clean up excessive whitespace
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
  
  return text;
}

export function brandWrapper(subject: string, bodyHtml: string, bodyText: string, showUnsubscribe: boolean = true, unsubscribeUrl?: string) {
  const unsubscribeFooter = showUnsubscribe ? `
          <tr>
            <td style="padding:16px 24px;border-top:1px solid #eef2f7;color:#475467;font-size:12px;">
              <div>You're receiving this email from e-matrimonial.in.</div>
              <div style="margin-top:6px;">${unsubscribeUrl
      ? `<a href="${unsubscribeUrl}" style="color:#6366f1;text-decoration:underline;">Unsubscribe</a> from these emails.`
      : 'To stop receiving these, use the Unsubscribe link below.'
    }</div>
            </td>
          </tr>` : '';
  const html = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fb;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;box-shadow:0 4px 18px rgba(16,24,40,0.06);overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#101828;">
          <tr>
            <td style="background:#1f2937;color:#fff;padding:20px 24px;">
              <div style="font-size:18px;font-weight:700;">e-matrimonial.in</div>
              <div style="opacity:.9;font-size:14px;margin-top:4px;">${subject}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;line-height:1.6;">
              ${bodyHtml}
            </td>
          </tr>
          ${unsubscribeFooter}
        </table>
      </td>
    </tr>
  </table>`;
  const unsubscribeText = showUnsubscribe
    ? (unsubscribeUrl ? `\n\nUnsubscribe: ${unsubscribeUrl}` : `\n\nUnsubscribe available via your email provider's unsubscribe button.`)
    : '';
  const text = `e-matrimonial.in\n${subject}\n\n${bodyText}${unsubscribeText}`;
  return { html, text };
}

export function brandWrapperBasic(subject: string, bodyHtml: string, bodyText: string) {
  const html = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fb;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;box-shadow:0 4px 18px rgba(16,24,40,0.06);overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#101828;">
          <tr>
            <td style="background:#1f2937;color:#fff;padding:16px 20px;font-weight:700;">e-matrimonial.in</td>
          </tr>
          <tr>
            <td style="padding:22px 24px;line-height:1.6;">
              <div style="font-size:16px;color:#111827;margin:0 0 6px;">${subject}</div>
              ${bodyHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
  const text = `e-matrimonial.in\n${subject}\n\n${bodyText}`;
  return { html, text };
}

export function tmplOtp(params: { otp: string }) {
  const subject = `Your OTP is ${params.otp} - e-matrimonial.in`;
  const bodyHtml = `
    <p style="margin:0 0 12px;color:#475467;">Use this code to continue. It expires in 10 minutes.</p>
    <div style="margin:16px 0 8px;">
      <div style="display:inline-block;background:#111827;color:#ffffff;padding:12px 20px;border-radius:10px;font-size:24px;letter-spacing:4px;font-weight:700;">${params.otp}</div>
    </div>
    <p style="margin:12px 0 0;color:#667085;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
  `;
  const bodyText = `Your OTP is: ${params.otp}\nIt is valid for 10 minutes.`;
  return brandWrapperBasic(subject, bodyHtml, bodyText);
}

export function tmplDataEntrySubmitted(params: { email: string; content: string; lookingFor?: string }) {
  const excerpt = (params.content || '').slice(0, 140);
  const subject = 'Your ad request was submitted on your behalf';
  const bodyHtml = `
    <p>Hello ${params.email},</p>
    <p>We received a matrimonial advertisement request submitted on your behalf.</p>
    <ul>
      ${params.lookingFor ? `<li><strong>I am looking for:</strong> ${params.lookingFor}</li>` : ''}
      <li><strong>Preview:</strong> ${excerpt}${params.content.length > 140 ? '…' : ''}</li>
      <li><strong>Status:</strong> Pending admin approval</li>
    </ul>
    <p>You will receive another email once your ad is published.</p>
  `;
  const bodyText = `Hello ${params.email},
We received a matrimonial advertisement request submitted on your behalf.
${params.lookingFor ? `I am looking for: ${params.lookingFor}\n` : ''}Preview: ${excerpt}${params.content.length > 140 ? '…' : ''}
Status: Pending admin approval.
You will receive another email once your ad is published.`;
  return brandWrapper(subject, bodyHtml, bodyText, true, generateUnsubscribeUrl(params.email));
}

export function tmplClientSubmitted(params: { email: string; content: string; lookingFor?: string }) {
  const excerpt = (params.content || '').slice(0, 140);
  const subject = 'Your ad request was submitted';
  const bodyHtml = `
    <p>Hello ${params.email},</p>
    <p>Thank you for submitting your matrimonial advertisement.</p>
    <ul>
      ${params.lookingFor ? `<li><strong>I am looking for:</strong> ${params.lookingFor}</li>` : ''}
      <li><strong>Preview:</strong> ${excerpt}${params.content.length > 140 ? '…' : ''}</li>
      <li><strong>Status:</strong> Pending admin approval</li>
    </ul>
    <p>We will notify you once your ad is approved and published.</p>
  `;
  const bodyText = `Hello ${params.email},
Thank you for submitting your matrimonial advertisement.
${params.lookingFor ? `I am looking for: ${params.lookingFor}\n` : ''}Preview: ${excerpt}${params.content.length > 140 ? '…' : ''}
Status: Pending admin approval.
We will notify you once your ad is approved and published.`;
  return brandWrapper(subject, bodyHtml, bodyText);
}

export function tmplPublished(params: { email: string; expiresAt?: Date; postId?: number; content?: string }) {
  const subject = 'Your ad has been published';
  const siteUrl = process.env.CLIENT_BASE_URL || process.env.FRONTEND_URL || 'https://e-matrimonials.com';
  const viewAdUrl = params.postId ? `${siteUrl}/?highlight=${params.postId}` : siteUrl;

  // Convert HTML to plain text while preserving list structure, then truncate
  const contentPlainText = params.content ? htmlToPlainText(params.content) : '';
  const contentPreview = contentPlainText.slice(0, 200) + (contentPlainText.length > 200 ? '…' : '');
  const safePreview = contentPreview.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

  const bodyHtml = `
    <p>Hello ${params.email},</p>
    <p style="font-size:18px;color:#059669;font-weight:600;margin:16px 0;">🎉 CONGRATULATIONS! Your matrimonial advertisement is now live!</p>
    <p style="color:#475467;margin:0 0 16px;">We look forward to providing a very beautiful experience during your journey of finding the perfect soulmate. In case you need absolutely any assistance, please directly contact us at <a href="mailto:superadmin@e-matrimonial.in" style="color:#6366f1;">superadmin@e-matrimonial.in</a></p>
    ${contentPreview ? `
    <div style="background:#f9fafb;border:1px solid #eef2f7;border-radius:8px;padding:16px;margin:16px 0;">
      <div style="color:#475467;font-size:12px;margin-bottom:8px;font-weight:600;">Your Ad Preview</div>
      <div style="color:#101828;font-size:14px;line-height:1.6;">${safePreview}</div>
    </div>
    ` : ''}
    ${params.expiresAt ? `<p><strong>Expires on:</strong> ${params.expiresAt.toDateString()}</p>` : ''}
    <div style="margin:24px 0;text-align:center;">
      <a href="${viewAdUrl}" 
         style="background-color:#1f2937;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;font-size:16px;">
        View Your Ad
      </a>
    </div>
    <p style="color:#667085;font-size:13px;margin-top:16px;">Click the button above to see your ad live on e-matrimonial.in. You can share this link with family and friends!</p>
    <p>Thank you for using e-matrimonial.in.</p>
  `;
  const bodyText = `Hello ${params.email},

CONGRATULATIONS! Your matrimonial advertisement is now live!

We look forward to providing a very beautiful experience during your journey of finding the perfect soulmate. In case you need absolutely any assistance, please directly contact us at superadmin@e-matrimonial.in
${contentPreview ? `\nYour Ad Preview:\n${contentPreview}\n` : ''}
${params.expiresAt ? `Expires on: ${params.expiresAt.toDateString()}\n` : ''}
View your ad: ${viewAdUrl}

Thank you for using e-matrimonial.in.`;
  return brandWrapper(subject, bodyHtml, bodyText, false);
}

export function tmplPaymentRequired(params: { email: string; paymentLink: string; amount: number; postId: number }) {
  const subject = 'Payment required to publish your ad';
  const bodyHtml = `
    <p>Hello ${params.email},</p>
    <p>Great news! Your matrimonial advertisement has been approved and is ready to be published.</p>
    <p>To complete the publication process, please make a payment of <strong>₹${params.amount.toLocaleString('en-IN')}</strong>.</p>
    <div style="margin: 20px 0; text-align: center;">
      <a href="${params.paymentLink}" 
         style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
        Pay Now - ₹${params.amount.toLocaleString('en-IN')}
      </a>
    </div>
    <p><strong>Payment Link:</strong> <a href="${params.paymentLink}">${params.paymentLink}</a></p>
    <p><strong>Post ID:</strong> ${params.postId}</p>
    <p>Once payment is completed, your ad will be automatically published and you'll receive a confirmation email.</p>
    <p>If you have any questions, please contact our support team.</p>
  `;
  const bodyText = `Hello ${params.email},
Great news! Your matrimonial advertisement has been approved and is ready to be published.
To complete the publication process, please make a payment of ₹${params.amount.toLocaleString('en-IN')}.

Payment Link: ${params.paymentLink}
Post ID: ${params.postId}

Once payment is completed, your ad will be automatically published and you'll receive a confirmation email.
If you have any questions, please contact our support team.`;
  return brandWrapper(subject, bodyHtml, bodyText, false);
}

export function tmplNewMessageToPoster(params: {
  toEmail: string;
  fromEmail: string;
  contentPreview: string;
  lookingFor: string;
  message: string;
}) {
  const subject = `[${params.lookingFor} - "${params.contentPreview}"] New message from ${params.fromEmail}`;
  const safePreview = params.contentPreview.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Message comes from rich text editor and is already sanitized - render HTML
  // Convert to plain text while preserving list structure
  const plainTextMessage = htmlToPlainText(params.message);
  
  // Add inline styles for lists to ensure consistent rendering across email clients
  const styledMessage = params.message
    .replace(/<ul>/gi, '<ul style="margin:8px 0;padding-left:20px;list-style-type:disc;">')
    .replace(/<ol>/gi, '<ol style="margin:8px 0;padding-left:20px;list-style-type:decimal;">')
    .replace(/<li>/gi, '<li style="margin:4px 0;">');
  
  const bodyHtml = `
    <p>Hello ${params.toEmail},</p>
    <p>You received a new message for your "${params.lookingFor}" post:</p>
    <div style="background:#f9fafb;border:1px solid #eef2f7;border-radius:8px;padding:12px 14px;margin:10px 0 14px;">
      <div style="color:#475467;font-size:12px;margin-bottom:6px;">Post Preview</div>
      <div style="color:#101828;font-weight:600;">"${safePreview}"</div>
    </div>
    <div style="background:#f9fafb;border:1px solid #eef2f7;border-radius:8px;padding:12px 14px;margin:0 0 14px;">
      <div style="color:#475467;font-size:12px;margin-bottom:6px;">Message</div>
      <div style="color:#101828;">${styledMessage}</div>
    </div>
    <p style="margin-top:12px;color:#475467;">Reply directly to this email to respond.</p>
  `;
  const bodyText = `You received a new message for your "${params.lookingFor}" post\n\nPost Preview: "${params.contentPreview}"\n\n${plainTextMessage}\n\nReply directly to this email to respond.`;
  return brandWrapper(subject, bodyHtml, bodyText, true, generateUnsubscribeUrl(params.toEmail));
}

export function tmplPostArchived(params: { email: string; contentPreview: string; reason?: string }) {
  const subject = 'Your ad has been archived';
  const safePreview = params.contentPreview.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const reasonHtml = params.reason
    ? `
    <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px 14px;margin:16px 0;">
      <div style="color:#92400e;font-size:12px;font-weight:600;margin-bottom:6px;">Reason</div>
      <div style="color:#78350f;">${params.reason.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    </div>`
    : '';
  const bodyHtml = `
    <p>Hello ${params.email},</p>
    <p>Your matrimonial advertisement has been archived by our team.</p>
    <div style="background:#f9fafb;border:1px solid #eef2f7;border-radius:8px;padding:12px 14px;margin:10px 0 14px;">
      <div style="color:#475467;font-size:12px;margin-bottom:6px;">Ad Preview</div>
      <div style="color:#101828;font-weight:600;">"${safePreview}"</div>
    </div>
    ${reasonHtml}
    <p>If you believe this was done in error or have any questions, please contact our support team.</p>
    <p>Thank you for using e-matrimonial.in.</p>
  `;
  const bodyText = `Hello ${params.email},
Your matrimonial advertisement has been archived by our team.

Ad Preview: "${params.contentPreview}"
${params.reason ? `\nReason: ${params.reason}\n` : ''}
If you believe this was done in error or have any questions, please contact our support team.
Thank you for using e-matrimonial.in.`;
  return brandWrapper(subject, bodyHtml, bodyText);
}

export function tmplPostDeleted(params: { email: string; contentPreview: string; reason?: string }) {
  const subject = 'Your ad has been removed';
  const safePreview = params.contentPreview.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const reasonHtml = params.reason
    ? `
    <div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:12px 14px;margin:16px 0;">
      <div style="color:#991b1b;font-size:12px;font-weight:600;margin-bottom:6px;">Reason</div>
      <div style="color:#7f1d1d;">${params.reason.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    </div>`
    : '';
  const bodyHtml = `
    <p>Hello ${params.email},</p>
    <p>Your matrimonial advertisement has been removed by our team.</p>
    <div style="background:#f9fafb;border:1px solid #eef2f7;border-radius:8px;padding:12px 14px;margin:10px 0 14px;">
      <div style="color:#475467;font-size:12px;margin-bottom:6px;">Ad Preview</div>
      <div style="color:#101828;font-weight:600;">"${safePreview}"</div>
    </div>
    ${reasonHtml}
    <p>If you believe this was done in error or have any questions, please contact our support team.</p>
    <p>Thank you for using e-matrimonial.in.</p>
  `;
  const bodyText = `Hello ${params.email},
Your matrimonial advertisement has been removed by our team.

Ad Preview: "${params.contentPreview}"
${params.reason ? `\nReason: ${params.reason}\n` : ''}
If you believe this was done in error or have any questions, please contact our support team.
Thank you for using e-matrimonial.in.`;
  return brandWrapper(subject, bodyHtml, bodyText);
}

export function tmplExpiryReminder(params: {
  email: string;
  postId: number;
  content: string;
  expiresAt: Date;
  extendUrl: string;
}) {
  const subject = 'Your ad is expiring soon — extend it now!';
  const siteUrl = process.env.CLIENT_BASE_URL || process.env.FRONTEND_URL || 'https://e-matrimonials.com';
  const viewAdUrl = `${siteUrl}/?highlight=${params.postId}`;
  
  // Convert HTML to plain text while preserving list structure, then truncate
  const contentPlainText = params.content ? htmlToPlainText(params.content) : '';
  const contentPreview = contentPlainText.slice(0, 200) + (contentPlainText.length > 200 ? '…' : '');
  const safePreview = contentPreview.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

  // Calculate time remaining
  const now = new Date();
  const diff = params.expiresAt.getTime() - now.getTime();
  const hoursLeft = Math.max(0, Math.floor(diff / (1000 * 60 * 60)));
  const timeLeftText = hoursLeft > 24
    ? `${Math.floor(hoursLeft / 24)} day(s) and ${hoursLeft % 24} hour(s)`
    : `${hoursLeft} hour(s)`;

  const bodyHtml = `
    <p>Hello ${params.email},</p>
    <p style="font-size:16px;color:#dc2626;font-weight:600;margin:16px 0;">⏰ Your matrimonial advertisement is expiring in ${timeLeftText}!</p>
    ${contentPreview ? `
    <div style="background:#f9fafb;border:1px solid #eef2f7;border-radius:8px;padding:16px;margin:16px 0;">
      <div style="color:#475467;font-size:12px;margin-bottom:8px;font-weight:600;">Your Ad Preview</div>
      <div style="color:#101828;font-size:14px;line-height:1.6;">${safePreview}</div>
    </div>
    ` : ''}
    <p><strong>Expires on:</strong> ${params.expiresAt.toDateString()} at ${params.expiresAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
    <p>Don't let your ad go offline! Extend it for 2 more weeks with a single click:</p>
    <div style="margin:24px 0;text-align:center;">
      <a href="${params.extendUrl}" 
         style="background-color:#059669;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;font-size:16px;">
        Extend Your Ad — 2 More Weeks
      </a>
    </div>
    <p style="color:#667085;font-size:13px;margin-top:16px;">Click the button above to review your ad and extend its visibility. You can also <a href="${viewAdUrl}" style="color:#6366f1;">view your current ad here</a>.</p>
    <p>Thank you for using e-matrimonial.in.</p>
  `;
  const bodyText = `Hello ${params.email},

Your matrimonial advertisement is expiring in ${timeLeftText}!
${contentPreview ? `\nYour Ad Preview:\n${contentPreview}\n` : ''}
Expires on: ${params.expiresAt.toDateString()}

Extend your ad for 2 more weeks: ${params.extendUrl}
View your ad: ${viewAdUrl}

Thank you for using e-matrimonial.in.`;
  return brandWrapper(subject, bodyHtml, bodyText, false);
}

export function tmplAdExtended(params: {
  email: string;
  postId: number;
  content?: string;
  newExpiresAt: Date;
}) {
  const subject = 'Your ad has been extended!';
  const siteUrl = process.env.CLIENT_BASE_URL || process.env.FRONTEND_URL || 'https://e-matrimonials.com';
  const viewAdUrl = `${siteUrl}/?highlight=${params.postId}`;

  // Convert HTML to plain text while preserving list structure, then truncate
  const contentPlainText = params.content ? htmlToPlainText(params.content) : '';
  const contentPreview = contentPlainText ? contentPlainText.slice(0, 200) + (contentPlainText.length > 200 ? '…' : '') : '';
  const safePreview = contentPreview.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

  const bodyHtml = `
    <p>Hello ${params.email},</p>
    <p style="font-size:18px;color:#059669;font-weight:600;margin:16px 0;">🎉 Great news! Your ad has been extended for 2 more weeks!</p>
    ${contentPreview ? `
    <div style="background:#f9fafb;border:1px solid #eef2f7;border-radius:8px;padding:16px;margin:16px 0;">
      <div style="color:#475467;font-size:12px;margin-bottom:8px;font-weight:600;">Your Ad Preview</div>
      <div style="color:#101828;font-size:14px;line-height:1.6;">${safePreview}</div>
    </div>
    ` : ''}
    <p><strong>New expiry date:</strong> ${params.newExpiresAt.toDateString()}</p>
    <div style="margin:24px 0;text-align:center;">
      <a href="${viewAdUrl}" 
         style="background-color:#1f2937;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;font-size:16px;">
        View Your Ad
      </a>
    </div>
    <p style="color:#667085;font-size:13px;margin-top:16px;">Your ad is live and visible to all users. Share this link with family and friends!</p>
    <p>Thank you for using e-matrimonial.in.</p>
  `;
  const bodyText = `Hello ${params.email},

Great news! Your ad has been extended for 2 more weeks!
${contentPreview ? `\nYour Ad Preview:\n${contentPreview}\n` : ''}
New expiry date: ${params.newExpiresAt.toDateString()}

View your ad: ${viewAdUrl}

Thank you for using e-matrimonial.in.`;
  return brandWrapper(subject, bodyHtml, bodyText, false);
}
