import { db } from '../db';
import { adminAnalytics, dataEntryStats, dailyAdminStats } from '../db/schema';
import { eq, gte, desc, sql } from 'drizzle-orm';

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

  // Get admin analytics data
  static async getAdminAnalytics(period: 'daily' | 'weekly' | 'monthly', days: number = 30) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      if (period === 'daily') {
        const dailyStats = await db.select()
          .from(dailyAdminStats)
          .where(gte(dailyAdminStats.date, startDate.toISOString()))
          .orderBy(desc(dailyAdminStats.date));
        
        // If no daily stats available, calculate from raw events
        if (dailyStats.length === 0) {
          console.log('No daily stats found, calculating from raw events');
          return await this.calculateFromRawEvents(startDate, endDate);
        }
        
        return dailyStats;
      }

      if (period === 'weekly') {
        return await db.execute(sql`
          SELECT 
            DATE_TRUNC('week', date::timestamp) as week,
            SUM(ad_submissions) as ad_submissions,
            SUM(ad_approvals) as ad_approvals,
            AVG(payment_success_rate) as payment_success_rate,
            SUM(unique_email_senders) as unique_email_senders,
            SUM(unique_email_recipients) as unique_email_recipients,
            SUM(duration_2weeks) as duration_2weeks,
            SUM(duration_3weeks) as duration_3weeks,
            SUM(duration_4weeks) as duration_4weeks,
            SUM(font_default) as font_default,
            SUM(font_large) as font_large
          FROM daily_admin_stats 
          WHERE date >= ${startDate.toISOString()}
          GROUP BY DATE_TRUNC('week', date::timestamp)
          ORDER BY week DESC
        `);
      }

      if (period === 'monthly') {
        return await db.execute(sql`
          SELECT 
            DATE_TRUNC('month', date::timestamp) as month,
            SUM(ad_submissions) as ad_submissions,
            SUM(ad_approvals) as ad_approvals,
            AVG(payment_success_rate) as payment_success_rate,
            SUM(unique_email_senders) as unique_email_senders,
            SUM(unique_email_recipients) as unique_email_recipients,
            SUM(duration_2weeks) as duration_2weeks,
            SUM(duration_3weeks) as duration_3weeks,
            SUM(duration_4weeks) as duration_4weeks,
            SUM(font_default) as font_default,
            SUM(font_large) as font_large
          FROM daily_admin_stats 
          WHERE date >= ${startDate.toISOString()}
          GROUP BY DATE_TRUNC('month', date::timestamp)
          ORDER BY month DESC
        `);
      }

      return [];
    } catch (error) {
      console.error('Get admin analytics error:', error);
      throw error;
    }
  }

  // Get data entry employee performance
  static async getDataEntryStats(employeeId: string, days: number = 30) {
    try {
      const endDate = new Date();
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

  // Calculate analytics from raw events when daily stats are not available
  static async calculateFromRawEvents(startDate: Date, endDate: Date) {
    try {
      const startOfDay = startDate.toISOString();
      const endOfDay = endDate.toISOString();

      // Get all events in the date range
      const events = await db.select()
        .from(adminAnalytics)
        .where(
          sql`${adminAnalytics.createdAt} >= ${startOfDay} AND ${adminAnalytics.createdAt} <= ${endOfDay}`
        );

      // Group events by date
      const eventsByDate: { [key: string]: any[] } = {};
      events.forEach(event => {
        const date = event.createdAt.split('T')[0];
        if (!eventsByDate[date]) {
          eventsByDate[date] = [];
        }
        eventsByDate[date].push(event);
      });

      // Calculate stats for each date
      const dailyStats = Object.keys(eventsByDate).map(date => {
        const dayEvents = eventsByDate[date];
        
        return {
          id: 0, // Placeholder
          date: date,
          adSubmissions: dayEvents.filter(e => e.eventType === 'ad_submission').length,
          adApprovals: dayEvents.filter(e => e.eventType === 'ad_approval').length,
          paymentSuccessRate: 0, // Will be calculated separately
          uniqueEmailSenders: new Set(dayEvents.filter(e => e.eventType === 'email_sent').map(e => (e.metadata as any)?.fromEmail)).size,
          uniqueEmailRecipients: new Set(dayEvents.filter(e => e.eventType === 'email_sent').map(e => (e.metadata as any)?.toEmail)).size,
          duration2weeks: dayEvents.filter(e => e.eventType === 'ad_submission' && (e.metadata as any)?.duration === 14).length,
          duration3weeks: dayEvents.filter(e => e.eventType === 'ad_submission' && (e.metadata as any)?.duration === 21).length,
          duration4weeks: dayEvents.filter(e => e.eventType === 'ad_submission' && (e.metadata as any)?.duration === 28).length,
          fontDefault: dayEvents.filter(e => e.eventType === 'ad_submission' && (e.metadata as any)?.fontSize === 'default').length,
          fontLarge: dayEvents.filter(e => e.eventType === 'ad_submission' && (e.metadata as any)?.fontSize === 'large').length,
          createdAt: new Date().toISOString()
        };
      });

      return dailyStats.sort((a, b) => b.date.localeCompare(a.date));
    } catch (error) {
      console.error('Error calculating from raw events:', error);
      return [];
    }
  }

  // Get all data entry employees performance (for admin view)
  static async getAllDataEntryStats(days: number = 30) {
    try {
      const endDate = new Date();
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
}
