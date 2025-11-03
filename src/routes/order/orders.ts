import express, { Request, Response } from "express";
import mongoose from "mongoose";
import Order from "../../models/order.js";
import { adminAuth, userAuth } from "../../middleware/auth.js"; // zakładam, że masz AuthRequest z userem

const router = express.Router();

/**
 * GET /api/orders
 * 📦 Zwraca wszystkie zamówienia (dla admina)
 */
router.get("/", adminAuth, async (req: Request, res: Response) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    console.error("Błąd przy pobieraniu wszystkich zamówień:", error);
    res.status(500).json({ message: "Błąd serwera przy pobieraniu zamówień" });
  }
});

/**
 * GET /api/orders/user
 * 📦 Zwraca zamówienia zalogowanego użytkownika
 */
router.get("/user", userAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Brak autoryzacji" });
    }

    const orders = await Order.find({ "user.userId": req.user._id }).sort({
      createdAt: -1,
    });

    res.status(200).json(orders);
  } catch (error) {
    console.error("Błąd przy pobieraniu zamówień użytkownika:", error);
    res
      .status(500)
      .json({ message: "Błąd serwera przy pobieraniu zamówień użytkownika" });
  }
});

/**
 * POST /api/orders/refund/:id
 * 🔁 Zwraca zamówienie (zwrot)
 */
router.post(
  "/refund/:id",

  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res
          .status(400)
          .json({ message: "Nieprawidłowy identyfikator zamówienia" });
      }

      const order = await Order.findById(id);
      if (!order) {
        return res.status(404).json({ message: "Zamówienie nie znalezione" });
      }

      // Sprawdzenie czy użytkownik to właściciel lub admin
      if (
        !req.user ||
        (order.user.userId.toString() !== req.user._id.toString() &&
          req.user.role !== "admin")
      ) {
        return res.status(403).json({ message: "Brak uprawnień do zwrotu" });
      }

      // 💡 Tu w przyszłości można dodać logikę faktycznego zwrotu (Stripe refund API)
      order.set("refundedAt", new Date());
      await order.save();

      res.status(200).json({ message: "Zwrot zarejestrowany", order });
    } catch (error) {
      console.error("Błąd przy zwrocie zamówienia:", error);
      res.status(500).json({ message: "Błąd serwera przy zwrocie" });
    }
  }
);

export default router;
