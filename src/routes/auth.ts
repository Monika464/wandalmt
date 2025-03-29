import express from "express";
import User from "../models/user.js";
import { Request, Response, NextFunction } from "express";

// Extend the Request interface to include the user property
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const router = express.Router();

router.get("/", (req, res) => {
  res.send("Hello World!");
});

// router.post("/user/signup", async (req, res) => {
//   const user = new User(req.body);
//   try {
//     await user.save();
//     const token = await user.generateAuthToken();
//     res.status(201).send({ user, token });
//   } catch (e) {
//     res.status(400).send({ error: (e as Error).message });
//   }
// });

router.post("/login", async (req, res) => {
  try {
    const user = await User.findByCredentials(
      req.body.email,
      req.body.password
    );
    const token = await user.generateAuthToken();

    res.send({ user, token });
  } catch (e) {
    res.status(400).send({ error: (e as Error).message });
  }
});

// Rejestracja (z możliwością dodania admina)
router.post("/register", async (req, res) => {
  try {
    const { email, password, name, surname, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 8);
    const user = new User({
      email,
      password: hashedPassword,
      name,
      surname,
      role,
    });

    await user.save();
    res.status(201).send({ message: "User created", user });
  } catch (error) {
    res.status(400).send(error);
  }
});

// Middleware sprawdzający, czy użytkownik jest adminem
const adminAuth = (req: Request, res: Response, next: NextFunction) => {
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

// Admin: Zarządzanie produktami
router.get("/admin/products", adminAuth, async (req, res) => {
  res.send("Lista produktów dla admina");
});

// User: Przeglądanie i kupowanie produktów
router.get("/user/products", async (req, res) => {
  res.send("Lista produktów dla użytkownika");
});

export default router;
