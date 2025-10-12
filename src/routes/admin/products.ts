import express from "express";
import { adminAuth } from "../../middleware/auth.js";

import {
  createProduct,
  deleteProduct,
  fetchProduct,
  fetchProducts,
  getEditProduct,
  postEditProduct,
} from "../../controllers/admin/productsController.js";

import { body } from "express-validator";

const router = express.Router();

//create product
router.post("/products", adminAuth, createProduct);

//fetch products
router.get("/products", adminAuth, fetchProducts);

//fetch product
router.get("/products/:id", adminAuth, fetchProduct);

//edit product
router.put("/products/:productId", adminAuth, postEditProduct);
router.get("/products/:productId", adminAuth, getEditProduct);

router.get("/edit-product/:productId", adminAuth, getEditProduct);

router.patch(
  "/edit-product/:productId",
  [
    body("productId").isMongoId(),
    body("title").isString().isLength({ min: 2 }).trim(),
    body("price").isFloat({ gt: 0 }),
    body("description").isLength({ min: 4, max: 400 }).trim(),
  ],
  adminAuth,
  postEditProduct
);

router.delete("/products/:productId", adminAuth, deleteProduct);

export default router;
