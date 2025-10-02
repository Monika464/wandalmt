import express from "express";
import userRoutes from "./users.js";
import productRoutes from "./products.js";
import resourceRoutes from "./resources.js";

const router = express.Router();

// Teraz /admin/users/... → /admin/delete-user/:id
router.use("/", userRoutes);
router.use("/", productRoutes);
router.use("/", resourceRoutes);

export default router;
