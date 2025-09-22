import express from 'express';
import { and, desc, eq, like, sql } from 'drizzle-orm';
import { db } from '../db';
import { admins, posts, users } from '../db/schema';
import { AdminRequest } from '../middleware/adminAuth';
import { requireRole } from '../middleware/adminAuth';
import { sanitizeInput, validate, validateQuery, schemas } from '../middleware/validation';
import bcrypt from 'bcryptjs';
import { sendEmail } from '../utils/sendEmail';
import { tmplDataEntrySubmitted } from '../utils/emailTemplates';
import { trackDataEntryPerformance } from '../middleware/analytics';

const router = express.Router();

// GET /api/data-entry/posts - list own posts with pagination and optional filters
router.get('/posts', requireRole(['data_entry']), validateQuery(schemas.adminPostsQuery), async (req: AdminRequest, res) => {
  try {
    const { status, search, page = 1 } = req.query as any;
    const limit = 20;
    const offset = (Number(page) - 1) * limit;

    const whereConditions: any[] = [eq(posts.createdByAdminId, req.admin!.adminId)];
    if (status && status !== 'all') whereConditions.push(eq(posts.status, status));
    if (search) whereConditions.push(sql`(${posts.email} ILIKE ${`%${search}%`} OR ${posts.content} ILIKE ${`%${search}%`} OR ${posts.content} % ${search})`);

    const whereClause = and(...whereConditions);

    const [postsData, totalCount] = await Promise.all([
      db.select().from(posts).where(whereClause).orderBy(desc(posts.createdAt)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(posts).where(whereClause)
    ]);

    const total = totalCount[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);

    res.json({ success: true, posts: postsData, total, page: Number(page), totalPages });
  } catch (error) {
    console.error('DataEntry list posts error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/data-entry/posts - create a new post on behalf of customer
router.post('/posts', requireRole(['data_entry']), sanitizeInput, validate(schemas.createAdminPost), async (req: AdminRequest, res) => {
  try {
    const { email, content, lookingFor, duration, fontSize, bgColor } = req.body as any;

    // Ensure user exists (same as admin create)
    let userId;
    const existingUser = await db.select().from(users).where(eq(users.email, email));
    if (existingUser.length > 0) {
      userId = existingUser[0].id;
    } else {
      const randomPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      const [newUser] = await db.insert(users).values({ email, password: hashedPassword }).returning();
      userId = newUser.id;
    }

    // Create pending post (awaiting admin approval)
    const [newPost] = await db.insert(posts).values({
      email,
      content,
      userId,
      lookingFor,
      fontSize: fontSize || 'default',
      bgColor: bgColor || null,
      status: 'pending',
      createdByAdminId: req.admin!.adminId,
    }).returning();

    // Fire-and-forget email to customer
    try {
      const { html, text } = tmplDataEntrySubmitted({ email, content, lookingFor });
      sendEmail({ to: email, subject: '[E‑Matrimonials] Ad submitted on your behalf', text, html });
    } catch (e) {
      console.error('DataEntry submit email error:', e);
    }

    // Track data entry performance
    trackDataEntryPerformance(req.admin!.adminId.toString(), 'create', {
      characterCount: content.length,
      lookingFor,
      fontSize
    })(req, res, () => {
      res.status(201).json({ success: true, message: 'Post created and pending approval', post: newPost });
    });
  } catch (error) {
    console.error('DataEntry create post error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PUT /api/data-entry/posts/:id - edit own post (sets status to 'edited')
router.put('/posts/:id', requireRole(['data_entry']), sanitizeInput, validate(schemas.updateAdminPost), async (req: AdminRequest, res) => {
  try {
    const { id } = req.params;
    // Ensure ownership
    const [existing] = await db.select().from(posts).where(eq(posts.id, Number(id)));
    if (!existing || existing.createdByAdminId !== req.admin!.adminId) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this post' });
    }

    const updateData: any = { ...req.body, status: 'edited' };
    // Never change expiresAt here; admin approval will set/refresh it
    delete updateData.duration; // duration is used only by admin approval/create

    const [updated] = await db.update(posts).set(updateData).where(eq(posts.id, Number(id))).returning();
    
    // Track data entry performance
    trackDataEntryPerformance(req.admin!.adminId.toString(), 'edit', {
      characterCount: updateData.content?.length || 0,
      postId: Number(id)
    })(req, res, () => {
      res.json({ success: true, message: 'Post updated and pending re-approval', post: updated });
    });
  } catch (error) {
    console.error('DataEntry update post error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;


