-- Enable required PostgreSQL extensions for search functionality

-- Enable pg_trgm extension for trigram matching (used in search with % operator)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_posts_email_trgm ON posts USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_posts_content_trgm ON posts USING gin (content gin_trgm_ops);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_posts_status_expires_looking ON posts (status, expiresAt, lookingFor);

-- Create function to expire posts
CREATE OR REPLACE FUNCTION expire_posts()
RETURNS void AS $$
BEGIN
  UPDATE posts 
  SET status = 'expired'
  WHERE expiresAt < NOW() AND status = 'published';
END;
$$ LANGUAGE plpgsql;

-- Schedule post expiration check every hour
SELECT cron.schedule('expire-posts', '0 * * * *', 'SELECT expire_posts();');

-- Re-schedule email limits reset (in case it wasn't created before)
SELECT cron.schedule('reset-email-limits', '0 0 * * *', 'SELECT reset_daily_email_limits();'); 