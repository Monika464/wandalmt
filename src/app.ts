import express from "express";
import cors from "cors";
import { connectDB } from "./db.js";
import authRouter from "./routes/auth.js";
import adminRouter from "./routes/admin/index.js";
import userRouter from "./routes/user.js";
import productRouter from "./routes/public/products.js";
import resourceRouter from "./routes/public/resources.js";
import uploadRouter from "./routes/upload.js";
import checkoutRouter from "./routes/public/checkout.js";
//import purchaseRoutes from "./routes/public/purchase.js";
import stripeWebhookRouter from "./routes/stripeWebhook.js";
import cartCheckoutRouter from "./routes/public/cart-checkout.js";
import orderRoutes from "./routes/order/orders.js";
import bunnyStream from "./routes/bunnyStream.js";
import { tokenRefreshMiddleware } from "./middleware/tokenRefreshMiddleware.js";

import dotenv from "dotenv";
import emailRoutes from "routes/emailRoutes.js";
import { checkVideoStatus, getVideoStatus } from "controllers/bunnyWebhook.js";
dotenv.config();

connectDB();
const app = express();

app.use("/api", stripeWebhookRouter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
//app.use("/api", myOrdersRouter);

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
//app.use(cors());
app.post("/vbp/stream/webhook/bunny/", checkVideoStatus);
app.get("/vbp/stream/webhook/bunny/:videoId", getVideoStatus);

app.use("/auth", authRouter);
app.use(tokenRefreshMiddleware);
app.use("/users", userRouter);
app.use("/admin", adminRouter);
app.use("/", productRouter);
app.use("/", resourceRouter);
app.use("/api", uploadRouter);
app.use("/api", checkoutRouter);
app.use("/api", cartCheckoutRouter);
app.use("/api/orders", orderRoutes);
app.use("/email", emailRoutes);
app.use("/api/stream", bunnyStream);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
