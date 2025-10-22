import express, { Response } from "express";
import { userAuth } from "../../middleware/auth.js";
import type { AuthenticatedRequest } from "../../types/express";
import Order from "../../models/order.js";

const router = express.Router();

// ✅ Zwraca zamówienia zalogowanego użytkownika
router.get(
  "/my-orders",
  userAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Brak autoryzacji" });
      }

      const orders = await Order.find({ "user.userId": req.user._id }).sort({
        createdAt: -1,
      });

      if (!orders.length) {
        return res.json({ message: "Brak zamówień" });
      }

      res.json(orders);
    } catch (err: any) {
      console.error("Błąd pobierania zamówień:", err);
      res.status(500).json({ error: "Błąd pobierania zamówień" });
    }
  }
);

export default router;
