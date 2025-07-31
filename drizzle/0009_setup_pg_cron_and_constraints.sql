-- Create function to reset daily email limits
CREATE OR REPLACE FUNCTION reset_daily_email_limits()
RETURNS void AS $$
BEGIN
  UPDATE user_email_limits 
  SET daily_count = 0, last_reset_date = CURRENT_DATE::varchar(10)
  WHERE last_reset_date < CURRENT_DATE::varchar(10);
END;
$$ LANGUAGE plpgsql;

-- Schedule daily reset at midnight (0 0 * * * = every day at 00:00)
SELECT cron.schedule('reset-email-limits', '0 0 * * *', 'SELECT reset_daily_email_limits();');

-- Add unique constraint to prevent duplicate emails per post per user
ALTER TABLE post_emails ADD CONSTRAINT post_emails_user_post_unique UNIQUE (user_id, post_id); 