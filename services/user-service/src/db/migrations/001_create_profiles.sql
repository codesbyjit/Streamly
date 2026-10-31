CREATE TABLE IF NOT EXISTS user_service.profiles (
  user_id uuid PRIMARY KEY,
  handle varchar(30) NOT NULL UNIQUE,
  display_name varchar(80) NOT NULL,
  bio varchar(500) NOT NULL DEFAULT '',
  avatar_url text,
  banner_url text,
  country_code char(2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_handle_format CHECK (handle ~ '^[a-zA-Z0-9_]{3,30}$'),
  CONSTRAINT profiles_display_name_nonempty CHECK (length(trim(display_name)) > 0),
  CONSTRAINT profiles_country_code_format CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$')
);

CREATE INDEX IF NOT EXISTS profiles_display_name_idx
  ON user_service.profiles USING btree (lower(display_name));
