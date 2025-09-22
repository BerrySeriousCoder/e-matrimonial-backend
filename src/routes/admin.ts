import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq, and, desc, like, sql } from 'drizzle-orm';
import { db } from '../db';
import { admins, posts, users, adminLogs } from '../db/schema';
import { requireAdminAuth, requireSuperadminAuth, AdminRequest, isSuperadmin } from '../middleware/adminAuth';
import { logAdminAction } from '../utils/adminLogger';
import { validate, sanitizeInput, validateQuery, schemas } from '../middleware/validation';
import { sendEmail } from '../utils/sendEmail';
import { tmplPublished } from '../utils/emailTemplates';
import { calculatePaymentAmount } from '../utils/paymentCalculation';
import RazorpayService from '../utils/razorpayService';
import { tmplPaymentRequired } from '../utils/emailTemplates';
import { createRateLimiters } from '../middleware/security';
import { trackAnalytics, trackDataEntryPerformance } from '../middleware/analytics';

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
    const role: 'superadmin' | 'admin' | 'data_entry' = isSuperadminUser ? 'superadmin' : (admin as any).role || 'admin';
    const token = jwt.sign(
      { adminId: admin.id, email: admin.email, isSuperadmin: isSuperadminUser, role },
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
      admin: { id: admin.id, email: admin.email, isSuperadmin: isSuperadminUser, role }
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
    const role: 'superadmin' | 'admin' | 'data_entry' = isSuperadminUser ? 'superadmin' : (admin as any).role || 'admin';

    res.json({
      success: true,
      admin: { 
        id: admin.id, 
        email: admin.email, 
        isSuperadmin: isSuperadminUser,
        role,
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
  let { status } = req.body;

  if (!status || !['pending', 'published', 'archived', 'deleted', 'expired', 'edited', 'payment_pending'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Valid status required' });
  }

  try {
    // Get current post data for logging
    const [currentPost] = await db.select().from(posts).where(eq(posts.id, Number(id)));
    
    if (!currentPost) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // If admin is trying to publish a pending post, redirect to payment_pending flow
    if (status === 'published' && currentPost.status === 'pending') {
      status = 'payment_pending';
    }

    // Update post status and handle payment flow
    let updateData: any = { status };
    let paymentLink = null;
    
    if (status === 'published') {
      // For direct publishing (bypass payment), set expiresAt to current date + duration
      const expiresAt = new Date();
      const duration = currentPost.duration || 14; // Default to 14 days if not set
      expiresAt.setDate(expiresAt.getDate() + duration);
      updateData.expiresAt = expiresAt.toISOString();
    } else if (status === 'payment_pending') {
      // Calculate payment amount and create payment link
      try {
        const paymentCalculation = await calculatePaymentAmount(
          currentPost.content,
          currentPost.fontSize as 'default' | 'large',
          currentPost.duration as 14 | 21 | 28,
          currentPost.couponCode || undefined
        );

        // Create payment link
        paymentLink = await RazorpayService.createPaymentLink(
          paymentCalculation.finalAmount,
          currentPost.id,
          currentPost.email,
          `Matrimonial Ad - ${currentPost.lookingFor === 'bride' ? 'Bride' : 'Groom'} Profile`
        );

        // Update post with payment details
        updateData.baseAmount = paymentCalculation.baseAmount;
        updateData.finalAmount = paymentCalculation.finalAmount;
        updateData.couponCode = currentPost.couponCode;
      } catch (error) {
        console.error('Payment calculation/link creation error:', error);
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to create payment link. Please try again.' 
        });
      }
    }
    
    const [updatedPost] = await db.update(posts)
      .set(updateData)
      .where(eq(posts.id, Number(id)))
      .returning();

    // Track analytics event
    if (status === 'published' || status === 'payment_pending') {
      trackAnalytics('ad_approval', {
        postId: Number(id),
        adminId: req.admin!.adminId
      })(req, res, () => {});
      
      // Track data entry performance if post was created by data entry employee
      if (currentPost.createdByAdminId) {
        trackDataEntryPerformance(currentPost.createdByAdminId.toString(), 'approve', {
          postId: Number(id)
        })(req, res, () => {});
      }
    } else if (status === 'archived' || status === 'deleted') {
      trackAnalytics('ad_rejection', {
        postId: Number(id),
        adminId: req.admin!.adminId,
        reason: status
      })(req, res, () => {});
      
      // Track data entry performance if post was created by data entry employee
      if (currentPost.createdByAdminId) {
        trackDataEntryPerformance(currentPost.createdByAdminId.toString(), 'reject', {
          postId: Number(id),
          reason: status
        })(req, res, () => {});
      }
    }

    // Log the action
    let actionType = 'delete_post';
    let actionVerb = 'deleted';
    
    if (status === 'published') {
      actionType = 'approve_post';
      actionVerb = 'approved';
    } else if (status === 'payment_pending') {
      actionType = 'approve_post_payment';
      actionVerb = 'approved for payment';
    } else if (status === 'archived') {
      actionType = 'archive_post';
      actionVerb = 'archived';
    }
    
    await logAdminAction(req, {
      action: actionType,
      entityType: 'post',
      entityId: Number(id),
      oldData: { status: currentPost.status },
      newData: { status, paymentLink: paymentLink?.short_url },
      details: `Admin ${req.admin!.email} ${actionVerb} post ${id}`,
    });

    // Send appropriate email based on status
    try {
      if (status === 'published') {
        const { html, text } = tmplPublished({ 
          email: currentPost.email, 
          expiresAt: updateData.expiresAt 
        });
        sendEmail({ 
          to: currentPost.email, 
          subject: '[E‑Matrimonials] Your ad is published', 
          text, 
          html 
        });
      } else if (status === 'payment_pending' && paymentLink) {
        const { html, text } = tmplPaymentRequired({ 
          email: currentPost.email,
          paymentLink: paymentLink.short_url,
          amount: updateData.finalAmount,
          postId: currentPost.id
        });
        sendEmail({ 
          to: currentPost.email, 
          subject: '[E‑Matrimonials] Payment required to publish your ad', 
          text, 
          html 
        });
      }
    } catch (e) {
      console.error('Email sending error:', e);
    }

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
    const expiresAtString = expiresAt.toISOString();

    // Create post
    const [newPost] = await db.insert(posts)
      .values({
        email,
        content,
        userId,
        lookingFor,
        expiresAt: expiresAtString,
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
  const { page = 1, action, adminId, limit: limitParam } = req.query as any;
  // Default 10 per page; cap to 100 to avoid abuse
  const limit = Math.min(100, Math.max(1, Number(limitParam) || 10));
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
      totalPages,
      pageSize: limit
    });

  } catch (error) {
    console.error('Get admin logs error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router; 