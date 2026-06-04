## 2026-05-10 - [Secure Push Notification Endpoints]
**Vulnerability:** Publicly accessible push notification endpoints (`/api/push/*`) allowed anyone to subscribe, unsubscribe, or send notifications to any user by simply knowing their `userId`.
**Learning:** Development often prioritizes functionality (getting push notifications to work) over security, leading to missing authentication on custom API routes that sit outside the main database/auth provider's automated protections.
**Prevention:** Always implement an authentication middleware for custom backend routes and perform explicit authorization checks to ensure a user can only modify their own data (`userId === req.user.id`).

## 2026-06-04 - [Critical Environment Misconfiguration]
**Vulnerability:** The `.replit` file contained a hardcoded Supabase `service_role` JWT in the `VITE_SUPABASE_ANON_KEY` field and an `anon` JWT in the `VITE_SUPABASE_URL` field.
**Learning:** Hardcoding secrets in configuration files is a primary source of data leaks. Mislabeling a highly-privileged Service Role key as a public Anon key can lead to complete database compromise if the key is used in frontend code.
**Prevention:** Never commit secrets to the repository. Use platform-specific secret management (like Replit Secrets) and strictly validate that environment variables contain the expected types of values (e.g., URLs vs. JWTs).
