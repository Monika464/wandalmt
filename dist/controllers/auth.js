var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import User from "../models/user.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET || "defaultsecret";
// Middleware sprawdzający, czy użytkownik jest adminem
export const adminAuth = (req, res, next) => {
    var _a;
    try {
        const token = (_a = req.header("Authorization")) === null || _a === void 0 ? void 0 : _a.replace("Bearer ", "");
        if (!token) {
            throw new Error("Token is missing");
        }
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== "admin") {
            throw new Error();
        }
        req.user = decoded;
        next();
    }
    catch (error) {
        res.status(403).send({ error: "Access denied" });
    }
};
//autoryzacja usera
export const userAuth = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const token = (_a = req.header("Authorization")) === null || _a === void 0 ? void 0 : _a.replace("Bearer ", "");
        if (!token) {
            res.status(401).json({ error: "Token is missing" });
            return; // Zatrzymujemy dalsze wykonanie
        }
        // if (!token) {
        //   throw new Error("Token is missing");
        // }
        const decoded = jwt.verify(token, JWT_SECRET);
        // Pobieramy pełnego użytkownika z bazy
        const user = yield User.findById(decoded._id);
        if (!user) {
            res.status(404).json({ error: "Użytkownik nie znaleziony" });
        }
        req.user = user;
        next();
    }
    catch (error) {
        res.status(401).send({ error: "Please authenticate" });
    }
});
