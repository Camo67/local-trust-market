## 2026-05-10 - [Secure Push Notification Endpoints]
**Vulnerability:** Publicly accessible push notification endpoints (`/api/push/*`) allowed anyone to subscribe, unsubscribe, or send notifications to any user by simply knowing their `userId`.
**Learning:** Development often prioritizes functionality (getting push notifications to work) over security, leading to missing authentication on custom API routes that sit outside the main database/auth provider's automated protections.
**Prevention:** Always implement an authentication middleware for custom backend routes and perform explicit authorization checks to ensure a user can only modify their own data (`userId === req.user.id`).

## 2026-05-12 - [Recurring Information Leakage via Error Messages]
**Vulnerability:** Multiple API endpoints and serverless functions were returning raw `err.message` to clients, exposing internal implementation details and potential database schema information.
**Learning:** Developers often default to returning the caught error message for debugging convenience, forgetting that this leaks sensitive stack trace and system information in production.
**Prevention:** Implement a standard error handling pattern that logs the full error server-side but returns a generic "Internal server error" to the client.
