import User from "../models/user.js";
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "defaultsecret";

export interface AuthRequest extends Request {
  user?: {
    _id: string;
    role: string;
    [key: string]: any;
  };
}

interface DecodedToken {
  _id: string;
  role: string;
}

// Middleware sprawdzający, czy użytkownik jest adminem
export const adminAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  console.log("hello from adminAuth");
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    console.log("token", token);
    if (!token) {
      res.status(401).json({ error: "Token is missing" });
      return; // Zatrzymujemy dalsze wykonanie
    }
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;

    //console.log("decoded", decoded);

    // if (decoded.role !== "admin") {
    //   res.status(403).json({ error: "Access denied" });
    //   return;
    // }
    const user = await User.findById(decoded._id);
    if (!user) {
      res.status(404).json({ error: "Użytkownik nie znaleziony" });
      return;
    }
    if (user.role !== "admin") {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    console.log("admin", user);

    if (user) {
      req.user = { ...user.toObject(), _id: user._id.toString() };
    } else {
      res.status(404).json({ error: "Użytkownik nie znaleziony" });
      return; // Zatrzymujemy dalsze wykonanie
    }
    next();
  } catch (error) {
    res.status(403).send({ error: "Access denied" });
  }
};

//autoryzacja usera

export const userAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      res.status(401).json({ error: "Token is missing" });
      return; // Zatrzymujemy dalsze wykonanie
    }
    // if (!token) {
    //   throw new Error("Token is missing");
    // }

    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;

    // Pobieramy pełnego użytkownika z bazy
    const user = await User.findById(decoded._id);
    if (!user) {
      res.status(404).json({ error: "Użytkownik nie znaleziony" });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).send({ error: "Please authenticate" });
  }
};
