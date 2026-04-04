import express from 'express';
import { eq, and, or, desc, sql, gte, lte, like, count } from 'drizzle-orm';
import { db } from '../db';
import { emailLogs, posts } from '../db/schema';
import { requireAdminAuth } from '../middleware/adminAuth';
import { getSignedDownloadUrl, isR2Configured } from '../utils/r2Storage';

const router = express.Router();

router.use(requireAdminAuth);

// GET / - Paginated list of all email logs with filters
router.get('/', async (req: any, res: any) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
    const offset = (page - 1) * limit;

    const {
      senderEmail,
      recipientEmail,
      postId,
      emailType,
      dateFrom,
      dateTo,
      search,
      status,
    } = req.query;

    const conditions: any[] = [];

    if (senderEmail) {
      conditions.push(like(emailLogs.senderEmail, `%${senderEmail}%`));
    }
    if (recipientEmail) {
      conditions.push(like(emailLogs.recipientEmail, `%${recipientEmail}%`));
    }
    if (postId) {
      conditions.push(eq(emailLogs.postId, parseInt(postId as string)));
    }
    if (emailType) {
      conditions.push(eq(emailLogs.emailType, emailType as string));
    }
    if (status) {
      conditions.push(eq(emailLogs.status, status as string));
    }
    if (dateFrom) {
      conditions.push(gte(emailLogs.createdAt, dateFrom as string));
    }
    if (dateTo) {
      conditions.push(lte(emailLogs.createdAt, dateTo as string));
    }
    if (search) {
      const s = `%${search}%`;
      conditions.push(
        or(
          like(emailLogs.senderEmail, s),
          like(emailLogs.recipientEmail, s),
          like(emailLogs.subject, s)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [logs, totalResult] = await Promise.all([
      db.select({
        id: emailLogs.id,
        senderEmail: emailLogs.senderEmail,
        recipientEmail: emailLogs.recipientEmail,
        postId: emailLogs.postId,
        userId: emailLogs.userId,
        subject: emailLogs.subject,
        emailType: emailLogs.emailType,
        attachments: emailLogs.attachments,
        status: emailLogs.status,
        createdAt: emailLogs.createdAt,
      })
        .from(emailLogs)
        .where(whereClause)
        .orderBy(desc(emailLogs.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` })
        .from(emailLogs)
        .where(whereClause),
    ]);

    const total = totalResult[0]?.count || 0;

    res.json({
      success: true,
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Email audit list error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch email logs' });
  }
});

// GET /stats - Aggregate stats
router.get('/stats', async (_req: any, res: any) => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      totalAllTime,
      totalLast7,
      totalLast30,
      byType,
      topSenders,
      topPostsByEmails,
      dailyVolume,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(emailLogs),

      db.select({ count: sql<number>`count(*)::int` })
        .from(emailLogs)
        .where(gte(emailLogs.createdAt, sevenDaysAgo)),

      db.select({ count: sql<number>`count(*)::int` })
        .from(emailLogs)
        .where(gte(emailLogs.createdAt, thirtyDaysAgo)),

      db.select({
        emailType: emailLogs.emailType,
        count: sql<number>`count(*)::int`,
      })
        .from(emailLogs)
        .groupBy(emailLogs.emailType)
        .orderBy(sql`count(*) desc`),

      db.select({
        senderEmail: emailLogs.senderEmail,
        count: sql<number>`count(*)::int`,
      })
        .from(emailLogs)
        .where(eq(emailLogs.emailType, 'contact'))
        .groupBy(emailLogs.senderEmail)
        .orderBy(sql`count(*) desc`)
        .limit(20),

      db.select({
        postId: emailLogs.postId,
        postEmail: posts.email,
        count: sql<number>`count(*)::int`,
      })
        .from(emailLogs)
        .innerJoin(posts, eq(emailLogs.postId, posts.id))
        .where(eq(emailLogs.emailType, 'contact'))
        .groupBy(emailLogs.postId, posts.email)
        .orderBy(sql`count(*) desc`)
        .limit(20),

      db.select({
        date: sql<string>`date(${emailLogs.createdAt})`.as('date'),
        count: sql<number>`count(*)::int`,
      })
        .from(emailLogs)
        .where(gte(emailLogs.createdAt, thirtyDaysAgo))
        .groupBy(sql`date(${emailLogs.createdAt})`)
        .orderBy(sql`date(${emailLogs.createdAt}) asc`),
    ]);

    res.json({
      success: true,
      stats: {
        totalAllTime: totalAllTime[0]?.count || 0,
        totalLast7Days: totalLast7[0]?.count || 0,
        totalLast30Days: totalLast30[0]?.count || 0,
        byType,
        topSenders,
        topPostsByEmails,
        dailyVolume,
      },
    });
  } catch (error) {
    console.error('Email audit stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch email stats' });
  }
});

// GET /by-email/:email - All emails sent by OR received by a specific email
router.get('/by-email/:email', async (req: any, res: any) => {
  try {
    const { email } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
    const offset = (page - 1) * limit;

    const whereClause = or(
      eq(emailLogs.senderEmail, email),
      eq(emailLogs.recipientEmail, email)
    );

    const [logs, totalResult, sentCount, receivedCount] = await Promise.all([
      db.select()
        .from(emailLogs)
        .where(whereClause)
        .orderBy(desc(emailLogs.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` })
        .from(emailLogs)
        .where(whereClause),
      db.select({ count: sql<number>`count(*)::int` })
        .from(emailLogs)
        .where(eq(emailLogs.senderEmail, email)),
      db.select({ count: sql<number>`count(*)::int` })
        .from(emailLogs)
        .where(eq(emailLogs.recipientEmail, email)),
    ]);

    const total = totalResult[0]?.count || 0;

    res.json({
      success: true,
      email,
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      sentCount: sentCount[0]?.count || 0,
      receivedCount: receivedCount[0]?.count || 0,
    });
  } catch (error) {
    console.error('Email audit by-email error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch email history' });
  }
});

