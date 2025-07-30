-- Create search filter tables
CREATE TABLE IF NOT EXISTS "search_filter_sections" (
  "id" serial PRIMARY KEY,
  "name" varchar(100) NOT NULL UNIQUE,
  "display_name" varchar(100) NOT NULL,
  "description" varchar(255),
  "order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "search_filter_options" (
  "id" serial PRIMARY KEY,
  "section_id" integer NOT NULL REFERENCES "search_filter_sections"("id") ON DELETE CASCADE,
  "value" varchar(100) NOT NULL,
  "display_name" varchar(100) NOT NULL,
  "order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "post_search_tags" (
  "id" serial PRIMARY KEY,
  "post_id" integer NOT NULL REFERENCES "posts"("id") ON DELETE CASCADE,
  "option_id" integer NOT NULL REFERENCES "search_filter_options"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Insert default sections and options
INSERT INTO "search_filter_sections" ("name", "display_name", "description", "order") VALUES
('complexion', 'Complexion & Appearance', 'Physical appearance and complexion options', 1),
('education', 'Education & Profession', 'Educational qualifications and professional details', 2),
('age_height', 'Age & Height', 'Age and height preferences', 3),
('overseas', 'Overseas Status', 'Overseas residency and work status', 4),
('abbreviations', 'Abbreviations/SMS Style', 'Common abbreviations and short forms', 5),
('astrology', 'Astrology Labels', 'Astrological and cultural preferences', 6);

INSERT INTO "search_filter_options" ("section_id", "value", "display_name", "order") VALUES
-- Complexion options
(1, 'fair', 'Fair', 1),
(1, 'gori', 'Gori', 2),
(1, 'tall', 'Tall', 3),
(1, 'wheatish', 'Wheatish', 4),

-- Education options
(2, 'mba', 'MBA', 1),
(2, 'btech', 'B.Tech', 2),
(2, 'mbbs', 'MBBS', 3),
(2, 'iim', 'IIM', 4),
(2, 'mnc', 'MNC', 5),
(2, 'govt_job', 'Govt Job', 6),

-- Age & Height options
(3, 'age_25_30', 'Age 25-30', 1),
(3, 'age_30_35', 'Age 30-35', 2),
(3, 'height_5_6', 'Height 5\'6"', 3),
(3, 'height_5_8', 'Height 5\'8"', 4),

-- Overseas options
(4, 'nri', 'NRI', 1),
(4, 'green_card', 'Green Card', 2),
(4, 'working_abroad', 'Working Abroad', 3),

-- Abbreviations options
(5, 'sm$', 'SM$', 1),
(5, 'pqm', 'PQM', 2),
(5, 'edu', 'Edu', 3),
(5, 'hsome', 'H\'some', 4),
(5, 'bful', 'B\'ful', 5),

-- Astrology options
(6, 'manglik', 'Manglik', 1),
(6, 'non_manglik', 'Non-Manglik', 2); 