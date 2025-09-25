import express from "express";

//import { Request, Response, NextFunction } from "express";
import { adminAuth, userAuth } from "../middleware/auth.js";
import User, { IUser } from "../models/user.js";
// Extend the Request interface to include the user property
declare global {
  namespace Express {
    interface Request {
      user?: any;
      token?: string;
    }
  }
}
// Typ dla ciała żądania login/register
interface AuthRequestBody {
  email: string;
  password: string;
  name?: string;
  surname?: string;
  role?: "user" | "admin";
}
import bcrypt from "bcryptjs";

const router = express.Router();

//Login admin or user
router.post("/login", async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const user: IUser | null = await User.findByCredentials(email, password);
    // const user = await User.findByCredentials(
    //   req.body.email,
    //   req.body.password
    // );
    if (!user) {
      return res.status(400).send({ error: "Niepoprawny email lub hasło" });
    }
    // Sprawdzamy rolę, jeśli podano
    if (role && user.role !== role) {
      return res.status(403).send({ error: "Nie masz odpowiednich uprawnień" });
    }

    const token = await user.generateAuthToken();
    res.status(200).send({ user, token });
    //res.send({ user, token });
  } catch (e) {
    res.status(400).send({ error: (e as Error).message });
  }
});

// Register admin or user
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

//logout admin

router.post("/logout-admin", adminAuth, async (req, res, next) => {
  //console.log("req.user", req.user);
  try {
    if (req.user.role !== "admin") {
      res.status(403).send({ error: "Access denied" });
      return;
    }
    // await req.user.removeAuthToken(req.token);

    req.user.tokens = req.user.tokens.filter(
      (t: { token: string }) => t.token !== req.token
    );

    res.send({ message: "Logout successful" });
  } catch (error) {
    res.status(500).send({ error: "Failed to log out" });
  }
});

router.post("/logout", userAuth, async (req, res) => {
  try {
    req.user.tokens = req.user.tokens.filter(
      (t: { token: string }) => t.token !== req.token
    );
    await req.user.save();
    //console.log("req.user", req.user);
    res.status(200).send({ message: "Logged out successfully" });
  } catch (e) {
    res.status(500).send({ error: "Failed to log out" });
  }
});

export default router;
