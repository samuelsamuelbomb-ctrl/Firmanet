-- Create Sponsor Tier enum first (with check to avoid errors)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sponsor_tier') THEN
        CREATE TYPE sponsor_tier AS ENUM ('infrastructure', 'community', 'national');
    END IF;
END$$;

-- Create the Sponsors table
CREATE TABLE IF NOT EXISTS sponsors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  tier sponsor_tier NOT NULL,
  initials TEXT NOT NULL,
  accent TEXT NOT NULL,
  image_url TEXT, -- Optional image URL for sponsor logo
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT sponsors_pkey PRIMARY KEY (id)
);

-- Enable RLS on the table
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to read sponsors (with check to avoid errors)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'sponsors' 
        AND policyname = 'Allow public read access to sponsors'
    ) THEN
        CREATE POLICY "Allow public read access to sponsors"
          ON sponsors FOR SELECT
          USING (true);
    END IF;
END$$;

-- Insert sample data (ON CONFLICT to avoid errors if already inserted)
INSERT INTO sponsors (id, name, tagline, tier, initials, accent, image_url) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'MTN Nigeria', 'Connecting Nigerians to safety in real time', 'infrastructure', 'MTN', '#FF8C42', 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/MTN_Group_Logo.svg/200px-MTN_Group_Logo.svg.png'),
  ('550e8400-e29b-41d4-a716-446655440001', 'GTBank', 'Supporting safer communities across Nigeria', 'community', 'GTB', '#6C63FF', NULL),
  ('550e8400-e29b-41d4-a716-446655440002', 'Access Bank', 'Committed to community safety and resilience', 'community', 'AB', '#9B59B6', NULL),
  ('550e8400-e29b-41d4-a716-446655440003', 'Shell Nigeria', 'Investing in safer, more resilient communities', 'national', 'SH', '#E67E22', NULL)
ON CONFLICT (id) DO NOTHING;
