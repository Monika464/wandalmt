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
export const adminAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      throw new Error("Token is missing");
    }
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;

    if (decoded.role !== "admin") {
      throw new Error();
    }

    req.user = decoded;
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
