-- Add 'expired' to status enum
ALTER TYPE status ADD VALUE 'expired';

-- Create function to expire posts
CREATE OR REPLACE FUNCTION expire_posts()
RETURNS void AS $$
BEGIN
  UPDATE posts 
  SET status = 'expired'
  WHERE status = 'published' 
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule cron job to run every hour (0 * * * * = every hour at minute 0)
SELECT cron.schedule('expire-posts', '0 * * * *', 'SELECT expire_posts();'); 