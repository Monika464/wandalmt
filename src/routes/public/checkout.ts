import express from "express";
import { userAuth } from "middleware/auth.js";
import Product from "models/product.js";
import Stripe from "stripe";
import Order from "../../models/order.js";
import User from "../../models/user.js";
import Resource from "../../models/resource.js";
import mongoose from "mongoose";

const router = express.Router();
//const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
router.post("/checkout-session", userAuth, async (req, res): Promise<void> => {
  try {
    const { productId } = req.body as { productId: string };
    const user = req.user!;

    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    const session = await stripe.checkout.sessions.create({
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
      customer_email: user.email,
      metadata: {
        userId: user._id.toString(),
        productId: (product._id as string).toString(),
      },
      success_url:
        "http://localhost:5173/return?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "http://localhost:5173/cancel",
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Stripe error:", error);
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});
router.get("/session-status", userAuth, async (req, res): Promise<void> => {
  try {
    // console.log("Checking single product session status backend");

    const { session_id } = req.query;
    if (!session_id) {
      res.status(400).json({ error: "Brak session_id w zapytaniu" });
      return;
    }

    const session = await stripe.checkout.sessions.retrieve(
      session_id as string,
      {
        expand: ["line_items.data.price.product"],
      }
    );

    if (session.payment_status !== "paid") {
      res.json({
        status: "pending",
        message: "⏳ Płatność w trakcie przetwarzania",
      });
      return;
    }

    // Płatność zakończona sukcesem
    const userEmail = session.customer_email || req.user?.email;
    const userId = session.metadata?.userId;

    // Sprawdź, czy zamówienie już istnieje
    const existing = await Order.findOne({ stripeSessionId: session.id });

    if (!existing) {
      console.log("Creating new order...");

      const lineItem = session.line_items?.data[0];
      const productId = session.metadata?.productId;

      const order = new Order({
        stripeSessionId: session.id,
        products: [
          {
            product: {
              _id: productId
                ? new mongoose.Types.ObjectId(productId)
                : undefined,
              title: lineItem?.description || "Brak tytułu",
              price: (lineItem?.amount_total || 0) / 100,
              description: lineItem?.description || "",
              imageUrl: "",
              content: "",
              userId: new mongoose.Types.ObjectId(userId),
            },
            quantity: lineItem?.quantity || 1,
          },
        ],
        user: {
          email: userEmail,
          userId: new mongoose.Types.ObjectId(userId),
        },
      });

      await order.save();
      console.log("✅ Order saved for single product!");
    } else {
      //console.log("Order already exists, skipping save");
    }
    //
    // 🔹 Pobierz zasoby (resources) powiązane z zakupionymi produktami
    const resources = await Resource.find({
      productId: session.metadata?.productId,
    }).select("_id");

    //console.log("🔹 Resources found for products:", resources);

    if (resources.length > 0) {
      // 🔹 Dodaj zasoby do użytkownika (bez duplikatów)
      const updateResult = await User.updateOne(
        { _id: userId },
        {
          $addToSet: {
            resources: { $each: resources.map((r) => r._id) },
          },
        }
      );

      //console.log("🔹 User resources updated:", updateResult);
    } else {
      console.log("⚠️ Brak zasobów do przypisania użytkownikowi");
    }
    //

    res.json({
      status: "complete",
      message: "✅ Płatność zakończona sukcesem",
    });
    return;
  } catch (err) {
    console.error("Payment status error:", (err as Error).message || err);
    res.status(500).json({
      error: (err as Error).message || "Błąd podczas sprawdzania płatności",
    });
  }
});

export default router;
