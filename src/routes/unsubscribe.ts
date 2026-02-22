import express from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { emailUnsubscribes } from '../db/schema';

const router = express.Router();

// GET /api/unsubscribe?token=xxx — Browser click from email link
router.get('/', async (req, res) => {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
        return res.status(400).send(renderPage('Invalid Request', 'The unsubscribe link is invalid or expired.', false));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { email: string };
        const email = decoded.email;

        // Upsert — insert if not already unsubscribed
        const existing = await db.select().from(emailUnsubscribes).where(eq(emailUnsubscribes.email, email));
        if (existing.length === 0) {
            await db.insert(emailUnsubscribes).values({
                email,
                reason: 'User clicked unsubscribe link',
            });
            console.log(`Email unsubscribed: ${email}`);
        }

        res.send(renderPage('Unsubscribed', `<strong>${email}</strong> has been unsubscribed from E‑Matrimonials marketing emails. You will still receive important transactional emails (OTP, payment confirmations, etc.).`, true));
    } catch (error: any) {
        console.error('Unsubscribe error:', error?.message);
        if (error?.name === 'TokenExpiredError') {
            return res.status(400).send(renderPage('Link Expired', 'This unsubscribe link has expired. Please use the link from a more recent email.', false));
        }
        res.status(400).send(renderPage('Invalid Link', 'The unsubscribe link is invalid or has expired.', false));
    }
});

// POST /api/unsubscribe — One-click unsubscribe (List-Unsubscribe-Post header for Gmail/Outlook)
router.post('/', async (req, res) => {
    const token = req.body?.token || req.query?.token;

    if (!token || typeof token !== 'string') {
        return res.status(400).json({ success: false, message: 'Missing token' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { email: string };
        const email = decoded.email;

        const existing = await db.select().from(emailUnsubscribes).where(eq(emailUnsubscribes.email, email));
        if (existing.length === 0) {
            await db.insert(emailUnsubscribes).values({
                email,
                reason: 'One-click unsubscribe (email client)',
            });
            console.log(`Email unsubscribed (one-click): ${email}`);
        }

        res.json({ success: true, message: 'Unsubscribed successfully' });
    } catch (error: any) {
        console.error('One-click unsubscribe error:', error?.message);
        res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }
});

function renderPage(title: string, message: string, success: boolean) {
    const color = success ? '#059669' : '#dc2626';
    const icon = success ? '✅' : '❌';
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} — E‑Matrimonials</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; background: #f6f7fb; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #fff; border-radius: 12px; box-shadow: 0 4px 18px rgba(16,24,40,0.06); max-width: 480px; width: 90%; padding: 40px; text-align: center; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { color: ${color}; margin: 0 0 12px; font-size: 24px; }
    p { color: #475467; line-height: 1.6; margin: 0; font-size: 15px; }
    .brand { margin-top: 24px; color: #9ca3af; font-size: 13px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <div class="brand">E‑Matrimonials</div>
  </div>
</body>
</html>`;
}

export default router;
