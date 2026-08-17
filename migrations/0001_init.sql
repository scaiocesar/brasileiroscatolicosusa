CREATE TABLE communities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  address_line TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  website_url TEXT,
  whatsapp TEXT,
  instagram TEXT,
  facebook TEXT,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_by_name TEXT,
  submitted_by_email TEXT,
  admin_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at TEXT
);

CREATE TABLE mass_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  time TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'pt' CHECK (language IN ('pt', 'en', 'bilingual')),
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE community_services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  notes TEXT,
  UNIQUE (community_id, service_type)
);

CREATE INDEX idx_communities_status ON communities(status);
CREATE INDEX idx_communities_state ON communities(state);
CREATE INDEX idx_communities_slug ON communities(slug);
CREATE INDEX idx_mass_schedules_community ON mass_schedules(community_id);
CREATE INDEX idx_services_community ON community_services(community_id);

INSERT INTO communities (
  slug, name, description, address_line, city, state, zip, lat, lng,
  website_url, whatsapp, instagram, email, phone, status, approved_at
) VALUES
(
  'comunidade-catolica-brasileira-boston',
  'Comunidade Católica Brasileira de Boston',
  'Comunidade de brasileiros católicos na região de Boston, com missa em português e catequese para crianças e jovens.',
  '75 Saint Alphonsus Street',
  'Boston',
  'MA',
  '02120',
  42.3329,
  -71.1003,
  'https://example.com/boston',
  '16175550100',
  'catolicosboston',
  'boston@exemplo.com',
  '(617) 555-0100',
  'approved',
  datetime('now')
),
(
  'nossa-senhora-aparecida-newark',
  'Paróquia Nossa Senhora Aparecida — Newark',
  'Paróquia com forte presença brasileira em New Jersey. Atendimento sacramental e grupos de oração.',
  '142 Van Buren Street',
  'Newark',
  'NJ',
  '07105',
  40.7242,
  -74.1563,
  'https://example.com/newark',
  '19735550111',
  NULL,
  'newark@exemplo.com',
  '(973) 555-0111',
  'approved',
  datetime('now')
),
(
  'missao-brasileira-orlando',
  'Missão Brasileira de Orlando',
  'Missão católica brasileira na Flórida Central, com missa semanal em português e pastoral familiar.',
  '800 South Kirkman Road',
  'Orlando',
  'FL',
  '32811',
  28.5383,
  -81.429,
  NULL,
  '14075550122',
  'missaorlando',
  'orlando@exemplo.com',
  '(407) 555-0122',
  'approved',
  datetime('now')
);

INSERT INTO mass_schedules (community_id, day_of_week, time, language, notes, sort_order)
SELECT id, 0, '11:00', 'pt', 'Missa com música', 0 FROM communities WHERE slug = 'comunidade-catolica-brasileira-boston';
INSERT INTO mass_schedules (community_id, day_of_week, time, language, notes, sort_order)
SELECT id, 6, '18:00', 'pt', NULL, 1 FROM communities WHERE slug = 'comunidade-catolica-brasileira-boston';

INSERT INTO mass_schedules (community_id, day_of_week, time, language, notes, sort_order)
SELECT id, 0, '13:00', 'pt', 'Missa da comunidade brasileira', 0 FROM communities WHERE slug = 'nossa-senhora-aparecida-newark';
INSERT INTO mass_schedules (community_id, day_of_week, time, language, notes, sort_order)
SELECT id, 3, '19:30', 'pt', 'Missa semanal', 1 FROM communities WHERE slug = 'nossa-senhora-aparecida-newark';

INSERT INTO mass_schedules (community_id, day_of_week, time, language, notes, sort_order)
SELECT id, 0, '16:00', 'bilingual', NULL, 0 FROM communities WHERE slug = 'missao-brasileira-orlando';

INSERT INTO community_services (community_id, service_type, notes)
SELECT id, 'missa', NULL FROM communities WHERE slug = 'comunidade-catolica-brasileira-boston';
INSERT INTO community_services (community_id, service_type, notes)
SELECT id, 'catequese', 'Crianças e jovens' FROM communities WHERE slug = 'comunidade-catolica-brasileira-boston';
INSERT INTO community_services (community_id, service_type, notes)
SELECT id, 'batismo', NULL FROM communities WHERE slug = 'comunidade-catolica-brasileira-boston';
INSERT INTO community_services (community_id, service_type, notes)
SELECT id, 'confissao', 'Antes da missa de domingo' FROM communities WHERE slug = 'comunidade-catolica-brasileira-boston';

INSERT INTO community_services (community_id, service_type, notes)
SELECT id, 'missa', NULL FROM communities WHERE slug = 'nossa-senhora-aparecida-newark';
INSERT INTO community_services (community_id, service_type, notes)
SELECT id, 'catequese', NULL FROM communities WHERE slug = 'nossa-senhora-aparecida-newark';
INSERT INTO community_services (community_id, service_type, notes)
SELECT id, 'batismo', NULL FROM communities WHERE slug = 'nossa-senhora-aparecida-newark';
INSERT INTO community_services (community_id, service_type, notes)
SELECT id, 'crisma', NULL FROM communities WHERE slug = 'nossa-senhora-aparecida-newark';
INSERT INTO community_services (community_id, service_type, notes)
SELECT id, 'casamento', NULL FROM communities WHERE slug = 'nossa-senhora-aparecida-newark';
INSERT INTO community_services (community_id, service_type, notes)
SELECT id, 'grupo_oracao', NULL FROM communities WHERE slug = 'nossa-senhora-aparecida-newark';

INSERT INTO community_services (community_id, service_type, notes)
SELECT id, 'missa', NULL FROM communities WHERE slug = 'missao-brasileira-orlando';
INSERT INTO community_services (community_id, service_type, notes)
SELECT id, 'catequese', NULL FROM communities WHERE slug = 'missao-brasileira-orlando';
INSERT INTO community_services (community_id, service_type, notes)
SELECT id, 'jovens', NULL FROM communities WHERE slug = 'missao-brasileira-orlando';
INSERT INTO community_services (community_id, service_type, notes)
SELECT id, 'adoracao', 'Primeira sexta-feira' FROM communities WHERE slug = 'missao-brasileira-orlando';
