import { Router } from 'express';
import { db } from '../db';
import { posts, users, otps, searchFilterOptions, searchSynonymGroups, searchSynonymWords, classificationCategories, classificationOptions } from '../db/schema';
import { eq, and, gt, isNull, inArray, desc, asc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { validate, sanitizeInput, validateQuery, schemas } from '../middleware/validation';
import { userAuth } from '../middleware/userAuth';
import { sendEmail } from '../utils/sendEmail';
import { tmplClientSubmitted } from '../utils/emailTemplates';
import { trackAnalytics } from '../middleware/analytics';
import { stripHtml, getTextLength } from '../utils/htmlUtils';
import { parseDbTimestampAsUtc } from '../utils/dateUtils';
import { enrichPostClassifications } from '../utils/classificationEnricher';

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

// GET /api/posts - paginated, ordered by classification
router.get('/', validateQuery(schemas.postsQuery), async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const lookingFor = req.query.lookingFor as string;
  const search = req.query.search as string;
  const filters = req.query.filters as string;

  // When searching/filtering, fall back to simple time-based ordering
  const isSearching = !!(search && search.trim()) || !!(filters && filters !== '[]');

  // Build base where conditions
  const whereConditions: any[] = [
    eq(posts.status, 'published'),
    gt(posts.expiresAt, new Date().toISOString())
  ];

  if (lookingFor && (lookingFor === 'bride' || lookingFor === 'groom')) {
    whereConditions.push(eq(posts.lookingFor, lookingFor));
  }

  // Search filter with synonym expansion
  if (search && search.trim()) {
    const searchTerms = search.trim().toLowerCase().split(/\s+/);
    const termConditions = await Promise.all(searchTerms.map(async (term) => {
      const expandedTerms = await expandSearchTermsWithSynonyms([term]);
      const synonymConditions = expandedTerms.map(expandedTerm =>
        sql`(
          LOWER(${posts.email}) LIKE ${`%${expandedTerm}%`} OR 
          LOWER(REGEXP_REPLACE(${posts.content}, '<[^>]*>', '', 'g')) LIKE ${`%${expandedTerm}%`}
        )`
      );
      if (synonymConditions.length === 1) return synonymConditions[0];
      return sql`(${synonymConditions.reduce((acc, condition) => sql`${acc} OR ${condition}`)})`;
    }));
    if (termConditions.length > 0) {
      // @ts-ignore
      whereConditions.push(and(...termConditions));
    }
  }

  // Search filter options
  if (filters) {
    try {
      const selectedOptions = JSON.parse(filters);
      if (Array.isArray(selectedOptions) && selectedOptions.length > 0) {
        const filterOpts = await db
          .select({ optionId: searchFilterOptions.id, sectionId: searchFilterOptions.sectionId, value: searchFilterOptions.value })
          .from(searchFilterOptions)
          .where(inArray(searchFilterOptions.id, selectedOptions));

        const sectionGroups = filterOpts.reduce((acc, option) => {
          if (!acc[option.sectionId]) acc[option.sectionId] = [];
          acc[option.sectionId].push(option);
          return acc;
        }, {} as Record<number, typeof filterOpts>);

        const sectionConditions = Object.values(sectionGroups).map(sectionOptions => {
          const optionConditions = sectionOptions.map(opt => {
            const searchValue = opt.value.toLowerCase();
            return sql`(LOWER(${posts.content}) LIKE ${`%${searchValue}%`} OR LOWER(${posts.email}) LIKE ${`%${searchValue}%`})`;
          });
          if (optionConditions.length === 1) return optionConditions[0];
          return sql`(${optionConditions.reduce((acc, c) => sql`${acc} OR ${c}`)})`;
        });

        if (sectionConditions.length > 0) {
          // @ts-ignore
          whereConditions.push(and(...sectionConditions));
        }
      }
    } catch (error) {
      console.error('Error parsing filters:', error);
    }
  }

  const whereClause = and(...whereConditions);

  // Simple search mode: time-based ordering, standard pagination
  if (isSearching) {
    const [postsData, totalCount] = await Promise.all([
      db.select().from(posts)
        .where(whereClause)
        .orderBy(desc(posts.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      db.select({ count: sql<number>`count(*)` }).from(posts).where(whereClause),
    ]);

    const total = totalCount[0]?.count || 0;
    return res.json({ posts: postsData, total, page, totalPages: Math.ceil(total / limit) });
  }

  // Classification-based ordering mode
  // Get counts per classification option for page mapping
  const classificationCounts = await db
    .select({
      classificationId: posts.classificationId,
      count: sql<number>`count(*)::int`,
    })
    .from(posts)
    .where(whereClause)
    .groupBy(posts.classificationId);

  // Get all classification options with their categories, ordered properly
  const allOptions = await db
    .select({
      optionId: classificationOptions.id,
      optionName: classificationOptions.displayName,
      categoryId: classificationCategories.id,
      categoryName: classificationCategories.displayName,
      categoryOrder: classificationCategories.order,
      optionOrder: classificationOptions.order,
    })
    .from(classificationOptions)
    .innerJoin(classificationCategories, eq(classificationOptions.categoryId, classificationCategories.id))
    .where(eq(classificationOptions.isActive, true))
    .orderBy(asc(classificationCategories.order), asc(classificationOptions.order));

  // Build count map: optionId -> postCount
  const countMap = new Map<number | null, number>();
  for (const row of classificationCounts) {
    countMap.set(row.classificationId, row.count);
  }

  // Build page map: each classification option starts on a new page
  const classificationPageMap: {
    optionId: number | null;
    optionName: string;
    categoryId: number | null;
    categoryName: string;
    startPage: number;
    endPage: number;
    postCount: number;
  }[] = [];

  let currentPage = 1;
  for (const opt of allOptions) {
    const postCount = countMap.get(opt.optionId) || 0;
    if (postCount === 0) continue;

    const pagesNeeded = Math.ceil(postCount / limit);
    classificationPageMap.push({
      optionId: opt.optionId,
      optionName: opt.optionName,
      categoryId: opt.categoryId,
      categoryName: opt.categoryName,
      startPage: currentPage,
      endPage: currentPage + pagesNeeded - 1,
      postCount,
    });
    currentPage += pagesNeeded;
  }

  // Add unclassified posts at the end
  const unclassifiedCount = countMap.get(null) || 0;
  if (unclassifiedCount > 0) {
    const pagesNeeded = Math.ceil(unclassifiedCount / limit);
    classificationPageMap.push({
      optionId: null,
      optionName: 'Unclassified',
      categoryId: null,
      categoryName: 'Other',
      startPage: currentPage,
      endPage: currentPage + pagesNeeded - 1,
      postCount: unclassifiedCount,
    });
    currentPage += pagesNeeded;
  }

  const totalPages = currentPage - 1 || 1;
  const clampedPage = Math.min(Math.max(1, page), totalPages);

  // Determine which classification the requested page falls under
  let currentClassification = classificationPageMap.find(
    c => clampedPage >= c.startPage && clampedPage <= c.endPage
  ) || null;

  // If no classifications have posts, return empty
  if (!currentClassification) {
    return res.json({
      posts: [],
      total: 0,
      page: 1,
      totalPages: 1,
      currentClassification: null,
      classificationPageMap: [],
    });
  }

  // Calculate offset within the current classification
  const pageWithinClassification = clampedPage - currentClassification.startPage;
  const offsetWithinClassification = pageWithinClassification * limit;

  // Fetch posts for the current classification
  const classificationWhere = currentClassification.optionId !== null
    ? [...whereConditions, eq(posts.classificationId, currentClassification.optionId)]
    : [...whereConditions, sql`${posts.classificationId} IS NULL`];

  const postsData = await db.select().from(posts)
    .where(and(...classificationWhere))
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .offset(offsetWithinClassification);

  const total = classificationCounts.reduce((sum, c) => sum + c.count, 0);

  res.json({
    posts: postsData,
    total,
    page: clampedPage,
    totalPages,
    currentClassification: {
      optionId: currentClassification.optionId,
      optionName: currentClassification.optionName,
      categoryId: currentClassification.categoryId,
      categoryName: currentClassification.categoryName,
    },
    classificationPageMap,
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
    couponCode,
    classificationId
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
    classificationId: classificationId || null,
    status: 'pending'
  }).returning();

  // Email confirmation to user
  try {
    const { html, text } = tmplClientSubmitted({ email, content, lookingFor });
    sendEmail({
      to: email,
      subject: '[E‑Matrimonials] Your ad request was submitted',
      text,
      html,
      disableUnsubscribe: true,
      logMetadata: { senderEmail: 'system', emailType: 'notification' },
    });
  } catch (e) {
    console.error('Client submit email error:', e);
  }

  enrichPostClassifications(result[0].id, content).catch(() => {});

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
  const { content, lookingFor, duration, fontSize, bgColor, icon, couponCode, classificationId } = req.body;
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
    classificationId: classificationId || null,
    status: 'pending'
  }).returning();

  try {
    const { html, text } = tmplClientSubmitted({ email: userEmail, content, lookingFor });
    sendEmail({
      to: userEmail,
      subject: '[E‑Matrimonials] Your ad request was submitted',
      text,
      html,
      disableUnsubscribe: true,
      logMetadata: { senderEmail: 'system', emailType: 'notification' },
    });
  } catch (e) {
    console.error('Authenticated submit email error:', e);
  }

  enrichPostClassifications(result[0].id, content).catch(() => {});

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