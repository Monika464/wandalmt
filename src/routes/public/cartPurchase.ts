// import express, { Request, Response } from "express";
// import mongoose from "mongoose";
// import Order from "../../models/order.js"; // upewnij się, że ścieżka jest poprawna
// import authenticate from "../../middleware/auth.js";

// const router = express.Router();

// interface ProductItem {
//   title: string;
//   price: number;
//   description?: string;
//   imageUrl?: string;
//   content?: string;
//   userId: mongoose.Types.ObjectId;
//   quantity: number;
// }

// interface UserData {
//   email: string;
//   userId: mongoose.Types.ObjectId;
// }

// interface CartPurchaseRequest extends Request {
//   body: {
//     items: ProductItem[];
//     user: UserData;
//   };
// }

// // POST /cart-purchase
// router.post(
//   "/cart-purchase",
//   authenticate,
//   async (req: CartPurchaseRequest, res: Response) => {
//     try {
//       const { items, user } = req.body;

//       if (!items || items.length === 0) {
//         return res.status(400).json({ error: "Brak produktów do zapisania" });
//       }

//       if (!user?.email || !user?.userId) {
//         return res.status(400).json({ error: "Brak danych użytkownika" });
//       }

//       const order = new Order({
//         products: items.map((item) => ({
//           product: {
//             title: item.title,
//             price: item.price,
//             description: item.description || "",
//             imageUrl: item.imageUrl || "",
//             content: item.content || "",
//             userId: item.userId,
//           },
//           quantity: item.quantity,
//         })),
//         user: {
//           email: user.email,
//           userId: user.userId,
//         },
//       });

//       await order.save();
//       res.json({ success: true, order });
//     } catch (err) {
//       console.error("❌ Błąd podczas zapisu zamówienia:", err);
//       res.status(500).json({ error: "Błąd serwera podczas zapisu zamówienia" });
//     }
//   }
// );

// export default router;
