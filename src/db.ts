import mongoose from "mongoose";

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/wandaldatabase";

export const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      autoCreate: false, // 🟢 NIE twórz automatycznie baz/kolekcji
      autoIndex: false, // 🟢 NIE twórz automatycznie indeksów
      // maxPoolSize: 10,       // opcjonalnie
      // serverSelectionTimeoutMS: 5000 // opcjonalnie
    });
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};

// import mongoose from "mongoose";

// const MONGO_URI =
//   process.env.MONGO_URI || "mongodb://localhost:27017/wandaldatabase";

// export const connectDB = async () => {
//   try {
//     await mongoose.connect(MONGO_URI);
//     console.log("✅ Conntected to MongoDB");
//   } catch (error) {
//     console.error("❌ MongoDB connection error:", error);
//     process.exit(1);
//   }
// };
