import express from "express";
import { adminAuth } from "../../middleware/auth.js";

import {
  addChapterToResource,
  createProduct,
  deleteChapterFromResource,
  deleteProduct,
  editResource,
  fetchUserResources,
  getEditProduct,
  postEditProduct,
  updateChapterInResource,
} from "../../controllers/admin/productsController.js";
import { body } from "express-validator";

const router = express.Router();

router.post("/products", createProduct);

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

router.put("/edit-resource/:resourceId", adminAuth, editResource);
router.post("/resources/:id/chapters", adminAuth, addChapterToResource);
router.patch(
  "/resources/:id/chapters/:chapterIndex",
  adminAuth,
  updateChapterInResource
);
router.delete(
  "/resources/:id/chapters/:chapterIndex",
  adminAuth,
  deleteChapterFromResource
);

// router.delete("/delete-user/:userId", adminAuth, deleteUser);
router.delete("/delete-product/:productId", adminAuth, deleteProduct);

router.get("/resources/:userId", adminAuth, fetchUserResources);

export default router;
