import express from 'express';
import { AnalyticsService } from '../services/analyticsService';
import { userAuth } from '../middleware/userAuth';
import { requireAdminAuth } from '../middleware/adminAuth';
import { db } from '../db';
import { dataEntryStats } from '../db/schema';

const router = express.Router();

// Get admin analytics data
router.get('/admin', requireAdminAuth, async (req: any, res) => {
  try {
    const { period = 'daily', days = 30 } = req.query;
    
    console.log('Admin Analytics API - Period:', period, 'Days:', days);
    const analytics = await AnalyticsService.getAdminAnalytics(period, parseInt(days as string));
    console.log('Admin Analytics API - Stats found:', Array.isArray(analytics) ? analytics.length : 0, 'records');
    
    res.json({
      success: true,
      data: analytics,
      period,
      days: parseInt(days as string)
    });
  } catch (error) {
    console.error('Admin analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin analytics'
    });
  }
});

// Get data entry employee performance
router.get('/data-entry/:employeeId', requireAdminAuth, async (req: any, res) => {
  try {
    const { employeeId } = req.params;
    const { days = 30 } = req.query;
    
    const stats = await AnalyticsService.getDataEntryStats(employeeId, parseInt(days as string));
    
    res.json({
      success: true,
      data: stats,
      employeeId,
      days: parseInt(days as string)
    });
  } catch (error) {
    console.error('Data entry stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch data entry stats'
    });
  }
});

// Get all data entry employees performance (admin view)
router.get('/data-entry', requireAdminAuth, async (req: any, res) => {
  try {
    const { days = 30 } = req.query;
    
    console.log('Data Entry Stats API - Days:', days);
    const stats = await AnalyticsService.getAllDataEntryStats(parseInt(days as string));
    console.log('Data Entry Stats API - Stats found:', Array.isArray(stats) ? stats.length : 0, 'records');
    
    res.json({
      success: true,
      data: stats,
      days: parseInt(days as string)
    });
  } catch (error) {
    console.error('All data entry stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch all data entry stats'
    });
  }
});

// Get current user's data entry performance (for employee dashboard)
router.get('/my-performance', requireAdminAuth, async (req: any, res) => {
  try {
    const { days = 30 } = req.query;
    const adminId = req.admin.adminId.toString();
    
    const stats = await AnalyticsService.getDataEntryStats(adminId, parseInt(days as string));
    
    res.json({
      success: true,
      data: stats,
      days: parseInt(days as string)
    });
  } catch (error) {
    console.error('My performance stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch performance stats'
    });
  }
});

// Calculate daily stats (admin only)
router.post('/calculate-daily-stats', requireAdminAuth, async (req: any, res) => {
  try {
    const { date } = req.body;
    const targetDate = date ? new Date(date) : new Date();
    
    const stats = await AnalyticsService.calculateDailyStats(targetDate);
    
    res.json({
      success: true,
      data: stats,
      message: 'Daily stats calculated successfully'
    });
  } catch (error) {
    console.error('Calculate daily stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate daily stats'
    });
  }
});

// Manual trigger for daily stats job (admin only)
router.post('/run-daily-stats-job', requireAdminAuth, async (req: any, res) => {
  try {
    const { CronService } = await import('../services/cronService');
    await CronService.runDailyStatsJob();
    
    res.json({
      success: true,
      message: 'Daily stats job completed successfully'
    });
  } catch (error) {
    console.error('Daily stats job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run daily stats job'
    });
  }
});

export default router;
