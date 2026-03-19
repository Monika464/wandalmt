import express from "express";
import cors from "cors";
import { connectDB } from "./db.js";
import authRouter from "./routes/public/auth.js";
import adminRouter from "./routes/admin/index.js";
import userRouter from "./routes/public/user.js";
import productRouter from "./routes/public/products.js";
import resourceRouter from "./routes/public/resources.js";
import uploadRouter from "./routes/upload.js";
import stripeWebhookRouter from "./routes/stripe.js";
import cartCheckoutRouter from "./routes/public/cart-checkout.js";
import orderRoutes from "./routes/order/orders.js";
import bunnyRouter from "./routes/bunny.js";
import emailRouter from "./routes/email.js";
import discountPublicRouter from "./routes/public/discount-public.js";
//import discountAdminRouter from "./routes/admin/discount.js";
import progressRouter from "./routes/progress.js";
import { tokenRefreshMiddleware } from "./middleware/tokenRefreshMiddleware.js";

import {
  checkVideoStatus,
  getVideoStatus,
} from "./controllers/bunnyWebhook.js";
//import { adminAuth } from "middleware/auth.js";

connectDB();
const app = express();

app.use("/api", stripeWebhookRouter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: ["http://localhost:5173", "https://club.boxingonline.eu"],
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);
app.options("*", cors());

app.post("/vbp/stream/webhook/bunny/", checkVideoStatus);
app.get("/vbp/stream/webhook/bunny/:videoId", getVideoStatus);

// app.use(
//   "/admin",
//   (req, res, next) => {
//     console.log("🎯 ADMIN LAYER HIT!");
//     console.log("  fullUrl:", req.originalUrl);
//     console.log("  baseUrl:", req.baseUrl);
//     console.log("  path:", req.path);
//     next();
//   },
//   adminRouter,
// );

app.use("/auth", authRouter);
app.use(tokenRefreshMiddleware);
app.use("/users", userRouter);
app.use("/admin", adminRouter);
app.use("/", productRouter);
app.use("/", resourceRouter);
app.use("/api", uploadRouter);
app.use("/api", cartCheckoutRouter);
app.use("/api/orders", orderRoutes);
app.use("/api/email", emailRouter);
app.use("/api/stream", bunnyRouter);
app.use("/api/discounts", discountPublicRouter);
//app.use("/api/admin/discounts", discountAdminRouter);
// app.use(
//   "/api/admin/discounts",
//   adminAuth,
//   (req, res, next) => {
//     console.log("⚡⚡⚡ ADMIN ROUTE HIT! ⚡⚡⚡");
//     console.log("Path:", req.path);
//     console.log("Method:", req.method);
//     next();
//   },
//   discountAdminRouter,
// );
app.use("/api/progress", progressRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
