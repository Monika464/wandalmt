import express from "express";
import Product from "../models/product.js";
import Resource from "../models/resource.js";
import { userAuth } from "controllers/auth.js";

const router = express.Router();

// Tworzenie produktu + powiązanego zasobu
router.post("/products", async (req, res, next) => {
  //console.log("reqbody", req.body);
  // next();
  try {
    const {
      title,
      description,
      price,
      resourceTitle,
      imageUrl,
      content,
      videoUrl,
    } = req.body;

    // 1️⃣ Tworzymy nowy produkt
    const newProduct = new Product({
      title,
      description,
      price,
      content,
      imageUrl,
    });
    await newProduct.save();

    // 2️⃣ Tworzymy powiązany zasób i przypisujemy mu `productId`
    const newResource = new Resource({
      title: resourceTitle,
      imageUrl,
      videoUrl,
      content,
      productId: newProduct._id,
    });

    await newResource.save();

    res.status(201).json({
      message: "Product and Resource created successfully",
      product: newProduct,
      resource: newResource,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
});

// router.get("/resources", userAuth, async (req, res) => {
//   try {
//     const userId = req.user._id;
//     const resources = await Resource.find({ userIds: userId }).populate(
//       "productId"
//     );
//     res.json(resources);
//   } catch (error) {
//     res.status(500).json({ error: "Error fetching resources" });
//   }
// });

export default router;
