import { AnalyticsService } from './analyticsService';
import { db } from '../db';
import { posts } from '../db/schema';
import { eq, and, gt, lte, sql } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { sendEmail } from '../utils/sendEmail';
import { tmplExpiryReminder } from '../utils/emailTemplates';

export class CronService {
  // Calculate daily stats for yesterday
  static async calculateDailyStats() {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      console.log(`Calculating daily stats for ${yesterday.toISOString().split('T')[0]}`);
      
      const stats = await AnalyticsService.calculateDailyStats(yesterday);
      
      console.log('Daily stats calculated:', {
        date: stats.date,
        adSubmissions: stats.adSubmissions,
        adApprovals: stats.adApprovals,
        paymentSuccessRate: stats.paymentSuccessRate,
        uniqueEmailSenders: stats.uniqueEmailSenders,
        uniqueEmailRecipients: stats.uniqueEmailRecipients
      });
      
      return stats;
    } catch (error) {
      console.error('Error calculating daily stats:', error);
      throw error;
    }
  }

  // Run daily stats calculation (can be called from cron job)
  static async runDailyStatsJob() {
    try {
      await this.calculateDailyStats();
      console.log('Daily stats job completed successfully');
    } catch (error) {
      console.error('Daily stats job failed:', error);
    }
  }

  /**
   * Check for ads expiring within 48 hours and send reminder emails.
   * Only sends one reminder per ad (tracked via expiryReminderSent flag).
   */
  static async checkExpiringAds() {
    try {
      const now = new Date();
      const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      console.log(`⏰ Checking for ads expiring between now and ${in48Hours.toISOString()}`);

      // Find published posts expiring within 48 hours where reminder hasn't been sent
      const expiringPosts = await db.select()
        .from(posts)
        .where(and(
          eq(posts.status, 'published'),
          eq(posts.expiryReminderSent, false),
          gt(posts.expiresAt, now.toISOString()),           // Not yet expired
          lte(posts.expiresAt, in48Hours.toISOString())     // Expiring within 48h
        ));

      if (expiringPosts.length === 0) {
        console.log('No expiring ads found');
        return;
      }

      console.log(`Found ${expiringPosts.length} expiring ads, sending reminders...`);

      const siteUrl = process.env.CLIENT_BASE_URL || process.env.FRONTEND_URL || 'https://e-matrimonials.com';

      for (const post of expiringPosts) {
        try {
          // Generate signed JWT token for the extend link (valid 48 hours)
          const token = jwt.sign(
            { postId: post.id, type: 'ad_extend' },
            process.env.JWT_SECRET!,
            { expiresIn: '48h' }
          );

          const extendUrl = `${siteUrl}/extend-ad?token=${token}`;
          const expiresAt = new Date(post.expiresAt!);

          // Send reminder email
          const { html, text } = tmplExpiryReminder({
            email: post.email,
            postId: post.id,
            content: post.content,
            expiresAt,
            extendUrl,
          });

          await sendEmail({
            to: post.email,
            subject: '[E‑Matrimonials] Your ad is expiring soon — extend it now!',
            text,
            html,
            disableUnsubscribe: true,
            logMetadata: { senderEmail: 'system', postId: post.id, emailType: 'expiry_reminder' },
          });

          // Mark reminder as sent
          await db.update(posts)
            .set({ expiryReminderSent: true })
            .where(eq(posts.id, post.id));

          console.log(`✅ Expiry reminder sent for post #${post.id} to ${post.email}`);
        } catch (emailError) {
          console.error(`❌ Failed to send expiry reminder for post #${post.id}:`, emailError);
          // Continue with next post even if one fails
        }
      }

      console.log(`Expiry reminder job completed. Processed ${expiringPosts.length} posts.`);
    } catch (error) {
      console.error('Error in checkExpiringAds cron job:', error);
    }
  }
}
