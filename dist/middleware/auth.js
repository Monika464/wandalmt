import jwt from "jsonwebtoken";
// Middleware sprawdzający, czy użytkownik jest adminem
export const adminAuth = (req, res, next) => {
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
//autoryzacja usera
export const userAuth = (req, res, next) => {
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
