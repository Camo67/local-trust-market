# Buddies Worldwide 🌍🛡️

A peer-to-peer marketplace app built with security and trust at its core.

## Project Structure

This is a monorepo managed with `pnpm`.

- `artifacts/api-server`: Express backend for specialized services (e.g., Push Notifications).
- `artifacts/buddies-worldwide`: Vite + React frontend application.
- `lib/db`: Database schema and migrations (Drizzle ORM).
- `lib/api-zod`: Shared Zod schemas for API validation.

## Security Features (Sentinel 🛡️)

- **Authenticated API**: All sensitive API endpoints (like Push Notifications) are protected by Supabase authentication middleware.
- **Authorization**: Strict checks ensure users can only modify their own data (e.g., managing their own push subscriptions).
- **Secure Communication**: Uses VAPID for secure Web Push notifications.
- **Input Validation**: Uses Zod for rigorous runtime type checking and input validation.

## Getting Started

### Prerequisites

- `pnpm` installed globally.
- Node.js 20+.

### Installation

```bash
pnpm install
```

### Running the App

1. **Backend**:
   ```bash
   cd artifacts/api-server
   pnpm run dev
   ```

2. **Frontend**:
   ```bash
   cd artifacts/buddies-worldwide
   pnpm run dev
   ```

## Built with

- [Supabase](https://supabase.com/) - Auth & Database
- [Express](https://expressjs.com/) - Backend framework
- [React](https://reactjs.org/) - Frontend library
- [Vite](https://vitejs.dev/) - Build tool
- [Drizzle ORM](https://orm.drizzle.team/) - SQL ORM
- [Zod](https://zod.dev/) - Schema validation
