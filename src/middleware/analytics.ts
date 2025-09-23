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
      
      // Record DELTA rows per action to avoid double-counting when summing
      const deltaStats = {
        employeeId,
        date: today,
        postsCreated: 0,
        postsApproved: 0,
        postsRejected: 0,
        postsEdited: 0,
        totalCharacters: 0
      };

      if (action === 'create') {
        deltaStats.postsCreated = 1;
        if (metadata?.characterCount) {
          deltaStats.totalCharacters = metadata.characterCount;
        }
      } else if (action === 'approve') {
        deltaStats.postsApproved = 1;
      } else if (action === 'reject') {
        deltaStats.postsRejected = 1;
      } else if (action === 'edit') {
        deltaStats.postsEdited = 1;
        if (metadata?.characterCount) {
          deltaStats.totalCharacters = metadata.characterCount;
        }
      }

      // Insert the delta row
      await AnalyticsService.trackDataEntryStats(deltaStats);
      
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
