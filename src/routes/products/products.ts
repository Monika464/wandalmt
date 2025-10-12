import { fetchProduct } from "controllers/products/productsControllers.js";
import { fetchProducts } from "controllers/products/productsControllers.js";
import express from "express";

const router = express.Router();

//fetch products
router.get("/products", fetchProducts);

//fetch product
router.get("/products/:id", fetchProduct);

export default router;
