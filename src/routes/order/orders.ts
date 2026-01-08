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
router.get(
  "/user",
  userAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user?._id) {
        res.status(401).json({ message: "Brak autoryzacji" });
        return;
      }

      const userId = new mongoose.Types.ObjectId(req.user._id);

      // 🔹 Pobierz zamówienia użytkownika
      const orders = await Order.find({ "user.userId": userId })
        .sort({ createdAt: -1 })
        .lean();

      // 🔹 Pobierz użytkownika wraz z jego zasobami
      const user = await User.findById(userId).populate("resources");
      if (!user) {
        res.status(404).json({ message: "Nie znaleziono użytkownika" });
        return;
      }

      const userResources = user.resources || [];

      // 🔹 Przygotuj odpowiedź - NIE potrzebujesz dodatkowych danych produktów
      // bo już masz wszystko w order.products
      const response = orders.map((order: any) => {
        // Upewnij się że każdy produkt ma spójną strukturę
        const normalizedProducts = order.products
          ? order.products.map((product: any) => {
              // Jeśli produkt ma zagnieżdżony obiekt 'product', wypłaszcz go
              if (product.product && typeof product.product === "object") {
                return {
                  productId: product.product._id || product.productId,
                  title: product.title || product.product.title,
                  price: product.price || product.product.price,
                  quantity: product.quantity || 1,
                  imageUrl: product.imageUrl || product.product.imageUrl,
                  content: product.content || product.product.content,
                  description:
                    product.description || product.product.description,
                  // Pola do zwrotów
                  refunded: product.refunded,
                  refundedAt: product.refundedAt,
                  refundId: product.refundId,
                  refundAmount: product.refundAmount,
                  refundQuantity: product.refundQuantity,
                  // Zachowaj oryginał dla kompatybilności
                  product: product.product,
                };
              }
              // Jeśli już ma płaską strukturę, zwróć jak jest
              return product;
            })
          : [];

        return {
          ...order,
          products: normalizedProducts,
          userResources: userResources.filter((resource: any) => {
            return normalizedProducts.some((p: any) => {
              const productId = p.productId || (p.product && p.product._id);
              return (
                productId &&
                resource.productId &&
                resource.productId.toString() === productId.toString()
              );
            });
          }),
        };
      });

      res.status(200).json(response);
    } catch (error) {
      console.error("Błąd przy pobieraniu zamówień użytkownika:", error);
      res.status(500).json({
        message: "Błąd serwera przy pobieraniu zamówień użytkownika",
      });
    }
  }
);
// router.get(
//   "/user",
//   userAuth,
//   async (req: Request, res: Response): Promise<void> => {
//     try {
//       console.log("=== DEBUG /api/orders/user ===");
//       console.log("1. Authenticated user:", {
//         _id: req.user?._id,
//         email: req.user?.email,
//         role: req.user?.role,
//       });
//       if (!req.user?._id) {
//         res.status(401).json({ message: "Brak autoryzacji" });
//         return;
//       }
//       ///

//       const userId = new mongoose.Types.ObjectId(req.user._id);
//       console.log("2. User ID as ObjectId:", userId);
//       // 🔍 SPRAWDŹ ILE ZAMÓWIEŃ JEST W BAZIE DLA TEGO USERA
//       const userOrdersCount = await Order.countDocuments({
//         "user.userId": userId,
//       });
//       console.log(`3. Orders count for user ${userId}: ${userOrdersCount}`);

//       // 🔍 SPRAWDŹ WSZYSTKIE ZAMÓWIENIA
//       const allOrdersCount = await Order.countDocuments({});
//       console.log(`4. Total orders in DB: ${allOrdersCount}`);

//       // 🔍 POKAŻ PRZYKŁADOWE ZAMÓWIENIA
//       const sampleOrders = await Order.find({})
//         .limit(3)
//         .select("user.userId user.email");
//       console.log("5. Sample orders from DB:");
//       sampleOrders.forEach((order, i) => {
//         console.log(`   Order ${i + 1}:`, {
//           orderId: order._id,
//           userId: order.user?.userId,
//           userEmail: order.user?.email,
//           isCurrentUser: order.user?.userId?.toString() === userId.toString(),
//         });
//       });

//       ///
//       console.log(
//         '6. Executing query: Order.find({ "user.userId":',
//         userId,
//         "})"
//       );
//       // 🔹 Pobierz zamówienia użytkownika
//       const orders = await Order.find({ "user.userId": req.user._id })
//         .populate({
//           path: "user",
//           select: "email name",
//         })
//         .populate({
//           path: "products.product",
//         })
//         .sort({ createdAt: -1 });

//       console.log(`7. Query returned ${orders.length} orders`);
//       console.log(
//         "8. Order IDs returned:",
//         orders.map((o) => o._id)
//       );
//       // 🔹 Pobierz użytkownika wraz z jego zasobami
//       const user = await User.findById(req.user._id).populate("resources");
//       if (!user) {
//         res.status(404).json({ message: "Nie znaleziono użytkownika" });
//         return;
//       }

//       // 🔹 Zasoby przypisane użytkownikowi
//       const userResources = user.resources || [];

//       // 🔹 Połącz dane zamówień z zasobami użytkownika
//       const ordersWithUserResources = orders.map((order) => ({
//         ...order.toObject(),
//         userResources,
//       }));

//       res.status(200).json(ordersWithUserResources);
//     } catch (error) {
//       console.error("Błąd przy pobieraniu zamówień użytkownika:", error);
//       res.status(500).json({
//         message: "Błąd serwera przy pobieraniu zamówień użytkownika",
//       });
//     }
//   }
// );

