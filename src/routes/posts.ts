import { Router } from 'express';
import { db } from '../db';
import { posts, users, otps, searchFilterOptions } from '../db/schema';
import { eq, and, gt, isNull, inArray, desc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { validate, sanitizeInput, validateQuery, schemas } from '../middleware/validation';
import { userAuth } from '../middleware/userAuth';

const router = Router();

// GET /api/posts - paginated (only published and non-expired posts)
router.get('/', validateQuery(schemas.postsQuery), async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;
  const lookingFor = req.query.lookingFor as string; // 'bride' or 'groom'
  const search = req.query.search as string; // search term
  const filters = req.query.filters as string; // JSON string of selected filter options

  // Build where conditions
  const whereConditions = [
    eq(posts.status, 'published'),
    gt(posts.expiresAt, new Date())
  ];

  // Add lookingFor filter if provided
  if (lookingFor && (lookingFor === 'bride' || lookingFor === 'groom')) {
    whereConditions.push(eq(posts.lookingFor, lookingFor));
  }

  // Enhanced search filter with case-insensitive matching
  if (search) {
    const searchTerms = search.trim().toLowerCase().split(/\s+/);
    
    // Create search conditions for each term
    const searchConditions = searchTerms.map(term => 
      sql`(
        LOWER(${posts.email}) LIKE ${`%${term}%`} OR 
        LOWER(${posts.content}) LIKE ${`%${term}%`} OR
        ${posts.content} % ${term}
      )`
    );
    
    // All search terms must match (AND logic)
    if (searchConditions.length > 0) {
      // @ts-ignore - TypeScript issue with SQL conditions
      whereConditions.push(and(...searchConditions));
    }
  }

  // Add search filter options if provided
  if (filters) {
    try {
      const selectedOptions = JSON.parse(filters);
      if (Array.isArray(selectedOptions) && selectedOptions.length > 0) {
        
        // Get the filter options and their values
        const filterOptions = await db
          .select({
            optionId: searchFilterOptions.id,
            sectionId: searchFilterOptions.sectionId,
            value: searchFilterOptions.value,
          })
          .from(searchFilterOptions)
          .where(inArray(searchFilterOptions.id, selectedOptions));

        // Group options by section
        const sectionGroups = filterOptions.reduce((acc, option) => {
          if (!acc[option.sectionId]) acc[option.sectionId] = [];
          acc[option.sectionId].push(option);
          return acc;
        }, {} as Record<number, typeof filterOptions>);

        // For each section, find posts that match ANY option in that section
        const sectionConditions = Object.values(sectionGroups).map(sectionOptions => {
          const optionValues = sectionOptions.map(opt => opt.value);
          
          // Create search conditions for each option value
          const optionConditions = optionValues.map(value => {
            const searchValue = value.toLowerCase();
            return sql`(
              LOWER(${posts.content}) LIKE ${`%${searchValue}%`} OR
              LOWER(${posts.email}) LIKE ${`%${searchValue}%`}
            )`;
          });
          
          // Any option in this section can match (OR logic within section)
          if (optionConditions.length === 1) {
            return optionConditions[0];
          } else {
            return sql`(${optionConditions.reduce((acc, condition) => sql`${acc} OR ${condition}`)})`;
          }
        });

        // All sections must match (AND logic across sections)
        if (sectionConditions.length > 0) {
          // @ts-ignore - TypeScript issue with SQL conditions
          whereConditions.push(and(...sectionConditions));
        }
      }
    } catch (error) {
      console.error('Error parsing filters:', error);
    }
  }

  const [postsData, totalCount] = await Promise.all([
    db.select().from(posts)
      .where(and(...whereConditions))
      .orderBy(desc(posts.createdAt))
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
router.post('/', sanitizeInput, validate(schemas.createPost), async (req, res) => {
  const { 
    email, 
    content, 
    otp, 
    lookingFor, 
    duration, 
    fontSize, 
    bgColor 
  } = req.body;

  // Verify OTP
  const now = new Date();
  const found = await db.select().from(otps).where(eq(otps.email, email));
  const valid = found.find(r => r.otp === otp && r.expiresAt > now);
  if (!valid) return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  await db.delete(otps).where(eq(otps.email, email));

  // Create post (expiresAt will be set when admin approves)
  const result = await db.insert(posts).values({
    email,
    content,
    lookingFor,
    fontSize,
    bgColor,
    status: 'pending'
  }).returning();

  res.json({ success: true, message: 'Post created and pending approval', postId: result[0].id });
});

// POST /api/posts/authenticated - create post for authenticated users (no OTP required)
router.post('/authenticated', userAuth, sanitizeInput, validate(schemas.createAuthenticatedPost), async (req: any, res) => {
  const { content, lookingFor, duration, fontSize, bgColor } = req.body;
  const userEmail = req.user.email; // From JWT token

  // Create post (expiresAt will be set when admin approves)
  const result = await db.insert(posts).values({
    email: userEmail,
    content,
    lookingFor,
    fontSize,
    bgColor,
    status: 'pending'
  }).returning();

  res.json({ success: true, message: 'Post created and pending approval', postId: result[0].id });
});

export default router; 