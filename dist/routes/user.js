var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import express from "express";
//import User from "../models/user.js";
//import { Request, Response, NextFunction } from "express";
import { addToCartHandler } from "../controllers/user.js";
// interface AuthRequest extends Request {
//   user?: any;
// }
import { userAuth } from "../controllers/auth.js";
import Product from "../models/product.js";
const router = express.Router();
router.get("/products", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const products = yield Product.find(); // Pobiera wszystkie produkty z bazy
        res.status(200).json(products);
    }
    catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Unknown error occurred",
        });
    }
}));
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
