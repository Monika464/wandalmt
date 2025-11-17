import { Router } from "express";
//import { Request, Response, NextFunction } from "express";
import { adminAuth, userAuth } from "../middleware/auth.js";
import User from "../models/user.js";
//import bcrypt from "bcryptjs";
import { changeEmail, requestPasswordReset, resetPassword, } from "controllers/authController.js";
const router = Router();
//Login admin or user
router.post("/login", async (req, res) => {
    try {
        const { email, password, role } = req.body;
        const user = await User.findByCredentials(email, password);
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
        res.status(200).send({ user, token });
        //res.send({ user, token });
    }
    catch (e) {
        res.status(400).send({ error: e.message });
    }
});
// Register admin or user
router.post("/register", async (req, res) => {
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
            role,
        });
        await user.save();
        const token = await user.generateAuthToken();
        res.status(201).send({ message: "User created", user, token });
    }
    catch (error) {
        res.status(400).send(error);
    }
});
router.post("/register-admin", adminAuth, async (req, res, next) => {
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
    }
    catch (error) {
        res.status(400).send({ error });
    }
});
router.post("/logout-admin", adminAuth, async (req, res) => {
    try {
        if (!req.user || !req.token) {
            return;
        }
        if (req.user.role !== "admin") {
            res.status(403).send({ error: "Access denied" });
            return;
        }
        // await req.user.removeAuthToken(req.token);
        req.user.tokens = req.user.tokens.filter((t) => t.token !== req.token);
        await req.user.save();
        res.status(200).send({ message: "Admin logged out successfully" });
        console.log("Logout-admin success");
        //res.send({ message: "Logout successful" });
    }
    catch (error) {
        console.error("Logout-admin error:", error);
        res.status(500).send({ error: "Failed to log out" });
    }
});
router.post("/logout", userAuth, async (req, res) => {
    try {
        //console.log("Logout user called", req.user, req.token);
        if (!req.user || !req.token) {
            res.status(401).json({
                message: "Brak autoryzacji (user lub token nie znaleziony)",
            });
            return;
        }
        req.user.tokens = req.user.tokens.filter((t) => t.token !== req.token);
        await req.user.save();
        //console.log("req.user", req.user);
        res.status(200).send({ message: "Logged out successfully" });
    }
    catch (e) {
        res.status(500).send({ error: "Failed to log out" });
    }
});
// GET /auth/me
router.get("/me", userAuth, async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Nieautoryzowany" });
            return;
        }
        // zwracamy sam obiekt usera
        res.status(200).json(req.user);
        return;
    }
    catch (error) {
        res.status(500).json({
            message: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
// POST /api/auth/request-reset → wysyła maila z linkiem resetującym
router.post("/request-reset", requestPasswordReset);
// POST /api/auth/reset-password → zmienia hasło po kliknięciu w link
router.post("/reset-password", resetPassword);
// PATCH /api/auth/change-email → zmienia email (wymaga logowania)
router.patch("/change-email", userAuth, changeEmail);
export default router;
