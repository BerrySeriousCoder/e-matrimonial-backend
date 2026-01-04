/**
 * Parse a timestamp string from the database as UTC.
 * 
 * PostgreSQL timestamp columns store values without timezone info.
 * When Drizzle retrieves them as strings, they come as "2026-01-04 16:11:49.699"
 * JavaScript's Date() interprets this as LOCAL time, which is incorrect.
 * 
 * This function normalizes the format and adds 'Z' suffix to indicate UTC.
 */
export function parseDbTimestampAsUtc(timestamp: string): Date {
    // Replace space with 'T' to make it ISO-8601 compatible
    const normalized = timestamp.replace(' ', 'T');
    // Add 'Z' suffix if not present to indicate UTC timezone
    return new Date(normalized.endsWith('Z') ? normalized : normalized + 'Z');
}
