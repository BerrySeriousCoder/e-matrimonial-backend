import jwt from 'jsonwebtoken';

const SESSION_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || 'session-secret';
const SESSION_EXPIRY = '30m'; // 30 minutes

/**
 * Generate a session token for a verified email address.
 * This allows the user to send multiple emails without re-entering OTP.
 */
export function generateSessionToken(email: string): string {
    return jwt.sign(
        { email: email.toLowerCase().trim(), type: 'email-session' },
        SESSION_SECRET,
        { expiresIn: SESSION_EXPIRY }
    );
}

/**
 * Validate a session token and check if it matches the provided email.
 * Returns true if valid and matches, false otherwise.
 */
export function validateSessionToken(token: string, email: string): boolean {
    try {
        const decoded = jwt.verify(token, SESSION_SECRET) as { email: string; type: string };
        return decoded.type === 'email-session' && decoded.email === email.toLowerCase().trim();
    } catch {
        return false;
    }
}
