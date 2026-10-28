
-- Users and refresh-token sessions.
-- Mirrors the validation rules already enforced in backend-go/auth.go,
-- so the database is a second line of defence, not a different rule set.

CREATE TABLE users (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    username      text        NOT NULL,
    email         text,
    password_hash text        NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT users_username_format CHECK (username ~ '^[a-z0-9_.-]{3,32}$'),
    CONSTRAINT users_email_lower     CHECK (email IS NULL OR email = lower(email)),
    CONSTRAINT users_email_length    CHECK (email IS NULL OR length(email) <= 254),
    CONSTRAINT users_hash_length     CHECK (length(password_hash) BETWEEN 20 AND 255)
);

CREATE UNIQUE INDEX users_username_key ON users (username);
CREATE UNIQUE INDEX users_email_key ON users (email) WHERE email IS NOT NULL;

-- Only the SHA-256 hash of a refresh token is stored, never the raw token.
-- family_id groups a rotation chain so reuse of an old token can revoke it all.
CREATE TABLE refresh_tokens (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    family_id  uuid        NOT NULL,
    token_hash bytea       NOT NULL,
    issued_at  timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,

    CONSTRAINT refresh_tokens_hash_len CHECK (octet_length(token_hash) = 32),
    CONSTRAINT refresh_tokens_expiry   CHECK (expires_at > issued_at)
);

CREATE UNIQUE INDEX refresh_tokens_hash_key ON refresh_tokens (token_hash);
CREATE INDEX refresh_tokens_user_idx    ON refresh_tokens (user_id);
CREATE INDEX refresh_tokens_family_idx  ON refresh_tokens (family_id);
CREATE INDEX refresh_tokens_expires_idx ON refresh_tokens (expires_at);
