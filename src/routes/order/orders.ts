import express, { Request, Response } from "express";
import mongoose from "mongoose";
import Stripe from "stripe";
import Order from "../../models/order.js";
import { adminAuth, userAuth } from "../../middleware/auth.js";
import Resource from "../../models/resource.js";
import User from "../../models/user.js";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// Definiuj typ dla produktu w zamówieniu
interface OrderProduct {
  productId: mongoose.Types.ObjectId;
  title: string;
  price: number;
  discountedPrice?: number;
  quantity: number;
  refundQuantity?: number;
  refunded?: boolean;
  refundedAt?: Date;
  [key: string]: any;
}

// Definiuj typ dla szczegółów zwrotu
interface RefundDetail {
  productId: mongoose.Types.ObjectId;
  title: string;
  quantity: number;
  price: number;
  amount: number;
  reason: string;
}

/**
 * GET /api/orders
 * 📦 Zwraca wszystkie zamówienia (dla admina)
 */
router.get(
  "/",
  adminAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orders = await Order.find().sort({ createdAt: -1 });
      res.status(200).json(orders);
    } catch (error) {
      console.error("Błąd przy pobieraniu wszystkich zamówień:", error);
      res
        .status(500)
        .json({ message: "Błąd serwera przy pobieraniu zamówień" });
    }
  },
);

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
                  discountedPrice: product.discountedPrice,
                  quantity: product.quantity || 1,
                  imageUrl: product.imageUrl || product.product.imageUrl,
                  content: product.content || product.product.content,
                  description:
                    product.description || product.product.description,

                  refunded: product.refunded,
                  refundedAt: product.refundedAt,
                  refundId: product.refundId,
                  refundAmount: product.refundAmount,
                  refundQuantity: product.refundQuantity,

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
  },
);

