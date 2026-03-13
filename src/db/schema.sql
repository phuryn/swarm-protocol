CREATE TABLE IF NOT EXISTS teams (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  conventions TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS intents (
  id                  TEXT PRIMARY KEY DEFAULT 'intent_' || gen_random_uuid()::text,
  title               TEXT NOT NULL,
  description         TEXT,
  created_by          TEXT NOT NULL,
  team_id             TEXT REFERENCES teams(id),
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','claimed','blocked','done','cancelled')),
  priority            TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical','high','medium','low')),
  parent_id           TEXT REFERENCES intents(id),
  context             TEXT,
  constraints         JSONB DEFAULT '[]',
  acceptance_criteria JSONB DEFAULT '[]',
  files_likely_touched JSONB DEFAULT '[]',
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS intent_dependencies (
  intent_id    TEXT REFERENCES intents(id) ON DELETE CASCADE,
  depends_on   TEXT REFERENCES intents(id) ON DELETE CASCADE,
  PRIMARY KEY (intent_id, depends_on)
);

CREATE TABLE IF NOT EXISTS claims (
  id             TEXT PRIMARY KEY DEFAULT 'claim_' || gen_random_uuid()::text,
  intent_id      TEXT REFERENCES intents(id) ON DELETE CASCADE,
  claimed_by     TEXT NOT NULL,
  agent_session  TEXT,
  files_touching JSONB DEFAULT '[]',
  branch         TEXT,
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','abandoned')),
  started_at     TIMESTAMPTZ DEFAULT now(),
  last_heartbeat TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS signals (
  id          TEXT PRIMARY KEY DEFAULT 'signal_' || gen_random_uuid()::text,
  type        TEXT NOT NULL CHECK (type IN ('completion','blocked','conflict','info','request')),
  from_user   TEXT NOT NULL,
  intent_id   TEXT REFERENCES intents(id),
  claim_id    TEXT REFERENCES claims(id),
  message     TEXT NOT NULL,
  unblocks    JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intents_status ON intents(status);
CREATE INDEX IF NOT EXISTS idx_intents_team ON intents(team_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_intent ON claims(intent_id);
CREATE INDEX IF NOT EXISTS idx_signals_intent ON signals(intent_id);
CREATE INDEX IF NOT EXISTS idx_signals_created ON signals(created_at DESC);
