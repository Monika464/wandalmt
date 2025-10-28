import express, { Request, Response } from "express";
import Stripe from "stripe";
import Purchase from "../models/purchase.js";
import Product from "../models/product.js";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-09-30.clover",
});

// POST /webhook musi używać express.raw
router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature failed:", err);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    //console.log("Webhook received:", event.type);
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const lineItems = await stripe.checkout.sessions.listLineItems(
        session.id
      );
      // console.log("Line items:", lineItems.data);

      // Odczytaj userId z metadanych
      const userId = session.metadata?.userId || null;
      console.log("🔑 Webhook userId:", userId);

      // Jeśli to sesja z koszyka (więcej niż 1 produkt)
      if (lineItems.data.length > 1) {
        console.log(`🛒 Saving multiple purchases for session ${session.id}`);

        for (const item of lineItems.data) {
          const product = await Product.findOne({ title: item.description });
          if (product) {
            await Purchase.create({
              userId,
              productId: product._id,
              sessionId: session.id,
              customerEmail: session.customer_email,
              amount: (item.amount_total || 0) / 100,
              quantity: item.quantity,
              status: "complete",
            });
          } else {
            console.warn("Product not found:", item.description);
          }
        }
      } else {
        // Pojedynczy produkt (jak dotychczas)
        const firstItem = lineItems.data[0];
        const product = await Product.findOne({ title: firstItem.description });
        if (product) {
          await Purchase.create({
            userId,
            productId: product._id,
            sessionId: session.id,
            customerEmail: session.customer_email,
            amount: (session.amount_total || 0) / 100,
            quantity: firstItem.quantity,
            status: "complete",
          });
          console.log("Purchase saved:", session.id);
        } else {
          console.warn("Product not found:", firstItem.description);
        }
      }
    }

    res.json({ received: true });
  }
);

// // 🧩 webhook wymaga surowego body
// router.post(
//   "/api/stripe-webhook",
//   express.raw({ type: "application/json" }),
//   async (req: Request, res: Response) => {
//     const sig = req.headers["stripe-signature"];

//     if (!sig) {
//       return res.status(400).send("Missing Stripe signature");
//     }

//     let event: Stripe.Event;

//     try {
//       event = stripe.webhooks.constructEvent(
//         req.body,
//         sig,
//         process.env.STRIPE_WEBHOOK_SECRET as string
//       );
//     } catch (err: any) {
//       console.error("⚠️ Webhook signature verification failed:", err.message);
//       return res.status(400).send(`Webhook Error: ${err.message}`);
//     }

//     // ✅ Obsługa zdarzenia 'checkout.session.completed'
//     if (event.type === "checkout.session.completed") {
//       const session = event.data.object as Stripe.Checkout.Session;
//       console.log("✅ Webhook session completed:", session.id);

//       if (session.payment_status === "paid") {
//         try {
//           const existing = await Order.findOne({ stripeSessionId: session.id });
//           if (!existing) {
//             const order = new Order({
//               stripeSessionId: session.id,
//               user: {
//                 email: session.customer_email,
//                 userId: new mongoose.Types.ObjectId(session.metadata?.userId),
//               },
//               products: [
//                 {
//                   product: {
//                     title: session.metadata?.productTitle || "Produkt",
//                     price: Number(session.amount_total || 0) / 100,
//                     description: session.metadata?.description || "",
//                     userId: new mongoose.Types.ObjectId(
//                       session.metadata?.userId
//                     ),
//                     imageUrl: "",
//                     content: "",
//                   },
//                   quantity: 1,
//                 },
//               ],
//             });

//             await order.save();
//             console.log("💾 Order zapisany przez webhook:", order._id);
//           }
//         } catch (error) {
//           console.error(
//             "❌ Błąd podczas zapisu zamówienia przez webhook:",
//             error
//           );
//         }
//       }
//     }

//     res.status(200).send("Received");
//   }
// );

export default router;
