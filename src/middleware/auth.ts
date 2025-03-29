import User from "../models/user.js";
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

// Middleware sprawdzający, czy użytkownik jest adminem
export const adminAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      throw new Error("Token is missing");
    }
    const decoded = jwt.verify(token, "secretkey");

    if (typeof decoded !== "object" || decoded.role !== "admin") {
      throw new Error();
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).send({ error: "Access denied" });
  }
};

//autoryzacja usera

export const userAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      throw new Error("Token is missing");
    }

    const decoded = jwt.verify(token, "secretkey");

    if (typeof decoded !== "object") {
      throw new Error();
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).send({ error: "Please authenticate" });
  }
};
