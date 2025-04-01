import express from "express";
import User from "../models/user.js";
import { Request, Response, NextFunction } from "express";
import { adminAuth, userAuth } from "../controllers/auth.js";
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

// Admin: Zarządzanie produktami
router.get("/admin/products", adminAuth, async (req, res) => {
  res.send("Lista produktów dla admina");
});

// User: Przeglądanie i kupowanie produktów
router.get("/user/products", userAuth, async (req, res) => {
  res.send("Lista produktów dla użytkownika");
});

// Pobieranie wszystkich użytkowników z rolą "user"
router.get("/users", async (req, res) => {
  try {
    const users = await User.find({ role: "user" }); // Filtrujemy użytkowników z rolą "user"
    res.status(200).send(users);
  } catch (error) {
    res.status(500).send({ error: "Błąd serwera" });
  }
});

export default router;
