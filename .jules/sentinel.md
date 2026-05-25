## 2026-05-10 - [Secure Push Notification Endpoints]
**Vulnerability:** Publicly accessible push notification endpoints (`/api/push/*`) allowed anyone to subscribe, unsubscribe, or send notifications to any user by simply knowing their `userId`.
**Learning:** Development often prioritizes functionality (getting push notifications to work) over security, leading to missing authentication on custom API routes that sit outside the main database/auth provider's automated protections.
**Prevention:** Always implement an authentication middleware for custom backend routes and perform explicit authorization checks to ensure a user can only modify their own data (`userId === req.user.id`).

## 2026-05-11 - [Conversation Participant Authorization & Generic Errors]
**Vulnerability:** The `/push/notify` endpoint lacked participant verification, allowing any authenticated user to send notifications to others. Additionally, raw error messages were leaking internal implementation details.
**Learning:** Authentication alone is insufficient for multi-user resources; business-logic authorization (e.g., verifying conversation membership) is critical. Leaking `err.message` in 500 responses is a recurring risk in this codebase.
**Prevention:** Always verify that the requester has permission to interact with all involved parties in a transaction (e.g., query the `conversations` table for participant IDs). Use generic error messages for all production responses and log details server-side.
