import DOMPurify from 'isomorphic-dompurify';

/**
 * Strip all HTML tags from a string to get plain text
 * @param html - HTML string
 * @returns Plain text without HTML tags
 */
export function stripHtml(html: string): string {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Sanitize HTML to allow only safe formatting tags
 * Whitelist: p, br, strong, em, u, ol, ul, li
 * @param html - HTML string to sanitize
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(html: string): string {
    if (!html) return '';

    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li'],
        ALLOWED_ATTR: [], // No attributes allowed
        KEEP_CONTENT: true, // Keep text content even if tags are removed
    });
}

/**
 * Get the character count of visible text (strips HTML tags)
 * @param html - HTML string
 * @returns Character count of plain text
 */
export function getTextLength(html: string): number {
    return stripHtml(html).length;
}
