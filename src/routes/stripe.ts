import express from "express";
import Stripe from "stripe";
import Order from "../models/order.js";
import mongoose from "mongoose";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res): Promise<void> => {
    console.log("🔔 Stripe webhook received");
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // 🔹 Security - no signature = reject
    if (!sig || !webhookSecret) {
      console.error("❌ Missing Stripe signature or secret");
      res.status(400).send("Missing Stripe signature or secret");
      return;
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error("❌ Invalid Stripe signature:", (err as Error).message);
      res.status(400).send(`Webhook Error: ${(err as Error).message}`);
      return;
    }

    // 🔹 Payment Completed Event Handler
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      console.log("✅ Stripe webhook: checkout.session.completed", session.id);

      try {
        // // We avoid duplicates
        const existing = await Order.findOne({ stripeSessionId: session.id });
        if (existing) {
          console.log("ℹ️ Order already exists, skipping.");
          res.status(200).send("Already processed");
          return;
        }

        // Get details of purchased products
        const lineItems = await stripe.checkout.sessions.listLineItems(
          session.id,
        );

        const userId = session.metadata?.userId;
        const productIds = session.metadata?.productIds
          ? session.metadata.productIds.split(",")
          : [session.metadata?.productId];

        // Create a new order document
        const order = new Order({
          stripeSessionId: session.id,
          createdAt: new Date(),
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
        console.log("💾 Order saved via webhook:", order._id);
      } catch (err) {
        console.error("❌ Error while saving order:", err);
      }
    }

    res.status(200).send("Received");
  },
);

// // Webhook for invoices
router.post(
  "/stripe-invoice-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;

    let event;

    try {
      if (!sig || !endpointSecret) {
        console.error("❌ Missing Stripe signature or secret");
        res.status(400).send("Missing Stripe signature or secret");
        return;
      }
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err: any) {
      console.error(`⚠️ Webhook signature verification failed:`, err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    // Handle various invoice-related events
    switch (event.type) {
      case "invoice.created":
      case "invoice.finalized":
      case "invoice.paid":
      case "invoice.payment_succeeded":
        const invoice = event.data.object as any;

        try {
          // Find order by payment_intent
          const order = await Order.findOne({
            stripePaymentIntentId: invoice.payment_intent,
          });

          if (order) {
            console.log(`📄 Webhook: Updating invoice for order ${order._id}`);

            order.invoiceId = invoice.id;
            order.invoiceDetails = {
              invoiceNumber:
                invoice.number || `INV-${order._id.toString().slice(-8)}`,
              invoicePdf: invoice.invoice_pdf || "",
              hostedInvoiceUrl: invoice.hosted_invoice_url || "",
              status: invoice.status || "paid",
              amountPaid: invoice.amount_paid
                ? invoice.amount_paid / 100
                : order.totalAmount,
              createdAt: invoice.created
                ? new Date(invoice.created * 1000)
                : new Date(),
            };

            await order.save();
            console.log(
              `✅ Invoice updated via webhook for order ${order._id}`,
            );
          }
        } catch (error) {
          console.error("Error updating invoice from webhook:", error);
        }
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  },
);

export default router;
