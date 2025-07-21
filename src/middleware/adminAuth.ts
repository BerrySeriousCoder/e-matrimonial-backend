import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AdminRequest extends Request {
  admin?: {
    adminId: number;
    email: string;
    isSuperadmin: boolean;
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { adminId: number; email: string; isSuperadmin: boolean };
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { adminId: number; email: string; isSuperadmin: boolean };
    
    if (!decoded.isSuperadmin) {
      return res.status(403).json({ success: false, message: 'Superadmin access required' });
    }
    
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid admin token' });
  }
}; 