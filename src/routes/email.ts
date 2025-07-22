import { Router } from 'express';
import { sendEmail } from '../utils/sendEmail';
import { db } from '../db';
import { otps } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// POST /api/email/send
router.post('/send', async (req, res) => {
  const { fromEmail, toEmail, message, otp } = req.body;
  if (!fromEmail || !toEmail || !message || !otp) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }
  // Verify OTP for fromEmail
  const now = new Date();
  const found = await db.select().from(otps).where(eq(otps.email, fromEmail)).orderBy(otps.createdAt);
  const valid = found.find(r => r.otp === otp && r.expiresAt > now);
  if (!valid) {
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  }
  await db.delete(otps).where(eq(otps.email, fromEmail));
  try {
    await sendEmail({
      to: toEmail,
      from: process.env.SENDGRID_FROM_EMAIL!,
      subject: 'Contact from E-Matrimonial',
      text: message,
      replyTo: fromEmail,
      unsubscribeUrl: 'https://yourdomain.com/unsubscribe', // TODO: real link
    });
    res.json({ success: true, message: 'Email sent' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to send email' });
  }
});

export default router; 