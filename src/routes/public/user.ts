import express from "express";

import {
  addToCartHandler,
  deleteCartProductHandler,
} from "../../controllers/user.js";
import { userAuth } from "../../middleware/auth.js";
// interface AuthRequest extends Request {
//   user?: any;
// }

import Product from "../../models/product.js";

const router = express.Router();

router.get("/products", async (req, res) => {
  try {
    const products = await Product.find();
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
});

router.post("/cart/add", userAuth, addToCartHandler);
router.post("/cart/delete", userAuth, deleteCartProductHandler);

export default router;
