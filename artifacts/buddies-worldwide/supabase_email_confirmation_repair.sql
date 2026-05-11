-- Buddies Worldwide email confirmation repair
-- Use only when a Supabase Auth user is stuck with email_confirmed_at = NULL
-- after the real email link failed or expired.
--
-- Replace the email below with the affected account, then run this in
-- Supabase Dashboard -> SQL Editor.

UPDATE auth.users
SET
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at = now()
WHERE lower(email) = lower('replace-this-email@example.com')
  AND email_confirmed_at IS NULL;

-- Confirm the repair:
SELECT email, email_confirmed_at, confirmed_at
FROM auth.users
WHERE lower(email) = lower('replace-this-email@example.com');
