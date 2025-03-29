var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import express from "express";
import User from "../models/user.js";
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
router.post("/login", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield User.findByCredentials(req.body.email, req.body.password);
        const token = yield user.generateAuthToken();
        res.send({ user, token });
    }
    catch (e) {
        res.status(400).send({ error: e.message });
    }
}));
// Rejestracja (z możliwością dodania admina)
router.post("/register", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password, name, surname, role } = req.body;
        const hashedPassword = yield bcrypt.hash(password, 8);
        const user = new User({
            email,
            password: hashedPassword,
            name,
            surname,
            role,
        });
        yield user.save();
        res.status(201).send({ message: "User created", user });
    }
    catch (error) {
        res.status(400).send(error);
    }
}));
// Middleware sprawdzający, czy użytkownik jest adminem
const adminAuth = (req, res, next) => {
    var _a;
    try {
        const token = (_a = req.header("Authorization")) === null || _a === void 0 ? void 0 : _a.replace("Bearer ", "");
        if (!token) {
            throw new Error("Token is missing");
        }
        const decoded = jwt.verify(token, "secretkey");
        if (typeof decoded !== "object" || decoded.role !== "admin") {
            throw new Error();
        }
        req.user = decoded;
        next();
    }
    catch (error) {
        res.status(403).send({ error: "Access denied" });
    }
};
// Admin: Zarządzanie produktami
router.get("/admin/products", adminAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.send("Lista produktów dla admina");
}));
//autoryzacja usera
const userAuth = (req, res, next) => {
    var _a;
    try {
        const token = (_a = req.header("Authorization")) === null || _a === void 0 ? void 0 : _a.replace("Bearer ", "");
        if (!token) {
            throw new Error("Token is missing");
        }
        const decoded = jwt.verify(token, "secretkey");
        if (typeof decoded !== "object") {
            throw new Error();
        }
        req.user = decoded;
        next();
    }
    catch (error) {
        res.status(401).send({ error: "Please authenticate" });
    }
};
// User: Przeglądanie i kupowanie produktów
router.get("/user/products", userAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.send("Lista produktów dla użytkownika");
}));
// Pobieranie wszystkich użytkowników z rolą "user"
router.get("/users", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const users = yield User.find({ role: "user" }); // Filtrujemy użytkowników z rolą "user"
        res.status(200).send(users);
    }
    catch (error) {
        res.status(500).send({ error: "Błąd serwera" });
    }
}));
export default router;