router.post(
  "/refund/:id",
  userAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (Array.isArray(id)) {
        res
          .status(400)
          .json({ message: "Nieprawidłowy format identyfikatora" });
        return;
      }

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

      // ✅ Sprawdź czy order.user istnieje
      if (!order.user) {
        res
          .status(400)
          .json({ message: "Brak danych użytkownika w zamówieniu" });
        return;
      }

      if (
        !req.user ||
        (order.user.userId?.toString() !== req.user._id.toString() &&
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

      // 🔹 Sprawdź czy totalAmount istnieje
      if (order.totalAmount === undefined || order.totalAmount === null) {
        res.status(400).json({
          message: "Brak kwoty zamówienia - nie można wykonać zwrotu",
        });
        return;
      }

      // 🔹 Znajdź payment_intent na podstawie sessionId
      if (!order.stripeSessionId) {
        res.status(400).json({ message: "Brak identyfikatora sesji Stripe" });
        return;
      }

      const session = await stripe.checkout.sessions.retrieve(
        order.stripeSessionId,
      );

      if (!session.payment_intent) {
        res
          .status(400)
          .json({ message: "Nie znaleziono płatności do zwrotu." });
        return;
      }

      // 🔍 POBIERZ RZECZYWISTĄ KWOTĘ Z STRIPE
      const paymentIntent = await stripe.paymentIntents.retrieve(
        session.payment_intent as string,
      );

      // Użyj dokładnej kwoty z Stripe (w groszach)
      const exactAmountInCents = paymentIntent.amount;
      const exactAmountInZloty = exactAmountInCents / 100;

      // Sprawdź czy już były zwroty
      const existingRefunds = await stripe.refunds.list({
        payment_intent: session.payment_intent as string,
        limit: 100,
      });

      const alreadyRefundedInCents = existingRefunds.data.reduce(
        (sum, refund) => sum + refund.amount,
        0,
      );

      const availableForRefundInCents =
        exactAmountInCents - alreadyRefundedInCents;

      // Bezpieczne użycie totalAmount z domyślną wartością 0
      const orderTotal = order.totalAmount ?? 0;
      const orderDiscount = order.totalDiscount ?? 0;

      console.log("💰 Stripe payment details:", {
        paymentIntentId: paymentIntent.id,
        amountInCents: exactAmountInCents,
        amountInZloty: exactAmountInZloty,
        alreadyRefundedInCents,
        alreadyRefundedInZloty: alreadyRefundedInCents / 100,
        availableForRefundInCents,
        availableForRefundInZloty: availableForRefundInCents / 100,
        orderTotal,
        orderTotalInCents: Math.round(orderTotal * 100),
      });

      // Użyj dostępnej kwoty z Stripe, nie z bazy danych!
      const refundAmountInCents = availableForRefundInCents;
      const refundAmountInZloty = refundAmountInCents / 100;

      const isDiscountedOrder = !!(order.couponCode || orderDiscount > 0);

      if (isDiscountedOrder) {
        console.log("ℹ️ Full refund for discounted order:", {
          couponCode: order.couponCode,
          totalDiscount: orderDiscount,
          refundAmountFromDB: orderTotal,
          refundAmountFromStripe: refundAmountInZloty,
          refundAmountInCents,
          difference: orderTotal - refundAmountInZloty,
        });
      }

      // 🔹 Wykonaj zwrot używając dokładnej kwoty z Stripe
      const refund = await stripe.refunds.create({
        payment_intent: session.payment_intent as string,
        amount: refundAmountInCents, // Użyj kwoty w groszach bez zaokrągleń!
        metadata: {
          orderId: order._id.toString(),
          couponApplied: order.couponCode || "none",
          originalTotal: (orderTotal + orderDiscount).toString(),
          discountAmount: orderDiscount.toString(),
          stripeAmount: refundAmountInCents.toString(),
        },
      });

      // 🔹 Zaktualizuj dokument w MongoDB
      order.set({
        refundedAt: new Date(),
        refundId: refund.id,
        refundAmount: refundAmountInZloty, // Zapisz rzeczywistą zwróconą kwotę
        status: "refunded",
      });

      await order.save();

      // 🔹 Usuń zasoby powiązane z produktami z tego zamówienia u użytkownika
      if (order.user?.userId) {
        const userId = order.user.userId;
        const productIds = order.products
          .map((p: any) =>
            typeof p.product === "object" ? p.product._id : p.productId,
          )
          .filter((id: any) => id != null);

        const resourcesToRemove = await Resource.find({
          productId: { $in: productIds },
        }).select("_id");

        if (resourcesToRemove.length > 0) {
          await mongoose.model("User").updateOne(
            { _id: userId },
            {
              $pull: {
                resources: { $in: resourcesToRemove.map((r) => r._id) },
              },
            },
          );
        }
      }

      const responseData: any = {
        message: isDiscountedOrder
          ? "Pełny zwrot wykonany pomyślnie (zniżka została zachowana w rozliczeniu). Zasoby usunięte z konta użytkownika"
          : "Zwrot wykonany pomyślnie. Zasoby usunięte z konta użytkownika",
        refund: {
          id: refund.id,
          amount: refundAmountInZloty,
          amountInCents: refundAmountInCents,
          currency: "pln",
        },
        order: {
          id: order._id,
          status: order.status,
          refundedAt: order.refundedAt,
        },
      };

      if (isDiscountedOrder) {
        responseData.note =
          "W zamówieniach z kuponem zwrot jest możliwy tylko w pełnej wysokości kwoty zapłaconej.";
        responseData.originalTotal = orderTotal + orderDiscount;
        responseData.discountApplied = orderDiscount;
      }

      res.status(200).json(responseData);
    } catch (error) {
      console.error("Błąd przy zwrocie zamówienia:", error);
      res.status(500).json({
        message: "Błąd serwera przy zwrocie",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

//PARTIAL

router.post(
  "/refund/:orderId/partial",
  userAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { orderId } = req.params;
      const { refundItems } = req.body;

      console.log("🛠️ Partial refund request received:", {
        orderId,
        refundItems,
        timestamp: new Date().toISOString(),
      });

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

      console.log("🔍 Order found for refund:", {
        orderId,
        status: order.status,
        totalAmount: order.totalAmount,
        products: order.products.map((p: any) => ({
          title: p.title,
          price: p.price,
          discountedPrice: p.discountedPrice,
          quantity: p.quantity,
          refundQuantity: p.refundQuantity || 0,
        })),
      });

      // ⚠️ BLOKADA - Sprawdź czy zamówienie ma kupon/zniżkę
      if (order.couponCode || (order.totalDiscount || 0) > 0) {
        console.log("🚫 Blocking partial refund - order has discount/coupon:", {
          couponCode: order.couponCode,
          totalDiscount: order.totalDiscount,
        });

        res.status(400).json({
          error:
            "Częściowy zwrot jest niemożliwy dla zamówień z kuponem lub zniżką. Skontaktuj się z obsługą klienta.",
          code: "PARTIAL_REFUND_DISCOUNT_BLOCKED",
        });
        return;
      }

      // Sprawdź czy zamówienie zostało opłacone
      if (order.status !== "paid" && order.status !== "partially_refunded") {
        res.status(400).json({ error: "Zamówienie nie nadaje się do zwrotu" });
        return;
      }

      // Sprawdź czy użytkownik ma uprawnienia
      if (!order.user) {
        res.status(400).json({ error: "Brak danych użytkownika w zamówieniu" });
        return;
      }

      if (
        req.user._id.toString() !== order.user.userId?.toString() &&
        req.user.role !== "admin"
      ) {
        res.status(403).json({ error: "Brak uprawnień" });
        return;
      }

      // 🔍 SPRAWDŹ DOSTĘPNE KWOTY W STRIPE NA POCZĄTKU
      let availableInStripe = 0;
      let totalAmountInStripe = 0;
      let alreadyRefundedInStripe = 0;

      try {
        if (!order.stripePaymentIntentId) {
          throw new Error("Brak identyfikatora płatności Stripe");
        }

        const paymentIntent = await stripe.paymentIntents.retrieve(
          order.stripePaymentIntentId,
        );
        totalAmountInStripe = paymentIntent.amount / 100;

        const refundsList = await stripe.refunds.list({
          payment_intent: order.stripePaymentIntentId,
          limit: 100,
        });

        alreadyRefundedInStripe = refundsList.data.reduce(
          (sum, refund) => sum + refund.amount / 100,
          0,
        );

        availableInStripe = totalAmountInStripe - alreadyRefundedInStripe;

        console.log("💰 Stripe refund status:", {
          totalAmountInStripe,
          alreadyRefundedInStripe,
          availableInStripe,
        });
      } catch (stripeError: any) {
        console.error("❌ Stripe API error:", stripeError.message);
        res.status(500).json({
          error: "Nie można sprawdzić statusu płatności w Stripe",
          details: stripeError.message,
        });
        return;
      }

      // Oblicz kwotę zwrotu - TYLKO DLA WYBRANYCH PRODUKTÓW
      let totalRefundAmount = 0;
      const refundDetails: RefundDetail[] = [];

      for (const refundItem of refundItems) {
        const product = order.products.find(
          (p: any) => p.productId?.toString() === refundItem.productId,
        ) as OrderProduct | undefined;

        if (!product) {
          res.status(404).json({
            error: `Produkt nie znaleziony: ${refundItem.productId}`,
          });
          return;
        }

        // Sprawdź dostępną ilość do zwrotu
        const alreadyRefunded = product.refundQuantity || 0;
        const productQuantity = product.quantity || 0;
        const availableToRefund = productQuantity - alreadyRefunded;

        console.log(`📊 Product: ${product.title}`, {
          price: product.price,
          discountedPrice: product.discountedPrice,
          totalQuantity: productQuantity,
          alreadyRefunded,
          availableToRefund,
          requestedRefund: refundItem.quantity,
        });

        if (availableToRefund < refundItem.quantity) {
          res.status(400).json({
            error: `Niewystarczająca ilość do zwrotu dla produktu: ${product.title}`,
            available: availableToRefund,
            requested: refundItem.quantity,
          });
          return;
        }

        // 🔥 POPRAWA: Bezpieczne użycie priceToUse z domyślną wartością
        const priceToUse = product.discountedPrice ?? product.price ?? 0;

        if (priceToUse === 0) {
          console.warn(`⚠️ Product ${product.title} has zero price!`);
        }

        const productRefundAmount = priceToUse * refundItem.quantity;
        const roundedAmount = Math.round(productRefundAmount * 100) / 100;

        console.log("💰 Product refund calculation:", {
          product: product.title,
          priceUsed: priceToUse,
          quantity: refundItem.quantity,
          calculatedAmount: productRefundAmount,
          roundedAmount,
        });

        totalRefundAmount += roundedAmount;

        refundDetails.push({
          productId: product.productId,
          title: product.title,
          quantity: refundItem.quantity,
          price: priceToUse,
          amount: roundedAmount,
          reason: refundItem.reason || "Zwrot na żądanie klienta",
        });
      }

      // Zaokrąglij końcową kwotę
      totalRefundAmount = Math.round(totalRefundAmount * 100) / 100;

      console.log("💰 Total refund calculation:", {
        totalRefundAmount,
        refundDetails,
        availableInStripe,
      });

      // WALIDACJA KRYTYCZNA - porównaj z dostępną kwotą w Stripe
      if (totalRefundAmount > availableInStripe) {
        console.error("❌ Refund amount exceeds available amount:", {
          requested: totalRefundAmount,
          available: availableInStripe,
          difference: totalRefundAmount - availableInStripe,
        });

        res.status(400).json({
          error: `Żądana kwota zwrotu (${totalRefundAmount.toFixed(2)} zł) jest większa niż dostępna w Stripe (${availableInStripe.toFixed(2)} zł).`,
          details: {
            requestedAmount: totalRefundAmount,
            availableInStripe,
            alreadyRefundedInStripe,
            totalAmountInStripe,
          },
        });
        return;
      }

      if (totalRefundAmount <= 0) {
        res.status(400).json({ error: "Brak kwoty do zwrotu" });
        return;
      }

      console.log("✅ Order validation passed!");

      // Wykonaj zwrot w Stripe
      try {
        const refund = await stripe.refunds.create({
          payment_intent: order.stripePaymentIntentId,
          amount: Math.round(totalRefundAmount * 100),
          reason: "requested_by_customer",
          metadata: {
            orderId: order._id.toString(),
            refundType: "partial",
            refundItems: JSON.stringify(
              refundDetails.map((item) => ({
                productId: item.productId?.toString(),
                title: item.title,
                quantity: item.quantity,
                amount: item.amount,
              })),
            ),
          },
        });

        console.log("✅ Stripe refund created:", {
          refundId: refund.id,
          amount: refund.amount / 100,
          status: refund.status,
        });

        // Zaktualizuj produkty w zamówieniu
        for (const refundDetail of refundDetails) {
          const product = order.products.find(
            (p: any) =>
              p.productId?.toString() === refundDetail.productId?.toString(),
          );

          if (product) {
            product.refundQuantity =
              (product.refundQuantity || 0) + refundDetail.quantity;
            product.refunded = product.refundQuantity === product.quantity;
            product.refundedAt = product.refunded ? new Date() : undefined;
          }
        }

        // 🔥 POPRAWA: Prawidłowe dodanie do partialRefunds
        if (!order.partialRefunds) {
          // Inicjalizacja jako pusty array (Mongoose zaakceptuje zwykły array)
          order.partialRefunds = [] as any;
        }

        // Dodaj nowy zwrot do historii
        (order.partialRefunds as any).push({
          refundId: refund.id,
          amount: totalRefundAmount,
          createdAt: new Date(),
          reason: refundDetails[0]?.reason || "Partial refund",
          products: refundDetails,
        });

        // Aktualizuj status zamówienia
        const allProductsRefunded = order.products.every(
          (p: any) => (p.refundQuantity || 0) === p.quantity,
        );

        if (allProductsRefunded) {
          order.status = "refunded";
          order.refundedAt = new Date();
          order.refundId = refund.id;
          order.refundAmount = order.totalAmount;
        } else {
          order.status = "partially_refunded";
        }

        // ZAPISZ ZMIANY
        await order.save();

        ///usuwam od tad

        // Usuń zasoby użytkownika dla zwróconych produktów
        if (order.user?.userId) {
          const refundedProductIds = refundDetails
            .map((item) => item.productId)
            .filter((id): id is mongoose.Types.ObjectId => id != null);

          if (refundedProductIds.length > 0) {
            console.log("📦 Looking for resources to remove:", {
              userId: order.user.userId,
              productIds: refundedProductIds.map((id) => id.toString()),
            });

            // 🔥 KROK 1: Znajdź Resource które mają te productId
            const resourcesToRemove = await Resource.find({
              productId: { $in: refundedProductIds },
            }).select("_id");

            const resourceIds = resourcesToRemove.map((r) => r._id);

            console.log("📦 Found resources to remove:", {
              count: resourceIds.length,
              resourceIds: resourceIds.map((id: any) => id.toString()),
            });

            if (resourceIds.length > 0) {
              // 🔥 KROK 2: Usuń referencje z User (tylko te konkretne Resource ID)
              const updateResult = await User.updateOne(
                { _id: order.user.userId },
                {
                  $pull: {
                    resources: { $in: resourceIds },
                  },
                },
              );

              console.log("📦 User resources updated:", {
                userId: order.user.userId,
                removedResourceIds: resourceIds.map((id: any) => id.toString()),
                modifiedCount: updateResult.modifiedCount,
              });

              // Jeśli modifiedCount = 0, to znaczy że nie znaleziono takich referencji
              if (updateResult.modifiedCount === 0) {
                console.log(
                  "⚠️ No resources were removed - check if resourceIds match user's resources",
                );
              }

              // 🔥 KROK 3: Opcjonalnie - usuń same Resource (jeśli chcesz)
              // await Resource.deleteMany({ _id: { $in: resourceIds } });
            }

            // Sprawdź pozostałe zasoby użytkownika
            const updatedUser = await User.findById(order.user.userId).populate(
              {
                path: "resources",
                populate: { path: "productId" },
              },
            );

            console.log("📦 User remaining resources after cleanup:", {
              count: updatedUser?.resources?.length || 0,
              resources: updatedUser?.resources?.map((r: any) => ({
                id: r._id,
                title: r.title,
                productId:
                  r.productId?._id?.toString() || r.productId?.toString(),
              })),
            });
          }
        }
        ///dotad
        res.json({
          success: true,
          message: `Częściowy zwrot ${totalRefundAmount.toFixed(2)} PLN został wykonany`,
          refund: {
            id: refund.id,
            amount: totalRefundAmount,
            status: refund.status,
          },
          order: {
            id: order._id,
            status: order.status,
            products: order.products.map((p: any) => ({
              title: p.title,
              quantity: p.quantity,
              refundQuantity: p.refundQuantity || 0,
              refunded: p.refunded,
            })),
          },
          details: {
            refundedProducts: refundDetails,
          },
        });
      } catch (stripeRefundError: any) {
        console.error("❌ Stripe refund creation error:", {
          type: stripeRefundError.type,
          message: stripeRefundError.message,
          stack: stripeRefundError.stack,
        });

        if (
          stripeRefundError.type === "StripeInvalidRequestError" &&
          stripeRefundError.message.includes("greater than unrefunded amount")
        ) {
          // Odśwież dane z Stripe
          const refunds = await stripe.refunds.list({
            payment_intent: order.stripePaymentIntentId,
            limit: 100,
          });

          const totalRefunded = refunds.data.reduce(
            (sum, r) => sum + r.amount / 100,
            0,
          );

          const paymentIntent = await stripe.paymentIntents.retrieve(
            order.stripePaymentIntentId,
          );
          const available = paymentIntent.amount / 100 - totalRefunded;

          res.status(400).json({
            error: `Dostępna kwota do zwrotu: ${available.toFixed(2)} PLN`,
            details: {
              availableForRefund: available,
              totalRefunded,
              totalAmount: paymentIntent.amount / 100,
              requestedAmount: totalRefundAmount,
            },
          });
        } else {
          res.status(500).json({
            error: "Błąd podczas tworzenia zwrotu w Stripe",
            details: stripeRefundError.message,
          });
        }
      }
    } catch (err: any) {
      console.error("❌ Partial refund error:", err);
      res.status(500).json({
        error: "Błąd podczas częściowego zwrotu",
        details: err.message,
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
      });
    }
  },
);

export default router;
