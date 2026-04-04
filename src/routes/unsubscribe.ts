import express from 'express';
import jwt from 'jsonwebtoken';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '../db';
import { emailUnsubscribes, posts } from '../db/schema';

const router = express.Router();

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
}

// GET /api/unsubscribe?token=xxx — Browser click from email link
// Shows a confirmation page; does NOT unsubscribe yet
router.get('/', async (req, res) => {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
        return res.status(400).send(renderResultPage('Invalid Request', 'The unsubscribe link is invalid or expired.', false));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { email: string };
        const email = decoded.email;

        const alreadyUnsubscribed = await db.select().from(emailUnsubscribes).where(eq(emailUnsubscribes.email, email));
        if (alreadyUnsubscribed.length > 0) {
            return res.send(renderResultPage('Already Unsubscribed', `<strong>${email}</strong> is already unsubscribed from E‑Matrimonials marketing emails.`, true));
        }

        const activePosts = await db.select({
            id: posts.id,
            content: posts.content,
            lookingFor: posts.lookingFor,
            expiresAt: posts.expiresAt,
            publishedAt: posts.publishedAt,
        }).from(posts).where(
            and(
                eq(posts.email, email),
                eq(posts.status, 'published'),
                gt(posts.expiresAt, new Date().toISOString())
            )
        );

        res.send(renderConfirmPage(email, token, activePosts));
    } catch (error: any) {
        console.error('Unsubscribe error:', error?.message);
        if (error?.name === 'TokenExpiredError') {
            return res.status(400).send(renderResultPage('Link Expired', 'This unsubscribe link has expired. Please use the link from a more recent email.', false));
        }
        res.status(400).send(renderResultPage('Invalid Link', 'The unsubscribe link is invalid or has expired.', false));
    }
});

