## 2026-05-10 - [Secure Push Notification Endpoints]
**Vulnerability:** Publicly accessible push notification endpoints (`/api/push/*`) allowed anyone to subscribe, unsubscribe, or send notifications to any user by simply knowing their `userId`.
**Learning:** Development often prioritizes functionality (getting push notifications to work) over security, leading to missing authentication on custom API routes that sit outside the main database/auth provider's automated protections.
**Prevention:** Always implement an authentication middleware for custom backend routes and perform explicit authorization checks to ensure a user can only modify their own data (`userId === req.user.id`).

## 2026-05-12 - [Secure Push Notification Authorization]
**Vulnerability:** The `/push/notify` endpoint lacked authorization, allowing any authenticated user to send notifications to any other user by providing their `userId`.
**Learning:** Even with authentication (`authMiddleware`), explicit authorization checks are necessary to ensure users can only perform actions within the context of their permitted resources (e.g., conversations they belong to).
**Prevention:** Implement "Participation-based Authorization" for messaging/notification features. Verify that both the sender and all recipients are authorized participants in the relevant entity (Conversation, Order, etc.) before processing the request.
