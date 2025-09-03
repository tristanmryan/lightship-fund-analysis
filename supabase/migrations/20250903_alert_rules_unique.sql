-- Phase 4: Ensure idempotent seed for alert_rules

DO $$
DECLARE
  has_index boolean;
BEGIN
  -- 1) Consolidate duplicates by (name, rule_type) to a canonical rule (min id)
  --    Update alerts.rule_id to point at the canonical rule before deleting dup rows.
  WITH d AS (
    SELECT name, rule_type, MIN(id) AS keep_id
    FROM public.alert_rules
    GROUP BY name, rule_type
    HAVING COUNT(*) > 1
  ), tf AS (
    SELECT ar.id AS dup_id, d.keep_id
    FROM public.alert_rules ar
    JOIN d ON d.name = ar.name AND d.rule_type = ar.rule_type
    WHERE ar.id <> d.keep_id
  )
  UPDATE public.alerts a
  SET rule_id = tf.keep_id
  FROM tf
  WHERE a.rule_id = tf.dup_id;

  -- 2) Delete duplicate alert_rules rows now that alerts are repointed
  WITH d AS (
    SELECT name, rule_type, MIN(id) AS keep_id
    FROM public.alert_rules
    GROUP BY name, rule_type
    HAVING COUNT(*) > 1
  ), tf AS (
    SELECT ar.id AS dup_id
    FROM public.alert_rules ar
    JOIN d ON d.name = ar.name AND d.rule_type = ar.rule_type
    WHERE ar.id <> d.keep_id
  )
  DELETE FROM public.alert_rules r
  USING tf
  WHERE r.id = tf.dup_id;

  -- 3) Create unique index if it does not exist
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'ux_alert_rules_name_type'
  ) INTO has_index;
  IF NOT has_index THEN
    CREATE UNIQUE INDEX ux_alert_rules_name_type ON public.alert_rules (name, rule_type);
  END IF;
END $$;
