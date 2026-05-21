## 2026-05-10 - [Secure Push Notification Endpoints]
**Vulnerability:** Publicly accessible push notification endpoints (`/api/push/*`) allowed anyone to subscribe, unsubscribe, or send notifications to any user by simply knowing their `userId`.
**Learning:** Development often prioritizes functionality (getting push notifications to work) over security, leading to missing authentication on custom API routes that sit outside the main database/auth provider's automated protections.
**Prevention:** Always implement an authentication middleware for custom backend routes and perform explicit authorization checks to ensure a user can only modify their own data (`userId === req.user.id`).

## 2026-05-21 - [Information Leakage in API Error Responses]
**Vulnerability:** API endpoints were returning raw error messages (`err.message`) to clients, potentially exposing sensitive internal details, stack traces, or environment information.
**Learning:** This is a recurring pattern in this codebase, especially in newly added routes or functions where standard error handling middleware hasn't been consistently applied.
**Prevention:** Always use generic error messages for 500 status codes in production and log the full error details server-side for debugging.
