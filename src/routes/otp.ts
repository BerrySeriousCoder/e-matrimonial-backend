import { Router } from 'express';
import { db } from '../db';
import { otps } from '../db/schema';
import { eq } from 'drizzle-orm';
import { sendEmail } from '../utils/sendEmail';
import { tmplOtp } from '../utils/emailTemplates';
import { validate, sanitizeInput, schemas } from '../middleware/validation';

const router = Router();

// POST /api/otp/request
router.post('/request', sanitizeInput, validate(schemas.requestOtp), async (req, res) => {
  const { email } = req.body;
  
  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min from now
  
  // Save OTP in DB
  await db.insert(otps).values({ email, otp, expiresAt });
  
  // Send OTP via email
  try {
    const { html, text } = tmplOtp({ otp });
    await sendEmail({ to: email, subject: 'Your OTP for E‑Matrimonial', text, html, disableUnsubscribe: true });
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
  
  // Find the most recent valid OTP
  const valid = found
    .filter(r => {
      const otpMatch = r.otp === otp;
      // Convert database timestamp to UTC Date object for proper comparison
      const expiresAt = new Date(r.expiresAt + 'Z'); // Add Z to make it UTC
      const notExpired = expiresAt > now;
      return otpMatch && notExpired;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  
  if (!valid) {
    console.log('OTP verification failed:', { 
      email, 
      otp, 
      now: now.toISOString(), 
      found: found.map(f => {
        const expiresAt = new Date(f.expiresAt + 'Z');
        return {
          otp: f.otp, 
          expiresAt: f.expiresAt,
          expiresAtUTC: expiresAt.toISOString(),
          createdAt: f.createdAt,
          isExpired: expiresAt <= now
        };
      }) 
    });
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  }
  
  // Delete all OTPs for this email (cleanup)
  await db.delete(otps).where(eq(otps.email, email));
  
  res.json({ success: true, message: 'OTP verified' });
});

export default router; 