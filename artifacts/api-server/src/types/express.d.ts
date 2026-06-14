import type { ActorContext } from "../lib/request-context";

declare global {
  namespace Express {
    interface Request {
      actor?: ActorContext;
    }
  }
}

export {};
