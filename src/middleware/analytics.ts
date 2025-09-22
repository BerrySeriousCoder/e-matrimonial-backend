import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from '../services/analyticsService';

// Generate session ID for anonymous users
function generateSessionId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Analytics middleware for tracking events
export function trackAnalytics(eventType: string, metadata?: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Track the event
    const sessionId = req.headers['x-session-id'] as string || generateSessionId();
    const userId = (req as any).user?.id || (req as any).admin?.id;
    
    AnalyticsService.trackEvent({
      eventType: eventType as any,
      userId: userId,
      sessionId: sessionId,
      pagePath: req.path,
      metadata: metadata
    });

    // Add session ID to response headers for client to store
    if (!req.headers['x-session-id']) {
      res.setHeader('X-Session-ID', sessionId);
    }

    next();
  };
}

// Middleware for tracking data entry employee performance
export function trackDataEntryPerformance(employeeId: string, action: 'create' | 'approve' | 'reject' | 'edit', metadata?: any) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get existing stats for today
      const existingStats = await AnalyticsService.getDataEntryStats(employeeId, 1);
      const todayStats = existingStats.find(stat => stat.date.startsWith(today));
      
      // Update stats based on action
      const stats = {
        employeeId,
        date: today,
        postsCreated: todayStats?.postsCreated || 0,
        postsApproved: todayStats?.postsApproved || 0,
        postsRejected: todayStats?.postsRejected || 0,
        postsEdited: todayStats?.postsEdited || 0,
        totalCharacters: todayStats?.totalCharacters || 0
      };

      if (action === 'create') {
        stats.postsCreated++;
        if (metadata?.characterCount) {
          stats.totalCharacters += metadata.characterCount;
        }
      } else if (action === 'approve') {
        stats.postsApproved++;
      } else if (action === 'reject') {
        stats.postsRejected++;
      } else if (action === 'edit') {
        stats.postsEdited++;
      }

      // Track the updated stats
      await AnalyticsService.trackDataEntryStats(stats);
      
      next();
    } catch (error) {
      console.error('Data entry performance tracking error:', error);
      next(); // Don't break the main flow
    }
  };
}

// Middleware for tracking email events
export function trackEmailEvent(fromEmail: string, toEmail: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const sessionId = req.headers['x-session-id'] as string || generateSessionId();
    const userId = (req as any).user?.id || (req as any).admin?.id;
    
    AnalyticsService.trackEvent({
      eventType: 'email_sent',
      userId: userId,
      sessionId: sessionId,
      pagePath: req.path,
      metadata: {
        fromEmail,
        toEmail
      }
    });

    next();
  };
}

// Middleware for tracking profile selections
export function trackProfileSelection(profileId: number, action: 'select' | 'unselect') {
  return (req: Request, res: Response, next: NextFunction) => {
    const sessionId = req.headers['x-session-id'] as string || generateSessionId();
    const userId = (req as any).user?.id || (req as any).admin?.id;
    
    AnalyticsService.trackEvent({
      eventType: 'profile_selection',
      userId: userId,
      sessionId: sessionId,
      pagePath: req.path,
      metadata: {
        profileId,
        action
      }
    });

    next();
  };
}
