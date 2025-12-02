import express, { Request, Response, Router } from "express";
//import { Request, Response, NextFunction } from "express";
import { adminAuth, userAuth } from "../middleware/auth.js";
import User, { IUser } from "../models/user.js";
import jwt from "jsonwebtoken";

import {
  changeEmail,
  requestPasswordReset,
  resetPassword,
} from "controllers/authController.js";

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
      return;
    }
    // Sprawdzamy rolę, jeśli podano
    if (role && user.role !== role) {
      res.status(403).send({ error: "Nie masz odpowiednich uprawnień" });
      return;
    }

    const token = await user.generateAuthToken();

    // Dekoduj token, aby pobrać czas wygaśnięcia
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET nie jest zdefiniowany");
    }

    const decoded = jwt.verify(token, secret) as {
      exp: number; // czas wygaśnięcia w SEKUNDACH
      iat: number; // czas utworzenia
      _id: string; // ID użytkownika
    };

    // expiresAt w milisekundach (JWT exp jest w sekundach)
    const expiresAt = decoded.exp * 1000;

    res.status(200).send({
      user: {
        _id: user._id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        role: user.role,
      },
      token,
      expiresAt, // ← przekazujemy frontendowi
      expiresIn: decoded.exp - Math.floor(Date.now() / 1000), // czas do wygaśnięcia w sekundach
    });

    // res.status(200).send({
    //   user,
    //   token,
    //   expiresAt, // ← dodajemy czas wygaśnięcia
    // });

    // res.status(200).send({ user, token });
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
      return;
    }

    const user = new User({
      email,
      password,
      name,
      surname,
      role: role || "user",
    });

    await user.save();
    const token = await user.generateAuthToken();

    // WERYFIKACJA DLA REJESTRACJI
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET nie jest zdefiniowany");
    }

    const decoded = jwt.verify(token, secret) as { exp: number; _id: string };
    const expiresAt = decoded.exp * 1000;

    res.status(201).send({
      message: "User created",
      user: {
        _id: user._id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        role: user.role,
      },
      token,
      expiresAt, // ← kluczowe!
    });
    //res.status(201).send({ message: "User created", user, token });
  } catch (error) {
    res.status(400).send(error);
  }
});

router.post(
  "/register-admin",
  adminAuth,
  async (req, res, next): Promise<void> => {
    try {
      // if (!req.user || !req.token) {
      //   return;
      // }
      if (!req.user || req.user.role !== "admin") {
        res.status(403).send({ error: "Access denied" });
        return;
      }
      const { email, password, name, surname } = req.body;

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        res
          .status(400)
          .json({ error: "Użytkownik z tym emailem już istnieje" });
        return;
      }

      //const hashedPassword = await bcrypt.hash(password, 8);
      const user = new User({
        email,
        password,
        name,
        surname,
        role: "admin",
      });

      //console.log("Creating admin:", user);

      await user.save();
      res.status(201).send({ message: "Admin created", user });
    } catch (error) {
      res.status(400).send({ error });
    }
  }
);

// Refresh token - Z WERYFIKACJĄ
router.post(
  "/refresh-token",
  userAuth,
  async (req: IAuthRequest, res): Promise<void> => {
    try {
      if (!req.user || !req.token) {
        res.status(401).send({ error: "Nieautoryzowany" });
        return;
      }

      // Usuń stary token z bazy danych
      req.user.tokens = req.user.tokens.filter(
        (t: { token: string }) => t.token !== req.token
      );

      // Wygeneruj nowy token
      const newToken = await req.user.generateAuthToken();

      // WERYFIKACJA NOWEGO TOKENA
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error("JWT_SECRET nie jest zdefiniowany");
      }

      const decoded = jwt.verify(newToken, secret) as {
        exp: number;
        _id: string;
      };
      const expiresAt = decoded.exp * 1000;

      res.status(200).send({
        token: newToken,
        expiresAt,
        expiresIn: decoded.exp - Math.floor(Date.now() / 1000),
        message: "Token odświeżony",
      });
    } catch (error) {
      console.error("Błąd odświeżania tokena:", error);
      res.status(500).send({ error: "Nie udało się odświeżyć tokena" });
    }
  }
);

// GET /auth/me
router.get(
  "/me",
  userAuth,
  async (req: IAuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ message: "Nieautoryzowany" });
        return;
      }

      res.status(200).json(req.user);
      return;
    } catch (error) {
      res.status(500).json({
        message: error instanceof Error ? error.message : "Unknown error",
      });
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
      //console.log("Logout user called", req.user, req.token);
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

// POST /api/auth/request-reset → wysyła maila z linkiem resetującym
router.post("/request-reset", requestPasswordReset);

// POST /api/auth/reset-password → zmienia hasło po kliknięciu w link
router.post("/reset-password", resetPassword);

// PATCH /api/auth/change-email → zmienia email (wymaga logowania)
router.patch("/change-email", userAuth, changeEmail);

export default router;
