import type { Request, Response, NextFunction } from "express";
import { getSupabase } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Middleware to verify Supabase JWT and attach user to request.
 * Security: Prevents unauthenticated access to sensitive endpoints.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const supabase = getSupabase();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      req.log.warn({ error }, "Failed to verify Supabase token");
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    req.log.error({ err }, "Unexpected error in auth middleware");
    res.status(500).json({ error: "Internal server error" });
  }
}
