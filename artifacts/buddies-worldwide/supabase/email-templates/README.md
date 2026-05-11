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

Remove these unless a matching route is added to the React app:

- `https://buddiesworldwide.online/auth/callback`
- `https://www.buddiesworldwide.online/auth/callback`
- `https://buddiesworldwide.online/signup`
- `https://www.buddiesworldwide.online/signup`
- `https://buddiesworldwide.online/oauth/consent`
