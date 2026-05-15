## 2026-05-10 - [Secure Push Notification Endpoints]
**Vulnerability:** Publicly accessible push notification endpoints (`/api/push/*`) allowed anyone to subscribe, unsubscribe, or send notifications to any user by simply knowing their `userId`.
**Learning:** Development often prioritizes functionality (getting push notifications to work) over security, leading to missing authentication on custom API routes that sit outside the main database/auth provider's automated protections.
**Prevention:** Always implement an authentication middleware for custom backend routes and perform explicit authorization checks to ensure a user can only modify their own data (`userId === req.user.id`).

## 2026-05-11 - [Authorization in Multi-Participant Contexts]
**Vulnerability:** A push notification relay endpoint (`/api/push/notify`) allowed authenticated users to send notifications to any arbitrary list of `userIds` for any `conversationId`, without verifying they were actually a participant in that conversation.
**Learning:** Even with authentication, endpoints that act as relays or bridges between users need context-aware authorization. Knowing a `conversationId` is not proof of participation.
**Prevention:** Always fetch the associated resource (e.g., a conversation record) using a service role and verify that both the requester and all targets are authorized participants based on the resource's owner/participant fields.
