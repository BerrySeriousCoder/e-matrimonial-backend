import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users, otps, userSelectedProfiles, posts } from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendEmail } from '../utils/sendEmail';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Extend Express Request type for req.user
interface AuthRequest extends Request {
  user?: { userId: number; email: string };
}

// POST /api/user/register
// Body: { email, password, otp }
router.post('/register', async (req: Request, res: Response) => {
  const { email, password, otp } = req.body;
  if (!email || !password || !otp) return res.status(400).json({ success: false, message: 'Missing fields' });
  // Verify OTP (reuse logic from /api/otp/verify)
  const now = new Date();
  const found = await db.select().from(otps).where(eq(otps.email, email));
  const valid = found.find(r => r.otp === otp && r.expiresAt > now);
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
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, message: 'Missing fields' });
  const user = await db.select().from(users).where(eq(users.email, email));
  if (!user.length) return res.status(400).json({ success: false, message: 'User not found' });
  const valid = await bcrypt.compare(password, user[0].password);
  if (!valid) return res.status(400).json({ success: false, message: 'Invalid password' });
  // Issue JWT
  const token = jwt.sign({ userId: user[0].id, email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ success: true, token });
});

// POST /api/user/reset-password
// Body: { email, otp, newPassword }
router.post('/reset-password', async (req: Request, res: Response) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) return res.status(400).json({ success: false, message: 'Missing fields' });
  // Verify OTP (reuse logic from /api/otp/verify)
  const now = new Date();
  const found = await db.select().from(otps).where(eq(otps.email, email));
  const valid = found.find(r => r.otp === otp && r.expiresAt > now);
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
router.post('/login-with-otp', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email required' });
  
  // Check if user exists
  const user = await db.select().from(users).where(eq(users.email, email));
  if (!user.length) return res.status(400).json({ success: false, message: 'User not found' });
  
  // Generate and send OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min from now
  
  // Save OTP in DB
  await db.insert(otps).values({ email, otp, expiresAt });
  
  // Send OTP via email
  try {
    await sendEmail({
      to: email,
      subject: 'Your Login OTP for E-Matrimonial',
      text: `Your login OTP is: ${otp}\nIt is valid for 10 minutes.`,
    });
    res.json({ success: true, message: 'Login OTP sent' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
});

// POST /api/user/verify-login-otp
// Body: { email, otp }
router.post('/verify-login-otp', async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ success: false, message: 'Missing fields' });
  
  // Check if user exists
  const user = await db.select().from(users).where(eq(users.email, email));
  if (!user.length) return res.status(400).json({ success: false, message: 'User not found' });
  
  // Verify OTP
  const now = new Date();
  const found = await db.select().from(otps).where(eq(otps.email, email)).orderBy(otps.createdAt);
  const valid = found.find(r => r.otp === otp && r.expiresAt > now);
  
  if (!valid) {
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  }
  
  // Delete all OTPs for this email after successful verification
  await db.delete(otps).where(eq(otps.email, email));
  
  // Issue JWT
  const token = jwt.sign({ userId: user[0].id, email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ success: true, token, message: 'Login successful' });
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
router.post('/selected-profiles', requireAuth, async (req: AuthRequest, res: Response) => {
  const { profileId, action } = req.body;
  const userId = req.user!.userId;
  if (!profileId || !['add', 'remove'].includes(action)) return res.status(400).json({ success: false, message: 'Missing fields' });
  if (action === 'add') {
    await db.insert(userSelectedProfiles).values({ userId, profileId });
    res.json({ success: true });
  } else {
    await db.delete(userSelectedProfiles).where(and(eq(userSelectedProfiles.userId, userId), eq(userSelectedProfiles.profileId, profileId)));
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