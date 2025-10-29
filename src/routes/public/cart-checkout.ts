import express, { Request, Response } from "express";
import Stripe from "stripe";
import mongoose from "mongoose";
import Order from "../../models/order.js";
import User from "../../models/user.js";
import { userAuth } from "../../middleware/auth.js"; // poprawnie
//import type { AuthenticatedRequest } from ""; // jeśli masz typ rozszerzający Request

const router = express.Router();

// 🔑 Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// ✅ 1️⃣ Tworzenie sesji płatności Stripe Checkout
router.post("/cart-checkout-session", userAuth, async (req, res) => {
  try {
    console.log("Creating cart checkout session backend");
    const { items } = req.body;
    //console.log("req body:", req.body, "req user", req.user);

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Brak produktów w koszyku" });
    }

    if (!req.user) {
      return res.status(401).json({ error: "Użytkownik nieautoryzowany" });
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
  } catch (err) {
    console.error("Stripe error:", err);
    res.status(500).json({ error: "Błąd tworzenia sesji płatności" });
  }
});

// ✅ 2️⃣ Sprawdzanie statusu i zapisywanie zamówienia
router.get(
  "/cart-session-status",
  userAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("Checking cart session status backend");
      const { session_id } = req.query;
      if (!session_id) {
        console.log("No session_id in query");
        return res.status(400).json({ error: "Brak session_id w zapytaniu" });
      }

      const session = await stripe.checkout.sessions.retrieve(
        session_id as string,
        { expand: ["line_items.data.price.product"] }
      );

      //console.log("Stripe session object:", JSON.stringify(session, null, 2));

      //console.log("Payment status:", session.payment_status);
      if (session.payment_status !== "paid") {
        return res.json({
          status: "pending",
          message: "⏳ Płatność w trakcie przetwarzania",
        });
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
            products: session.line_items?.data.map(
              (item: any, index: number) => ({
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
              })
            ),
            user: {
              email: userEmail,
              userId: new mongoose.Types.ObjectId(session.metadata?.userId),
            },
          });

          await order.save();
          console.log("Order saved!");
        } else {
          console.log("Order already exists, skipping save");
        }

        return res.json({
          status: "complete",
          message: "✅ Płatność zakończona sukcesem",
        });
      }

      console.log("Payment not yet paid");
      res.json({
        status: "pending",
        message: "⏳ Płatność w trakcie przetwarzania",
      });
    } catch (err: any) {
      console.error("Payment status error:", err.message || err);
      res
        .status(500)
        .json({ error: err.message || "Błąd podczas sprawdzania płatności" });
    }
  }
);

export default router;

// import express from "express";
// import Stripe from "stripe";
// import { userAuth } from "../../middleware/auth.js";
// import User from "../../models/user.js"; // ⬅️ zakładam, że masz model User
// import Purchase from "models/purchase.js";

// const router = express.Router();
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// // POST /cart-checkout-session
// router.post("/cart-checkout-session", userAuth, async (req, res) => {
//   try {
//     const { items } = req.body; // zawartość koszyka z frontu
//     const user = req.user; // z middleware JWT

//     if (!items || items.length === 0) {
//       return res.status(400).json({ error: "Koszyk jest pusty" });
//     }

//     // Utwórz line_items dla Stripe
//     const line_items = items.map((item) => ({
//       price_data: {
//         currency: "pln",
//         product_data: { name: item.title },
//         unit_amount: item.price * 100,
//       },
//       quantity: item.quantity,
//     }));

//     // Tworzymy sesję Stripe Checkout (klasyczny tryb redirect)
//     const session = await stripe.checkout.sessions.create({
//       payment_method_types: ["card"],
//       mode: "payment",
//       line_items,
//       customer_email: user.email,
//       metadata: { userId: user._id.toString() },
//       success_url: "http://localhost:5173/cart-return?success=true",
//       cancel_url: "http://localhost:5173/cart-return?canceled=true",
//     });

//     // Zapisz e-mail użytkownika w bazie (dla historii zakupów)
//     await User.findByIdAndUpdate(user._id, {
//       $set: { lastPurchaseEmail: user.email, lastPurchaseAt: new Date() },
//     });

//     res.json({ url: session.url });
//   } catch (err) {
//     console.error("Błąd w /cart-checkout-session:", err);
//     res.status(500).json({ error: "Nie udało się utworzyć sesji Stripe" });
//   }
// });

// export default router;
