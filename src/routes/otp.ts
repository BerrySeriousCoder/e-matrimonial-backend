import { Router } from 'express';
import { db } from '../db';
import { otps } from '../db/schema';
import { eq } from 'drizzle-orm';
import { sendEmail } from '../utils/sendEmail';
import { validate, sanitizeInput, schemas } from '../middleware/validation';

const router = Router();

// POST /api/otp/request
router.post('/request', sanitizeInput, validate(schemas.requestOtp), async (req, res) => {
  const { email } = req.body;
  
  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
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
router.post('/verify', sanitizeInput, validate(schemas.verifyOtp), async (req, res) => {
  const { email, otp } = req.body;
  
  // Verify OTP
  const now = new Date();
  const found = await db.select().from(otps).where(eq(otps.email, email));
  const valid = found.find(r => r.otp === otp && r.expiresAt > now);
  
  if (!valid) {
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  }
  
  // Delete used OTP
  await db.delete(otps).where(eq(otps.email, email));
  
  res.json({ success: true, message: 'OTP verified' });
});

export default router; 