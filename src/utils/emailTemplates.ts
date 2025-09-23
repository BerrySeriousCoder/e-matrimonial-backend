export function brandWrapper(subject: string, bodyHtml: string, bodyText: string) {
  const html = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fb;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;box-shadow:0 4px 18px rgba(16,24,40,0.06);overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#101828;">
          <tr>
            <td style="background:#1f2937;color:#fff;padding:20px 24px;">
              <div style="font-size:18px;font-weight:700;">E‑Matrimonials</div>
              <div style="opacity:.9;font-size:14px;margin-top:4px;">${subject}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;line-height:1.6;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;border-top:1px solid #eef2f7;color:#475467;font-size:12px;">
              <div>You're receiving this email from E‑Matrimonials.</div>
              <div style="margin-top:6px;">To stop receiving these, use the Unsubscribe link below.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
  const text = `E-Matrimonials\n${subject}\n\n${bodyText}\n\nUnsubscribe available via your email provider's unsubscribe button.`;
  return { html, text };
}

export function brandWrapperBasic(subject: string, bodyHtml: string, bodyText: string) {
  const html = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fb;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;box-shadow:0 4px 18px rgba(16,24,40,0.06);overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#101828;">
          <tr>
            <td style="background:#1f2937;color:#fff;padding:16px 20px;font-weight:700;">E‑Matrimonials</td>
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
  const text = `E-Matrimonials\n${subject}\n\n${bodyText}`;
  return { html, text };
}

export function tmplOtp(params: { otp: string }) {
  const subject = 'Your OTP for E‑Matrimonial';
  const bodyHtml = `
    <p style="margin:0 0 12px;color:#475467;">Use this code to continue. It expires in 10 minutes.</p>
    <div style="margin:16px 0 8px;">
      <div style="display:inline-block;background:#111827;color:#ffffff;padding:12px 20px;border-radius:10px;font-size:24px;letter-spacing:4px;font-weight:700;">${params.otp}</div>
    </div>
    <p style="margin:12px 0 0;color:#667085;font-size:12px;">If you didn’t request this, you can safely ignore this email.</p>
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
  return brandWrapper(subject, bodyHtml, bodyText);
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

export function tmplPublished(params: { email: string; expiresAt?: Date }) {
  const subject = 'Your ad has been published';
  const bodyHtml = `
    <p>Hello ${params.email},</p>
    <p>Good news! Your matrimonial advertisement has been published.</p>
    ${params.expiresAt ? `<p><strong>Expires on:</strong> ${params.expiresAt.toDateString()}</p>` : ''}
    <p>Thank you for using E‑Matrimonials.</p>
  `;
  const bodyText = `Hello ${params.email},
Good news! Your matrimonial advertisement has been published.
${params.expiresAt ? `Expires on: ${params.expiresAt.toDateString()}\n` : ''}Thank you for using E-Matrimonials.`;
  return brandWrapper(subject, bodyHtml, bodyText);
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
  return brandWrapper(subject, bodyHtml, bodyText);
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
  const safeMessage = params.message.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const bodyHtml = `
    <p>Hello ${params.toEmail},</p>
    <p>You received a new message for your "${params.lookingFor}" post:</p>
    <div style="background:#f9fafb;border:1px solid #eef2f7;border-radius:8px;padding:12px 14px;margin:10px 0 14px;">
      <div style="color:#475467;font-size:12px;margin-bottom:6px;">Post Preview</div>
      <div style="color:#101828;font-weight:600;">"${safePreview}"</div>
    </div>
    <div style="background:#f9fafb;border:1px solid #eef2f7;border-radius:8px;padding:12px 14px;margin:0 0 14px;">
      <div style="color:#475467;font-size:12px;margin-bottom:6px;">Message</div>
      <div style="white-space:pre-wrap;color:#101828;">${safeMessage}</div>
    </div>
    <p style="margin-top:12px;color:#475467;">Reply directly to this email to respond.</p>
  `;
  const bodyText = `You received a new message for your "${params.lookingFor}" post\n\nPost Preview: "${params.contentPreview}"\n\n${params.message}\n\nReply directly to this email to respond.`;
  return brandWrapper(subject, bodyHtml, bodyText);
}


