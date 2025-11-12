-- ============================================
-- PROFILES SCHEMA AND TABLES
-- ============================================

-- Create profiles schema
CREATE SCHEMA IF NOT EXISTS profiles;
SET search_path = profiles, public;

-- User profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Public Information
  nickname TEXT,                          -- Apodo/Display name
  personal_url TEXT,                      -- URL de página personal
  bio TEXT,                               -- Biografía
  organization TEXT,                      -- Organización a la que pertenece
  country TEXT,                           -- País de residencia
  mailing_address TEXT,                   -- Dirección de correspondencia
  
  -- Privacy Settings
  contact_info_public BOOLEAN NOT NULL DEFAULT FALSE,  -- Si la info de contacto es pública
  profile_visibility TEXT NOT NULL DEFAULT 'public',   -- public|private|connections
  
  -- Social Media Links
  github_url TEXT,
  linkedin_url TEXT,
  twitter_url TEXT,
  facebook_url TEXT,
  instagram_url TEXT,
  website_url TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT check_profile_visibility CHECK (profile_visibility IN ('public', 'private', 'connections'))
);

-- Profile view history (quién vio el perfil)
CREATE TABLE IF NOT EXISTS profile_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  viewer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- Profile activity log
CREATE TABLE IF NOT EXISTS profile_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,  -- 'updated', 'privacy_changed', 'social_added', etc.
  changes JSONB,          -- JSON con los cambios realizados
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_country ON user_profiles(country);
CREATE INDEX IF NOT EXISTS idx_profiles_organization ON user_profiles(organization);
CREATE INDEX IF NOT EXISTS idx_profiles_visibility ON user_profiles(profile_visibility);
CREATE INDEX IF NOT EXISTS idx_profile_views_profile_id ON profile_views(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_viewer ON profile_views(viewer_user_id);
CREATE INDEX IF NOT EXISTS idx_profile_activity_profile_id ON profile_activity(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_activity_performed_at ON profile_activity(performed_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION profiles.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION profiles.update_updated_at_column();

-- Grant permissions
GRANT USAGE ON SCHEMA profiles TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA profiles TO PUBLIC;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA profiles TO PUBLIC;

COMMENT ON TABLE user_profiles IS 'Extended user profile information';
COMMENT ON TABLE profile_views IS 'Track profile views for analytics';
COMMENT ON TABLE profile_activity IS 'Audit log of profile changes';
