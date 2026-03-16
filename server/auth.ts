import type { Express, Request, Response } from "express";

export function registerAuthRoutes(app: Express) {
  app.get("/api/auth/me", (_req: Request, res: Response) => {
    return res.status(401).json({ authenticated: false });
  });
}
