-- Forward-only audit context snapshots. Existing audit records remain unchanged.
-- This trigger runs after the action-classification trigger (alphabetical trigger name order).
CREATE OR REPLACE FUNCTION public.audit_capture_context_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  payload jsonb;
  snapshot jsonb := '{}'::jsonb;
  candidate text;
  resolved_job_id uuid;
  resolved_job_name text;
  resolved_shift_code text;
  resolved_shift_name text;
  resolved_group_id uuid;
  profile_name text;
  field_key text;
  field_value text;
  profile_id uuid;
BEGIN
  payload := COALESCE(NEW.metadata, '{}'::jsonb) || COALESCE(NEW.old_values, '{}'::jsonb) || COALESCE(NEW.new_values, '{}'::jsonb);

  -- Preserve names explicitly recorded by the operation, never overwrite them.
  snapshot := COALESCE(NEW.metadata->'audit_context', '{}'::jsonb);
  IF jsonb_typeof(snapshot) IS DISTINCT FROM 'object' THEN snapshot := '{}'::jsonb; END IF;

  IF NEW.actor_user_id IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.actor_user_id := NEW.user_id;
  END IF;
  IF NEW.actor_user_id IS NOT NULL AND NULLIF(btrim(COALESCE(NEW.actor_display_name,'')), '') IS NULL THEN
    SELECT p.display_name, p.email INTO NEW.actor_display_name, NEW.actor_email
    FROM public.profiles p WHERE p.id = NEW.actor_user_id;
  END IF;

  candidate := COALESCE(NULLIF(payload->>'job_type_id',''), NULLIF(payload->>'jobTypeId',''));
  IF candidate ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    resolved_job_id := candidate::uuid;
    SELECT jt.name, jt.schedule_group_id INTO resolved_job_name, resolved_group_id
    FROM public.job_types jt WHERE jt.id = resolved_job_id;
    IF resolved_job_name IS NOT NULL THEN
      IF NOT (snapshot ? 'job_type_name') THEN
        snapshot := jsonb_set(snapshot, '{job_type_name}', to_jsonb(resolved_job_name), true);
      END IF;
    END IF;
  END IF;

  resolved_shift_code := COALESCE(NULLIF(payload->>'shift_code',''), NULLIF(payload->>'shiftCode',''));
  IF resolved_group_id IS NOT NULL AND resolved_shift_code IS NOT NULL THEN
    SELECT t.name INTO resolved_shift_name FROM public.schedule_group_shift_templates t
    WHERE t.schedule_group_id = resolved_group_id AND t.code = resolved_shift_code
    ORDER BY t.is_active DESC, t.created_at DESC LIMIT 1;
    IF resolved_shift_name IS NOT NULL THEN
      snapshot := jsonb_set(snapshot, '{shift_name}', to_jsonb(resolved_shift_name), true);
    END IF;
  END IF;

  -- Snapshot employee names from the actual before/after payload, not today's assignment.
  FOREACH field_key IN ARRAY ARRAY['old_user_id','new_user_id','user_id','userId','target_user_id'] LOOP
    field_value := payload->>field_key;
    IF field_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      profile_id := field_value::uuid;
      SELECT p.display_name INTO profile_name FROM public.profiles p WHERE p.id = profile_id;
      IF profile_name IS NOT NULL AND NOT (snapshot ? (field_key || '_name')) THEN
        snapshot := jsonb_set(snapshot, ARRAY[field_key || '_name'], to_jsonb(profile_name), true);
      END IF;
    END IF;
  END LOOP;

  IF snapshot <> '{}'::jsonb THEN
    NEW.metadata := jsonb_set(COALESCE(NEW.metadata, '{}'::jsonb), '{audit_context}', snapshot, true);
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.audit_capture_context_before_insert() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS audit_capture_context_before_insert ON public.audit_logs;
CREATE TRIGGER audit_capture_context_before_insert
BEFORE INSERT ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.audit_capture_context_before_insert();
