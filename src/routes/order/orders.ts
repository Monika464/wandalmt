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
      const orders = await Order.find({
        "user.userId": userId,
        status: { $in: ["paid", "partially_refunded", "refunded"] },
      })
        .sort({ createdAt: -1 })
        .lean();

      // 🔹 Pobierz użytkownika wraz z jego zasobami
      const user = await User.findById(userId).populate("resources");
      if (!user) {
        res.status(404).json({ message: "Nie znaleziono użytkownika" });
        return;
      }

      const userResources = user.resources || [];

      const response = orders.map((order: any) => {
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
      const pendingOrdersCount = await Order.countDocuments({
        "user.userId": userId,
        status: "pending",
      });

      res.status(200).json({
        orders: response,
        stats: {
          total: response.length,
          pending: pendingOrdersCount,
          lastUpdated: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Błąd przy pobieraniu zamówień użytkownika:", error);
      res.status(500).json({
        message: "Błąd serwera przy pobieraniu zamówień użytkownika",
      });
    }
  }
);

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
// routes/orders.ts - POPRAWIONY endpoint dla częściowego zwrotu
// routes/orders.ts - poprawiony fragment
router.post(
  "/refund/:orderId/partial",
  userAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { orderId } = req.params;
      const { refundItems } = req.body;

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

      console.log("🔄 Current order status:", order.status);
      console.log("📦 Products before refund:");
      order.products.forEach((p: any, i: number) => {
        console.log(`  Product ${i}: ${p.title}`);
        console.log(
          `    Quantity: ${p.quantity}, Refunded: ${p.refundQuantity || 0}`
        );
      });

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
          (p: any) =>
            p.productId && p.productId.toString() === refundItem.productId
        );

        if (!product) {
          console.log(`❌ Product not found: ${refundItem.productId}`);
          continue;
        }

        // Sprawdź dostępną ilość do zwrotu
        const alreadyRefunded = (product as any).refundQuantity || 0;
        const availableToRefund = product.quantity - alreadyRefunded;

        console.log(`📊 Product: ${product.title}`);
        console.log(`   Already refunded: ${alreadyRefunded}`);
        console.log(`   Available to refund: ${availableToRefund}`);
        console.log(`   Requested refund: ${refundItem.quantity}`);

        if (availableToRefund < refundItem.quantity) {
          res.status(400).json({
            error: `Niewystarczająca ilość do zwrotu dla produktu: ${product.title}`,
            available: availableToRefund,
            requested: refundItem.quantity,
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
        (product as any).refundQuantity = alreadyRefunded + refundItem.quantity;
        (product as any).refunded =
          (product as any).refundQuantity === product.quantity;

        if ((product as any).refundQuantity === product.quantity) {
          (product as any).refundedAt = new Date();
        }

        console.log(`✅ Updated product ${product.title}:`);
        console.log(
          `   New refundQuantity: ${(product as any).refundQuantity}`
        );
      } // KONIEC PĘTLI FOR

      if (totalRefundAmount <= 0) {
        res.status(400).json({ error: "Brak kwoty do zwrotu" });
        return;
      }

      // PRZED wykonaniem refundacji, sprawdź dostępną kwotę w Stripe
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(
          order.stripePaymentIntentId,
          { expand: ["charges.data.refunds"] }
        );

        console.log("💰 Payment Intent retrieved:", {
          id: paymentIntent.id,
          amount: paymentIntent.amount,
          charges: paymentIntent.charges?.data?.length || 0,
        });

        // Oblicz już zwróconą kwotę
        let alreadyRefundedInStripe = 0;

        // Sprawdź różne możliwe lokalizacje refundacji
        if (paymentIntent.charges?.data?.[0]?.refunds?.data) {
          // Refundacje w charge
          alreadyRefundedInStripe =
            paymentIntent.charges.data[0].refunds.data.reduce(
              (sum: number, refund: any) => sum + refund.amount,
              0
            );
          console.log(
            "💸 Refunds found in charge:",
            paymentIntent.charges.data[0].refunds.data.length
          );
        } else if (paymentIntent.refunds?.data) {
          // Refundacje bezpośrednio w payment intent
          alreadyRefundedInStripe = paymentIntent.refunds.data.reduce(
            (sum: number, refund: any) => sum + refund.amount,
            0
          );
          console.log(
            "💸 Refunds found in payment intent:",
            paymentIntent.refunds.data.length
          );
        }

        // Alternatywnie: pobierz listę refundacji dla payment intent
        const refundsList = await stripe.refunds.list({
          payment_intent: order.stripePaymentIntentId,
        });

        if (refundsList.data.length > 0) {
          alreadyRefundedInStripe = refundsList.data.reduce(
            (sum: number, refund: any) => sum + refund.amount,
            0
          );
          console.log("💸 Refunds from list:", refundsList.data.length);
        }

        const chargeAmount = paymentIntent.amount;
        const availableForRefund = chargeAmount - alreadyRefundedInStripe;
        const requestedRefundAmountInCents = Math.round(
          totalRefundAmount * 100
        );

        console.log("📊 Refund calculations:", {
          chargeAmount: chargeAmount / 100,
          alreadyRefundedInStripe: alreadyRefundedInStripe / 100,
          availableForRefund: availableForRefund / 100,
          requestedRefundAmount: totalRefundAmount,
          requestedRefundAmountInCents,
        });

        // Sprawdź czy kwota jest dostępna
        if (requestedRefundAmountInCents > availableForRefund) {
          res.status(400).json({
            error: `Żądana kwota zwrotu (${totalRefundAmount.toFixed(
              2
            )} zł) jest większa niż dostępna (${(
              availableForRefund / 100
            ).toFixed(2)} zł).`,
            availableForRefund: availableForRefund / 100,
            alreadyRefunded: alreadyRefundedInStripe / 100,
            totalAmount: chargeAmount / 100,
          });
          return;
        }
      } catch (stripeError: any) {
        console.error("Stripe API error:", stripeError.message);
        // Kontynuuj mimo błędu
      }

      // Wykonaj zwrot w Stripe
      try {
        const refund = await stripe.refunds.create({
          payment_intent: order.stripePaymentIntentId,
          amount: Math.round(totalRefundAmount * 100),
          reason: "requested_by_customer",
          metadata: {
            orderId: order._id.toString(),
            refundType: "partial",
            refundItems: JSON.stringify(refundItems),
          },
        });

        console.log("✅ Stripe refund created:", refund.id);

        // Zaktualizuj zamówienie
        (order as any).partialRefunds = (order as any).partialRefunds || [];
        (order as any).partialRefunds.push({
          refundId: refund.id,
          amount: totalRefundAmount,
          createdAt: new Date(),
          reason: "Partial refund - customer request",
          products: refundDetails,
        });

        // Sprawdź czy wszystkie produkty są zwrócone
        const allProductsRefunded = order.products.every(
          (p: any) => (p.refundQuantity || 0) === p.quantity
        );

        if (allProductsRefunded) {
          order.status = "refunded";
          (order as any).refundedAt = new Date();
          (order as any).refundId = refund.id;
          (order as any).refundAmount = order.totalAmount;
        } else {
          order.status = "partially_refunded";
        }

        // ZAPISZ ZMIANY
        await order.save();

        console.log("✅ Order saved with new status:", order.status);
        console.log("📦 Products after refund:");
        order.products.forEach((p: any, i: number) => {
          console.log(`  Product ${i}: ${p.title}`);
          console.log(
            `    Quantity: ${p.quantity}, Refunded: ${p.refundQuantity || 0}`
          );
        });

        // Usuń zasoby użytkownika dla zwróconych produktów
        if (order.user.userId) {
          const refundedProductIds = refundDetails.map(
            (item) => item.productId
          );

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
      } catch (stripeRefundError: any) {
        console.error("Stripe refund creation error:", stripeRefundError);

        // Sprawdź czy to błąd z powodu niewystarczającej kwoty
        if (
          stripeRefundError.type === "StripeInvalidRequestError" &&
          stripeRefundError.message.includes("greater than unrefunded amount")
        ) {
          // Spróbuj pobrać dostępną kwotę inaczej
          const refunds = await stripe.refunds.list({
            payment_intent: order.stripePaymentIntentId,
            limit: 100,
          });

          const totalRefunded = refunds.data.reduce(
            (sum, r) => sum + r.amount,
            0
          );
          const paymentIntent = await stripe.paymentIntents.retrieve(
            order.stripePaymentIntentId
          );
          const available = paymentIntent.amount - totalRefunded;

          res.status(400).json({
            error: `Dostępna kwota do zwrotu: ${(available / 100).toFixed(
              2
            )} PLN`,
            availableForRefund: available / 100,
            totalRefunded: totalRefunded / 100,
            totalAmount: paymentIntent.amount / 100,
            requestedAmount: totalRefundAmount,
          });
        } else {
          throw stripeRefundError;
        }
      }
    } catch (err: any) {
      console.error("Partial refund error:", err);
      res.status(500).json({
        error: "Błąd podczas częściowego zwrotu",
        details: err.message,
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
      });
    }
  }
);

export default router;
