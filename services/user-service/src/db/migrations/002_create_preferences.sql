CREATE TABLE IF NOT EXISTS user_service.preferences (
  user_id uuid PRIMARY KEY REFERENCES user_service.profiles(user_id) ON DELETE CASCADE,
  language varchar(12) NOT NULL DEFAULT 'en',
  theme varchar(10) NOT NULL DEFAULT 'system',
  autoplay boolean NOT NULL DEFAULT true,
  email_notifications boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT preferences_theme_check CHECK (theme IN ('light', 'dark', 'system'))
);
