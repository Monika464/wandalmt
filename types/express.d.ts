import type { Request } from "express";
import type { UserDocument } from "../models/user"; // jeśli masz taki typ

export interface AuthenticatedRequest extends Request {
  user?: UserDocument & { _id: string; email: string };
}
