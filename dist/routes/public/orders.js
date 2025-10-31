import express from "express";
import { userAuth } from "../../middleware/auth.js";
import Order from "../../models/order.js";
const router = express.Router();
// ✅ Zwraca zamówienia zalogowanego użytkownika
router.get("/my-orders", userAuth, async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: "Brak autoryzacji" });
            return;
        }
        const orders = await Order.find({ "user.userId": req.user._id }).sort({
            createdAt: -1,
        });
        if (!orders.length) {
            res.json({ message: "Brak zamówień" });
            return;
        }
        res.json(orders);
    }
    catch (err) {
        console.error("Błąd pobierania zamówień:", err);
        res.status(500).json({ error: "Błąd pobierania zamówień" });
    }
});
export default router;
