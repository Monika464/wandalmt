import mongoose from "mongoose";
import dotenv from "dotenv";
//dotenv.config();
//mongoose.set("debug", true);
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ========== LOADING .env ==========
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envFile = process.env.NODE_ENV === 'production' 
  ? '.env' 
  : '.env.development.local';



dotenv.config({ 
  path: join(__dirname, '..', envFile) 
});
// =====================================

const MONGO_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/wandaldatabase";

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
