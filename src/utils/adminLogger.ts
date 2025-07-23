import { db } from '../db';
import { adminLogs } from '../db/schema';
import { AdminRequest } from '../middleware/adminAuth';

export interface LogAction {
  action: string;
  entityType: string;
  entityId?: number;
  oldData?: any;
  newData?: any;
  details?: string;
}

export const logAdminAction = async (
  req: AdminRequest,
  logData: LogAction
) => {
  if (!req.admin) return;

  try {
    await db.insert(adminLogs).values({
      adminId: req.admin.adminId,
      action: logData.action,
      entityType: logData.entityType,
      entityId: logData.entityId,
      oldData: logData.oldData,
      newData: logData.newData,
      details: logData.details,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
    });
  } catch (error) {
    console.error('Failed to log admin action:', error);
  }
}; 