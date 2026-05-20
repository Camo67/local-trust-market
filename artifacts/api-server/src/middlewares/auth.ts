import { Request, Response, NextFunction } from "express";
import { getSupabase } from "../lib/supabase";

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const supabase = getSupabase();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    (req as any).user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: "Authentication failed" });
  }
};