/**
 * POST /api/orders/refund/:id
 * 🔁 Zwraca zamówienie (zwrot)
 */
router.post(
  "/refund/:id",
  userAuth,

  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res
          .status(400)
          .json({ message: "Nieprawidłowy identyfikator zamówienia" });
        return;
      }

      const order = await Order.findById(id);
      if (!order) {
        res.status(404).json({ message: "Zamówienie nie znalezione" });
        return;
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
        res.status(403).json({ message: "Brak uprawnień do zwrotu" });
        return;
      }

      // Jeśli już zwrócone
      if (order.refundedAt) {
        res
          .status(400)
          .json({ message: "To zamówienie zostało już zwrócone." });
        return;
      }

      // 🔹 Znajdź payment_intent na podstawie sessionId
      const session = await stripe.checkout.sessions.retrieve(
        order.stripeSessionId
      );

      if (!session.payment_intent) {
        res
          .status(400)
          .json({ message: "Nie znaleziono płatności do zwrotu." });
        return;
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

// routes/orders.ts - endpoint dla częściowego zwrotu
router.post(
  "/refund/:orderId/partial",
  userAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { orderId } = req.params;
      const { refundItems } = req.body; // Array<{productId, quantity, reason}>

      if (
        !refundItems ||
        !Array.isArray(refundItems) ||
        refundItems.length === 0
      ) {
        res.status(400).json({ error: "Brak produktów do zwrotu" });
        return;
      }

      // Znajdź zamówienie
      const order = await Order.findById(orderId);
      if (!order) {
        res.status(404).json({ error: "Zamówienie nie znalezione" });
        return;
      }

      // Sprawdź czy zamówienie zostało opłacone
      if (order.status !== "paid" && order.status !== "partially_refunded") {
        res.status(400).json({ error: "Zamówienie nie nadaje się do zwrotu" });
        return;
      }

      // Sprawdź czy użytkownik ma uprawnienia
      if (
        req.user._id.toString() !== order.user.userId.toString() &&
        req.user.role !== "admin"
      ) {
        res.status(403).json({ error: "Brak uprawnień" });
        return;
      }

      // Oblicz kwotę zwrotu
      let totalRefundAmount = 0;
      const refundDetails = [];

      for (const refundItem of refundItems) {
        const product = order.products.find(
          (p) => p.productId.toString() === refundItem.productId
        );

        if (!product) {
          continue;
        }

        // Sprawdź dostępną ilość do zwrotu
        const alreadyRefunded = product.refundQuantity || 0;
        const availableToRefund = product.quantity - alreadyRefunded;

        if (availableToRefund < refundItem.quantity) {
          res.status(400).json({
            error: `Niewystarczająca ilość do zwrotu dla produktu: ${product.title}`,
          });
          return;
        }

        const productRefundAmount = product.price * refundItem.quantity;
        totalRefundAmount += productRefundAmount;

        refundDetails.push({
          productId: product.productId,
          title: product.title,
          quantity: refundItem.quantity,
          amount: productRefundAmount,
          reason: refundItem.reason,
        });

        // Zaktualizuj produkt w zamówieniu
        product.refundQuantity =
          (product.refundQuantity || 0) + refundItem.quantity;
        product.refunded = product.refundQuantity === product.quantity;

        if (product.refundQuantity === product.quantity) {
          product.refundedAt = new Date().toISOString();
        }
      }

      if (totalRefundAmount <= 0) {
        res.status(400).json({ error: "Brak kwoty do zwrotu" });
        return;
      }

      // Wykonaj zwrot w Stripe
      const refund = await stripe.refunds.create({
        payment_intent: order.stripePaymentIntentId,
        amount: Math.round(totalRefundAmount * 100), // grosze
        reason: "requested_by_customer",
        metadata: {
          orderId: order._id.toString(),
          refundType: "partial",
          refundItems: JSON.stringify(refundItems),
        },
      });

      // Zaktualizuj zamówienie
      order.partialRefunds = order.partialRefunds || [];
      order.partialRefunds.push({
        refundId: refund.id,
        amount: totalRefundAmount,
        createdAt: new Date().toISOString(),
        reason: "Partial refund - customer request",
        products: refundDetails,
      });

      // Sprawdź czy wszystkie produkty są zwrócone
      const allProductsRefunded = order.products.every(
        (p) => p.refundQuantity === p.quantity
      );

      if (allProductsRefunded) {
        order.status = "refunded";
        order.refundedAt = new Date().toISOString();
        order.refundId = refund.id;
        order.refundAmount = order.totalAmount;
      } else {
        order.status = "partially_refunded";
      }

      await order.save();

      // Usuń zasoby użytkownika dla zwróconych produktów
      if (order.user.userId) {
        const refundedProductIds = refundDetails.map((item) => item.productId);

        await User.updateOne(
          { _id: order.user.userId },
          {
            $pull: {
              resources: {
                productId: { $in: refundedProductIds },
              },
            },
          }
        );
      }

      res.json({
        success: true,
        message: `Częściowy zwrot ${totalRefundAmount.toFixed(
          2
        )} PLN został wykonany`,
        order,
        refundId: refund.id,
      });
    } catch (err: any) {
      console.error("Partial refund error:", err);
      res.status(500).json({
        error: "Błąd podczas częściowego zwrotu",
        details: err.message,
      });
    }
  }
);

export default router;
