## 2026-05-10 - [Secure Push Notification Endpoints]
**Vulnerability:** Publicly accessible push notification endpoints (`/api/push/*`) allowed anyone to subscribe, unsubscribe, or send notifications to any user by simply knowing their `userId`.
**Learning:** Development often prioritizes functionality (getting push notifications to work) over security, leading to missing authentication on custom API routes that sit outside the main database/auth provider's automated protections.
**Prevention:** Always implement an authentication middleware for custom backend routes and perform explicit authorization checks to ensure a user can only modify their own data (`userId === req.user.id`).

## 2026-05-11 - [Authorization and Information Leakage in Push API]
**Vulnerability:** The `/push/notify` endpoint lacked authorization checks to ensure the sender and recipients were participants in the conversation being notified about. Additionally, push routes were leaking internal error messages in 500 responses.
**Learning:** Custom API routes often bypass the standard database RLS protections, requiring manual authorization logic. Error handling that defaults to returning `err.message` can expose sensitive internal state or database schema details.
**Prevention:** Implement explicit participant-matching checks for all collaboration-based API endpoints. Use generic error messages in production responses while logging detailed errors server-side using tools like pino.