// POST /api/unsubscribe/confirm — User confirmed unsubscribe from the browser page
router.post('/confirm', express.urlencoded({ extended: false }), async (req, res) => {
    const token = req.body?.token;

    if (!token || typeof token !== 'string') {
        return res.status(400).send(renderResultPage('Invalid Request', 'The unsubscribe request is invalid.', false));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { email: string };
        const email = decoded.email;

        const existing = await db.select().from(emailUnsubscribes).where(eq(emailUnsubscribes.email, email));
        if (existing.length === 0) {
            await db.insert(emailUnsubscribes).values({
                email,
                reason: 'User clicked unsubscribe link',
            });
            console.log(`Email unsubscribed: ${email}`);
        }

        res.send(renderResultPage('Unsubscribed', `<strong>${email}</strong> has been unsubscribed from E‑Matrimonials marketing emails. You will still receive important transactional emails (OTP, payment confirmations, etc.).`, true));
    } catch (error: any) {
        console.error('Unsubscribe confirm error:', error?.message);
        if (error?.name === 'TokenExpiredError') {
            return res.status(400).send(renderResultPage('Link Expired', 'This unsubscribe link has expired. Please use the link from a more recent email.', false));
        }
        res.status(400).send(renderResultPage('Error', 'Something went wrong. Please try again.', false));
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

interface ActivePost {
    id: number;
    content: string;
    lookingFor: string | null;
    expiresAt: string | null;
    publishedAt: string | null;
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderConfirmPage(email: string, token: string, activePosts: ActivePost[]) {
    const hasActivePosts = activePosts.length > 0;

    let activePostsHtml = '';
    if (hasActivePosts) {
        const postCards = activePosts.map(p => {
            const preview = stripHtml(p.content).substring(0, 120);
            const truncated = preview.length < stripHtml(p.content).length ? preview + '...' : preview;
            const lookingForLabel = p.lookingFor === 'bride' ? 'Bride' : p.lookingFor === 'groom' ? 'Groom' : '—';
            return `
            <div class="post-card">
                <div class="post-header">
                    <span class="post-id">#${p.id}</span>
                    <span class="post-badge">Active</span>
                    <span class="post-looking">Looking for: ${lookingForLabel}</span>
                </div>
                <div class="post-content">${truncated}</div>
                <div class="post-dates">
                    Published: ${formatDate(p.publishedAt)} &nbsp;·&nbsp; Expires: ${formatDate(p.expiresAt)}
                </div>
            </div>`;
        }).join('');

        activePostsHtml = `
        <div class="warning-box">
            <div class="warning-icon">⚠️</div>
            <div class="warning-title">You have ${activePosts.length} active ad${activePosts.length > 1 ? 's' : ''} with this email</div>
            <div class="warning-text">
                If you unsubscribe, <strong>people browsing E‑Matrimonials will not be able to reach out to you</strong> via email regarding your ad${activePosts.length > 1 ? 's' : ''}. 
                You will lose potential responses to your matrimonial listing${activePosts.length > 1 ? 's' : ''}.
            </div>
        </div>
        <div class="posts-section">
            <div class="posts-label">Your active ad${activePosts.length > 1 ? 's' : ''}:</div>
            ${postCards}
        </div>`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Unsubscribe — E‑Matrimonials</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; background: #f6f7fb; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: #fff; border-radius: 12px; box-shadow: 0 4px 18px rgba(16,24,40,0.06); max-width: 540px; width: 100%; padding: 36px; }
    .header { text-align: center; margin-bottom: 24px; }
    .icon { font-size: 40px; margin-bottom: 12px; }
    h1 { color: #1f2937; margin: 0 0 8px; font-size: 22px; }
    .subtitle { color: #6b7280; font-size: 14px; line-height: 1.5; margin: 0; }
    .email-tag { display: inline-block; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 6px; padding: 4px 12px; font-size: 14px; font-weight: 600; color: #374151; margin-top: 8px; }
    .warning-box { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .warning-icon { font-size: 24px; margin-bottom: 8px; }
    .warning-title { font-weight: 700; color: #92400e; font-size: 15px; margin-bottom: 6px; }
    .warning-text { color: #78350f; font-size: 13px; line-height: 1.5; }
    .posts-section { margin: 16px 0; }
    .posts-label { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
    .post-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; margin-bottom: 8px; }
    .post-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
    .post-id { font-size: 12px; font-weight: 700; color: #6b7280; font-family: monospace; }
    .post-badge { font-size: 11px; font-weight: 600; background: #d1fae5; color: #065f46; padding: 2px 8px; border-radius: 10px; }
    .post-looking { font-size: 11px; color: #6b7280; margin-left: auto; }
    .post-content { font-size: 13px; color: #374151; line-height: 1.5; }
    .post-dates { font-size: 11px; color: #9ca3af; margin-top: 6px; }
    .info-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 14px; margin: 16px 0; }
    .info-text { color: #1e40af; font-size: 13px; line-height: 1.5; margin: 0; }
    .actions { margin-top: 24px; display: flex; gap: 12px; justify-content: center; }
    .btn { display: inline-block; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none; border: none; cursor: pointer; transition: background 0.15s; }
    .btn-danger { background: #dc2626; color: #fff; }
    .btn-danger:hover { background: #b91c1c; }
    .btn-cancel { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; }
    .btn-cancel:hover { background: #e5e7eb; }
    .brand { text-align: center; margin-top: 24px; color: #9ca3af; font-size: 13px; }
    .note { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 12px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="icon">📧</div>
      <h1>Unsubscribe from emails?</h1>
      <p class="subtitle">You are about to unsubscribe this email from E‑Matrimonials notifications:</p>
      <div class="email-tag">${email}</div>
    </div>

    ${activePostsHtml}

    <div class="info-box">
      <p class="info-text">
        ${hasActivePosts
            ? 'After unsubscribing, you will <strong>not receive any messages</strong> from people interested in your ad. You will still receive transactional emails (OTP, payment confirmations).'
            : 'You will stop receiving marketing emails. You will still receive important transactional emails (OTP, payment confirmations, etc.).'}
      </p>
    </div>

    <div class="actions">
      <a href="${process.env.CLIENT_BASE_URL || 'https://e-matrimonials.com'}" class="btn btn-cancel">Cancel</a>
      <form method="POST" action="/api/unsubscribe/confirm" style="margin:0;">
        <input type="hidden" name="token" value="${token}" />
        <button type="submit" class="btn btn-danger">
          ${hasActivePosts ? 'Unsubscribe Anyway' : 'Confirm Unsubscribe'}
        </button>
      </form>
    </div>

    <p class="note">This will not delete your account or remove your ads.</p>
    <div class="brand">E‑Matrimonials</div>
  </div>
</body>
</html>`;
}

function renderResultPage(title: string, message: string, success: boolean) {
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
