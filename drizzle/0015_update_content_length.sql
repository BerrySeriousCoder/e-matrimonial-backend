-- Update content field length from 2000 to 1000 characters
ALTER TABLE posts ALTER COLUMN content TYPE varchar(1000); 