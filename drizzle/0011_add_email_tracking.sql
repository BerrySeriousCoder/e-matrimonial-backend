-- Add email column for anonymous tracking
ALTER TABLE post_emails ADD COLUMN email VARCHAR(255);

-- Add unique constraint for anonymous emails (email + post_id)
ALTER TABLE post_emails ADD CONSTRAINT post_emails_email_post_unique 
UNIQUE (email, post_id) WHERE email IS NOT NULL;

-- Backfill existing authenticated emails with user's email
UPDATE post_emails 
SET email = users.email 
FROM users 
WHERE post_emails.user_id = users.id 
AND post_emails.email IS NULL; 