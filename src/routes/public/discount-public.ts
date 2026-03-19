// routes/discounts-public.ts
import express, { Request, Response } from "express";
import Discount from "../../models/discount.js";
import { userAuth } from "../../middleware/auth.js";
import { t } from "../../utils/translations.js";

// Extend Request type to include language and user
interface RequestWithLang extends Request {
  lang?: string;
  user?: any;
}

const router = express.Router();

// PUBLIC COUPON VALIDATION (without user login)
router.post(
  "/validate-public",
  async (req: RequestWithLang, res: Response): Promise<void> => {
    try {
      // Get language from Accept-Language header (sent by frontend)
      const lang = (req.headers["accept-language"] as string) || "pl";
      // console.log("🌐 Using language from Accept-Language header:", lang);

      const { couponCode, totalAmount = 0 } = req.body;
      //console.log("📦 Request body:", { couponCode, totalAmount });

      if (!couponCode) {
        res.status(400).json({ error: t(lang, "checkout.invalidCoupon") });
        return;
      }

      // Find coupon in database
      const discount = await Discount.findOne({
        code: couponCode.toUpperCase(),
        isActive: true,
      });

      if (!discount) {
        res.status(404).json({
          valid: false,
          error: t(lang, "checkout.invalidCoupon"),
        });
        return;
      }

      // For user-specific coupons, return a warning that login is required
      if (discount.userId) {
        res.json({
          valid: true,
          requiresLogin: true,
          discount: {
            code: discount.code,
            type: discount.type,
            value: discount.value,
          },
          message: t(lang, "checkout.couponNotAvailable"),
        });
        return;
      }

      // Check expiration date
      const now = new Date();
      if (discount.validUntil && now > new Date(discount.validUntil)) {
        res.status(400).json({
          valid: false,
          error: t(lang, "checkout.couponExpired"),
        });
        return;
      }

      // Check usage limit
      if (discount.maxUses && discount.usedCount >= discount.maxUses) {
        res.status(400).json({
          valid: false,
          error: t(lang, "checkout.couponExpired"),
        });
        return;
      }

      // Check minimum purchase amount
      if (totalAmount < discount.minPurchaseAmount) {
        res.status(400).json({
          valid: false,
          error: t(lang, "checkout.minPurchaseAmount", {
            amount: discount.minPurchaseAmount.toFixed(2),
          }),
        });
        return;
      }

      // Calculate discount amount
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
              ? t(lang, "checkout.discountPercentage", {
                  value: discount.value,
                })
              : t(lang, "checkout.discountFixed", { value: discount.value }),
        },
      });
    } catch (error: any) {
      console.error("Error validating public coupon:", error);
      // Get language from Accept-Language header for error message
      const lang = (req.headers["accept-language"] as string) || "pl";
      // console.log(
      //   "🌐 Using language from Accept-Language header for error response:",
      //   lang,
      // );
      res.status(500).json({
        valid: false,
        error: t(lang, "checkout.couponValidationError"),
      });
    }
  },
);

// USER COUPON VALIDATION (for authenticated users - cart)
router.post(
  "/validate",
  userAuth,
  async (req: RequestWithLang, res: Response): Promise<void> => {
    try {
      // Get language from Accept-Language header (sent by frontend)
      const lang = (req.headers["accept-language"] as string) || "pl";
      // console.log(
      //   "🌐 Using language from Accept-Language header validate:",
      //   lang,
      // );

      const { couponCode, cartItems = [], totalAmount = 0 } = req.body;

      if (!couponCode) {
        res.status(400).json({ error: t(lang, "checkout.invalidCoupon") });
        return;
      }

      // Find coupon in database
      const discount = await Discount.findOne({
        code: couponCode.toUpperCase(),
      });

      if (!discount) {
        res.status(404).json({
          valid: false,
          error: t(lang, "checkout.invalidCoupon"),
        });
        return;
      }

      // Check if coupon is active
      if (!discount.isActive) {
        res.status(400).json({
          valid: false,
          error: t(lang, "checkout.couponExpired"),
        });
        return;
      }

      // Check expiration date
      const now = new Date();
      if (discount.validUntil && now > new Date(discount.validUntil)) {
        res.status(400).json({
          valid: false,
          error: t(lang, "checkout.couponExpired"),
        });
        return;
      }

      // Check usage limit
      if (discount.maxUses && discount.usedCount >= discount.maxUses) {
        res.status(400).json({
          valid: false,
          error: t(lang, "checkout.couponExpired"),
        });
        return;
      }

      // Check minimum purchase amount
      if (totalAmount < discount.minPurchaseAmount) {
        res.status(400).json({
          valid: false,
          error: t(lang, "checkout.minPurchaseAmount", {
            amount: discount.minPurchaseAmount.toFixed(2),
          }),
        });
        return;
      }

      // Check if coupon is assigned to this user
      if (
        discount.userId &&
        (!req.user?._id || !discount.userId.equals(req.user._id))
      ) {
        res.status(403).json({
          valid: false,
          error: t(lang, "checkout.couponNotAvailable"),
        });
        return;
      }

      // Calculate discount amount
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
              ? t(lang, "checkout.discountPercentage", {
                  value: discount.value,
                })
              : t(lang, "checkout.discountFixed", { value: discount.value }),
        },
      });
    } catch (error: any) {
      console.error("Error validating coupon:", error);
      // Get language from Accept-Language header for error message
      const lang = (req.headers["accept-language"] as string) || "pl";
      res.status(500).json({
        valid: false,
        error: t(lang, "checkout.couponValidationError"),
      });
    }
  },
);

