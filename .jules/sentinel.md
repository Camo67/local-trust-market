## 2026-05-10 - [Secure Push Notification Endpoints]
**Vulnerability:** Publicly accessible push notification endpoints (`/api/push/*`) allowed anyone to subscribe, unsubscribe, or send notifications to any user by simply knowing their `userId`.
**Learning:** Development often prioritizes functionality (getting push notifications to work) over security, leading to missing authentication on custom API routes that sit outside the main database/auth provider's automated protections.
**Prevention:** Always implement an authentication middleware for custom backend routes and perform explicit authorization checks to ensure a user can only modify their own data (`userId === req.user.id`).

## 2025-05-11 - [Conversation-Based Authorization for Push Notifications]
**Vulnerability:** The `/push/notify` endpoint lacked authorization checks beyond basic authentication, allowing any logged-in user to send notifications to any other user by providing their IDs.
**Learning:** Authentication is not enough; multi-user interactions (like chat) require validating that the sender and all recipients are authorized participants of the specific context (e.g., a `conversationId`).
**Prevention:** For any endpoint facilitating communication between users, always verify that the sender and all recipients are valid members of the shared entity (conversation, group, etc.) using server-side lookups.
