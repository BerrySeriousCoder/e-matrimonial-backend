import { AnalyticsService } from './analyticsService';

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
}
