import express, { Request, Response, Router } from "express";
//import { Request, Response, NextFunction } from "express";
import { adminAuth, userAuth } from "../middleware/auth.js";
import User, { IUser } from "../models/user.js";

interface IAuthRequestBody {
  email: string;
  password: string;
  name?: string;
  surname?: string;
  role?: "user" | "admin";
}
interface IAuthRequest extends Request {
  body: IAuthRequestBody;
  user?: IUser | null;
  token?: string;
}
import bcrypt from "bcryptjs";

const router = Router();

//Login admin or user
router.post("/login", async (req, res): Promise<void> => {
  try {
    const { email, password, role } = req.body;
    const user: IUser | null = await User.findByCredentials(email, password);
    // const user = await User.findByCredentials(
    //   req.body.email,
    //   req.body.password
    // );
    if (!user) {
      res.status(400).send({ error: "Niepoprawny email lub hasło" });
    }
    // Sprawdzamy rolę, jeśli podano
    if (role && user.role !== role) {
      res.status(403).send({ error: "Nie masz odpowiednich uprawnień" });
    }

    const token = await user.generateAuthToken();
    res.status(200).send({ user, token });

    //res.send({ user, token });
  } catch (e) {
    res.status(400).send({ error: (e as Error).message });
  }
});

// Register admin or user
router.post("/register", async (req, res): Promise<void> => {
  try {
    const { email, password, name, surname, role } = req.body;

    // Sprawdzenie, czy email już istnieje
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).send({ error: "Użytkownik z tym emailem już istnieje" });
    }
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

router.post(
  "/register-admin",
  adminAuth,
  async (req, res, next): Promise<void> => {
    try {
      const { email, password, name, surname } = req.body;

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        res
          .status(400)
          .json({ error: "Użytkownik z tym emailem już istnieje" });
      }

      const hashedPassword = await bcrypt.hash(password, 8);
      const user = new User({
        email,
        password: hashedPassword,
        name,
        surname,
        role: "admin", // wymuszona rola
      });

      console.log("Creating admin:", user);

      await user.save();
      res.status(201).send({ message: "Admin created", user });
    } catch (error) {
      res.status(400).send({ error });
    }
  }
);

router.post(
  "/logout-admin",
  adminAuth,
  async (req: IAuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user || !req.token) {
        return;
      }
      if (req.user.role !== "admin") {
        res.status(403).send({ error: "Access denied" });
        return;
      }
      // await req.user.removeAuthToken(req.token);

      req.user.tokens = req.user.tokens.filter(
        (t: { token: string }) => t.token !== req.token
      );

      await req.user.save();

      res.status(200).send({ message: "Admin logged out successfully" });
      console.log("Logout-admin success");
      //res.send({ message: "Logout successful" });
    } catch (error) {
      console.error("Logout-admin error:", error);
      res.status(500).send({ error: "Failed to log out" });
    }
  }
);

router.post(
  "/logout",
  userAuth,
  async (req: IAuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user || !req.token) {
        res.status(401).json({
          message: "Brak autoryzacji (user lub token nie znaleziony)",
        });
        return;
      }
      req.user.tokens = req.user.tokens.filter(
        (t: { token: string }) => t.token !== req.token
      );
      await req.user.save();

      //console.log("req.user", req.user);
      res.status(200).send({ message: "Logged out successfully" });
    } catch (e) {
      res.status(500).send({ error: "Failed to log out" });
    }
  }
);

export default router;
