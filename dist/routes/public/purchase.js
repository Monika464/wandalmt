// import express, { Request, Response } from "express";
// import Purchase, { IPurchase } from "../../models/purchase.js";
// import Product, { IProduct } from "../../models/product.js";
// import mongoose from "mongoose";
export {};
// const router = express.Router();
// router.get("/purchase", async (req: Request, res: Response) => {
//   console.log("🔍 purchase backend");
//   const session_id = req.query.session_id as string;
//   if (!session_id) {
//     return res
//       .status(400)
//       .json({ status: "error", message: "session_id is required" });
//   }
//   try {
//     console.log("🔍 backsession_id:", session_id);
//     // findOne i populate z typowaniem
//     const purchase = await Purchase.findOne({ sessionId: session_id }).populate<
//       IPurchase & { productId: IProduct }
//     >("productId");
//     console.log("🔍 Found purchase back:", purchase);
//     if (!purchase) {
//       return res.status(404).json({ status: "not found", items: [] });
//     }
//     res.json({
//       status: purchase.status,
//       items: [
//         {
//           productName: purchase.productId.title,
//           amount: purchase.amount,
//         },
//       ],
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ status: "error", message: "Internal server error" });
//   }
// });
// export default router;
