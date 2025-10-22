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
  "/webhook",
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

    // if (event.type === "checkout.session.completed") {
    //   const session = event.data.object as Stripe.Checkout.Session;

    //   const lineItems = await stripe.checkout.sessions.listLineItems(
    //     session.id
    //   );
    //   //console.log("Line items:", lineItems.data);

    //   const firstItem = lineItems.data[0];
    //   const product = firstItem?.description
    //     ? await Product.findOne({ title: firstItem.description })
    //     : null;
    //   console.log("📦 Saving purchase for session:", session.id);
    //   if (product) {
    //     await Purchase.create({
    //       productId: product._id,
    //       sessionId: session.id,
    //       customerEmail: session.customer_email,
    //       amount: session.amount_total,
    //       status: "complete",
    //     });
    //     console.log("Purchase saved:", session.id);
    //   } else {
    //     console.warn(
    //       "Product not found for description:",
    //       firstItem?.description
    //     );
    //   }
    // }

    res.json({ received: true });
  }
);

export default router;

// import express, { Request, Response } from "express";
// import Stripe from "stripe";
// import Purchase from "../models/purchase.js";
// import Product from "../models/product.js";

// const router = express.Router();

// // Ustawienie Stripe z wersją API 2025-09-30.clover
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
//   apiVersion: "2025-09-30.clover",
// });

// // Typ dla obiektu webhook session
// interface StripeSession {
//   id: string;
//   customer_email?: string;
//   amount_total?: number;
//   line_items?: Array<{
//     description?: string;
//   }>;
// }

// router.post(
//   "/webhook",
//   express.raw({ type: "application/json" }),
//   async (req: Request, res: Response) => {
//     const sig = req.headers["stripe-signature"] as string;
//     const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

//     let event: Stripe.Event;

//     try {
//       event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
//     } catch (err: any) {
//       console.error("Webhook signature failed:", err);
//       return res.status(400).send(`Webhook Error: ${err.message}`);
//     }

//     console.log("Webhook event received heej");
//     console.log("Webhook received:", event.type);
//     if (event.type === "checkout.session.completed") {
//       const session = event.data.object as StripeSession;

//       const lineItems = await stripe.checkout.sessions.listLineItems(
//         session.id
//       );
//       console.log(lineItems.data);

//       const lineItem = session.line_items?.[0];
//       const product = await Product.findOne({ title: lineItem?.description });

//       if (product) {
//         await Purchase.create({
//           productId: product._id,
//           sessionId: session.id,
//           customerEmail: session.customer_email,
//           amount: session.amount_total,
//           status: "complete",
//         });
//         console.log("Purchase saved:", session.id);
//       } else {
//         console.warn(
//           "Product not found for description:",
//           lineItem?.description
//         );
//       }
//     }

//     res.json({ received: true });
//   }
// );

// export default router;
