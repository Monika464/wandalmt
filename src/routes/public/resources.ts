import { getResourceByProductId } from "controllers/public/resourceControllers.js";
import express from "express";
const router = express.Router();

router.get("/resources/:productId", getResourceByProductId);

export default router;
