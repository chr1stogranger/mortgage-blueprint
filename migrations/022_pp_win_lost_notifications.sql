-- 022 — PricePoint "someone beat your call" notifications (2026-10-09)
-- /api/pp-guess inserts a 'win_lost' pp_notifications row (and sends a push)
-- when a new Sold/Daily guess beats the player who was #1 on that home.
-- Until this runs, the insert is rejected by the type CHECK; pp-guess logs it
-- and still sends the push, so only the in-app bell entry is missing.

ALTER TABLE pp_notifications DROP CONSTRAINT IF EXISTS pp_notifications_type_check;
ALTER TABLE pp_notifications ADD CONSTRAINT pp_notifications_type_check
  CHECK (type IN ('prediction_resolved', 'level_up', 'weekly_digest', 'win_lost'));
