import express from "express";
import cors from "cors";
import { connectDB } from "./db.js";
import authRouter from "./routes/auth.js";
import adminRouter from "./routes/admin.js";
import userRouter from "./routes/user.js";
import dotenv from "dotenv";
dotenv.config();
connectDB();
const app = express();
app.use(express.json());
app.use(cors());
app.use("/auth", authRouter);
app.use("/users", userRouter);
app.use("/admin", adminRouter);
// app.use(authRouter);
// //app.use("/admin", productRouter);
// app.use(userRouter);
// app.use(adminRouter);
// app.get("/", (req, res) => {
//   res.send("Hello World!");
// });
app.listen(3000, () => {
    console.log("Server is running on port 3000");
});
