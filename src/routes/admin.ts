import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq, and, desc, like, sql } from 'drizzle-orm';
import { db } from '../db';
import { admins, posts, users, adminLogs } from '../db/schema';
import { requireAdminAuth, requireSuperadminAuth, AdminRequest, isSuperadmin } from '../middleware/adminAuth';
import { logAdminAction } from '../utils/adminLogger';
import { validate, sanitizeInput, validateQuery, schemas } from '../middleware/validation';
import { createRateLimiters } from '../middleware/security';

const router = express.Router();

// Get admin-specific rate limiters
const { adminAuthLimiter } = createRateLimiters();

// Admin Login - with specific auth rate limiter
router.post('/login', adminAuthLimiter, sanitizeInput, validate(schemas.adminLogin), async (req, res) => {
  const { email, password } = req.body;

  try {
    const [admin] = await db.select().from(admins).where(eq(admins.email, email));

    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, admin.password);

    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isSuperadminUser = isSuperadmin(admin.email);
    const token = jwt.sign(
      { adminId: admin.id, email: admin.email, isSuperadmin: isSuperadminUser },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    // Log admin login
    await logAdminAction(req as AdminRequest, {
      action: 'admin_login',
      entityType: 'admin',
      entityId: admin.id,
      details: `Admin ${admin.email} logged in`,
    });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      admin: { id: admin.id, email: admin.email, isSuperadmin: isSuperadminUser }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get Admin Profile
router.get('/profile', requireAdminAuth, async (req: AdminRequest, res) => {
  try {
    const [admin] = await db.select().from(admins).where(eq(admins.id, req.admin!.adminId));
    
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    const isSuperadminUser = isSuperadmin(admin.email);

    res.json({
      success: true,
      admin: { 
        id: admin.id, 
        email: admin.email, 
        isSuperadmin: isSuperadminUser,
        createdAt: admin.createdAt 
      }
    });

  } catch (error) {
    console.error('Get admin profile error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get All Posts (Admin)
router.get('/posts', requireAdminAuth, validateQuery(schemas.adminPostsQuery), async (req: AdminRequest, res) => {
  const { status, search, page = 1 } = req.query;
  const limit = 20;
  const offset = (Number(page) - 1) * limit;

  try {
    let whereConditions = [];

    if (status && status !== 'all') {
      whereConditions.push(eq(posts.status, status as any));
    }

    if (search) {
      whereConditions.push(
        sql`(${posts.email} ILIKE ${`%${search}%`} OR ${posts.content} ILIKE ${`%${search}%`} OR ${posts.content} % ${search})`
      );
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const [postsData, totalCount] = await Promise.all([
      db.select().from(posts).where(whereClause).orderBy(desc(posts.createdAt)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(posts).where(whereClause)
    ]);

    const total = totalCount[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      posts: postsData,
      total,
      page: Number(page),
      totalPages
    });

  } catch (error) {
    console.error('Get admin posts error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Update Post Status
router.put('/posts/:id/status', requireAdminAuth, async (req: AdminRequest, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['pending', 'published', 'archived', 'deleted', 'expired'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Valid status required' });
  }

  try {
    // Get current post data for logging
    const [currentPost] = await db.select().from(posts).where(eq(posts.id, Number(id)));
    
    if (!currentPost) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Update post status and set expiresAt if publishing
    let updateData: any = { status };
    
    if (status === 'published') {
      // Set expiresAt to current date + 28 days (default duration)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 28);
      updateData.expiresAt = expiresAt;
    }
    
    const [updatedPost] = await db.update(posts)
      .set(updateData)
      .where(eq(posts.id, Number(id)))
      .returning();

    // Log the action
    let actionType = 'delete_post';
    let actionVerb = 'deleted';
    
    if (status === 'published') {
      actionType = 'approve_post';
      actionVerb = 'approved';
    } else if (status === 'archived') {
      actionType = 'archive_post';
      actionVerb = 'archived';
    }
    
    await logAdminAction(req, {
      action: actionType,
      entityType: 'post',
      entityId: Number(id),
      oldData: { status: currentPost.status },
      newData: { status },
      details: `Admin ${req.admin!.email} ${actionVerb} post ${id}`,
    });

    res.json({
      success: true,
      message: `Post ${status === 'published' ? 'approved' : 'deleted'} successfully`,
      post: updatedPost
    });

  } catch (error) {
    console.error('Update post status error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Create Post (Admin - No OTP required)
router.post('/posts', requireAdminAuth, async (req: AdminRequest, res) => {
  const {
    email,
    content,
    lookingFor,
    duration,
    fontSize,
    bgColor
  } = req.body;

  if (!email || !content) {
    return res.status(400).json({ success: false, message: 'Email and content required' });
  }

  try {
    // Create or get user
    let userId;
    const existingUser = await db.select().from(users).where(eq(users.email, email));

    if (existingUser.length > 0) {
      userId = existingUser[0].id;
    } else {
      // Create new user with random password
      const randomPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      const [newUser] = await db.insert(users)
        .values({
          email,
          password: hashedPassword
        })
        .returning();

      userId = newUser.id;
    }

    // Calculate expiresAt
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (duration || 20));

    // Create post
    const [newPost] = await db.insert(posts)
      .values({
        email,
        content,
        userId,
        lookingFor,
        expiresAt,
        fontSize: fontSize || 'default',
        bgColor: bgColor || null,
        status: 'published' // Admin created posts are published directly
      })
      .returning();

    // Log the action
    await logAdminAction(req, {
      action: 'create_post',
      entityType: 'post',
      entityId: newPost.id,
      newData: newPost,
      details: `Admin ${req.admin!.email} created post for user ${email}`,
    });

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post: newPost
    });

  } catch (error) {
    console.error('Create admin post error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get All Users (Admin)
router.get('/users', requireAdminAuth, async (req: AdminRequest, res) => {
  const { search, page = 1 } = req.query;
  const limit = 20;
  const offset = (Number(page) - 1) * limit;

  try {
    let whereConditions = [];

    if (search) {
      whereConditions.push(like(users.email, `%${search}%`));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const [usersData, totalCount] = await Promise.all([
      db.select().from(users).where(whereClause).orderBy(desc(users.createdAt)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(users).where(whereClause)
    ]);

    const total = totalCount[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      users: usersData,
      total,
      page: Number(page),
      totalPages
    });

  } catch (error) {
    console.error('Get admin users error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get User's Posts
router.get('/users/:id/posts', requireAdminAuth, async (req: AdminRequest, res) => {
  const { id } = req.params;

  try {
    const userPosts = await db.select().from(posts).where(eq(posts.userId, Number(id)));

    res.json({
      success: true,
      posts: userPosts
    });

  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get Admin Logs (Superadmin Only)
router.get('/logs', requireSuperadminAuth, async (req: AdminRequest, res) => {
  const { page = 1, action, adminId } = req.query;
  const limit = 50;
  const offset = (Number(page) - 1) * limit;

  try {
    let whereConditions = [];

    if (action) {
      whereConditions.push(eq(adminLogs.action, action as string));
    }

    if (adminId) {
      whereConditions.push(eq(adminLogs.adminId, Number(adminId)));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const [logsData, totalCount] = await Promise.all([
      db.select({
        id: adminLogs.id,
        action: adminLogs.action,
        entityType: adminLogs.entityType,
        entityId: adminLogs.entityId,
        details: adminLogs.details,
        ipAddress: adminLogs.ipAddress,
        createdAt: adminLogs.createdAt,
        admin: {
          id: admins.id,
          email: admins.email
        }
      })
      .from(adminLogs)
      .leftJoin(admins, eq(adminLogs.adminId, admins.id))
      .where(whereClause)
      .orderBy(desc(adminLogs.createdAt))
      .limit(limit)
      .offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(adminLogs).where(whereClause)
    ]);

    const total = totalCount[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      logs: logsData,
      total,
      page: Number(page),
      totalPages
    });

  } catch (error) {
    console.error('Get admin logs error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router; 