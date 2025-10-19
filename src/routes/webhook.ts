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

    console.log("Webhook received:", event.type);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const lineItems = await stripe.checkout.sessions.listLineItems(
        session.id
      );
      console.log("Line items:", lineItems.data);

      const firstItem = lineItems.data[0];
      const product = firstItem?.description
        ? await Product.findOne({ title: firstItem.description })
        : null;

      if (product) {
        await Purchase.create({
          productId: product._id,
          sessionId: session.id,
          customerEmail: session.customer_email,
          amount: session.amount_total,
          status: "complete",
        });
        console.log("Purchase saved:", session.id);
      } else {
        console.warn(
          "Product not found for description:",
          firstItem?.description
        );
      }
    }

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
