-- ─────────────────────────────────────────────────────────────────────────────
-- IX Queue Data — seed from static ixQueueEngine.js values (Q1 2026)
-- Safe to re-run — uses ON CONFLICT DO UPDATE.
-- ─────────────────────────────────────────────────────────────────────────────

insert into ix_queue_data
  (state_id, iso, utility_name, projects_in_queue, mw_pending,
   avg_study_months, withdrawal_pct, avg_upgrade_cost_mw, queue_trend,
   data_source)
values
  ('IL', 'PJM',    'ComEd (PJM)',            142, 1840, 22, 31, 85000,  'growing',   'seed'),
  ('IL', 'MISO',   'Ameren Illinois (MISO)',  67,  890, 18, 28, 62000,  'stable',    'seed'),
  ('NY', 'NYISO',  'ConEdison',               98, 1250, 26, 35, 120000, 'growing',   'seed'),
  ('NY', 'NYISO',  'National Grid',           74,  980, 20, 27, 75000,  'stable',    'seed'),
  ('MA', 'ISO-NE', 'National Grid MA',        85,  720, 24, 33, 95000,  'shrinking', 'seed'),
  ('MA', 'ISO-NE', 'Eversource',              62,  540, 20, 29, 80000,  'stable',    'seed'),
  ('MN', 'MISO',   'Xcel Energy',             53,  620, 16, 22, 48000,  'stable',    'seed'),
  ('CO', 'WAPA',   'Xcel Energy CO',          41,  510, 14, 19, 42000,  'shrinking', 'seed'),
  ('NJ', 'PJM',    'PSE&G',                   88, 1100, 24, 34, 110000, 'growing',   'seed'),
  ('NJ', 'PJM',    'JCP&L',                   45,  580, 20, 26, 72000,  'stable',    'seed'),
  ('MD', 'PJM',    'BGE / Pepco',             56,  720, 22, 30, 88000,  'stable',    'seed'),
  ('ME', 'ISO-NE', 'CMP / Versant',           34,  380, 18, 25, 55000,  'shrinking', 'seed')
on conflict (state_id, utility_name) do update set
  iso                 = excluded.iso,
  projects_in_queue   = excluded.projects_in_queue,
  mw_pending          = excluded.mw_pending,
  avg_study_months    = excluded.avg_study_months,
  withdrawal_pct      = excluded.withdrawal_pct,
  avg_upgrade_cost_mw = excluded.avg_upgrade_cost_mw,
  queue_trend         = excluded.queue_trend,
  data_source         = excluded.data_source;
