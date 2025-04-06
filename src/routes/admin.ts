import express from "express";
import Product from "../models/product.js";
import Resource from "../models/resource.js";
import { userAuth, adminAuth } from "../middleware/auth.js";
import User from "../models/user.js";

import {
  addChapterToResource,
  createProduct,
  deleteChapterFromResource,
  deleteProduct,
  deleteUser,
  editResource,
  getEditProduct,
  postEditProduct,
  updateChapterInResource,
} from "../controllers/admin.js";
import { body } from "express-validator";

const router = express.Router();

// Tworzenie produktu + powiązanego zasobu
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
router.post("/resources/:id/chapters", addChapterToResource);
router.patch("/resources/:id/chapters/:chapterIndex", updateChapterInResource);
router.delete(
  "/resources/:id/chapters/:chapterIndex",
  deleteChapterFromResource
);

router.delete("/delete-user/:userId", adminAuth, deleteUser);
router.delete("/delete-product/:productId", deleteProduct);

router.get("/users", adminAuth, async (req, res) => {
  try {
    const users = await User.find({ role: "user" }); // Filtrujemy użytkowników z rolą "user"
    res.status(200).send(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send({ error: "Błąd serwera" });
  }
});

router.get("/resources/:userId", userAuth, async (req, res) => {
  try {
    const { id } = req.params;
    //const userId = req.user._id;
    const resources = await Resource.find({ userIds: id }).populate(
      "productId"
    );
    res.json(resources);
  } catch (error) {
    res.status(500).json({ error: "Error fetching resources" });
  }
});

export default router;
