import type { ActorContext } from "../lib/request-context";

export interface SessionActor {
  userId: string;
  email: string;
  status: "invited" | "active" | "inactive";
  companyId: string | null;
  role: "admin" | "employee" | "super_admin" | null;
}

declare global {
  namespace Express {
    interface Request {
      actor?: ActorContext;
      sessionActor?: SessionActor;
    }
  }
}

export {};
