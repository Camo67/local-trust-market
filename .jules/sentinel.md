# Sentinel Security Journal

## Mission
Identify and fix small security issues, prioritize critical vulnerabilities, use generic error messages, and ensure authorization checks.

## Log - 2026-05-12

### Issue: Information Leakage in API Server
- **Location:** `artifacts/api-server/src/routes/push.ts`
- **Description:** Error responses were returning raw error messages (`err.message`), which could leak internal implementation details or database schema information.
- **Fix:** Replaced specific error messages with generic "Internal server error" for production-like responses.
- **Lines changed:** ~15 lines.

### Issue: Potential Upload Failures (UX/Security)
- **Location:** `SellPage.tsx`, `VerifyPage.tsx`
- **Description:** Upload paths did not consistently follow the RLS requirement (`auth.uid()/...`), potentially leading to 403 Forbidden errors. Improved error reporting to distinguish between storage and database failures.
- **Fix:** Standardized upload path construction and added explicit logging/error handling.
- **Lines changed:** ~20 lines per file.

### Issue: Profile Management
- **Description:** Users were unable to manage their profile pictures or display names easily.
- **Fix:** Created `ProfilePage.tsx` and integrated profile data into `AuthContext`.
- **Status:** Resolved.
