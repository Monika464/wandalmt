import express from "express";
import User from "../models/user.js";
import { userAuth } from "../middleware/auth.js";
import { sendOrderConfirmation, sendInvoice, } from "../controllers/emailController.js";
import { adminAuth } from "../middleware/auth.js"; // jeśli chcesz zabezpieczyć
const router = express.Router();
//router.post("/send-email", sendMail);
// ===========================
// 3) CHANGE EMAIL
// ===========================
router.patch("/change-email", userAuth, // 🔒 WYMAGA bycia zalogowanym
async (req, res) => {
    console.log("change-email called");
    console.log("BODY:", req.body);
    try {
        const { newEmail } = req.body;
        const userId = req.user.id; // z userAuth
        if (!newEmail) {
            res.status(400).json({ error: "Nowy email jest wymagany" });
            return;
        }
        // sprawdz, czy email jest wolny
        const exists = await User.findOne({ email: newEmail });
        if (exists) {
            res.status(400).json({ error: "Ten email jest już zajęty" });
            return;
        }
        await User.findByIdAndUpdate(userId, { email: newEmail });
        res.json({ message: "Email został zmieniony" });
    }
    catch (err) {
        res.status(500).json({ error: "Błąd serwera przy zmianie emaila" });
    }
});
//=====================
//4 send email after order
//=====================
// routes/emailRoutes.ts
//router.post("/send-order-confirmation", sendOrderConfirmation);
// routes/emailRoutes.ts
// Publiczne endpointy (używane przez webhook)
router.post("/send-order-confirmation", sendOrderConfirmation);
router.post("/send-invoice", sendInvoice);
// Opcjonalnie - zabezpieczone endpointy dla admina do ręcznego wysyłania
router.post("/admin/send-order-confirmation", adminAuth, sendOrderConfirmation);
router.post("/admin/send-invoice", adminAuth, sendInvoice);
export default router;
