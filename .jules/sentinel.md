## 2025-05-22 - push-notification-authorization
**Vulnerability:** Unauthenticated and unauthorized push notification endpoints allowed anyone to subscribe/unsubscribe any user and spam notifications to any user.
**Learning:** Even "best-effort" or "side-channel" features like push notifications need full AAA (Authentication, Authorization, and Audit) if they handle user-specific data or allow communication between users.
**Prevention:** Always implement authentication middleware for all API endpoints and verify that the requester has the necessary permissions to perform the action on the specific resource (e.g., matching user IDs or checking conversation membership).