// Get coupon by code (public endpoint)
router.get(
  "/code/:code",
  async (req: RequestWithLang, res: Response): Promise<void> => {
    try {
      // Get language from Accept-Language header (sent by frontend)
      const lang = (req.headers["accept-language"] as string) || "pl";

      const { code } = req.params;

      if (!code || Array.isArray(code)) {
        res.status(400).json({ error: t(lang, "checkout.invalidCoupon") });
        return;
      }

      const discount = await Discount.findOne({
        code: code.toUpperCase(),
        isActive: true,
      }).select("name code type value");

      if (!discount) {
        res.status(404).json({ error: t(lang, "checkout.invalidCoupon") });
        return;
      }

      res.json({
        name: discount.name,
        code: discount.code,
        type: discount.type,
        value: discount.value,
        description:
          discount.type === "percentage"
            ? t(lang, "checkout.discountPercentage", { value: discount.value })
            : t(lang, "checkout.discountFixed", { value: discount.value }),
      });
    } catch (error: any) {
      console.error("Error fetching discount:", error);
      // Get language from Accept-Language header for error message
      const lang = (req.headers["accept-language"] as string) || "pl";
      res
        .status(500)
        .json({ error: t(lang, "checkout.couponValidationError") });
    }
  },
);

export default router;

/////////////////////////////////////////////

// // routes/discounts-public.ts
// import express, { Request, Response } from "express";
// import Discount from "../../models/discount.js";
// import { userAuth } from "../../middleware/auth.js";

// const router = express.Router();

// //WALIDUJ KUPN BEZ UŻYTKOWNIKA
// // routes/discounts-public.ts
// router.post(
//   "/validate-public",
//   async (req: Request, res: Response): Promise<void> => {
//     try {
//       const { couponCode, totalAmount = 0 } = req.body;

//       if (!couponCode) {
//         res.status(400).json({ error: "Podaj kod kuponu" });
//         return;
//       }

//       // Znajdź kupon (TUTAJ JEST POPRAWNA NAZWA ZMIENNEJ)
//       const discount = await Discount.findOne({
//         code: couponCode.toUpperCase(),
//         isActive: true,
//       });

//       if (!discount) {
//         res.status(404).json({
//           valid: false,
//           error: "Nieprawidłowy kod kuponu",
//         });
//         return;
//       }

//       // Dla kuponów przypisanych do użytkownika zwróć ostrzeżenie
//       if (discount.userId) {
//         res.json({
//           valid: true,
//           requiresLogin: true, // <-- FLAGA!
//           discount: {
//             code: discount.code,
//             type: discount.type,
//             value: discount.value,
//           },
//           message: "Ten kupon wymaga zalogowania się na odpowiednie konto",
//         });
//         return;
//       }

//       // Sprawdź daty
//       const now = new Date();
//       if (discount.validUntil && now > new Date(discount.validUntil)) {
//         res.status(400).json({
//           valid: false,
//           error: "Kupon wygasł",
//         });
//         return;
//       }

//       // Sprawdź użycia
//       if (discount.maxUses && discount.usedCount >= discount.maxUses) {
//         res.status(400).json({
//           valid: false,
//           error: "Kupon został wyczerpany",
//         });
//         return;
//       }

//       // Sprawdź minimalną kwotę
//       if (totalAmount < discount.minPurchaseAmount) {
//         res.status(400).json({
//           valid: false,
//           error: `Minimalna kwota zamówienia: ${discount.minPurchaseAmount} PLN`,
//         });
//         return;
//       }

//       // Oblicz zniżkę
//       let discountAmount = 0;

