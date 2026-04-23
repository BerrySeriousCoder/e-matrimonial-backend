import { db } from '../db';
import { adminAnalytics, dataEntryStats } from '../db/schema';
import { desc, sql } from 'drizzle-orm';

export interface AnalyticsEvent {
  eventType: 'ad_submission' | 'ad_approval' | 'ad_rejection' | 'payment_success' | 'payment_failure' | 'email_sent' | 'profile_selection';
  userId?: string;
  sessionId?: string;
  pagePath?: string;
  metadata?: any;
}

export interface DailyStats {
  date: string;
  adSubmissions: number;
  adApprovals: number;
  paymentSuccessRate: number;
  uniqueEmailSenders: number;
  uniqueEmailRecipients: number;
  duration2weeks: number;
  duration3weeks: number;
  duration4weeks: number;
  fontDefault: number;
  fontLarge: number;
}

export interface DataEntryStats {
  employeeId: string;
  date: string;
  postsCreated: number;
  postsApproved: number;
  postsRejected: number;
  postsEdited: number;
  totalCharacters: number;
}

export class AnalyticsService {
  // Track analytics event
  static async trackEvent(event: AnalyticsEvent) {
    try {
      await db.insert(adminAnalytics).values({
        eventType: event.eventType,
        userId: event.userId,
        sessionId: event.sessionId,
        pagePath: event.pagePath,
        metadata: event.metadata,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Analytics tracking error:', error);
      // Don't throw error to avoid breaking main functionality
    }
  }

  // Track data entry employee performance
  static async trackDataEntryStats(stats: DataEntryStats) {
    try {
      await db.insert(dataEntryStats).values({
        employeeId: stats.employeeId,
        date: stats.date,
        postsCreated: stats.postsCreated,
        postsApproved: stats.postsApproved,
        postsRejected: stats.postsRejected,
        postsEdited: stats.postsEdited,
        totalCharacters: stats.totalCharacters,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Data entry stats tracking error:', error);
    }
  }

  // Calculate and store daily admin stats
  static async calculateDailyStats(date: Date) {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const startOfDayISO = startOfDay.toISOString();
      const endOfDayISO = endOfDay.toISOString();

      // Get all events for the day
      const events = await db.select()
        .from(adminAnalytics)
        .where(
          sql`${adminAnalytics.createdAt} >= ${startOfDayISO} AND ${adminAnalytics.createdAt} <= ${endOfDayISO}`
        );

      // Calculate stats
      const stats = {
        date: startOfDayISO,
        adSubmissions: events.filter(e => e.eventType === 'ad_submission').length,
        adApprovals: events.filter(e => e.eventType === 'ad_approval').length,
        paymentSuccessRate: 0,
        uniqueEmailSenders: 0,
        uniqueEmailRecipients: 0,
        duration2weeks: 0,
        duration3weeks: 0,
        duration4weeks: 0,
        fontDefault: 0,
        fontLarge: 0
      };

      // Calculate payment success rate
      const paymentEvents = events.filter(e => e.eventType === 'payment_success' || e.eventType === 'payment_failure');
      if (paymentEvents.length > 0) {
        const successCount = paymentEvents.filter(e => e.eventType === 'payment_success').length;
        stats.paymentSuccessRate = (successCount / paymentEvents.length) * 100;
      }

      // Calculate unique email senders and recipients
      const emailEvents = events.filter(e => e.eventType === 'email_sent');
      const uniqueSenders = new Set(emailEvents.map(e => (e.metadata as any)?.fromEmail).filter(Boolean));
      const uniqueRecipients = new Set(emailEvents.map(e => (e.metadata as any)?.toEmail).filter(Boolean));
      stats.uniqueEmailSenders = uniqueSenders.size;
      stats.uniqueEmailRecipients = uniqueRecipients.size;

      // Calculate content preferences
      const submissionEvents = events.filter(e => e.eventType === 'ad_submission');
      submissionEvents.forEach(event => {
        const metadata = event.metadata as any;
        if (metadata?.duration === 14) stats.duration2weeks++;
        if (metadata?.duration === 21) stats.duration3weeks++;
        if (metadata?.duration === 28) stats.duration4weeks++;
        if (metadata?.fontSize === 'default') stats.fontDefault++;
        if (metadata?.fontSize === 'large') stats.fontLarge++;
      });

      // Store daily stats (upsert - update if exists, insert if not)
      await db.execute(sql`
        INSERT INTO daily_admin_stats (date, ad_submissions, ad_approvals, payment_success_rate, unique_email_senders, unique_email_recipients, duration_2weeks, duration_3weeks, duration_4weeks, font_default, font_large, created_at)
        VALUES (${stats.date}, ${stats.adSubmissions}, ${stats.adApprovals}, ${stats.paymentSuccessRate.toString()}, ${stats.uniqueEmailSenders}, ${stats.uniqueEmailRecipients}, ${stats.duration2weeks}, ${stats.duration3weeks}, ${stats.duration4weeks}, ${stats.fontDefault}, ${stats.fontLarge}, ${new Date().toISOString()})
        ON CONFLICT (date) 
        DO UPDATE SET
          ad_submissions = EXCLUDED.ad_submissions,
          ad_approvals = EXCLUDED.ad_approvals,
          payment_success_rate = EXCLUDED.payment_success_rate,
          unique_email_senders = EXCLUDED.unique_email_senders,
          unique_email_recipients = EXCLUDED.unique_email_recipients,
          duration_2weeks = EXCLUDED.duration_2weeks,
          duration_3weeks = EXCLUDED.duration_3weeks,
          duration_4weeks = EXCLUDED.duration_4weeks,
          font_default = EXCLUDED.font_default,
          font_large = EXCLUDED.font_large,
          created_at = EXCLUDED.created_at
      `);

      return stats;
    } catch (error) {
      console.error('Daily stats calculation error:', error);
      throw error;
    }
  }

  // Get data entry employee performance
  static async getDataEntryStats(employeeId: string, days: number = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      return await db.select()
        .from(dataEntryStats)
        .where(
          sql`${dataEntryStats.employeeId} = ${employeeId} AND ${dataEntryStats.date} >= ${startDate.toISOString()}`
        )
        .orderBy(desc(dataEntryStats.date));
    } catch (error) {
      console.error('Get data entry stats error:', error);
      throw error;
    }
  }

  // Get all data entry employees performance (for admin view)
  static async getAllDataEntryStats(days: number = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      return await db.execute(sql`
        SELECT 
          employee_id,
          SUM(posts_created) as total_posts_created,
          SUM(posts_approved) as total_posts_approved,
          SUM(posts_rejected) as total_posts_rejected,
          SUM(posts_edited) as total_posts_edited,
          SUM(total_characters) as total_characters,
          AVG(posts_created) as avg_posts_per_day,
          COUNT(DISTINCT date) as active_days
        FROM data_entry_stats 
        WHERE date >= ${startDate.toISOString()}
        GROUP BY employee_id
        ORDER BY total_posts_created DESC
      `);
    } catch (error) {
      console.error('Get all data entry stats error:', error);
      throw error;
    }
  }

  // Get aggregated analytics stats for a date range (calculated on-demand from raw events)
  static async getAggregatedStats(startDate: Date, endDate: Date) {
    try {
      const startISO = startDate.toISOString();
      const endISO = endDate.toISOString();

      const result = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE event_type = 'ad_submission') as ad_submissions,
          COUNT(*) FILTER (WHERE event_type = 'ad_approval') as ad_approvals,
          COUNT(*) FILTER (WHERE event_type = 'payment_success') as payment_successes,
          COUNT(*) FILTER (WHERE event_type = 'payment_failure') as payment_failures,
          COUNT(DISTINCT CASE WHEN event_type = 'email_sent' THEN metadata->>'fromEmail' END) as unique_email_senders,
          COUNT(DISTINCT CASE WHEN event_type = 'email_sent' THEN metadata->>'toEmail' END) as unique_email_recipients,
          COUNT(*) FILTER (WHERE event_type = 'ad_submission' AND (metadata->>'duration')::int = 14) as duration_2weeks,
          COUNT(*) FILTER (WHERE event_type = 'ad_submission' AND (metadata->>'duration')::int = 21) as duration_3weeks,
          COUNT(*) FILTER (WHERE event_type = 'ad_submission' AND (metadata->>'duration')::int = 28) as duration_4weeks,
          COUNT(*) FILTER (WHERE event_type = 'ad_submission' AND metadata->>'fontSize' = 'default') as font_default,
          COUNT(*) FILTER (WHERE event_type = 'ad_submission' AND metadata->>'fontSize' = 'large') as font_large
        FROM admin_analytics
        WHERE created_at >= ${startISO} AND created_at <= ${endISO}
      `);

      const row = (result.rows && result.rows[0]) || {};
      const successes = Number(row.payment_successes) || 0;
      const failures = Number(row.payment_failures) || 0;
      const totalPayments = successes + failures;

      return {
        adSubmissions: Number(row.ad_submissions) || 0,
        adApprovals: Number(row.ad_approvals) || 0,
        paymentSuccessRate: totalPayments > 0 ? (successes / totalPayments) * 100 : 0,
        uniqueEmailSenders: Number(row.unique_email_senders) || 0,
        uniqueEmailRecipients: Number(row.unique_email_recipients) || 0,
        duration2weeks: Number(row.duration_2weeks) || 0,
        duration3weeks: Number(row.duration_3weeks) || 0,
        duration4weeks: Number(row.duration_4weeks) || 0,
        fontDefault: Number(row.font_default) || 0,
        fontLarge: Number(row.font_large) || 0,
        dateRange: { start: startISO, end: endISO }
      };
    } catch (error) {
      console.error('Get aggregated stats error:', error);
      throw error;
    }
  }
}
