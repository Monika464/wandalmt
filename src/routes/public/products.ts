import { fetchProduct } from "controllers/public/productsControllers.js";
import { fetchProducts } from "controllers/public/productsControllers.js";
import express from "express";

const router = express.Router();

//fetch products
router.get("/products", fetchProducts);

//fetch product
router.get("/products/:id", fetchProduct);

export default router;