//       if (discount.type === "percentage") {
//         discountAmount = (totalAmount * discount.value) / 100;
//         if (
//           discount.maxDiscountAmount &&
//           discountAmount > discount.maxDiscountAmount
//         ) {
//           discountAmount = discount.maxDiscountAmount;
//         }
//       } else if (discount.type === "fixed") {
//         discountAmount = Math.min(discount.value, totalAmount);
//       }

//       res.json({
//         valid: true,
//         discount: {
//           id: discount._id,
//           code: discount.code,
//           name: discount.name,
//           type: discount.type,
//           value: discount.value,
//           discountAmount: discountAmount,
//           description:
//             discount.type === "percentage"
//               ? `${discount.value}% zniżki`
//               : `${discount.value} PLN zniżki`,
//         },
//       });
//     } catch (error: any) {
//       console.error("Error validating public coupon:", error);
//       res.status(500).json({
//         valid: false,
//         error: "Błąd podczas walidacji kuponu",
//       });
//     }
//   },
// );

// // WALIDUJ KUPON UŻYTKOWNIKA (dla koszyka)
// router.post(
//   "/validate",
//   userAuth,
//   async (req: Request, res: Response): Promise<void> => {
//     try {
//       const { couponCode, cartItems = [], totalAmount = 0 } = req.body;

//       if (!couponCode) {
//         res.status(400).json({ error: "Podaj kod kuponu" });
//         return;
//       }

//       // Znajdź kupon
//       const discount = await Discount.findOne({
//         code: couponCode.toUpperCase(),
//       });

//       if (!discount) {
//         res.status(404).json({
//           valid: false,
//           error: "Nieprawidłowy kod kuponu",
//         });
//         return;
//       }

//       // Prosta walidacja
//       if (!discount.isActive) {
//         res.status(400).json({
//           valid: false,
//           error: "Kupon nieaktywny",
//         });
//         return;
//       }

//       // Sprawdź daty
//       const now = new Date();
//       if (discount.validUntil && now > new Date(discount.validUntil)) {
//         res.status(400).json({
//           valid: false,
//           error: "Kupon wygasł",
//         });
//         return;
//       }

//       // Sprawdź użycia
//       if (discount.maxUses && discount.usedCount >= discount.maxUses) {
//         res.status(400).json({
//           valid: false,
//           error: "Kupon został wyczerpany",
//         });
//         return;
//       }

//       // Sprawdź minimalną kwotę
//       if (totalAmount < discount.minPurchaseAmount) {
//         res.status(400).json({
//           valid: false,
//           error: `Minimalna kwota zamówienia: ${discount.minPurchaseAmount} PLN`,
//         });
//         return;
//       }

//       // Oblicz zniżkę
//       let discountAmount = 0;

//       if (discount.type === "percentage") {
//         discountAmount = (totalAmount * discount.value) / 100;
//         if (
//           discount.maxDiscountAmount &&
//           discountAmount > discount.maxDiscountAmount
//         ) {
//           discountAmount = discount.maxDiscountAmount;
//         }
//       } else if (discount.type === "fixed") {
//         discountAmount = Math.min(discount.value, totalAmount);
//       }

//       res.json({
//         valid: true,
//         discount: {
//           id: discount._id,
//           code: discount.code,
//           name: discount.name,
//           type: discount.type,
//           value: discount.value,
//           discountAmount: discountAmount,
//           description:
//             discount.type === "percentage"
//               ? `${discount.value}% zniżki`
//               : `${discount.value} PLN zniżki`,
//         },
//       });
//     } catch (error: any) {
//       console.error("Error validating coupon:", error);
//       res.status(500).json({
//         valid: false,
//         error: "Błąd podczas walidacji kuponu",
//       });
//     }
//   },
// );

// // Pobierz kupon po kodzie (publiczne)
// router.get(
//   "/code/:code",
//   async (req: Request, res: Response): Promise<void> => {
//     try {
//       const { code } = req.params;
//       if (!code || Array.isArray(code)) {
//         res.status(400).json({ error: "Nieprawidłowy format kodu kuponu" });
//         return;
//       }

//       const discount = await Discount.findOne({
//         code: code.toUpperCase(),
//         isActive: true,
//       }).select("name code type value");

//       if (!discount) {
//         res.status(404).json({ error: "Kupon nie znaleziony" });
//         return;
//       }

//       res.json({
//         name: discount.name,
//         code: discount.code,
//         type: discount.type,
//         value: discount.value,
//         description:
//           discount.type === "percentage"
//             ? `${discount.value}% zniżki`
//             : `${discount.value} PLN zniżki`,
//       });
//     } catch (error: any) {
//       console.error("Error fetching discount:", error);
//       res.status(500).json({ error: "Błąd podczas pobierania kuponu" });
//     }
//   },
// );

// export default router;
