## 2026-05-10 - [Secure Push Notification Endpoints]
**Vulnerability:** Publicly accessible push notification endpoints (`/api/push/*`) allowed anyone to subscribe, unsubscribe, or send notifications to any user by simply knowing their `userId`.
**Learning:** Development often prioritizes functionality (getting push notifications to work) over security, leading to missing authentication on custom API routes that sit outside the main database/auth provider's automated protections.
**Prevention:** Always implement an authentication middleware for custom backend routes and perform explicit authorization checks to ensure a user can only modify their own data (`userId === req.user.id`).

## 2025-05-14 - [Preventing Information Disclosure in API Responses]
**Vulnerability:** API endpoints were returning raw error messages (`err.message`) in 500 responses, potentially leaking sensitive internal implementation details, database schema information, or environment variable names to external callers.
**Learning:** Standard catch blocks often default to returning the caught error's message for convenience, but this violates the security principle of "failing securely" by exposing backend internals.
**Prevention:** Always use generic error messages (e.g., "Internal server error") in production API responses. Implement robust server-side logging (using `req.log.error`) to ensure developers can still diagnose the root cause without exposing it to the client.
