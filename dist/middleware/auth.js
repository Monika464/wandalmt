import User from "../models/user.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET || "defaultsecret";
//admin auth
export const adminAuth = async (req, res, next) => {
    try {
        const token = req.header("Authorization")?.replace("Bearer ", "");
        //console.log("Token received:", token);
        if (!token) {
            res.status(401).json({ error: "Token is missing" });
            return;
        }
        const decoded = jwt.verify(token, JWT_SECRET);
        // console.log("Decoded token:", decoded);
        const user = await User.findById(decoded._id);
        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        if (user.role !== "admin") {
            res.status(403).json({ error: "Access denied" });
            return;
        }
        // console.log("admin", user);
        if (user) {
            req.token = token;
            req.user = user;
        }
        else {
            res.status(404).json({ error: "User not found" });
            return;
        }
        next();
    }
    catch (error) {
        console.error("Auth error:", error);
        res.status(401).json({ error: "Unauthorized" });
        return;
        //res.status(403).send({ error: "Access denied" });
    }
};
//userAuth
export const userAuth = async (req, res, next) => {
    try {
        const token = req.header("Authorization")?.replace("Bearer ", "");
        if (!token) {
            res.status(401).json({ error: "Token is missing" });
            return;
        }
        const decoded = jwt.verify(token, JWT_SECRET);
        // Pobieramy pełnego użytkownika z bazy
        const user = await User.findById(decoded._id);
        if (!user) {
            res.status(404).json({ error: "User not found" });
        }
        req.user = user;
        next();
    }
    catch (error) {
        res.status(401).send({ error: "Please authenticate" });
    }
};
// export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
//   const authHeader = req.headers.authorization;
//   if (!authHeader || !authHeader.startsWith("Bearer ")) {
//     return res.status(401).json({ error: "Brak tokena, nieautoryzowany" });
//   }
//   const token = authHeader.split(" ")[1];
//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
//     (req as any).user = decoded; // przypisujesz użytkownika do req
//     next();
//   } catch (err) {
//     return res.status(401).json({ error: "Nieprawidłowy token" });
//   }
// };
