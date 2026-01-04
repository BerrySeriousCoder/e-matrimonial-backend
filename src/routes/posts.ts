import { Router } from 'express';
import { db } from '../db';
import { posts, users, otps, searchFilterOptions, searchSynonymGroups, searchSynonymWords } from '../db/schema';
import { eq, and, gt, isNull, inArray, desc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { validate, sanitizeInput, validateQuery, schemas } from '../middleware/validation';
import { userAuth } from '../middleware/userAuth';
import { sendEmail } from '../utils/sendEmail';
import { tmplClientSubmitted } from '../utils/emailTemplates';
import { trackAnalytics } from '../middleware/analytics';
import { stripHtml, getTextLength } from '../utils/htmlUtils';
import { parseDbTimestampAsUtc } from '../utils/dateUtils';

// Helper function to expand search terms using synonym dictionary
async function expandSearchTermsWithSynonyms(terms: string[]): Promise<string[]> {
  const expandedTerms = new Set<string>();

  // Add original terms first
  terms.forEach(term => expandedTerms.add(term.toLowerCase()));

  // Get all active synonym groups with their words
  const synonymWords = await db
    .select({
      word: searchSynonymWords.word,
      groupId: searchSynonymWords.groupId,
    })
    .from(searchSynonymWords)
    .innerJoin(searchSynonymGroups, eq(searchSynonymWords.groupId, searchSynonymGroups.id))
    .where(eq(searchSynonymGroups.isActive, true));

  // Create a map of word -> groupId for quick lookup
  const wordToGroup = new Map<string, number>();
  const groupToWords = new Map<number, string[]>();

  synonymWords.forEach(sw => {
    const lowerWord = sw.word.toLowerCase();
    wordToGroup.set(lowerWord, sw.groupId);

    if (!groupToWords.has(sw.groupId)) {
      groupToWords.set(sw.groupId, []);
    }
    groupToWords.get(sw.groupId)!.push(lowerWord);
  });

  // For each search term, check if it's in a synonym group
  terms.forEach(term => {
    const lowerTerm = term.toLowerCase();
    const groupId = wordToGroup.get(lowerTerm);

    if (groupId !== undefined) {
      // Add all words from this synonym group
      const synonymsInGroup = groupToWords.get(groupId) || [];
      synonymsInGroup.forEach(synonym => expandedTerms.add(synonym));
    }
  });

  return Array.from(expandedTerms);
}

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
    gt(posts.expiresAt, new Date().toISOString())
  ];

  // Add lookingFor filter if provided
  if (lookingFor && (lookingFor === 'bride' || lookingFor === 'groom')) {
    whereConditions.push(eq(posts.lookingFor, lookingFor));
  }

  // Enhanced search filter with case-insensitive matching and synonym expansion
  if (search) {
    const searchTerms = search.trim().toLowerCase().split(/\s+/);

    // Expand each search term using synonym dictionary
    // For each original term, we get all related synonyms and search for any of them
    const termConditions = await Promise.all(searchTerms.map(async (term) => {
      // Get expanded terms for this single term
      const expandedTerms = await expandSearchTermsWithSynonyms([term]);

      // Create OR conditions for all expanded terms (synonyms)
      const synonymConditions = expandedTerms.map(expandedTerm =>
        sql`(
          LOWER(${posts.email}) LIKE ${`%${expandedTerm}%`} OR 
          LOWER(REGEXP_REPLACE(${posts.content}, '<[^>]*>', '', 'g')) LIKE ${`%${expandedTerm}%`}
        )`
      );

      // Any synonym can match for this term (OR logic for synonyms)
      if (synonymConditions.length === 1) {
        return synonymConditions[0];
      }
      return sql`(${synonymConditions.reduce((acc, condition) => sql`${acc} OR ${condition}`)})`;
    }));

    // All original search terms must match (AND logic across terms)
    if (termConditions.length > 0) {
      // @ts-ignore - TypeScript issue with SQL conditions
      whereConditions.push(and(...termConditions));
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
      gt(posts.expiresAt, new Date().toISOString())
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
    bgColor,
    icon,
    couponCode
  } = req.body;

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

  // Delete all OTPs for this email (cleanup - non-blocking)
  try {
    await db.delete(otps).where(eq(otps.email, email));
  } catch (otpDeleteError) {
    console.warn('Failed to delete OTP after validation:', otpDeleteError);
  }

  // Create post (expiresAt will be set when admin approves)
  const result = await db.insert(posts).values({
    email,
    content,
    lookingFor,
    duration: duration || 14, // Save duration for payment calculation
    fontSize,
    bgColor,
    icon: icon || null,
    couponCode: couponCode || null,
    status: 'pending'
  }).returning();

  // Email confirmation to user
  try {
    const { html, text } = tmplClientSubmitted({ email, content, lookingFor });
    sendEmail({ to: email, subject: '[E‑Matrimonials] Your ad request was submitted', text, html });
  } catch (e) {
    console.error('Client submit email error:', e);
  }

  // Track analytics event
  trackAnalytics('ad_submission', {
    duration,
    fontSize,
    lookingFor,
    characterCount: getTextLength(content),
    couponCode: couponCode || null
  })(req, res, () => {
    res.json({ success: true, message: 'Post created and pending approval', postId: result[0].id });
  });
});

// POST /api/posts/authenticated - create post for authenticated users (no OTP required)
router.post('/authenticated', userAuth, sanitizeInput, validate(schemas.createAuthenticatedPost), async (req: any, res) => {
  const { content, lookingFor, duration, fontSize, bgColor, icon, couponCode } = req.body;
  const userEmail = req.user.email; // From JWT token

  // Create post (expiresAt will be set when admin approves)
  const result = await db.insert(posts).values({
    email: userEmail,
    content,
    lookingFor,
    duration: duration || 14, // Save duration for payment calculation
    fontSize,
    bgColor,
    icon: icon || null,
    couponCode: couponCode || null,
    status: 'pending'
  }).returning();

  try {
    const { html, text } = tmplClientSubmitted({ email: userEmail, content, lookingFor });
    sendEmail({ to: userEmail, subject: '[E‑Matrimonials] Your ad request was submitted', text, html });
  } catch (e) {
    console.error('Authenticated submit email error:', e);
  }

  // Track analytics event
  trackAnalytics('ad_submission', {
    duration,
    fontSize,
    lookingFor,
    characterCount: getTextLength(content),
    couponCode: couponCode || null
  })(req, res, () => {
    res.json({ success: true, message: 'Post created and pending approval', postId: result[0].id });
  });
});

export default router; 