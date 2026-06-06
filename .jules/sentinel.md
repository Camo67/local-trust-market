## 2026-05-10 - [Secure Push Notification Endpoints]
**Vulnerability:** Publicly accessible push notification endpoints (`/api/push/*`) allowed anyone to subscribe, unsubscribe, or send notifications to any user by simply knowing their `userId`.
**Learning:** Development often prioritizes functionality (getting push notifications to work) over security, leading to missing authentication on custom API routes that sit outside the main database/auth provider's automated protections.
**Prevention:** Always implement an authentication middleware for custom backend routes and perform explicit authorization checks to ensure a user can only modify their own data (`userId === req.user.id`).

## 2026-05-11 - [Auth Guard Race Conditions]
**Vulnerability:** When implementing frontend authorization guards (e.g., `AdminRoute`), a race condition between authentication state (`user` object presence) and profile fetching (`is_admin` flag) can lead to unauthorized access or premature redirects.
**Learning:** React state updates for auth events often trigger before secondary profile data is fetched. If the guard only checks for the absence of a flag that hasn't loaded yet, it might incorrectly redirect a valid user.
**Prevention:** Ensure the global `loading` state in the Auth Context remains `true` while any critical authorization data (like roles or admin flags) is being retrieved from the database.