// GET /by-post/:postId - All contact emails for a specific post
router.get('/by-post/:postId', async (req: any, res: any) => {
  try {
    const postId = parseInt(req.params.postId);
    if (isNaN(postId)) {
      return res.status(400).json({ success: false, message: 'Invalid post ID' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
    const offset = (page - 1) * limit;

    const whereClause = eq(emailLogs.postId, postId);

    const [logs, totalResult] = await Promise.all([
      db.select()
        .from(emailLogs)
        .where(whereClause)
        .orderBy(desc(emailLogs.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` })
        .from(emailLogs)
        .where(whereClause),
    ]);

    const total = totalResult[0]?.count || 0;

    res.json({
      success: true,
      postId,
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Email audit by-post error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch post email history' });
  }
});

// GET /:id - Single email log detail
router.get('/:id', async (req: any, res: any) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }

    const [log] = await db.select().from(emailLogs).where(eq(emailLogs.id, id));

    if (!log) {
      return res.status(404).json({ success: false, message: 'Email log not found' });
    }

    res.json({ success: true, log });
  } catch (error) {
    console.error('Email audit detail error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch email log' });
  }
});

// GET /:id/attachment/:index - Get signed download URL for an attachment
router.get('/:id/attachment/:index', async (req: any, res: any) => {
  try {
    const id = parseInt(req.params.id);
    const index = parseInt(req.params.index);

    if (isNaN(id) || isNaN(index)) {
      return res.status(400).json({ success: false, message: 'Invalid parameters' });
    }

    if (!isR2Configured()) {
      return res.status(503).json({ success: false, message: 'R2 storage is not configured' });
    }

    const [log] = await db.select({ attachments: emailLogs.attachments })
      .from(emailLogs)
      .where(eq(emailLogs.id, id));

    if (!log) {
      return res.status(404).json({ success: false, message: 'Email log not found' });
    }

    const attachments = log.attachments as any[];
    if (!attachments || index < 0 || index >= attachments.length) {
      return res.status(404).json({ success: false, message: 'Attachment not found' });
    }

    const attachment = attachments[index];
    const url = await getSignedDownloadUrl(attachment.key);

    res.json({
      success: true,
      url,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
    });
  } catch (error) {
    console.error('Email audit attachment error:', error);
    res.status(500).json({ success: false, message: 'Failed to get attachment URL' });
  }
});

export default router;
