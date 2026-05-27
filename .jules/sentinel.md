## 2026-05-10 - [Secure Push Notification Endpoints]
**Vulnerability:** Publicly accessible push notification endpoints (`/api/push/*`) allowed anyone to subscribe, unsubscribe, or send notifications to any user by simply knowing their `userId`.
**Learning:** Development often prioritizes functionality (getting push notifications to work) over security, leading to missing authentication on custom API routes that sit outside the main database/auth provider's automated protections.
**Prevention:** Always implement an authentication middleware for custom backend routes and perform explicit authorization checks to ensure a user can only modify their own data (`userId === req.user.id`).

## 2026-05-27 - [Information Leakage in API Responses]
**Vulnerability:** API endpoints were returning raw error messages (`err.message`) to the client. This can leak sensitive internal information such as database schema details or stack traces.
**Learning:** Default error handling often returns the original error object, which is unsafe for production. Generic error messages should be returned to the client while logging the detailed error on the server.
**Prevention:** Use try-catch blocks in all route handlers, log the original error server-side, and return a generic message like "Internal server error" in the response.
