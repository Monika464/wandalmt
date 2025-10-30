import express from "express";
import Stripe from "stripe";
import Order from "../models/order.js"; // lub purchase.js – zależnie co zapisujesz
import mongoose from "mongoose";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-09-30.clover",
});

router.get("/test", (req, res) => {
  res.send("Webhook router działa!");
});
// ⚠️ WAŻNE: ten endpoint musi używać express.raw(), nie express.json()
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    console.log("🔔 Stripe webhook received");
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error("❌ Invalid Stripe signature:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // 🔹 Obsługa zdarzenia zakończonej płatności
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      console.log("✅ Stripe webhook: checkout.session.completed", session.id);

      try {
        // Unikamy duplikatów
        const existing = await Order.findOne({ stripeSessionId: session.id });
        if (existing) {
          console.log("ℹ️ Order already exists, skipping.");
          return res.status(200).send("Already processed");
        }

        // Pobierz szczegóły zakupionych produktów
        const lineItems = await stripe.checkout.sessions.listLineItems(
          session.id
        );

        const userId = session.metadata?.userId;
        const productIds = session.metadata?.productIds
          ? session.metadata.productIds.split(",")
          : [session.metadata?.productId];

        // Utwórz nowy dokument zamówienia
        const order = new Order({
          stripeSessionId: session.id,
          createdAt: new Date(), // 🔹 automatyczna data
          products: lineItems.data.map((item, index) => ({
            product: {
              _id: productIds[index]
                ? new mongoose.Types.ObjectId(productIds[index])
                : undefined,
              title: item.description || "Produkt",
              price: (item.amount_total || 0) / 100,
              description: item.description || "",
              imageUrl: "",
              content: "",
              userId: new mongoose.Types.ObjectId(userId),
            },
            quantity: item.quantity || 1,
          })),
          user: {
            email: session.customer_email,
            userId: new mongoose.Types.ObjectId(userId),
          },
        });

        await order.save();
        console.log("💾 Order zapisany przez webhook:", order._id);
      } catch (err) {
        console.error("❌ Błąd podczas zapisu zamówienia:", err);
      }
    }

    res.status(200).send("Received");
  }
);

export default router;
