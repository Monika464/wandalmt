// routes/discounts-public.ts
import express, { Request, Response } from "express";
import Discount from "../../models/discount.js";
import { userAuth } from "../../middleware/auth.js";

const router = express.Router();

// WALIDUJ KUPON (dla koszyka)
router.post(
  "/validate",
  userAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { couponCode, cartItems = [], totalAmount = 0 } = req.body;

      if (!couponCode) {
        res.status(400).json({ error: "Podaj kod kuponu" });
        return;
      }

      // Znajdź kupon
      const discount = await Discount.findOne({
        code: couponCode.toUpperCase(),
      });

      if (!discount) {
        res.status(404).json({
          valid: false,
          error: "Nieprawidłowy kod kuponu",
        });
        return;
      }

      // Prosta walidacja
      if (!discount.isActive) {
        res.status(400).json({
          valid: false,
          error: "Kupon nieaktywny",
        });
        return;
      }

      // Sprawdź daty
      const now = new Date();
      if (discount.validUntil && now > new Date(discount.validUntil)) {
        res.status(400).json({
          valid: false,
          error: "Kupon wygasł",
        });
        return;
      }

      // Sprawdź użycia
      if (discount.maxUses && discount.usedCount >= discount.maxUses) {
        res.status(400).json({
          valid: false,
          error: "Kupon został wyczerpany",
        });
        return;
      }

      // Sprawdź minimalną kwotę
      if (totalAmount < discount.minPurchaseAmount) {
        res.status(400).json({
          valid: false,
          error: `Minimalna kwota zamówienia: ${discount.minPurchaseAmount} PLN`,
        });
        return;
      }

      // Oblicz zniżkę
      let discountAmount = 0;

      if (discount.type === "percentage") {
        discountAmount = (totalAmount * discount.value) / 100;
        if (
          discount.maxDiscountAmount &&
          discountAmount > discount.maxDiscountAmount
        ) {
          discountAmount = discount.maxDiscountAmount;
        }
      } else if (discount.type === "fixed") {
        discountAmount = Math.min(discount.value, totalAmount);
      }

      res.json({
        valid: true,
        discount: {
          id: discount._id,
          code: discount.code,
          name: discount.name,
          type: discount.type,
          value: discount.value,
          discountAmount: discountAmount,
          description:
            discount.type === "percentage"
              ? `${discount.value}% zniżki`
              : `${discount.value} PLN zniżki`,
        },
      });
    } catch (error: any) {
      console.error("Error validating coupon:", error);
      res.status(500).json({
        valid: false,
        error: "Błąd podczas walidacji kuponu",
      });
    }
  }
);

// Pobierz kupon po kodzie (publiczne)
router.get(
  "/code/:code",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { code } = req.params;

      const discount = await Discount.findOne({
        code: code.toUpperCase(),
        isActive: true,
      }).select("name code type value");

      if (!discount) {
        res.status(404).json({ error: "Kupon nie znaleziony" });
        return;
      }

      res.json({
        name: discount.name,
        code: discount.code,
        type: discount.type,
        value: discount.value,
        description:
          discount.type === "percentage"
            ? `${discount.value}% zniżki`
            : `${discount.value} PLN zniżki`,
      });
    } catch (error: any) {
      console.error("Error fetching discount:", error);
      res.status(500).json({ error: "Błąd podczas pobierania kuponu" });
    }
  }
);

export default router;
