import express from "express";
import Product from "models/product.js";
import Stripe from "stripe";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post("/create-checkout-session", async (req, res) => {
  try {
    const { productId } = req.body;

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
      //success_url: "http://localhost:5173/success",
      //cancel_url: "http://localhost:5173/cancel",

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

router.get("/session-status", async (req, res) => {
  const session = await stripe.checkout.sessions.retrieve(req.query.session_id);
  res.send({
    message:
      session.status === "complete"
        ? "Płatność zakończona sukcesem 🎉"
        : "Płatność nie została ukończona ❌",
  });
});

export default router;
