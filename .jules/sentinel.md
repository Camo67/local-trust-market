## 2026-05-10 - [Secure Push Notification Endpoints]
**Vulnerability:** Publicly accessible push notification endpoints (`/api/push/*`) allowed anyone to subscribe, unsubscribe, or send notifications to any user by simply knowing their `userId`.
**Learning:** Development often prioritizes functionality (getting push notifications to work) over security, leading to missing authentication on custom API routes that sit outside the main database/auth provider's automated protections.
**Prevention:** Always implement an authentication middleware for custom backend routes and perform explicit authorization checks to ensure a user can only modify their own data (`userId === req.user.id`).

## 2026-05-11 - [Participant-Matching Authorization]
**Vulnerability:** The `/push/notify` endpoint, while authenticated, lacked authorization checks to ensure that the sender and all recipients were actually authorized participants of the specific conversation (`conversationId`).
**Learning:** Authentication (knowing who the user is) is not sufficient for multi-user interactions; explicit authorization (verifying the user has permission for the specific resource/action) is required.
**Prevention:** For any action involving multiple users or shared resources (like a chat conversation), fetch the resource's ownership/participant data from the database and verify it against the requester's identity.
