import express from "express";
import { userAuth } from "middleware/auth.js";
import Product from "models/product.js";
import Stripe from "stripe";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post("/create-checkout-session", userAuth, async (req, res) => {
  try {
    const { productId } = req.body;
    const user = req.user;
    console.log("Creating checkout session for user:", user);
    // Pobierz produkt po ID
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "pln",
            product_data: { name: product.title },
            unit_amount: product.price * 100,
          },
          quantity: 1,
        },
      ],
      // metadata: { userId: user._id.toString() },
      //success_url: "http://localhost:5173/success",
      //cancel_url: "http://localhost:5173/cancel",
      customer_email: user!.email,
      metadata: { userId: user!._id.toString() },
      return_url:
        "http://localhost:5173/return?session_id={CHECKOUT_SESSION_ID}",
    });
    //res.json({ id: session.id }); // zwracasz session.id
    //console.log("Stripe session created:", session);
    res.json({ client_secret: session.client_secret });
  } catch (error) {
    console.error("Stripe error:", error);
    res.status(500).json({ error: error.message });
  }
});
// router.post("/create-cart-checkout-session", async (req, res) => {
//   try {
//     const { cart, userId } = req.body;

//     if (!cart || cart.length === 0) {
//       return res.status(400).json({ error: "Koszyk jest pusty" });
//     }

//     const lineItems = cart.map((item) => ({
//       price_data: {
//         currency: "pln",
//         product_data: { name: item.title },
//         unit_amount: item.price * 100,
//       },
//       quantity: item.quantity,
//     }));

//     const session = await stripe.checkout.sessions.create({
//       ui_mode: "embedded",
//       payment_method_types: ["card"],
//       mode: "payment",
//       line_items: lineItems,
//       metadata: { userId: String(userId) },
//       return_url:
//         "http://localhost:5173/cart-return?session_id={CHECKOUT_SESSION_ID}",
//     });

//     res.json({ client_secret: session.client_secret });
//   } catch (err) {
//     console.error("Stripe cart error:", err);
//     res.status(500).json({ error: err.message });
//   }
// });

router.get("/session-status", async (req, res) => {
  const session = await stripe.checkout.sessions.retrieve(req.query.session_id);
  // console.log("Retrieveduu session:", session);
  res.send({
    message:
      session.status === "complete"
        ? "Płatność zakończona sukcesem 🎉"
        : "Płatność nie została ukończona ❌",
  });
});

export default router;
