import { db } from '../db';
import { postEmails, userEmailLimits } from '../db/schema';
import { and, eq, gte, count, sql, or } from 'drizzle-orm';

// URL detection in messages
export const containsUrl = (message: string): boolean => {
  const urlPattern = /https?:\/\/|www\.|\.com|\.org|\.net|\.io|\.co|\.in|\.uk|\.au|\.ca|\.de|\.fr|\.jp|\.cn|\.ru|\.br|\.mx|\.es|\.it|\.nl|\.se|\.no|\.dk|\.fi|\.pl|\.cz|\.hu|\.ro|\.bg|\.hr|\.si|\.sk|\.lt|\.lv|\.ee|\.mt|\.cy|\.gr|\.pt|\.ie|\.lu|\.be|\.at|\.ch|\.li|\.mc|\.ad|\.sm|\.va|\.mt|\.al|\.ba|\.me|\.mk|\.rs|\.tr|\.ge|\.am|\.az|\.by|\.kz|\.kg|\.md|\.tj|\.tm|\.uz|\.ua|\.uz|\.tm|\.tj|\.md|\.kg|\.kz|\.by|\.az|\.am|\.ge|\.tr|\.rs|\.mk|\.me|\.ba|\.al|\.mt|\.va|\.sm|\.ad|\.mc|\.li|\.ch|\.at|\.be|\.lu|\.ie|\.pt|\.gr|\.cy|\.mt|\.ee|\.lv|\.lt|\.sk|\.si|\.hr|\.bg|\.ro|\.hu|\.cz|\.pl|\.fi|\.dk|\.no|\.se|\.nl|\.it|\.es|\.mx|\.br|\.ru|\.cn|\.jp|\.fr|\.de|\.ca|\.au|\.uk|\.in|\.co|\.io|\.net|\.org|\.com/i;
  return urlPattern.test(message);
};

// Check if user already sent email to this post (unified for both authenticated and anonymous)
export const hasSentEmailToPost = async (email: string, postId: number, userId?: number): Promise<boolean> => {
  if (userId) {
    // Authenticated user - check by user_id OR by email (in case they sent anonymously before)
    const existing = await db.select().from(postEmails)
      .where(and(
        eq(postEmails.postId, postId),
        or(
          eq(postEmails.userId, userId),
          eq(postEmails.email, email)
        )
      ));
    return existing.length > 0;
  } else {
    // Anonymous user - check by email
    const existing = await db.select().from(postEmails)
      .where(and(eq(postEmails.email, email), eq(postEmails.postId, postId)));
    return existing.length > 0;
  }
};

// Check hourly limit (50 emails per hour)
export const checkHourlyLimit = async (userId: number): Promise<boolean> => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const countResult = await db.select({ count: count() }).from(postEmails)
    .where(and(
      eq(postEmails.userId, userId),
      gte(postEmails.sentAt, oneHourAgo.toISOString())
    ));

  return countResult[0].count < 50;
};

// Check daily limit (150 emails per day) with automatic reset
export const checkDailyLimit = async (userId: number): Promise<boolean> => {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

  // Get or create user limit record
  let userLimit = await db.select().from(userEmailLimits).where(eq(userEmailLimits.userId, userId));

  if (!userLimit.length) {
    // First time user
    await db.insert(userEmailLimits).values({
      userId,
      dailyCount: 0,
      lastResetDate: today
    });
    return true;
  }

  // Check if we need to reset daily count (automatic reset at midnight)
  if (userLimit[0].lastResetDate !== today) {
    await db.update(userEmailLimits)
      .set({ dailyCount: 0, lastResetDate: today })
      .where(eq(userEmailLimits.userId, userId));
    return true;
  }

  return userLimit[0].dailyCount < 150;
};

// Check cooldown (15 seconds between emails)
export const checkCooldown = async (userId: number): Promise<boolean> => {
  const fifteenSecondsAgo = new Date(Date.now() - 15 * 1000);
  const recentEmail = await db.select().from(postEmails)
    .where(and(
      eq(postEmails.userId, userId),
      gte(postEmails.sentAt, fifteenSecondsAgo.toISOString())
    ))
    .limit(1);

  return recentEmail.length === 0;
};

// Increment daily count
export const incrementDailyCount = async (userId: number): Promise<void> => {
  await db.update(userEmailLimits)
    .set({ dailyCount: sql`${userEmailLimits.dailyCount} + 1` })
    .where(eq(userEmailLimits.userId, userId));
};

// Record email sent (unified for both authenticated and anonymous)
export const recordEmailSent = async (email: string, postId: number, userId?: number): Promise<void> => {
  // Always insert new record (allowing multiple emails to same post now)
  await db.insert(postEmails).values({
    userId: userId || null,
    email: email,
    postId,
    sentAt: new Date().toISOString()
  });
};

// Get email history for a specific post (for duplicate email warning)
export const getEmailHistory = async (
  email: string,
  postId: number,
  userId?: number
): Promise<{ sentAt: string }[]> => {
  if (userId) {
    // Authenticated user - get by user_id OR by email
    const history = await db.select({ sentAt: postEmails.sentAt }).from(postEmails)
      .where(and(
        eq(postEmails.postId, postId),
        or(
          eq(postEmails.userId, userId),
          eq(postEmails.email, email)
        )
      ))
      .orderBy(postEmails.sentAt);
    return history;
  } else {
    // Anonymous user - check by email
    const history = await db.select({ sentAt: postEmails.sentAt }).from(postEmails)
      .where(and(eq(postEmails.email, email), eq(postEmails.postId, postId)))
      .orderBy(postEmails.sentAt);
    return history;
  }
};

// Comprehensive email validation (unified for both authenticated and anonymous)
// forceResend: if true, skip the duplicate check (user confirmed they want to resend)
export const validateEmailRequest = async (
  email: string,
  postId: number,
  message: string,
  userId?: number,
  forceResend?: boolean
): Promise<{ valid: boolean; error?: string; previousEmails?: { sentAt: string }[] }> => {

  // Check for URLs in message
  if (containsUrl(message)) {
    return { valid: false, error: 'URLs and links are not allowed in messages' };
  }

  // Check if already sent to this post (unless forceResend is true)
  if (!forceResend) {
    const history = await getEmailHistory(email, postId, userId);
    if (history.length > 0) {
      return {
        valid: false,
        error: 'duplicate_email',
        previousEmails: history
      };
    }
  }

  // For authenticated users, check rate limits
  if (userId) {
    // Check hourly limit
    if (!(await checkHourlyLimit(userId))) {
      return { valid: false, error: 'Hourly email limit exceeded (50 emails per hour)' };
    }

    // Check daily limit
    if (!(await checkDailyLimit(userId))) {
      return { valid: false, error: 'Daily email limit exceeded (150 emails per day)' };
    }

    // Check cooldown
    if (!(await checkCooldown(userId))) {
      return { valid: false, error: 'Please wait 15 seconds between emails' };
    }
  }

  return { valid: true };
}; 