import express from "express";
import Stripe from "stripe";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
router.post("/create-checkout-session", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "pln",
            product_data: { name: "Test product" },
            unit_amount: 1000, // 10.00 PLN
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      return_url:
        "http://localhost:5173/return?session_id={CHECKOUT_SESSION_ID}",
    });

    console.log("Stripe session created:", session);
    res.json({ client_secret: session.client_secret });
  } catch (error) {
    console.error("Stripe error:", error);
    res.status(500).json({ error: error.message });
  }
});

// router.post("/create-checkout-session", async (req, res) => {
//   try {
//     const session = await stripe.checkout.sessions.create({
//       ui_mode: "embedded",
//       payment_method_types: ["card"],
//       line_items: [
//         {
//           price_data: {
//             currency: "pln",
//             product_data: {
//               name: "Test Product",
//             },
//             unit_amount: 200, // 2.00 PLN
//           },
//           quantity: 1,
//         },
//       ],
//       mode: "payment",
//       return_url:
//         "http://localhost:5173/return?session_id={CHECKOUT_SESSION_ID}",
//     });

//     res.json({ client_secret: session.client_secret });
//   } catch (error) {
//     console.error("Błąd Stripe:", error);
//     res.status(500).json({ error: error.message });
//   }
// });

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
