import express from "express";
import cors from "cors";
import { connectDB } from "./db.js";
import authRouter from "./routes/auth.js";
import adminRouter from "./routes/admin.js";
import userRouter from "./routes/user.js";
import uploadRouter from "./routes/upload.js";

import dotenv from "dotenv";
dotenv.config();

connectDB();
const app = express();
app.use(express.json());
app.use(cors());

app.use("/auth", authRouter);
app.use("/users", userRouter);
app.use("/admin", adminRouter);
app.use("/api", uploadRouter);

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
