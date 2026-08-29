import { Request, Response, NextFunction } from "express";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export interface AuthenticatedRequest extends Request {
  /** Verified Logto access-token claims. Present only after authMiddleware succeeds. */
  user?: { id: string; claims: JWTPayload };
  /** Raw bearer token, forwarded to PostgREST so RLS sees the caller's own identity. */
  accessToken?: string;
}

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (_jwks) return _jwks;
  const endpoint = process.env["LOGTO_ENDPOINT"];
  if (!endpoint) throw new Error("LOGTO_ENDPOINT env var not set");
  _jwks = createRemoteJWKSet(new URL(`${endpoint.replace(/\/$/, "")}/oidc/jwks`));
  return _jwks;
}

/**
 * Verifies a Logto-issued access token (JWKS-based — no shared secret).
 * Replaces the old `supabase.auth.getUser(token)` check now that Logto,
 * not GoTrue, issues the tokens this API receives.
 */
export const authMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.slice("Bearer ".length);
  const endpoint = process.env["LOGTO_ENDPOINT"];
  const resource = process.env["VITE_SUPABASE_RESOURCE"];

  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: endpoint ? `${endpoint.replace(/\/$/, "")}/oidc` : undefined,
      audience: resource || undefined,
    });

    if (!payload.sub) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    req.user = { id: payload.sub, claims: payload };
    req.accessToken = token;
    next();
  } catch (err) {
    req.log?.error?.({ err }, "Auth middleware error");
    res.status(401).json({ error: "Invalid token" });
  }
};
