-- Adds account-lifecycle columns used by the admin deactivate/reactivate/delete
-- and forced-password-change flows. `disabled` is written only by Edge
-- Functions using the service-role key. `must_change_password` is set only by
-- the service role, but a user IS allowed to clear it themselves (true -> false)
-- when they complete the required password change via /account, since that
-- flow runs on the user's own session, not the service-role key.

ALTER TABLE public.profiles
  ADD COLUMN disabled boolean NOT NULL DEFAULT false,
  ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.protect_privileged_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) <> 'service_role' THEN
    NEW.disabled := OLD.disabled;
    -- Allow a user to clear their own must_change_password (true -> false)
    -- after completing the required change on /account, but never let a
    -- non-service-role request set it to true.
    IF NEW.must_change_password THEN
      NEW.must_change_password := OLD.must_change_password;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_privileged_profile_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_privileged_profile_columns();
