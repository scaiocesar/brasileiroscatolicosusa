CREATE TABLE login_attempts (
  ip TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT NOT NULL,
  locked_until TEXT
);
