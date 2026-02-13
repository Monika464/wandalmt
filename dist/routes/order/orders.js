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
