## 2026-05-10 - [Secure Push Notification Endpoints]
**Vulnerability:** Publicly accessible push notification endpoints (`/api/push/*`) allowed anyone to subscribe, unsubscribe, or send notifications to any user by simply knowing their `userId`.
**Learning:** Development often prioritizes functionality (getting push notifications to work) over security, leading to missing authentication on custom API routes that sit outside the main database/auth provider's automated protections.
**Prevention:** Always implement an authentication middleware for custom backend routes and perform explicit authorization checks to ensure a user can only modify their own data (`userId === req.user.id`).

## 2026-05-12 - [Hardening Push Notification Authorization]
**Vulnerability:** The `/push/notify` endpoint lacked authorization checks to verify if the sender or recipients were actually participants in the conversation, allowing potential IDOR exploitation.
**Learning:** Even when endpoints are behind authentication middleware, custom logic is often required to enforce application-level authorization (e.g., membership in a private conversation).
**Prevention:** Always verify that the authenticated user (`req.user.id`) has permission to perform the requested action on the specific resource (e.g., `conversationId`), and validate that all affected parties (recipients) are also authorized.
