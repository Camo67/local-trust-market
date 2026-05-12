## 2026-05-10 - [Secure Push Notification Endpoints]
**Vulnerability:** Publicly accessible push notification endpoints (`/api/push/*`) allowed anyone to subscribe, unsubscribe, or send notifications to any user by simply knowing their `userId`.
**Learning:** Development often prioritizes functionality (getting push notifications to work) over security, leading to missing authentication on custom API routes that sit outside the main database/auth provider's automated protections.
**Prevention:** Always implement an authentication middleware for custom backend routes and perform explicit authorization checks to ensure a user can only modify their own data (`userId === req.user.id`).
