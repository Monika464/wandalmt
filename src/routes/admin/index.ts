import express from "express";
import userRoutes from "./users.js";
import productRoutes from "./products.js";

const router = express.Router();

// Teraz /admin/users/... → /admin/delete-user/:id
router.use("/", userRoutes);
router.use("/", productRoutes);

export default router;
