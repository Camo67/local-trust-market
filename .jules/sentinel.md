## 2026-05-10 - [Secure Push Notification Endpoints]
**Vulnerability:** Publicly accessible push notification endpoints (`/api/push/*`) allowed anyone to subscribe, unsubscribe, or send notifications to any user by simply knowing their `userId`.
**Learning:** Development often prioritizes functionality (getting push notifications to work) over security, leading to missing authentication on custom API routes that sit outside the main database/auth provider's automated protections.
**Prevention:** Always implement an authentication middleware for custom backend routes and perform explicit authorization checks to ensure a user can only modify their own data (`userId === req.user.id`).

## 2026-05-17 - [Authorization and Information Leakage in Push API]
**Vulnerability:** The `/push/notify` endpoint lacked participant-matching authorization, allowing any authenticated user to send notifications to any other user if they knew a `conversationId`. Additionally, API routes exposed detailed stack traces/error messages.
**Learning:** Even with authentication, missing authorization (checking IF a user should be able to perform an action) is a critical gap. Using `err.message` in responses is a common but dangerous pattern that leaks internal details.
**Prevention:** Always implement explicit authorization checks against the database for sensitive actions. Use generic error messages in production responses and log details server-side.
