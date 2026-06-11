CREATE TABLE IF NOT EXISTS price_points (
  hub TEXT NOT NULL,
  market TEXT NOT NULL CHECK (market IN ('rtm','dam')),
  t INTEGER NOT NULL,
  price REAL NOT NULL,
  PRIMARY KEY (hub, market, t)
);
CREATE TABLE IF NOT EXISTS dispatches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hub TEXT NOT NULL,
  strategy TEXT NOT NULL,
  t INTEGER NOT NULL,
  action TEXT NOT NULL,
  mwh REAL NOT NULL,
  price REAL NOT NULL,
  value REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dispatches_hub_t ON dispatches(hub, t);
