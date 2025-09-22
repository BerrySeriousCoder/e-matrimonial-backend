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
  // Check if there's already a record for this email and post
  const existingRecord = await db.select().from(postEmails)
    .where(and(eq(postEmails.email, email), eq(postEmails.postId, postId)));
  
  if (existingRecord.length > 0) {
    // Update existing record with user_id if it's null (anonymous -> authenticated)
    if (!existingRecord[0].userId && userId) {
      await db.update(postEmails)
        .set({ userId: userId, sentAt: new Date().toISOString() })
        .where(eq(postEmails.id, existingRecord[0].id));
    }
    // If record already has user_id, do nothing (already recorded)
  } else {
    // Insert new record
    await db.insert(postEmails).values({
      userId: userId || null,
      email: email,
      postId,
      sentAt: new Date().toISOString()
    });
  }
};

// Comprehensive email validation (unified for both authenticated and anonymous)
export const validateEmailRequest = async (
  email: string,
  postId: number, 
  message: string,
  userId?: number
): Promise<{ valid: boolean; error?: string }> => {
  
  // Check for URLs in message
  if (containsUrl(message)) {
    return { valid: false, error: 'URLs and links are not allowed in messages' };
  }
  
  // Check if already sent to this post
  if (await hasSentEmailToPost(email, postId, userId)) {
    return { valid: false, error: 'You have already sent an email to this post' };
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