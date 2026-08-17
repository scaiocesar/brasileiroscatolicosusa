CREATE TABLE community_corrections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  payload TEXT NOT NULL,
  note TEXT,
  submitted_by_name TEXT NOT NULL,
  submitted_by_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT
);

CREATE INDEX idx_corrections_status ON community_corrections(status);
CREATE INDEX idx_corrections_community ON community_corrections(community_id);
