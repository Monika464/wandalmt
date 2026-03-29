import express, { Request, Response, Router } from "express";
//import { Request, Response, NextFunction } from "express";
import { adminAuth, userAuth } from "../../middleware/auth.js";
import User, { IUser } from "../../models/user.js";
import jwt from "jsonwebtoken";

import {
  changeEmail,
  requestPasswordReset,
  resetPassword,
  validateResetToken,
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
      res.status(400).send({ error: "Incorrect email or password" });
      return;
    }
    // Sprawdzamy rolę, jeśli podano
    if (role && user.role !== role) {
      res
        .status(403)
        .send({ error: "You do not have the required permissions" });
      return;
    }

    const token = await user.generateAuthToken();

    // Dekoduj token, aby pobrać czas wygaśnięcia
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET is not defined");
    }

    const decoded = jwt.verify(token, secret) as {
      exp: number; // czas wygaśnięcia w SEKUNDACH
      iat: number; // czas utworzenia
      _id: string; // ID użytkownika
    };

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

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).send({ error: "User with this email already exists" });
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
      expiresAt,
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

      await user.save();
      res.status(201).send({ message: "Admin created", user });
    } catch (error) {
      res.status(400).send({ error });
    }
  },
);

router.post(
  "/refresh-token",
  userAuth,
  async (req: IAuthRequest, res): Promise<void> => {
    try {
      if (!req.user || !req.token) {
        res.status(401).send({ error: "Nieautoryzowany" });
        return;
      }

      req.user.tokens = req.user.tokens.filter(
        (t: { token: string }) => t.token !== req.token,
      );

      const newToken = await req.user.generateAuthToken();

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
  },
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
  },
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
        (t: { token: string }) => t.token !== req.token,
      );

      await req.user.save();

      res.status(200).send({ message: "Admin logged out successfully" });
      console.log("Logout-admin success");
      //res.send({ message: "Logout successful" });
    } catch (error) {
      console.error("Logout-admin error:", error);
      res.status(500).send({ error: "Failed to log out" });
    }
  },
);

router.post(
  "/logout",
  userAuth,
  async (req: IAuthRequest, res: Response): Promise<void> => {
    try {
      //console.log("Logout user called", req.user, req.token);
      if (!req.user || !req.token) {
        res.status(401).json({
          message: "No authorization (user or token not found)",
        });
        return;
      }
      req.user.tokens = req.user.tokens.filter(
        (t: { token: string }) => t.token !== req.token,
      );
      await req.user.save();

      //console.log("req.user", req.user);
      res.status(200).send({ message: "Logged out successfully" });
    } catch (e) {
      res.status(500).send({ error: "Failed to log out" });
    }
  },
);

// Password reset request (send link)
router.post("/forgot-password", requestPasswordReset);

// Set new password
router.post("/reset-password", resetPassword);

// Validate reset token (for frontend)
router.get("/validate-reset-token", validateResetToken);

router.patch("/change-email", userAuth, changeEmail);

export default router;
