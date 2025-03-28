import mongoose from "mongoose";



const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/wandaldatabase";


export const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Połączono z MongoDB");
  } catch (error) {
    console.error("❌ Błąd połączenia z MongoDB:", error);
    process.exit(1);
  }
};
