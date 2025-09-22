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
}: {
  to: string;
  from?: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  unsubscribeUrl?: string;
}) {
  const msg: any = {
    to,
    from: from || process.env.SENDGRID_FROM_EMAIL!,
    subject,
    text,
    html,
    mailSettings: {
      sandboxMode: { enable: false },
    },
  };
  if (replyTo) msg.replyTo = replyTo;
  if (unsubscribeUrl) {
    msg.headers = {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
    };
  }
  await sgMail.send(msg);
} 