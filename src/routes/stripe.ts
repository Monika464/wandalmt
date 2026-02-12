import express from "express";
import Stripe from "stripe";
import Order from "../models/order.js"; // lub purchase.js – zależnie co zapisujesz
import mongoose from "mongoose";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

router.get("/test", (req, res) => {
  res.send("Webhook router działa!");
});

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res): Promise<void> => {
    console.log("🔔 Stripe webhook received");
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // 🔹 Zabezpieczenie — brak sygnatury = odrzuć
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

    // 🔹 Obsługa zdarzenia zakończonej płatności
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      console.log("✅ Stripe webhook: checkout.session.completed", session.id);

      try {
        // Unikamy duplikatów
        const existing = await Order.findOne({ stripeSessionId: session.id });
        if (existing) {
          console.log("ℹ️ Order already exists, skipping.");
          res.status(200).send("Already processed");
          return;
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

// Webhook dla faktur
router.post(
  "/stripe-invoice-webhook",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response): Promise<void> => {
    const sig = req.headers["stripe-signature"] as string;

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err: any) {
      console.error(`⚠️ Webhook signature verification failed:`, err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    // Obsłuż różne eventy związane z fakturami
    switch (event.type) {
      case "invoice.created":
      case "invoice.finalized":
      case "invoice.paid":
      case "invoice.payment_succeeded":
        const invoice = event.data.object as any;

        try {
          // Znajdź zamówienie po payment_intent
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
              `✅ Invoice updated via webhook for order ${order._id}`
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
  }
);

export default router;

//kod z zapisem resource do modelu user

// import express from "express";
// import Stripe from "stripe";
// import Order from "../models/order.js";
// import mongoose from "mongoose";
// import User from "../models/user.js";
// import Product from "../models/product.js";
// import Resource from "../models/resource.js";

// const router = express.Router();
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// router.get("/test", (req, res) => {
//   res.send("Webhook router działa!");
// });

// router.post(
//   "/webhook",
//   express.raw({ type: "application/json" }),
//   async (req, res): Promise<void> => {
//     console.log("🔔 Stripe webhook received");
//     const sig = req.headers["stripe-signature"];
//     const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

//     if (!sig || !webhookSecret) {
//       console.error("❌ Missing Stripe signature or secret");
//       res.status(400).send("Missing Stripe signature or secret");
//       return;
//     }

//     let event;
//     try {
//       event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
//     } catch (err) {
//       console.error("❌ Invalid Stripe signature:", (err as Error).message);
//       res.status(400).send(`Webhook Error: ${(err as Error).message}`);
//       return;
//     }

//     if (event.type === "checkout.session.completed") {
//       const session = event.data.object;
//       console.log("✅ checkout.session.completed dla sesji:", session.id);

//       try {
//         // Unikamy duplikatów
//         const existing = await Order.findOne({ stripeSessionId: session.id });
//         if (existing) {
//           console.log("ℹ️ Order already exists, skipping.");
//           res.status(200).send("Already processed");
//           return;
//         }

//         const lineItems = await stripe.checkout.sessions.listLineItems(session.id);

//         const userId = session.metadata?.userId;
//         const productIds = session.metadata?.productIds
//           ? session.metadata.productIds.split(",")
//           : [session.metadata?.productId];

//         // 🔹 Utwórz nowy dokument zamówienia
//         const order = new Order({
//           stripeSessionId: session.id,
//           createdAt: new Date(),
//           products: lineItems.data.map((item, index) => ({
//             product: {
//               _id: productIds[index]
//                 ? new mongoose.Types.ObjectId(productIds[index])
//                 : undefined,
//               title: item.description || "Produkt",
//               price: (item.amount_total || 0) / 100,
//               description: item.description || "",
//               imageUrl: "",
//               content: "",
//               userId: new mongoose.Types.ObjectId(userId),
//             },
//             quantity: item.quantity || 1,
//           })),
//           user: {
//             email: session.customer_email,
//             userId: new mongoose.Types.ObjectId(userId),
//           },
//         });

//         await order.save();
//         console.log("💾 Order zapisany przez webhook:", order._id);

//         // 🔹 Dodaj zasoby do użytkownika
//         if (userId && productIds.length > 0) {
//           const user = await User.findById(userId);
//           if (user) {
//             console.log(`👤 Znaleziono użytkownika: ${user.email}`);

//             // Pobierz wszystkie produkty
//             const products = await Product.find({ _id: { $in: productIds } });

//             // Zbierz wszystkie resource ID z produktów
//             const resourceIds = products
//               .map((p) => p.resource)
//               .filter((r) => !!r)
//               .map((r) => new mongoose.Types.ObjectId(r));

//             if (resourceIds.length > 0) {
//               // Dodaj unikalne resource do user.resources
//               user.resources = [
//                 ...new Set([
//                   ...(user.resources || []).map((r) => r.toString()),
//                   ...resourceIds.map((r) => r.toString()),
//                 ]),
//               ].map((r) => new mongoose.Types.ObjectId(r));

//               await user.save();
//               console.log(`📚 Dodano ${resourceIds.length} zasobów do użytkownika`);
//             } else {
//               console.log("⚠️ Produkty nie zawierały powiązanych zasobów");
//             }
//           } else {
//             console.warn("⚠️ Nie znaleziono użytkownika dla ID:", userId);
//           }
//         }
//       } catch (err) {
//         console.error("❌ Błąd podczas przetwarzania webhooka:", err);
//       }
//     }

//     res.status(200).send("Received");
//   }
// );

// export default router;
