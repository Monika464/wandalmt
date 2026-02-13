import express from "express";
import mongoose from "mongoose";
import Stripe from "stripe";
import Order from "../../models/order.js";
import { adminAuth, userAuth } from "../../middleware/auth.js";
import Resource from "../../models/resource.js";
import User from "models/user.js";
const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
/**
 * GET /api/orders
 * 📦 Zwraca wszystkie zamówienia (dla admina)
 */
router.get("/", adminAuth, async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        res.status(200).json(orders);
    }
    catch (error) {
        console.error("Błąd przy pobieraniu wszystkich zamówień:", error);
        res.status(500).json({ message: "Błąd serwera przy pobieraniu zamówień" });
    }
});
/**
 * GET /api/orders/user
 * 📦 Zwraca zamówienia zalogowanego użytkownika wraz z zasobami użytkownika
 */
router.get("/user", userAuth, async (req, res) => {
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
        const response = orders.map((order) => {
            const normalizedProducts = order.products
                ? order.products.map((product) => {
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
                            description: product.description || product.product.description,
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
                userResources: userResources.filter((resource) => {
                    return normalizedProducts.some((p) => {
                        const productId = p.productId || (p.product && p.product._id);
                        return (productId &&
                            resource.productId &&
                            resource.productId.toString() === productId.toString());
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
    }
    catch (error) {
        console.error("Błąd przy pobieraniu zamówień użytkownika:", error);
        res.status(500).json({
            message: "Błąd serwera przy pobieraniu zamówień użytkownika",
        });
    }
});
router.post("/refund/:id", userAuth, async (req, res) => {
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
        if (!req.user ||
            (order.user.userId.toString() !== req.user._id.toString() &&
                req.user.role !== "admin")) {
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
        const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
        if (!session.payment_intent) {
            res
                .status(400)
                .json({ message: "Nie znaleziono płatności do zwrotu." });
            return;
        }
        const refundAmount = order.totalAmount;
        const isDiscountedOrder = order.couponCode || order.totalDiscount > 0;
        if (isDiscountedOrder) {
            console.log("ℹ️ Full refund for discounted order:", {
                couponCode: order.couponCode,
                totalDiscount: order.totalDiscount,
                refundAmount: refundAmount,
            });
        }
        // 🔹 Wykonaj zwrot
        const refund = await stripe.refunds.create({
            payment_intent: session.payment_intent,
            amount: Math.round(refundAmount * 100), // Użyj totalAmount (po zniżce)
            metadata: {
                orderId: order._id.toString(),
                couponApplied: order.couponCode || "none",
                originalTotal: order.totalAmount + (order.totalDiscount || 0),
                discountAmount: order.totalDiscount || 0,
            },
        });
        // 🔹 Zaktualizuj dokument w MongoDB
        order.set({
            refundedAt: new Date(),
            refundId: refund.id,
            refundAmount: refundAmount,
            status: "refunded",
        });
        await order.save();
        // 🔹 Usuń zasoby powiązane z produktami z tego zamówienia u użytkownika
        const userId = order.user.userId;
        const productIds = order.products.map((p) => typeof p.product === "object" ? p.product._id : p.product);
        const resourcesToRemove = await Resource.find({
            productId: { $in: productIds },
        }).select("_id");
        if (resourcesToRemove.length > 0) {
            await mongoose.model("User").updateOne({ _id: userId }, {
                $pull: {
                    resources: { $in: resourcesToRemove.map((r) => r._id) },
                },
            });
        }
        if (isDiscountedOrder) {
            res.status(200).json({
                message: "Pełny zwrot wykonany pomyślnie (zniżka została zachowana w rozliczeniu). Zasoby usunięte z konta użytkownika",
                note: "W zamówieniach z kuponem zwrot jest możliwy tylko w pełnej wysokości kwoty zapłaconej.",
                refund: {
                    id: refund.id,
                    amount: refundAmount,
                    originalTotal: order.totalAmount + order.totalDiscount,
                    discountApplied: order.totalDiscount,
                    currency: "pln",
                },
                order: {
                    id: order._id,
                    status: order.status,
                    refundedAt: order.refundedAt,
                },
            });
        }
        else {
            res.status(200).json({
                message: "Zwrot wykonany pomyślnie. Zasoby usunięte z konta użytkownika",
                refund: {
                    id: refund.id,
                    amount: refundAmount,
                    currency: "pln",
                },
                order: {
                    id: order._id,
                    status: order.status,
                    refundedAt: order.refundedAt,
                },
            });
        }
    }
    catch (error) {
        console.error("Błąd przy zwrocie zamówienia:", error);
        res.status(500).json({ message: "Błąd serwera przy zwrocie" });
    }
});
router.post("/refund/:orderId/partial", userAuth, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { refundItems } = req.body;
        console.log("🛠️ Partial refund request received:", {
            orderId,
            refundItems,
        });
        console.log("🔄 Partial refund started:", {
            orderId,
            refundItems,
            timestamp: new Date().toISOString(),
        });
        if (!refundItems ||
            !Array.isArray(refundItems) ||
            refundItems.length === 0) {
            res.status(400).json({ error: "Brak produktów do zwrotu" });
            return;
        }
        // Znajdź zamówienie
        const order = await Order.findById(orderId);
        console.log("🔍 Order found for refund:", orderId, order);
        if (!order) {
            res.status(404).json({ error: "Zamówienie nie znalezione" });
            return;
        }
        // ⚠️ BLOKADA - Sprawdź czy zamówienie ma kupon/zniżkę
        if (order.couponCode || order.totalDiscount > 0) {
            console.log("🚫 Blocking partial refund - order has discount/coupon:", {
                couponCode: order.couponCode,
                totalDiscount: order.totalDiscount,
            });
            res.status(400).json({
                error: "Częściowy zwrot jest niemożliwy dla zamówień z kuponem lub zniżką. Skontaktuj się z obsługą klienta.",
                code: "PARTIAL_REFUND_DISCOUNT_BLOCKED",
                details: {
                    couponCode: order.couponCode,
                    totalDiscount: order.totalDiscount,
                    message: "W przypadku użycia kuponu możliwy jest tylko pełny zwrot całego zamówienia.",
                },
            });
            return;
        }
        // Sprawdź czy zamówienie zostało opłacone
        if (order.status !== "paid" && order.status !== "partially_refunded") {
            res.status(400).json({ error: "Zamówienie nie nadaje się do zwrotu" });
            return;
        }
        // Sprawdź czy użytkownik ma uprawnienia
        if (req.user._id.toString() !== order.user.userId.toString() &&
            req.user.role !== "admin") {
            res.status(403).json({ error: "Brak uprawnień" });
            return;
        }
        // Funkcja pomocnicza do obliczania kwoty zwrotu (uproszczona - bez zniżek)
        const calculateRefundAmount = (product, quantity) => {
            console.log("🔍 calculateRefundAmount called:", {
                product: product.title,
                price: product.price,
            });
            // Używamy tylko ceny oryginalnej (bo nie ma kuponu)
            const amount = product.price * quantity;
            const rounded = Math.round(amount * 100) / 100;
            console.log("💵 Using original price:", { amount, rounded });
            return rounded;
        };
        // Oblicz kwotę zwrotu
        let totalRefundAmount = 0;
        const refundDetails = [];
        // Przetwórz żądane refundacje
        for (const refundItem of refundItems) {
            const product = order.products.find((p) => p.productId && p.productId.toString() === refundItem.productId);
            if (!product) {
                console.log(`❌ Product not found: ${refundItem.productId}`);
                res.status(404).json({
                    error: `Produkt nie znaleziony: ${refundItem.productId}`,
                });
                return;
            }
            // Sprawdź dostępną ilość do zwrotu
            const alreadyRefunded = product.refundQuantity || 0;
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
            const productRefundAmount = calculateRefundAmount(product, refundItem.quantity);
            console.log("💰 Refund amount calculation:", {
                product: product.title,
                price: product.price,
                quantity: refundItem.quantity,
                refundAmount: productRefundAmount,
            });
            totalRefundAmount += productRefundAmount;
            refundDetails.push({
                productId: product.productId,
                title: product.title,
                quantity: refundItem.quantity,
                price: product.price,
                refundPerUnit: product.price,
                amount: productRefundAmount,
                reason: refundItem.reason,
            });
        }
        if (totalRefundAmount <= 0) {
            res.status(400).json({ error: "Brak kwoty do zwrotu" });
            return;
        }
        console.log("✅ Order validation passed!");
        // Sprawdź dostępną kwotę w Stripe
        try {
            const paymentIntent = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
            const refundsList = await stripe.refunds.list({
                payment_intent: order.stripePaymentIntentId,
            });
            let alreadyRefundedInStripe = 0;
            if (refundsList.data.length > 0) {
                alreadyRefundedInStripe = refundsList.data.reduce((sum, refund) => sum + refund.amount, 0);
            }
            const chargeAmount = paymentIntent.amount;
            const availableInStripe = chargeAmount - alreadyRefundedInStripe;
            const requestedRefundAmountInCents = Math.round(totalRefundAmount * 100);
            if (requestedRefundAmountInCents > availableInStripe) {
                res.status(400).json({
                    error: `Żądana kwota zwrotu (${totalRefundAmount.toFixed(2)} zł) jest większa niż dostępna w Stripe (${(availableInStripe / 100).toFixed(2)} zł).`,
                    availableInStripe: availableInStripe / 100,
                    alreadyRefundedInStripe: alreadyRefundedInStripe / 100,
                    totalAmount: chargeAmount / 100,
                });
                return;
            }
        }
        catch (stripeError) {
            console.error("Stripe API error:", stripeError.message);
            // W przypadku błędu Stripe kontynuujemy - i tak przed refundacją sprawdzimy
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
            // Znajdź świeżą wersję zamówienia
            const freshOrder = await Order.findById(orderId);
            if (!freshOrder) {
                throw new Error("Order not found after stripe refund");
            }
            // Zaktualizuj produkty w zamówieniu
            for (const refundDetail of refundDetails) {
                const product = freshOrder.products.find((p) => p.productId.toString() === refundDetail.productId.toString());
                if (product) {
                    const currentRefundQuantity = product.refundQuantity || 0;
                    product.refundQuantity =
                        currentRefundQuantity + refundDetail.quantity;
                    product.refunded = product.refundQuantity === product.quantity;
                    if (product.refunded) {
                        product.refundedAt = new Date();
                    }
                }
            }
            // Zaktualizuj zamówienie
            freshOrder.partialRefunds = freshOrder.partialRefunds || [];
            freshOrder.partialRefunds.push({
                refundId: refund.id,
                amount: totalRefundAmount,
                createdAt: new Date(),
                reason: "Partial refund - customer request",
                products: refundDetails,
            });
            // Sprawdź czy wszystkie produkty są zwrócone
            const allProductsRefunded = freshOrder.products.every((p) => (p.refundQuantity || 0) === p.quantity);
            if (allProductsRefunded) {
                freshOrder.status = "refunded";
                freshOrder.refundedAt = new Date();
                freshOrder.refundId = refund.id;
                freshOrder.refundAmount = freshOrder.totalAmount;
            }
            else {
                freshOrder.status = "partially_refunded";
            }
            // ZAPISZ ZMIANY
            await freshOrder.save();
            // Usuń zasoby użytkownika dla zwróconych produktów
            if (order.user.userId) {
                const refundedProductIds = refundDetails.map((item) => item.productId);
                await User.updateOne({ _id: order.user.userId }, {
                    $pull: {
                        resources: {
                            productId: { $in: refundedProductIds },
                        },
                    },
                });
            }
            res.json({
                success: true,
                message: `Częściowy zwrot ${totalRefundAmount.toFixed(2)} PLN został wykonany`,
                order: freshOrder,
                refundId: refund.id,
                details: {
                    refundedProducts: refundDetails.map((item) => ({
                        product: item.title,
                        price: item.price,
                        quantity: item.quantity,
                        total: item.amount,
                    })),
                },
            });
        }
        catch (stripeRefundError) {
            console.error("Stripe refund creation error:", stripeRefundError);
            if (stripeRefundError.type === "StripeInvalidRequestError" &&
                stripeRefundError.message.includes("greater than unrefunded amount")) {
                const refunds = await stripe.refunds.list({
                    payment_intent: order.stripePaymentIntentId,
                    limit: 100,
                });
                const totalRefunded = refunds.data.reduce((sum, r) => sum + r.amount, 0);
                const paymentIntent = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
                const available = paymentIntent.amount - totalRefunded;
                res.status(400).json({
                    error: `Dostępna kwota do zwrotu: ${(available / 100).toFixed(2)} PLN`,
                    availableForRefund: available / 100,
                    totalRefunded: totalRefunded / 100,
                    totalAmount: paymentIntent.amount / 100,
                    requestedAmount: totalRefundAmount,
                });
            }
            else {
                throw stripeRefundError;
            }
        }
    }
    catch (err) {
        console.error("Partial refund error:", err);
        res.status(500).json({
            error: "Błąd podczas częściowego zwrotu",
            details: err.message,
            stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
        });
    }
});
export default router;
// router.post(
//   "/refund/:orderId/partial",
//   userAuth,
//   async (req: Request, res: Response): Promise<void> => {
//     try {
//       const { orderId } = req.params;
//       const { refundItems } = req.body;
//       console.log("🛠️ Partial refund request received:", {
//         orderId,
//         refundItems,
//       });
//       console.log("🔄 Partial refund started:", {
//         orderId,
//         refundItems,
//         timestamp: new Date().toISOString(),
//       });
//       if (
//         !refundItems ||
//         !Array.isArray(refundItems) ||
//         refundItems.length === 0
//       ) {
//         res.status(400).json({ error: "Brak produktów do zwrotu" });
//         return;
//       }
//       // Znajdź zamówienie
//       const order = await Order.findById(orderId);
//       console.log("🔍 Order found for refund:", orderId, order);
//       if (!order) {
//         res.status(404).json({ error: "Zamówienie nie znalezione" });
//         return;
//       }
//       // Sprawdź czy zamówienie zostało opłacone
//       if (order.status !== "paid" && order.status !== "partially_refunded") {
//         res.status(400).json({ error: "Zamówienie nie nadaje się do zwrotu" });
//         return;
//       }
//       // Sprawdź czy użytkownik ma uprawnienia
//       if (
//         req.user._id.toString() !== order.user.userId.toString() &&
//         req.user.role !== "admin"
//       ) {
//         res.status(403).json({ error: "Brak uprawnień" });
//         return;
//       }
//       // Funkcja pomocnicza do obliczania kwoty zwrotu
//       const calculateRefundAmount = (
//         order: any,
//         product: any,
//         quantity: number,
//       ): number => {
//         console.log("🔍 calculateRefundAmount called:", {
//           product: product.title,
//           discountedPrice: product.discountedPrice,
//           price: product.price,
//         });
//         // 1. Jeśli mamy zapisane discountedPrice, użyj go
//         if (
//           typeof product.discountedPrice === "number" &&
//           product.discountedPrice > 0
//         ) {
//           const amount = product.discountedPrice * quantity;
//           const rounded = Math.round(amount * 100) / 100;
//           console.log("✅ Using discountedPrice (number):", {
//             discountedPrice: product.discountedPrice,
//             amount,
//             rounded,
//           });
//           return rounded;
//         }
//         // 2. Jeśli nie ma discountedPrice, ale jest zniżka w zamówieniu
//         if (order.totalDiscount && order.totalDiscount > 0) {
//           // Oblicz całkowitą oryginalną wartość zamówienia
//           const totalOriginal = order.products.reduce(
//             (sum: number, p: any) => sum + (p.price || 0) * (p.quantity || 1),
//             0,
//           );
//           if (totalOriginal === 0) {
//             return product.price * quantity;
//           }
//           // Udział tego produktu w oryginalnej wartości
//           const productOriginalValue = product.price * product.quantity;
//           const productShare = productOriginalValue / totalOriginal;
//           // Zniżka dla tego produktu
//           const productDiscount = order.totalDiscount * productShare;
//           // Cena po zniżce dla całego produktu
//           const productDiscountedValue = productOriginalValue - productDiscount;
//           // Cena jednostkowa po zniżce
//           const unitDiscountedPrice = productDiscountedValue / product.quantity;
//           const amount = unitDiscountedPrice * quantity;
//           const rounded = Math.round(amount * 100) / 100;
//           console.log("📈 Calculated discounted price:", {
//             productOriginalValue,
//             productShare,
//             productDiscount,
//             productDiscountedValue,
//             unitDiscountedPrice,
//             amount,
//             rounded,
//           });
//           return rounded;
//         }
//         // 3. Bez zniżki
//         const amount = (product.price || 0) * quantity;
//         const rounded = Math.round(amount * 100) / 100;
//         console.log("💵 Using original price:", { amount, rounded });
//         return rounded;
//       };
//       // Funkcja walidacji kwoty refundacji
//       const validateRefundAmount = (
//         order: any,
//         requestedRefund: number,
//       ): { valid: boolean; error?: string; available?: number } => {
//         // Oblicz już zwróconą kwotę (z użyciem corrected prices)
//         const alreadyRefunded = order.products.reduce(
//           (total: number, p: any) => {
//             const refundQty = p.refundQuantity || 0;
//             if (refundQty === 0) return total;
//             // Użyj tej samej logiki co dla nowych refundacji
//             let unitPrice;
//             if (
//               typeof p.discountedPrice === "number" &&
//               p.discountedPrice > 0
//             ) {
//               unitPrice = p.discountedPrice;
//             } else if (order.totalDiscount && order.totalDiscount > 0) {
//               // Oblicz proporcjonalny discounted price dla już zwróconych produktów
//               const totalOriginal = order.products.reduce(
//                 (sum: number, prod: any) =>
//                   sum + (prod.price || 0) * (prod.quantity || 1),
//                 0,
//               );
//               if (totalOriginal > 0) {
//                 const productOriginalValue = p.price * p.quantity;
//                 const productShare = productOriginalValue / totalOriginal;
//                 const productDiscount = order.totalDiscount * productShare;
//                 const productDiscountedValue =
//                   productOriginalValue - productDiscount;
//                 unitPrice = productDiscountedValue / p.quantity;
//               } else {
//                 unitPrice = p.price;
//               }
//             } else {
//               unitPrice = p.price;
//             }
//             return total + unitPrice * refundQty;
//           },
//           0,
//         );
//         // Zaokrąglij do 2 miejsc po przecinku
//         const totalPaid = Math.round(order.totalAmount * 100) / 100;
//         const alreadyRefundedRounded = Math.round(alreadyRefunded * 100) / 100;
//         const available = totalPaid - alreadyRefundedRounded;
//         // Dodaj tolerancję 0.01 zł dla błędów zaokrągleń
//         const tolerance = 0.01;
//         if (requestedRefund > available + tolerance) {
//           return {
//             valid: false,
//             error: `Kwota zwrotu przekracza dostępną kwotę. Dostępne: ${available.toFixed(2)} zł, Żądane: ${requestedRefund.toFixed(2)} zł`,
//             available,
//           };
//         }
//         return { valid: true, available };
//       };
//       // Oblicz kwotę zwrotu
//       let totalRefundAmount = 0;
//       const refundDetails = [];
//       const alreadyRefundedMap = new Map(); // Mapa dla już zwróconych ilości produktów
//       // Przeskanuj produkty i zbierz informacje o już zwróconych ilościach
//       for (const product of order.products) {
//         const productId = product.productId.toString();
//         const alreadyRefunded = (product as any).refundQuantity || 0;
//         alreadyRefundedMap.set(productId, alreadyRefunded);
//       }
//       // Przetwórz żądane refundacje
//       for (const refundItem of refundItems) {
//         const product = order.products.find(
//           (p: any) =>
//             p.productId && p.productId.toString() === refundItem.productId,
//         );
//         if (!product) {
//           console.log(`❌ Product not found: ${refundItem.productId}`);
//           res.status(404).json({
//             error: `Produkt nie znaleziony: ${refundItem.productId}`,
//           });
//           return;
//         }
//         // Sprawdź dostępną ilość do zwrotu
//         const alreadyRefunded =
//           alreadyRefundedMap.get(refundItem.productId) || 0;
//         const availableToRefund = product.quantity - alreadyRefunded;
//         console.log(`📊 Product: ${product.title}`);
//         console.log(`   Already refunded: ${alreadyRefunded}`);
//         console.log(`   Available to refund: ${availableToRefund}`);
//         console.log(`   Requested refund: ${refundItem.quantity}`);
//         if (availableToRefund < refundItem.quantity) {
//           res.status(400).json({
//             error: `Niewystarczająca ilość do zwrotu dla produktu: ${product.title}`,
//             available: availableToRefund,
//             requested: refundItem.quantity,
//           });
//           return;
//         }
//         const productRefundAmount = calculateRefundAmount(
//           order,
//           product,
//           refundItem.quantity,
//         );
//         console.log("💰 Refund amount calculation:", {
//           product: product.title,
//           originalPrice: product.price,
//           discountedPrice: product.discountedPrice,
//           orderTotalDiscount: order.totalDiscount || 0,
//           quantity: refundItem.quantity,
//           refundAmount: productRefundAmount,
//         });
//         totalRefundAmount += productRefundAmount;
//         refundDetails.push({
//           productId: product.productId,
//           title: product.title,
//           quantity: refundItem.quantity,
//           originalPrice: product.price,
//           discountedPrice: (product as any).discountedPrice || product.price,
//           refundPerUnit:
//             refundItem.quantity > 0
//               ? productRefundAmount / refundItem.quantity
//               : product.discountedPrice || product.price,
//           amount: productRefundAmount,
//           reason: refundItem.reason,
//         });
//         // Zaktualizuj mapę z już zwróconymi ilościami
//         alreadyRefundedMap.set(
//           refundItem.productId,
//           alreadyRefunded + refundItem.quantity,
//         );
//       }
//       // Walidacja kwoty refundacji
//       const { valid, error, available } = validateRefundAmount(
//         order,
//         totalRefundAmount,
//       );
//       if (!valid) {
//         console.error("❌ Refund validation failed:", error);
//         res.status(400).json({
//           error,
//           available,
//           requested: totalRefundAmount,
//         });
//         return;
//       }
//       if (totalRefundAmount <= 0) {
//         res.status(400).json({ error: "Brak kwoty do zwrotu" });
//         return;
//       }
//       console.log("✅ Order validation passed!");
//       // Sprawdź dostępną kwotę w Stripe
//       try {
//         const paymentIntent = await stripe.paymentIntents.retrieve(
//           order.stripePaymentIntentId,
//         );
//         const refundsList = await stripe.refunds.list({
//           payment_intent: order.stripePaymentIntentId,
//         });
//         let alreadyRefundedInStripe = 0;
//         if (refundsList.data.length > 0) {
//           alreadyRefundedInStripe = refundsList.data.reduce(
//             (sum: number, refund: any) => sum + refund.amount,
//             0,
//           );
//         }
//         const chargeAmount = paymentIntent.amount;
//         const availableInStripe = chargeAmount - alreadyRefundedInStripe;
//         const requestedRefundAmountInCents = Math.round(
//           totalRefundAmount * 100,
//         );
//         if (requestedRefundAmountInCents > availableInStripe) {
//           res.status(400).json({
//             error: `Żądana kwota zwrotu (${totalRefundAmount.toFixed(
//               2,
//             )} zł) jest większa niż dostępna w Stripe (${(
//               availableInStripe / 100
//             ).toFixed(2)} zł).`,
//             availableInStripe: availableInStripe / 100,
//             alreadyRefundedInStripe: alreadyRefundedInStripe / 100,
//             totalAmount: chargeAmount / 100,
//           });
//           return;
//         }
//       } catch (stripeError: any) {
//         console.error("Stripe API error:", stripeError.message);
//       }
//       // Wykonaj zwrot w Stripe
//       try {
//         const refund = await stripe.refunds.create({
//           payment_intent: order.stripePaymentIntentId,
//           amount: Math.round(totalRefundAmount * 100),
//           reason: "requested_by_customer",
//           metadata: {
//             orderId: order._id.toString(),
//             refundType: "partial",
//             refundItems: JSON.stringify(refundItems),
//             totalDiscount: order.totalDiscount || 0,
//             appliedCoupon: order.couponCode || "none",
//           },
//         });
//         console.log("✅ Stripe refund created:", refund.id);
//         // Znajdź świeżą wersję zamówienia
//         const freshOrder = await Order.findById(orderId);
//         if (!freshOrder) {
//           throw new Error("Order not found after stripe refund");
//         }
//         // Zaktualizuj produkty w zamówieniu
//         for (const refundDetail of refundDetails) {
//           const product = freshOrder.products.find(
//             (p: any) =>
//               p.productId.toString() === refundDetail.productId.toString(),
//           );
//           if (product) {
//             const currentRefundQuantity = (product as any).refundQuantity || 0;
//             (product as any).refundQuantity =
//               currentRefundQuantity + refundDetail.quantity;
//             (product as any).refunded =
//               (product as any).refundQuantity === product.quantity;
//             if ((product as any).refunded) {
//               (product as any).refundedAt = new Date();
//             }
//           }
//         }
//         // Zaktualizuj zamówienie
//         (freshOrder as any).partialRefunds =
//           (freshOrder as any).partialRefunds || [];
//         (freshOrder as any).partialRefunds.push({
//           refundId: refund.id,
//           amount: totalRefundAmount,
//           createdAt: new Date(),
//           reason: "Partial refund - customer request",
//           products: refundDetails,
//           metadata: {
//             usedDiscountedPrice: true,
//             originalTotal:
//               freshOrder.totalAmount + (freshOrder.totalDiscount || 0),
//             discountApplied: freshOrder.totalDiscount || 0,
//           },
//         });
//         // Sprawdź czy wszystkie produkty są zwrócone
//         const allProductsRefunded = freshOrder.products.every(
//           (p: any) => (p.refundQuantity || 0) === p.quantity,
//         );
//         if (allProductsRefunded) {
//           freshOrder.status = "refunded";
//           (freshOrder as any).refundedAt = new Date();
//           (freshOrder as any).refundId = refund.id;
//           (freshOrder as any).refundAmount = freshOrder.totalAmount;
//         } else {
//           freshOrder.status = "partially_refunded";
//         }
//         // ZAPISZ ZMIANY
//         await freshOrder.save();
//         // Usuń zasoby użytkownika dla zwróconych produktów
//         if (order.user.userId) {
//           const refundedProductIds = refundDetails.map(
//             (item) => item.productId,
//           );
//           await User.updateOne(
//             { _id: order.user.userId },
//             {
//               $pull: {
//                 resources: {
//                   productId: { $in: refundedProductIds },
//                 },
//               },
//             },
//           );
//         }
//         res.json({
//           success: true,
//           message: `Częściowy zwrot ${totalRefundAmount.toFixed(
//             2,
//           )} PLN został wykonany`,
//           order: freshOrder,
//           refundId: refund.id,
//           details: {
//             usedDiscountedPrices: refundDetails.map((item) => ({
//               product: item.title,
//               originalPrice: item.originalPrice,
//               refundPrice: item.refundPerUnit,
//               quantity: item.quantity,
//               total: item.amount,
//             })),
//             totalDiscount: order.totalDiscount || 0,
//           },
//         });
//       } catch (stripeRefundError: any) {
//         console.error("Stripe refund creation error:", stripeRefundError);
//         if (
//           stripeRefundError.type === "StripeInvalidRequestError" &&
//           stripeRefundError.message.includes("greater than unrefunded amount")
//         ) {
//           const refunds = await stripe.refunds.list({
//             payment_intent: order.stripePaymentIntentId,
//             limit: 100,
//           });
//           const totalRefunded = refunds.data.reduce(
//             (sum, r) => sum + r.amount,
//             0,
//           );
//           const paymentIntent = await stripe.paymentIntents.retrieve(
//             order.stripePaymentIntentId,
//           );
//           const available = paymentIntent.amount - totalRefunded;
//           res.status(400).json({
//             error: `Dostępna kwota do zwrotu: ${(available / 100).toFixed(
//               2,
//             )} PLN`,
//             availableForRefund: available / 100,
//             totalRefunded: totalRefunded / 100,
//             totalAmount: paymentIntent.amount / 100,
//             requestedAmount: totalRefundAmount,
//           });
//         } else {
//           throw stripeRefundError;
//         }
//       }
//     } catch (err: any) {
//       console.error("Partial refund error:", err);
//       res.status(500).json({
//         error: "Błąd podczas częściowego zwrotu",
//         details: err.message,
//         stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
//       });
//     }
//   },
//);
// import express, { Request, Response } from "express";
// import mongoose from "mongoose";
// import Stripe from "stripe";
// import Order from "../../models/order.js";
// import { adminAuth, userAuth } from "../../middleware/auth.js"; // zakładam, że masz AuthRequest z userem
// import Resource from "../../models/resource.js";
// import User from "models/user.js";
// const router = express.Router();
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
// /**
//  * GET /api/orders
//  * 📦 Zwraca wszystkie zamówienia (dla admina)
//  */
// router.get("/", adminAuth, async (req: Request, res: Response) => {
//   try {
//     const orders = await Order.find().sort({ createdAt: -1 });
//     res.status(200).json(orders);
//   } catch (error) {
//     console.error("Błąd przy pobieraniu wszystkich zamówień:", error);
//     res.status(500).json({ message: "Błąd serwera przy pobieraniu zamówień" });
//   }
// });
// /**
//  * GET /api/orders/user
//  * 📦 Zwraca zamówienia zalogowanego użytkownika wraz z zasobami użytkownika
//  */
// router.get(
//   "/user",
//   userAuth,
//   async (req: Request, res: Response): Promise<void> => {
//     try {
//       if (!req.user?._id) {
//         res.status(401).json({ message: "Brak autoryzacji" });
//         return;
//       }
//       const userId = new mongoose.Types.ObjectId(req.user._id);
//       // 🔹 Pobierz zamówienia użytkownika
//       const orders = await Order.find({
//         "user.userId": userId,
//         status: { $in: ["paid", "partially_refunded", "refunded"] },
//       })
//         .sort({ createdAt: -1 })
//         .lean();
//       // 🔹 Pobierz użytkownika wraz z jego zasobami
//       const user = await User.findById(userId).populate("resources");
//       if (!user) {
//         res.status(404).json({ message: "Nie znaleziono użytkownika" });
//         return;
//       }
//       const userResources = user.resources || [];
//       const response = orders.map((order: any) => {
//         const normalizedProducts = order.products
//           ? order.products.map((product: any) => {
//               // Jeśli produkt ma zagnieżdżony obiekt 'product', wypłaszcz go
//               if (product.product && typeof product.product === "object") {
//                 return {
//                   productId: product.product._id || product.productId,
//                   title: product.title || product.product.title,
//                   price: product.price || product.product.price,
//                   discountedPrice: product.discountedPrice,
//                   quantity: product.quantity || 1,
//                   imageUrl: product.imageUrl || product.product.imageUrl,
//                   content: product.content || product.product.content,
//                   description:
//                     product.description || product.product.description,
//                   refunded: product.refunded,
//                   refundedAt: product.refundedAt,
//                   refundId: product.refundId,
//                   refundAmount: product.refundAmount,
//                   refundQuantity: product.refundQuantity,
//                   product: product.product,
//                 };
//               }
//               // Jeśli już ma płaską strukturę, zwróć jak jest
//               return product;
//             })
//           : [];
//         return {
//           ...order,
//           products: normalizedProducts,
//           userResources: userResources.filter((resource: any) => {
//             return normalizedProducts.some((p: any) => {
//               const productId = p.productId || (p.product && p.product._id);
//               return (
//                 productId &&
//                 resource.productId &&
//                 resource.productId.toString() === productId.toString()
//               );
//             });
//           }),
//         };
//       });
//       const pendingOrdersCount = await Order.countDocuments({
//         "user.userId": userId,
//         status: "pending",
//       });
//       res.status(200).json({
//         orders: response,
//         stats: {
//           total: response.length,
//           pending: pendingOrdersCount,
//           lastUpdated: new Date().toISOString(),
//         },
//       });
//     } catch (error) {
//       console.error("Błąd przy pobieraniu zamówień użytkownika:", error);
//       res.status(500).json({
//         message: "Błąd serwera przy pobieraniu zamówień użytkownika",
//       });
//     }
//   },
// );
// router.post(
//   "/refund/:id",
//   userAuth,
//   async (req: Request, res: Response): Promise<void> => {
//     try {
//       const { id } = req.params;
//       if (!mongoose.Types.ObjectId.isValid(id)) {
//         res
//           .status(400)
//           .json({ message: "Nieprawidłowy identyfikator zamówienia" });
//         return;
//       }
//       const order = await Order.findById(id);
//       if (!order) {
//         res.status(404).json({ message: "Zamówienie nie znalezione" });
//         return;
//       }
//       if (
//         !req.user ||
//         (order.user.userId.toString() !== req.user._id.toString() &&
//           req.user.role !== "admin")
//       ) {
//         res.status(403).json({ message: "Brak uprawnień do zwrotu" });
//         return;
//       }
//       // Jeśli już zwrócone
//       if (order.refundedAt) {
//         res
//           .status(400)
//           .json({ message: "To zamówienie zostało już zwrócone." });
//         return;
//       }
//       // 🔹 Znajdź payment_intent na podstawie sessionId
//       const session = await stripe.checkout.sessions.retrieve(
//         order.stripeSessionId,
//       );
//       if (!session.payment_intent) {
//         res
//           .status(400)
//           .json({ message: "Nie znaleziono płatności do zwrotu." });
//         return;
//       }
//       const refundAmount = order.totalAmount;
//       // 🔹 Wykonaj zwrot
//       const refund = await stripe.refunds.create({
//         payment_intent: session.payment_intent as string,
//         amount: Math.round(refundAmount * 100), // Użyj totalAmount (po zniżce)
//         metadata: {
//           orderId: order._id.toString(),
//           couponApplied: order.couponCode || "none",
//           originalTotal: order.totalAmount + (order.totalDiscount || 0),
//           discountAmount: order.totalDiscount || 0,
//         },
//       });
//       // 🔹 Zaktualizuj dokument w MongoDB
//       order.set({
//         refundedAt: new Date(),
//         refundId: refund.id,
//         refundAmount: refundAmount,
//         status: "refunded",
//       });
//       await order.save();
//       // 🔹 Usuń zasoby powiązane z produktami z tego zamówienia u użytkownika
//       const userId = order.user.userId;
//       //const productIds = order.products.map((p: any) => p.product);
//       const productIds = order.products.map((p: any) =>
//         typeof p.product === "object" ? p.product._id : p.product,
//       );
//       const resourcesToRemove = await Resource.find({
//         productId: { $in: productIds },
//       }).select("_id");
//       // console.log("🔹 Resources found to remove:", resourcesToRemove);
//       if (resourcesToRemove.length > 0) {
//         await mongoose.model("User").updateOne(
//           { _id: userId },
//           {
//             $pull: {
//               resources: { $in: resourcesToRemove.map((r) => r._id) },
//             },
//           },
//         );
//         //console.log("🔹 User resources update result:", updateResult);
//       }
//       res.status(200).json({
//         message:
//           "Zwrot wykonany pomyślnie. Zasoby usunięte z konta użytkownika",
//         refund: {
//           id: refund.id,
//           amount: refundAmount,
//           currency: "pln",
//         },
//         order: {
//           id: order._id,
//           status: order.status,
//           refundedAt: order.refundedAt,
//         },
//       });
//     } catch (error) {
//       console.error("Błąd przy zwrocie zamówienia:", error);
//       res.status(500).json({ message: "Błąd serwera przy zwrocie" });
//     }
//   },
// );
// // routes/orders.ts - endpoint dla częściowego zwrotu
// // routes/orders.ts - POPRAWIONY endpoint dla częściowego zwrotu
// // routes/orders.ts - poprawiony fragment
// router.post(
//   "/refund/:orderId/partial",
//   userAuth,
//   async (req: Request, res: Response): Promise<void> => {
//     try {
//       const { orderId } = req.params;
//       const { refundItems } = req.body;
//       console.log("🛠️ Partial refund request received:", {
//         orderId,
//         refundItems,
//       });
//       console.log("🔄 Partial refund started:", {
//         orderId,
//         refundItems,
//         timestamp: new Date().toISOString(),
//       });
//       if (
//         !refundItems ||
//         !Array.isArray(refundItems) ||
//         refundItems.length === 0
//       ) {
//         res.status(400).json({ error: "Brak produktów do zwrotu" });
//         return;
//       }
//       // Znajdź zamówienie
//       const order = await Order.findById(orderId);
//       console.log("🔍 Order found for refund:", orderId, order);
//       if (!order) {
//         res.status(404).json({ error: "Zamówienie nie znalezione" });
//         return;
//       }
//       //console.log("🔄 Current order status:", order.status);
//       //console.log("📦 Products before refund:");
//       // order.products.forEach((p: any, i: number) => {
//       //   console.log(`  Product ${i}: ${p.title}`);
//       //   console.log(
//       //     `    Quantity: ${p.quantity}, Refunded: ${p.refundQuantity || 0}`
//       //   );
//       // });
//       // Sprawdź czy zamówienie zostało opłacone
//       if (order.status !== "paid" && order.status !== "partially_refunded") {
//         res.status(400).json({ error: "Zamówienie nie nadaje się do zwrotu" });
//         return;
//       }
//       // Sprawdź czy użytkownik ma uprawnienia
//       if (
//         req.user._id.toString() !== order.user.userId.toString() &&
//         req.user.role !== "admin"
//       ) {
//         res.status(403).json({ error: "Brak uprawnień" });
//         return;
//       }
//       // Oblicz kwotę zwrotu
//       let totalRefundAmount = 0;
//       const refundDetails = [];
//       // Dodaj funkcję pomocniczą PRZED pętlą for:
//       const calculateRefundAmount = (
//         order: any,
//         product: any,
//         quantity: number,
//       ): number => {
//         console.log("🔍 calculateRefundAmount called:", {
//           product: product.title,
//           discountedPrice: product.discountedPrice,
//             price: product.price,
//         });
//         // 1. Jeśli mamy zapisane discountedPrice, użyj go
//         if (typeof product.discountedPrice === "number" && product.discountedPrice > 0) {
//           const amount = product.discountedPrice * quantity;
//           const rounded = Math.round(amount * 100) / 100;
//           discountedPrice: product.discountedPrice,
//           console.log("✅ Using discountedPrice (number):", {
//             amount,
//             rounded,
//           });
//           return rounded;
//         }
//         // 2. Jeśli nie ma discountedPrice, ale jest zniżka w zamówieniu
//         if (order.totalDiscount && order.totalDiscount > 0) {
//           // Oblicz całkowitą oryginalną wartość zamówienia
//           const totalOriginal = order.products.reduce(
//             (sum: number, p: any) => sum + (p.price || 0) * (p.quantity || 1),
//             0,
//           );
//           console.log("Total original:", totalOriginal);
//           if (totalOriginal === 0) {
//                  return product.price * quantity;
//           }
//          // Udział tego produktu w oryginalnej wartości
//     const productOriginalValue = product.price * product.quantity;
//     const productShare = productOriginalValue / totalOriginal;
//     // Zniżka dla tego produktu
//     const productDiscount = order.totalDiscount * productShare;
//     // Cena po zniżce dla całego produktu
//     const productDiscountedValue = productOriginalValue - productDiscount;
//     // Cena jednostkowa po zniżce
//     const unitDiscountedPrice = productDiscountedValue / product.quantity;
//     const amount = unitDiscountedPrice * quantity;
//     const rounded = Math.round(amount * 100) / 100;
//     console.log("📈 Calculated discounted price:", {
//       productOriginalValue,
//       productShare,
//       productDiscount,
//       productDiscountedValue,
//       unitDiscountedPrice,
//       amount,
//       rounded,
//     });
//     return rounded;
//         }
//         // 3. Bez zniżki
//         const amount = (product.price || 0) * quantity;
//         const rounded = Math.round(amount * 100) / 100;
//         console.log("💵 Using original price:", { amount, rounded });
//         return rounded;
//       };
//       const validateRefundAmount = (
//   order: any,
//   requestedRefund: number
// ): { valid: boolean; error?: string; available?: number } => {
//   // Oblicz już zwróconą kwotę (z użyciem corrected prices)
//   const alreadyRefunded = order.products.reduce((total: number, p: any) => {
//     const refundQty = p.refundQuantity || 0;
//     if (refundQty === 0) return total;
//     // Użyj tej samej logiki co dla nowych refundacji
//     const unitPrice = p.discountedPrice || p.price;
//     return total + (unitPrice * refundQty);
//   }, 0);
//   // Zaokrąglij do 2 miejsc po przecinku
//   const totalPaid = Math.round(order.totalAmount * 100) / 100;
//   const alreadyRefundedRounded = Math.round(alreadyRefunded * 100) / 100;
//   const available = totalPaid - alreadyRefundedRounded;
//   // Dodaj tolerancję 0.01 zł dla błędów zaokrągleń
//   const tolerance = 0.01;
//   if (requestedRefund > available + tolerance) {
//     return {
//       valid: false,
//       error: `Kwota zwrotu przekracza dostępną kwotę. Dostępne: ${available.toFixed(2)} zł, Żądane: ${requestedRefund.toFixed(2)} zł`,
//       available
//     };
//   }
//   return { valid: true, available };
//         }
//         //const productRefundAmount = product.price * refundItem.quantity;
//         //const unitPrice = (product as any).discountedPrice || product.price;
//         //const productRefundAmount = unitPrice * refundItem.quantity;
//         const productRefundAmount = calculateRefundAmount(
//           order,
//           product,
//           refundItem.quantity,
//         );
//         console.log(` product ${product}`);
//         console.log("💰 Refund amount calculation:", {
//           product: product.title,
//           originalPrice: product.price,
//           discountedPrice: product.discountedPrice,
//           orderTotalDiscount: order.totalDiscount || 0,
//           quantity: refundItem.quantity,
//           refundAmount: productRefundAmount,
//           calculationMethod: product.discountedPrice
//             ? "from discountedPrice"
//             : order.totalDiscount
//               ? "calculated proportionally"
//               : "original price",
//         });
//         totalRefundAmount += productRefundAmount;
//         refundDetails.push({
//           productId: product.productId,
//           title: product.title,
//           quantity: refundItem.quantity,
//           originalPrice: product.price,
//           discountedPrice: (product as any).discountedPrice || product.price,
//           refundPerUnit:
//             refundItem.quantity > 0
//               ? productRefundAmount / refundItem.quantity
//               : product.discountedPrice || product.price,
//           //refundPerUnit: unitPrice,
//           amount: productRefundAmount,
//           reason: refundItem.reason,
//         });
//         // Zaktualizuj produkt w zamówieniu
//         (product as any).refundQuantity = alreadyRefunded + refundItem.quantity;
//         (product as any).refunded =
//           (product as any).refundQuantity === product.quantity;
//         if ((product as any).refundQuantity === product.quantity) {
//           (product as any).refundedAt = new Date();
//         }
//         // console.log(`✅ Updated product ${product.title}:`);
//         // console.log(
//         //   `   New refundQuantity: ${(product as any).refundQuantity}`
//         // );
//       } // KONIEC PĘTLI FOR
//       const allPreviouslyRefunded = order.products.reduce(
//         (total: number, p: any, index: number) => {
//           //const refundedQty = p.refundQuantity || 0;
//           const originalRefundedQty = p.refundQuantity || 0;
//           const pricePerUnit = p.discountedPrice || p.price;
//           const productTotal = pricePerUnit * originalRefundedQty;
//           console.log(`  Product ${index} (${p.title}):`, {
//             ORIGINAL_refundedQty: originalRefundedQty,
//             pricePerUnit,
//             productTotal,
//             discountedPrice: p.discountedPrice,
//             price: p.price,
//             calculation: `${pricePerUnit} × ${originalRefundedQty} = ${productTotal}`,
//           });
//           return total + productTotal;
//         },
//         0,
//       );
//       console.log("📊 Previously refunded total:", allPreviouslyRefunded);
//       //const availableForRefund = order.totalAmount - allPreviouslyRefunded;
//       const availableInOrder = order.totalAmount - allPreviouslyRefunded;
//       const requestedRefund = totalRefundAmount;
//       console.log("💰 Order validation:", {
//         orderTotalAmount: order.totalAmount,
//         allPreviouslyRefunded,
//         availableInOrder,
//         requestedRefund,
//         difference: requestedRefund - availableInOrder,
//       });
//       // Uwzględnij błąd zaokrągleń (1 grosz)
//       if (requestedRefund > availableInOrder + 0.01) {
//         res.status(400).json({
//           error: `Suma refundów przekracza dostępną kwotę w zamówieniu`,
//           available: availableInOrder.toFixed(2),
//           requested: requestedRefund.toFixed(2),
//           difference: (requestedRefund - availableInOrder).toFixed(2),
//           orderTotal: order.totalAmount,
//           alreadyRefunded: allPreviouslyRefunded.toFixed(2),
//         });
//         return;
//       }
//       if (totalRefundAmount <= 0) {
//         res.status(400).json({ error: "Brak kwoty do zwrotu" });
//         return;
//       }
//       console.log("✅ Order validation passed!");
//       // PRZED wykonaniem refundacji, sprawdź dostępną kwotę w Stripe
//       try {
//         const paymentIntent = await stripe.paymentIntents.retrieve(
//           order.stripePaymentIntentId,
//           { expand: ["charges.data.refunds"] },
//         );
//         // console.log("💰 Payment Intent retrieved:", {
//         //   id: paymentIntent.id,
//         //   amount: paymentIntent.amount,
//         //   charges: paymentIntent.charges?.data?.length || 0,
//         // });
//         // Oblicz już zwróconą kwotę
//         let alreadyRefundedInStripe = 0;
//         // Sprawdź różne możliwe lokalizacje refundacji
//         if (paymentIntent.charges?.data?.[0]?.refunds?.data) {
//           // Refundacje w charge
//           alreadyRefundedInStripe =
//             paymentIntent.charges.data[0].refunds.data.reduce(
//               (sum: number, refund: any) => sum + refund.amount,
//               0,
//             );
//           console.log(
//             "💸 Refunds found in charge:",
//             paymentIntent.charges.data[0].refunds.data.length,
//           );
//         } else if (paymentIntent.refunds?.data) {
//           // Refundacje bezpośrednio w payment intent
//           alreadyRefundedInStripe = paymentIntent.refunds.data.reduce(
//             (sum: number, refund: any) => sum + refund.amount,
//             0,
//           );
//           // console.log(
//           //   "💸 Refunds found in payment intent:",
//           //   paymentIntent.refunds.data.length
//           // );
//         }
//         // Alternatywnie: pobierz listę refundacji dla payment intent
//         const refundsList = await stripe.refunds.list({
//           payment_intent: order.stripePaymentIntentId,
//         });
//         if (refundsList.data.length > 0) {
//           alreadyRefundedInStripe = refundsList.data.reduce(
//             (sum: number, refund: any) => sum + refund.amount,
//             0,
//           );
//           console.log("💸 Refunds from list:", refundsList.data.length);
//         }
//         const chargeAmount = paymentIntent.amount;
//         //const availableForRefund = chargeAmount - alreadyRefundedInStripe;
//         const availableInStripe = chargeAmount - alreadyRefundedInStripe;
//         const requestedRefundAmountInCents = Math.round(
//           totalRefundAmount * 100,
//         );
//         // console.log("📊 Refund calculations:", {
//         //   chargeAmount: chargeAmount / 100,
//         //   alreadyRefundedInStripe: alreadyRefundedInStripe / 100,
//         //   availableForRefund: availableForRefund / 100,
//         //   requestedRefundAmount: totalRefundAmount,
//         //   requestedRefundAmountInCents,
//         // });
//         // Sprawdź czy kwota jest dostępna
//         if (requestedRefundAmountInCents > availableInStripe) {
//           res.status(400).json({
//             error: `Żądana kwota zwrotu (${totalRefundAmount.toFixed(
//               2,
//             )} zł) jest większa niż dostępna (${(
//               availableInStripe / 100
//             ).toFixed(2)} zł).`,
//             availableForRefund: availableInStripe / 100,
//             alreadyRefunded: alreadyRefundedInStripe / 100,
//             totalAmount: chargeAmount / 100,
//           });
//           return;
//         }
//       } catch (stripeError: any) {
//         console.error("Stripe API error:", stripeError.message);
//         // Kontynuuj mimo błędu
//       }
//       // Wykonaj zwrot w Stripe
//       try {
//         const refund = await stripe.refunds.create({
//           payment_intent: order.stripePaymentIntentId,
//           amount: Math.round(totalRefundAmount * 100),
//           reason: "requested_by_customer",
//           metadata: {
//             orderId: order._id.toString(),
//             refundType: "partial",
//             refundItems: JSON.stringify(refundItems),
//             totalDiscount: order.totalDiscount || 0,
//             appliedCoupon: order.couponCode || "none",
//           },
//         });
//         console.log("✅ Stripe refund created:", refund.id);
//         const freshOrder = await Order.findById(orderId);
//         if (!freshOrder) {
//           throw new Error("Order not found after stripe refund");
//         }
//         // Zaktualizuj zamówienie
//         (freshOrder as any).partialRefunds =
//           (freshOrder as any).partialRefunds || [];
//         (freshOrder as any).partialRefunds.push({
//           refundId: refund.id,
//           amount: totalRefundAmount,
//           createdAt: new Date(),
//           reason: "Partial refund - customer request",
//           products: refundDetails,
//           metadata: {
//             usedDiscountedPrice: true,
//             originalTotal:
//               freshOrder.totalAmount + (freshOrder.totalDiscount || 0),
//             discountApplied: freshOrder.totalDiscount || 0,
//           },
//         });
//         // Sprawdź czy wszystkie produkty są zwrócone
//         const allProductsRefunded = freshOrder.products.every(
//           (p: any) => (p.refundQuantity || 0) === p.quantity,
//         );
//         if (allProductsRefunded) {
//           freshOrder.status = "refunded";
//           (freshOrder as any).refundedAt = new Date();
//           (freshOrder as any).refundId = refund.id;
//           (freshOrder as any).refundAmount = freshOrder.totalAmount;
//         } else {
//           freshOrder.status = "partially_refunded";
//         }
//         // ZAPISZ ZMIANY
//         await freshOrder.save();
//         // Usuń zasoby użytkownika dla zwróconych produktów
//         if (order.user.userId) {
//           const refundedProductIds = refundDetails.map(
//             (item) => item.productId,
//           );
//           await User.updateOne(
//             { _id: order.user.userId },
//             {
//               $pull: {
//                 resources: {
//                   productId: { $in: refundedProductIds },
//                 },
//               },
//             },
//           );
//         }
//         res.json({
//           success: true,
//           message: `Częściowy zwrot ${totalRefundAmount.toFixed(
//             2,
//           )} PLN został wykonany`,
//           order,
//           refundId: refund.id,
//           details: {
//             usedDiscountedPrices: refundDetails.map((item) => ({
//               product: item.title,
//               originalPrice: item.originalPrice,
//               refundPrice: item.refundPerUnit,
//               quantity: item.quantity,
//               total: item.amount,
//             })),
//             totalDiscount: order.totalDiscount || 0,
//           },
//         });
//       } catch (stripeRefundError: any) {
//         console.error("Stripe refund creation error:", stripeRefundError);
//         // Sprawdź czy to błąd z powodu niewystarczającej kwoty
//         if (
//           stripeRefundError.type === "StripeInvalidRequestError" &&
//           stripeRefundError.message.includes("greater than unrefunded amount")
//         ) {
//           // Spróbuj pobrać dostępną kwotę inaczej
//           const refunds = await stripe.refunds.list({
//             payment_intent: order.stripePaymentIntentId,
//             limit: 100,
//           });
//           const totalRefunded = refunds.data.reduce(
//             (sum, r) => sum + r.amount,
//             0,
//           );
//           const paymentIntent = await stripe.paymentIntents.retrieve(
//             order.stripePaymentIntentId,
//           );
//           const available = paymentIntent.amount - totalRefunded;
//           res.status(400).json({
//             error: `Dostępna kwota do zwrotu: ${(available / 100).toFixed(
//               2,
//             )} PLN`,
//             availableForRefund: available / 100,
//             totalRefunded: totalRefunded / 100,
//             totalAmount: paymentIntent.amount / 100,
//             requestedAmount: totalRefundAmount,
//           });
//         } else {
//           throw stripeRefundError;
//         }
//       }
//     } catch (err: any) {
//       console.error("Partial refund error:", err);
//       res.status(500).json({
//         error: "Błąd podczas częściowego zwrotu",
//         details: err.message,
//         stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
//       });
//     }
//   },
// );
// export default router;
