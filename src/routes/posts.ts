import { Router } from 'express';
import { db } from '../db';
import { posts, users, otps } from '../db/schema';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const router = Router();

// GET /api/posts - paginated (only published and non-expired posts)
router.get('/', async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;
  const lookingFor = req.query.lookingFor as string; // 'bride' or 'groom'
  const search = req.query.search as string; // search term

  // Build where conditions
  const whereConditions = [
    eq(posts.status, 'published'),
    gt(posts.expiresAt, new Date())
  ];

  // Add lookingFor filter if provided
  if (lookingFor && (lookingFor === 'bride' || lookingFor === 'groom')) {
    whereConditions.push(eq(posts.lookingFor, lookingFor));
  }

  // Add search filter if provided
  if (search) {
    whereConditions.push(
      sql`(${posts.email} ILIKE ${`%${search}%`} OR ${posts.content} ILIKE ${`%${search}%`} OR ${posts.content} % ${search})`
    );
  }

  const [postsData, totalCount] = await Promise.all([
    db.select().from(posts)
      .where(and(...whereConditions))
      .orderBy(posts.createdAt)
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` })
      .from(posts)
      .where(and(...whereConditions)),
  ]);

  const total = totalCount[0]?.count || 0;
  const totalPages = Math.ceil(total / limit);

  res.json({
    posts: postsData,
    total,
    page,
    totalPages,
  });
});

// GET /api/posts/:id
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
  
  const result = await db.select().from(posts)
    .where(and(
      eq(posts.id, id),
      eq(posts.status, 'published'),
      gt(posts.expiresAt, new Date())
    ));
  
  if (!result.length) return res.status(404).json({ error: 'Not found' });
  res.json({ post: result[0] });
});

// POST /api/posts - create post with new logic
router.post('/', async (req, res) => {
  const { 
    email, 
    content, 
    otp, 
    lookingFor, 
    duration, 
    fontSize, 
    bgColor 
  } = req.body;

  // Validate required fields
  if (!email || !content || !otp || !lookingFor || !duration) {
    return res.status(400).json({ 
      success: false, 
      message: 'Missing required fields' 
    });
  }

  // Validate lookingFor
  if (!['bride', 'groom'].includes(lookingFor)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid lookingFor value' 
    });
  }

  // Validate duration
  if (![15, 20, 25].includes(duration)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid duration value' 
    });
  }

  // Validate fontSize
  if (fontSize && !['default', 'medium', 'large'].includes(fontSize)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid fontSize value' 
    });
  }

  try {
    // Verify OTP
    const otpRecord = await db.select().from(otps)
      .where(and(
        eq(otps.email, email),
        eq(otps.otp, otp),
        gt(otps.expiresAt, new Date())
      ));

    if (!otpRecord.length) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired OTP' 
      });
    }

    // Check if user already has a post
    const existingUser = await db.select().from(users)
      .where(eq(users.email, email));
    
    if (existingUser.length > 0) {
      const existingPost = await db.select().from(posts)
        .where(eq(posts.userId, existingUser[0].id));
      
      if (existingPost.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'You can post only one ad' 
        });
      }
    }

    // Create or get user
    let userId;
    if (existingUser.length > 0) {
      userId = existingUser[0].id;
    } else {
      // Create new user with random password (they can reset it later)
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
    expiresAt.setDate(expiresAt.getDate() + duration);

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
        status: 'pending'
      })
      .returning();

    // Delete used OTP
    await db.delete(otps).where(eq(otps.email, email));

    res.status(201).json({ 
      success: true, 
      message: 'Post created successfully and pending approval', 
      post: newPost 
    });

  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

export default router; 