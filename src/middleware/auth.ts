import User, { IUser } from "../models/user.js";
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "defaultsecret";

// export interface AuthRequest extends Request {
//   user?: mongoose.Document<unknown, any, IUser> & IUser;
//   //user?: IUser | null;
//   token?: string;
// }

interface DecodedToken {
  _id: string;
  role: string;
}

//admin auth
export const adminAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    //console.log("Token received by backend:", token);

    if (!token) {
      res.status(401).json({ error: "Token is missing" });
      return;
    }
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
    // console.log("Decoded token:", decoded);

    const user = await User.findById(decoded._id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (user.role !== "admin") {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    // console.log("admin", user);

    if (user) {
      req.token = token;
      req.user = user;
    } else {
      res.status(404).json({ error: "User not found" });
      return;
    }
    next();
  } catch (error) {
    console.error("Auth error:", error);
    res.status(401).json({ error: "Unauthorized" });
    return;
    //res.status(403).send({ error: "Access denied" });
  }
};

//userAuth

export const userAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      res.status(401).json({ error: "Token is missing" });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;

    // Pobieramy pełnego użytkownika z bazy
    const user = await User.findById(decoded._id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).send({ error: "Please authenticate" });
  }
};
