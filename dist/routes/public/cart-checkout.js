import express from "express";
import Stripe from "stripe";
import mongoose from "mongoose";
import Order from "../../models/order.js";
//import User from "../../models/user.js";
import { userAuth } from "../../middleware/auth.js"; // poprawnie
//import type { AuthenticatedRequest } from "../../../types/express.js";
const router = express.Router();
// 🔑 Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
// ✅ 1️⃣ Tworzenie sesji płatności Stripe Checkout
router.post("/cart-checkout-session", userAuth, async (req, res) => {
    try {
        // console.log("Creating cart checkout session backend");
        const { items } = req.body;
        //console.log("req body:", req.body, "req user", req.user);
        if (!items || !Array.isArray(items) || items.length === 0) {
            res.status(400).json({ error: "Brak produktów w koszyku" });
            return;
        }
        if (!req.user) {
            res.status(401).json({ error: "Użytkownik nieautoryzowany" });
            return;
        }
        const productIds = items.map((item) => item._id.toString());
        // Stripe line_items
        const lineItems = items.map((item) => ({
            price_data: {
                currency: "pln",
                product_data: { name: item.title },
                unit_amount: Math.round(item.price * 100),
            },
            quantity: item.quantity,
        }));
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "payment",
            line_items: lineItems,
            success_url: `http://localhost:5173/cart-return?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `http://localhost:5173/cart-cancel`,
            customer_email: req.user.email,
            metadata: {
                userId: req.user._id.toString(),
                email: req.user.email,
                productIds: productIds.join(","),
            },
        });
        res.json({ url: session.url });
    }
    catch (err) {
        console.error("Stripe error:", err);
        res.status(500).json({ error: "Błąd tworzenia sesji płatności" });
    }
});
// ✅ 2️⃣ Sprawdzanie statusu i zapisywanie zamówienia
router.get("/cart-session-status", userAuth, async (req, res) => {
    try {
        // console.log("Checking cart session status backend");
        const { session_id } = req.query;
        if (!session_id) {
            console.log("No session_id in query");
            res.status(400).json({ error: "Brak session_id w zapytaniu" });
            return;
        }
        const session = await stripe.checkout.sessions.retrieve(session_id, { expand: ["line_items.data.price.product"] });
        //console.log("Stripe session object:", JSON.stringify(session, null, 2));
        //console.log("Payment status:", session.payment_status);
        if (session.payment_status !== "paid") {
            res.json({
                status: "pending",
                message: "⏳ Płatność w trakcie przetwarzania",
            });
            return;
        }
        if (session.payment_status === "paid") {
            const userEmail = session.customer_email || req.user?.email;
            const productIds = session.metadata?.productIds
                ? session.metadata.productIds.split(",")
                : [];
            // console.log("User email:", userEmail);
            //console.log("User ID from metadata:", session.metadata?.userId);
            const existing = await Order.findOne({
                stripeSessionId: session.id,
                // "user.email": userEmail,
                // "user.userId": session.metadata?.userId,
            });
            //console.log("Existing order found?", existing);
            if (!existing) {
                //console.log("Creating new order...");
                const order = new Order({
                    stripeSessionId: session.id,
                    products: session.line_items?.data.map((item, index) => ({
                        product: {
                            _id: productIds[index]
                                ? new mongoose.Types.ObjectId(productIds[index])
                                : undefined,
                            title: item.description || "Brak tytułu",
                            price: (item.amount_total || 0) / 100,
                            description: item.description || "",
                            imageUrl: "",
                            content: "",
                            userId: new mongoose.Types.ObjectId(session.metadata?.userId),
                        },
                        quantity: item.quantity || 1,
                    })),
                    user: {
                        email: userEmail,
                        userId: new mongoose.Types.ObjectId(session.metadata?.userId),
                    },
                });
                await order.save();
                console.log("Order saved!");
            }
            else {
                console.log("Order already exists, skipping save");
            }
            res.json({
                status: "complete",
                message: "✅ Płatność zakończona sukcesem",
            });
            return;
        }
        console.log("Payment not yet paid");
        res.json({
            status: "pending",
            message: "⏳ Płatność w trakcie przetwarzania",
        });
    }
    catch (err) {
        console.error("Payment status error:", err.message || err);
        res
            .status(500)
            .json({ error: err.message || "Błąd podczas sprawdzania płatności" });
    }
});
export default router;
