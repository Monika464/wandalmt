import express from "express";
import cors from "cors";
import { connectDB } from "./db.js";
import authRouter from "./routes/auth.js";
import productRouter from "./routes/admin.js";
import userRouter from "./routes/user.js";
import dotenv from "dotenv";
dotenv.config();
connectDB();
const app = express();
app.use(cors());
app.use(express.json());
app.use(authRouter);
app.use("/admin", productRouter);
app.use(userRouter);
// app.get("/", (req, res) => {
//   res.send("Hello World!");
// });
app.listen(3000, () => {
    console.log("Server is running on port 3000");
});
