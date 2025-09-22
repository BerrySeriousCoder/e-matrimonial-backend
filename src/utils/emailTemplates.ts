export function brandWrapper(subject: string, bodyHtml: string, bodyText: string) {
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#111">
    <h2 style="margin:0 0 12px">E‑Matrimonials</h2>
    <p style="margin:0 0 16px;color:#444">${subject}</p>
    <div style="margin:12px 0 20px;color:#111">${bodyHtml}</div>
    <hr style="border:none;border-top:1px solid #eee;margin:16px 0" />
    <p style="font-size:12px;color:#777">This is an automated message. Please do not reply.</p>
  </div>`;
  const text = `E-Matrimonials\n${subject}\n\n${bodyText}\n\nThis is an automated message. Please do not reply.`;
  return { html, text };
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


