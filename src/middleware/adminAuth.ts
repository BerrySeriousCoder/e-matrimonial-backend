import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { admins } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface AdminRequest extends Request {
  admin?: {
    adminId: number;
    email: string;
    isSuperadmin: boolean;
    role?: 'superadmin' | 'admin' | 'data_entry';
  };
}

// Check if an email is the superadmin
export const isSuperadmin = (email: string): boolean => {
  const superadminEmail = process.env.SUPERADMIN_EMAIL;
  return superadminEmail ? email === superadminEmail : false;
};

export const requireAdminAuth = (req: AdminRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Admin token required' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { adminId: number; email: string; isSuperadmin: boolean; role?: 'superadmin' | 'admin' | 'data_entry' };
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid admin token' });
  }
};

export const requireSuperadminAuth = (req: AdminRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Admin token required' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { adminId: number; email: string; isSuperadmin: boolean; role?: 'superadmin' | 'admin' | 'data_entry' };
    
    if (!(decoded.isSuperadmin || decoded.role === 'superadmin')) {
      return res.status(403).json({ success: false, message: 'Superadmin access required' });
    }
    
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid admin token' });
  }
}; 

// Generic role guard - superadmin always allowed
export const requireRole = (roles: Array<'superadmin' | 'admin' | 'data_entry'>) => {
  return async (req: AdminRequest, res: Response, next: NextFunction) => {
    // Ensure authenticated
    requireAdminAuth(req, res, async () => {
      try {
        const current = req.admin!;
        // Superadmin always allowed
        if (current.isSuperadmin || current.role === 'superadmin') {
          return next();
        }

        // If role missing in token (old tokens), fetch from DB
        let role = current.role;
        if (!role) {
          const [row] = await db.select({ role: admins.role }).from(admins).where(eq(admins.id, current.adminId));
          role = row?.role as any;
          req.admin = { ...current, role };
        }

        if (!role || !roles.includes(role)) {
          return res.status(403).json({ success: false, message: 'Insufficient role permissions' });
        }
        next();
      } catch (e) {
        return res.status(401).json({ success: false, message: 'Invalid admin token' });
      }
    });
  };
};