import express from "express";
import cors from "cors";
import { connectDB } from "./db.js";
import authRouter from "./routes/auth.js";
import productRouter from "./routes/admin.js";
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

import { S3Client, ListObjectsCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "eu-central-003", // Musi być dokładnie taki jak w endpointzie
  credentials: {
    accessKeyId: process.env.B2_KEY_ID!, // applicationKey z Backblaze (K003...)
    secretAccessKey: process.env.B2_APP_KEY!, // keyID z Backblaze (003...)
  },
  endpoint: "https://s3.eu-central-003.backblazeb2.com", // Endpoint z Twojego bucketa
  forcePathStyle: true, // Wymagane dla Backblaze
});

const test = async () => {
  try {
    const data = await s3.send(
      new ListObjectsCommand({ Bucket: process.env.B2_BUCKET_NAME! })
    );
    console.log(
      "✅ Połączenie działa! Obiekty w buckecie:",
      data.Contents || "Brak plików"
    );
  } catch (err) {
    if (err instanceof Error) {
      console.error("❌ Błąd połączenia:", err.message);
    } else {
      console.error("❌ Błąd połączenia:", err);
    }
  }
};

test();

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
