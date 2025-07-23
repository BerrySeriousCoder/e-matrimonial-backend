import { Router } from 'express';
import { db } from '../db';
import { otps } from '../db/schema';
import { eq } from 'drizzle-orm';
import { sendEmail } from '../utils/sendEmail';

const router = Router();

// Helper to generate OTP
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/otp/request
router.post('/request', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email required' });
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min from now
  // Save OTP in DB
  await db.insert(otps).values({ email, otp, expiresAt });
  // Send OTP via email
  try {
    await sendEmail({
      to: email,
      subject: 'Your OTP for E-Matrimonial',
      text: `Your OTP is: ${otp}\nIt is valid for 10 minutes.`,
    });
    res.json({ success: true, message: 'OTP sent' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
});

// POST /api/otp/verify
router.post('/verify', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ success: false, message: 'Missing fields' });
  const now = new Date();
  const found = await db.select().from(otps).where(eq(otps.email, email)).orderBy(otps.createdAt);
  const valid = found.find(r => r.otp === otp && r.expiresAt > now);
  if (!valid) {
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  }
  // Delete all OTPs for this email after successful verification
  await db.delete(otps).where(eq(otps.email, email));
  res.json({ success: true, message: 'OTP verified' });
});

export default router; 