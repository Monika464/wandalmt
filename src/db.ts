import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();
//mongoose.set("debug", true);

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/wandaldatabase";

export const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    mongoose.set("strictQuery", true);
    console.log("✅ Connected to MongoDB");
    console.log("📊 Database name:", mongoose.connection.name);
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};
