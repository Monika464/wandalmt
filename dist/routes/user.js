import express from "express";
//import User from "../models/user.js";
//import { Request, Response, NextFunction } from "express";
import { addToCartHandler } from "../controllers/user.js";
import { userAuth } from "../middleware/auth.js";
// interface AuthRequest extends Request {
//   user?: any;
// }
import Product from "../models/product.js";
const router = express.Router();
router.get("/products", async (req, res) => {
    try {
        const products = await Product.find(); // Pobiera wszystkie produkty z bazy
        res.status(200).json(products);
    }
    catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Unknown error occurred",
        });
    }
});
// const addToCartHandler = async (
//   req: AuthRequest,
//   res: Response
// ): Promise<void> => {
//   try {
//     if (!req.user) {
//       res.status(401).json({ error: "Musisz być zalogowany" });
//       return;
//     }
//     const product = await Product.findById(req.body.productId);
//     //return res.status(404).json({ error: "Produkt nie znaleziony" });
//     if (!product) {
//       res.status(404).json({ error: "Produkt nie znaleziony" });
//       return;
//     }
//     console.log("czy jest user", req.user);
//     await req.user.addToCart(product._id);
//     res
//       .status(200)
//       .json({ message: "Produkt dodany do koszyka", cart: req.user.cart });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Wystąpił błąd" });
//   }
// };
router.post("/cart/add", userAuth, addToCartHandler);
export default router;
