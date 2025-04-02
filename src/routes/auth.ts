import express from "express";
import User from "../models/user.js";
import { Request, Response, NextFunction } from "express";
import { adminAuth, userAuth } from "../controllers/auth.js";
// Extend the Request interface to include the user property
declare global {
  namespace Express {
    interface Request {
      user?: any;
      token?: string;
    }
  }
}

import bcrypt from "bcryptjs";

const router = express.Router();

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

router.post("/logout", userAuth, async (req, res) => {
  //console.log("req.user", req.user);
  try {
    req.user.tokens = req.user.tokens.filter(
      (t: { token: string }) => t.token !== req.token
    );
    await req.user.save();
    res.send({ message: "Wylogowano pomyślnie" });
  } catch (e) {
    res.status(500).send({ error: "Nie udało się wylogować" });
  }
});

export default router;
