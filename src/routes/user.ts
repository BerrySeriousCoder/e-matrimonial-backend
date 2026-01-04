import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users, otps, userSelectedProfiles, posts } from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendEmail } from '../utils/sendEmail';
import { validate, sanitizeInput, schemas } from '../middleware/validation';
import { trackProfileSelection } from '../middleware/analytics';
import { parseDbTimestampAsUtc } from '../utils/dateUtils';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Extend Express Request type for req.user
interface AuthRequest extends Request {
  user?: { userId: number; email: string };
}

// POST /api/user/register
// Body: { email, password, otp }
router.post('/register', sanitizeInput, validate(schemas.register), async (req: Request, res: Response) => {
  const { email, password, otp } = req.body;

  // Verify OTP (reuse logic from /api/otp/verify)
  const now = new Date();
  const found = await db.select().from(otps).where(eq(otps.email, email));

  // Debug logging
  console.log('Register OTP verification:', {
    email,
    inputOtp: otp,
    now: now.toISOString(),
    foundRecords: found.map(r => ({
      otp: r.otp,
      expiresAt: r.expiresAt,
      expiresAtParsed: parseDbTimestampAsUtc(r.expiresAt).toISOString(),
      isMatch: r.otp === otp,
      isNotExpired: parseDbTimestampAsUtc(r.expiresAt) > now
    }))
  });

  const valid = found.find(r => r.otp === otp && parseDbTimestampAsUtc(r.expiresAt) > now);
  if (!valid) return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  await db.delete(otps).where(eq(otps.email, email));

  // Check if user exists
  const existing = await db.select().from(users).where(eq(users.email, email));
  if (existing.length > 0) return res.status(400).json({ success: false, message: 'User already exists' });

  // Hash password
  const hash = await bcrypt.hash(password, 10);
  await db.insert(users).values({ email, password: hash });
  res.json({ success: true, message: 'User registered' });
});

// POST /api/user/login
// Body: { email, password }
router.post('/login', sanitizeInput, validate(schemas.login), async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await db.select().from(users).where(eq(users.email, email));
  if (!user.length) return res.status(400).json({ success: false, message: 'User not found' });

  const valid = await bcrypt.compare(password, user[0].password);
  if (!valid) return res.status(400).json({ success: false, message: 'Invalid password' });

  // Issue JWT
  const token = jwt.sign({ userId: user[0].id, email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ success: true, token, email: user[0].email });
});

// POST /api/user/reset-password
// Body: { email, otp, newPassword }
router.post('/reset-password', sanitizeInput, validate(schemas.resetPassword), async (req: Request, res: Response) => {
  const { email, otp, newPassword } = req.body;

  // Verify OTP (reuse logic from /api/otp/verify)
  const now = new Date();
  const found = await db.select().from(otps).where(eq(otps.email, email));
  const valid = found.find(r => r.otp === otp && parseDbTimestampAsUtc(r.expiresAt) > now);
  if (!valid) return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  await db.delete(otps).where(eq(otps.email, email));

  // Update password
  const hash = await bcrypt.hash(newPassword, 10);
  const updated = await db.update(users).set({ password: hash }).where(eq(users.email, email));
  if (!updated) return res.status(400).json({ success: false, message: 'User not found' });
  res.json({ success: true, message: 'Password reset successful' });
});

// POST /api/user/login-with-otp
// Body: { email }
router.post('/login-with-otp', sanitizeInput, validate(schemas.requestOtp), async (req: Request, res: Response) => {
  const { email } = req.body;

  // Check if user exists
  const user = await db.select().from(users).where(eq(users.email, email));
  if (!user.length) return res.status(400).json({ success: false, message: 'User not found' });

  // Generate and send OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min from now

  // Save OTP in DB
  await db.insert(otps).values({ email, otp, expiresAt });

  // Send OTP via email
  try {
    await sendEmail({
      to: email,
      subject: `Your OTP: ${otp} - E-Matrimonial Login`,
      text: `Your login OTP is: ${otp}\nIt is valid for 10 minutes.`,
    });
    res.json({ success: true, message: 'Login OTP sent' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
});

// POST /api/user/verify-login-otp
// Body: { email, otp }
router.post('/verify-login-otp', sanitizeInput, validate(schemas.verifyOtp), async (req: Request, res: Response) => {
  const { email, otp } = req.body;

  // Verify OTP
  const now = new Date();
  const found = await db.select().from(otps).where(eq(otps.email, email));

  // Find the most recent valid OTP
  const valid = found
    .filter(r => {
      const otpMatch = r.otp === otp;
      const expiresAt = parseDbTimestampAsUtc(r.expiresAt);
      const notExpired = expiresAt > now;
      return otpMatch && notExpired;
    })
    .sort((a, b) => parseDbTimestampAsUtc(b.createdAt).getTime() - parseDbTimestampAsUtc(a.createdAt).getTime())[0];

  if (!valid) {
    console.log('OTP verification failed:', {
      email,
      otp,
      now: now.toISOString(),
      found: found.map(f => {
        const expiresAt = parseDbTimestampAsUtc(f.expiresAt);
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

  // Get user
  const user = await db.select().from(users).where(eq(users.email, email));
  if (!user.length) return res.status(400).json({ success: false, message: 'User not found' });

  // Issue JWT
  const token = jwt.sign({ userId: user[0].id, email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ success: true, token, email: user[0].email });
});

// Middleware to check JWT
function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ success: false, message: 'No token' });
  try {
    const decoded = jwt.verify(auth.split(' ')[1], JWT_SECRET) as { userId: number; email: string };
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

// POST /api/user/selected-profiles
// Body: { profileId, action: 'add' | 'remove' }
router.post('/selected-profiles', requireAuth, sanitizeInput, validate(schemas.userSelection), async (req: AuthRequest, res: Response) => {
  const { profileId, action } = req.body;
  const userId = req.user!.userId;

  if (action === 'add') {
    await db.insert(userSelectedProfiles).values({ userId, profileId });
    // Track profile selection analytics
    trackProfileSelection(profileId, 'select')(req, res, () => { });
    res.json({ success: true });
  } else {
    await db.delete(userSelectedProfiles).where(and(eq(userSelectedProfiles.userId, userId), eq(userSelectedProfiles.profileId, profileId)));
    // Track profile unselection analytics
    trackProfileSelection(profileId, 'unselect')(req, res, () => { });
    res.json({ success: true });
  }
});

// GET /api/user/selected-profiles
router.get('/selected-profiles', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  // Get selected profile IDs
  const selected = await db.select().from(userSelectedProfiles).where(eq(userSelectedProfiles.userId, userId));
  const profileIds = selected.map(s => s.profileId);
  let profiles: any[] = [];
  if (profileIds.length > 0) {
    profiles = await db.select().from(posts).where(inArray(posts.id, profileIds));
  }
  res.json({ success: true, selected: profiles });
});

export default router; 