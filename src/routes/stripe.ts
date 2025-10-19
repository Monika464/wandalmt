import express, { Request, Response } from "express";
import Stripe from "stripe";
import bodyParser from "body-parser";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// Middleware do ustawiania nagłówka Stripe-Version
router.use((req: Request, res: Response, next) => {
  res.setHeader("Stripe-Version", "2025-09-30.clover");
  next();
});

// Uwaga: webhook MUSI używać raw body!
router.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"] as string | undefined;
    if (!sig) {
      return res.status(400).send("Missing Stripe signature");
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET as string
      );
    } catch (err: any) {
      console.error("❌ Invalid signature:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Obsługa eventów:
    switch (event.type) {
      case "checkout.session.completed":
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("✅ Payment completed:", session.id);
        break;
      case "payment_intent.payment_failed":
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log("❌ Payment failed:", paymentIntent.id);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.sendStatus(200);
  }
);

export default router;
