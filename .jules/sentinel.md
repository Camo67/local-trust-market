## 2026-05-10 - [Secure Push Notification Endpoints]
**Vulnerability:** Publicly accessible push notification endpoints (`/api/push/*`) allowed anyone to subscribe, unsubscribe, or send notifications to any user by simply knowing their `userId`.
**Learning:** Development often prioritizes functionality (getting push notifications to work) over security, leading to missing authentication on custom API routes that sit outside the main database/auth provider's automated protections.
**Prevention:** Always implement an authentication middleware for custom backend routes and perform explicit authorization checks to ensure a user can only modify their own data (`userId === req.user.id`).

## 2026-05-11 - [Conversation-based Push Authorization]
**Vulnerability:** The `/push/notify` endpoint only checked for a valid session but did not verify if the sender or recipients were actually participants in the conversation being notified about. This allowed any authenticated user to send notifications to any other user if they knew their ID and a valid `conversationId`.
**Learning:** Authentication is not Authorization. Even with a valid user session, API endpoints must verify that the user has the right to perform the specific action on the specific resource (e.g., sending a message in a specific conversation).
**Prevention:** Always perform multi-resource authorization checks. For messaging, verify that both the sender and all recipients are authorized participants of the conversation before triggering external actions like push notifications.
