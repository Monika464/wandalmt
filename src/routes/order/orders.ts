import express, { Request, Response } from "express";
import mongoose from "mongoose";
import Stripe from "stripe";
import Order from "../../models/order.js";
import { adminAuth, userAuth } from "../../middleware/auth.js"; // zakładam, że masz AuthRequest z userem
import Resource from "../../models/resource.js";

import User from "models/user.js";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

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
 * 📦 Zwraca zamówienia zalogowanego użytkownika wraz z zasobami użytkownika
 */
router.get("/user", userAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Brak autoryzacji" });
    }

    // 🔹 Pobierz zamówienia użytkownika
    const orders = await Order.find({ "user.userId": req.user._id })
      .populate({
        path: "user",
        select: "email name",
      })
      .populate({
        path: "products.product",
      })
      .sort({ createdAt: -1 });

    // 🔹 Pobierz użytkownika wraz z jego zasobami
    const user = await User.findById(req.user._id).populate("resources");
    if (!user) {
      return res.status(404).json({ message: "Nie znaleziono użytkownika" });
    }

    // 🔹 Zasoby przypisane użytkownikowi
    const userResources = user.resources || [];

    // 🔹 Połącz dane zamówień z zasobami użytkownika
    const ordersWithUserResources = orders.map((order) => ({
      ...order.toObject(),
      userResources, // <--- zamiast zasobów z produktów
    }));

    res.status(200).json(ordersWithUserResources);
  } catch (error) {
    console.error("Błąd przy pobieraniu zamówień użytkownika:", error);
    res.status(500).json({
      message: "Błąd serwera przy pobieraniu zamówień użytkownika",
    });
  }
});

//export default router;
/**
 * GET /api/orders/user
 * 📦 Zwraca zamówienia zalogowanego użytkownika wraz z zasobami produktów
 */
// router.get("/user", userAuth, async (req: Request, res: Response) => {
//   try {
//     if (!req.user?._id) {
//       return res.status(401).json({ message: "Brak autoryzacji" });
//     }

//     // 🔹 Pobierz zamówienia tylko tego użytkownika
//     const orders = await Order.find({ "user.userId": req.user._id })
//       .populate({
//         path: "user",
//         select: "email name",
//       })
//       .populate({
//         path: "products.product",
//       })
//       .sort({ createdAt: -1 });

//     // 🔹 Dociągnij zasoby (Resource) dla każdego produktu
//     const ordersWithResources = await Promise.all(
//       orders.map(async (order) => {
//         const enrichedProducts = await Promise.all(
//           order.products.map(async (item: any) => {
//             const resources = await Resource.find({
//               productId: item.product._id,
//             });
//             return {
//               ...item.toObject(),
//               resources,
//             };
//           })
//         );

//         return {
//           ...order.toObject(),
//           products: enrichedProducts,
//         };
//       })
//     );

//     res.status(200).json(ordersWithResources);
//   } catch (error) {
//     console.error("Błąd przy pobieraniu zamówień użytkownika:", error);
//     res.status(500).json({
//       message: "Błąd serwera przy pobieraniu zamówień użytkownika",
//     });
//   }
// });

/**
 * POST /api/orders/refund/:id
 * 🔁 Zwraca zamówienie (zwrot)
 */
router.post(
  "/refund/:id",
  userAuth,

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
      // console.log({
      //   orderUserId: order.user.userId,
      //   reqUserId: req.user?._id,
      //   equal: order.user.userId.toString() === req.user._id.toString(),
      // });

      if (
        !req.user ||
        (order.user.userId.toString() !== req.user._id.toString() &&
          req.user.role !== "admin")
      ) {
        return res.status(403).json({ message: "Brak uprawnień do zwrotu" });
      }

      // Jeśli już zwrócone
      if (order.refundedAt) {
        return res
          .status(400)
          .json({ message: "To zamówienie zostało już zwrócone." });
      }

      // 🔹 Znajdź payment_intent na podstawie sessionId
      const session = await stripe.checkout.sessions.retrieve(
        order.stripeSessionId
      );

      if (!session.payment_intent) {
        return res
          .status(400)
          .json({ message: "Nie znaleziono płatności do zwrotu." });
      }

      // 🔹 Wykonaj zwrot
      const refund = await stripe.refunds.create({
        payment_intent: session.payment_intent as string,
      });

      // 🔹 Zaktualizuj dokument w MongoDB
      order.set({
        refundedAt: new Date(),
        refundId: refund.id, // opcjonalnie dodaj to do schematu
      });

      await order.save();

      // 🔹 Usuń zasoby powiązane z produktami z tego zamówienia u użytkownika
      const userId = order.user.userId;
      //const productIds = order.products.map((p: any) => p.product);
      const productIds = order.products.map((p: any) =>
        typeof p.product === "object" ? p.product._id : p.product
      );
      const resourcesToRemove = await Resource.find({
        productId: { $in: productIds },
      }).select("_id");

      // console.log("🔹 Resources found to remove:", resourcesToRemove);

      if (resourcesToRemove.length > 0) {
        //
        // const user = await mongoose
        //   .model("User")
        //   .findById(userId)
        //   .select("resources");
        // console.log("🔹 User current resources:", user?.resources);
        //
        await mongoose.model("User").updateOne(
          { _id: userId },
          {
            $pull: {
              resources: { $in: resourcesToRemove.map((r) => r._id) },
            },
          }
        );
        //console.log("🔹 User resources update result:", updateResult);
      }

      res.status(200).json({
        message:
          "Zwrot wykonany pomyślnie. Zasoby usunięte z konta użytkownika",
        refund,
        order,
      });
    } catch (error) {
      console.error("Błąd przy zwrocie zamówienia:", error);
      res.status(500).json({ message: "Błąd serwera przy zwrocie" });
    }
  }
);

export default router;
