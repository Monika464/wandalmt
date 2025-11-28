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
import bunnyStreamRouter from "./routes/bunnyStream.js";

import dotenv from "dotenv";
import emailRoutes from "routes/emailRoutes.js";
dotenv.config();

connectDB();
const app = express();

app.use("/api", stripeWebhookRouter);
app.use(express.json());
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

app.use("/auth", authRouter);
app.use("/users", userRouter);
app.use("/admin", adminRouter);
app.use("/", productRouter);
app.use("/", resourceRouter);
app.use("/api", uploadRouter);
app.use("/", checkoutRouter);
app.use("/", cartCheckoutRouter);
app.use("/api/orders", orderRoutes);
app.use("/email", emailRoutes);
app.use("/api/stream", bunnyStreamRouter);

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
