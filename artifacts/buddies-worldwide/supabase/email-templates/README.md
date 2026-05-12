# Supabase Email Templates

These templates are configured in the Supabase dashboard, not through the database SQL setup.

## Magic Link

Paste `magic-link.html` into:

Supabase Dashboard -> Authentication -> Emails -> Magic Link

Keep Supabase template variables exactly as written:

- `{{ .SiteURL }}`
- `{{ .ConfirmationURL }}`

The template references the app logo at `{{ .SiteURL }}/Buddies_worldwide_online_logo.jpeg`. Make sure the production site URL in Supabase Auth points to the deployed Buddies Worldwide app so the logo can load in email clients.

## Auth URL Settings

The app currently signs users up with `emailRedirectTo: window.location.origin`, so Supabase should redirect back to the site root after email confirmation.

Recommended Supabase settings:

- Site URL: `https://buddiesworldwide.online`
- Redirect URLs:
- `https://buddiesworldwide.online`
- `https://www.buddiesworldwide.online`
- `https://buddiesworldwide.online/reset-password`
- `https://www.buddiesworldwide.online/reset-password`

Remove these unless a matching route is added to the React app:

- `https://buddiesworldwide.online/auth/callback`
- `https://www.buddiesworldwide.online/auth/callback`
- `https://buddiesworldwide.online/signup`
- `https://www.buddiesworldwide.online/signup`
- `https://buddiesworldwide.online/oauth/consent`

## Stuck Email Confirmations

If a user exists in `auth.users` but `email_confirmed_at` is still empty after the confirmation link failed or expired, use `../../supabase_email_confirmation_repair.sql` with that user's email address. This is a manual repair for a known account, not part of the normal schema setup.

## Send Email Hook

The site includes a Cloudflare Pages Function for Supabase's HTTP Send Email hook:

```text
https://buddiesworldwide.online/api/auth/send-email
```

Do not use the site root as the hook URL.

Before enabling the hook, set these Cloudflare Pages environment variables/secrets for the `buddiesworldwide` project:

```text
RESEND_API_KEY
SEND_EMAIL_HOOK_SECRET
AUTH_EMAIL_FROM
VITE_SUPABASE_URL=https://nvqlsxkicqgaiwuhqwjc.supabase.co
```

`AUTH_EMAIL_FROM` must be a sender verified in Resend, for example `Buddies Worldwide <auth@buddiesworldwide.online>`.
