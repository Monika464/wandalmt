import express from "express";
import Product from "../models/product.js";
import Resource from "../models/resource.js";
import { userAuth, adminAuth } from "../controllers/auth.js";
import User from "../models/user.js";

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

//console.log("admin auth", adminAuth);
//console.log("user auth", userAuth);
// Admin: Zarządzanie produktami
// router.get("/admin/products", adminAuth, async (req, res) => {
//   res.send("Lista produktów dla admina");
// });

// // User: Przeglądanie i kupowanie produktów
// router.get("/user/products", userAuth, async (req, res) => {
//   res.send("Lista produktów dla użytkownika");
// });

// Pobieranie wszystkich użytkowników z rolą "user"
router.get("/users", adminAuth, async (req, res) => {
  console.log("router.get('/users') - wywołano");
  console.log("root dziala");
  try {
    const users = await User.find({ role: "user" }); // Filtrujemy użytkowników z rolą "user"
    res.status(200).send(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send({ error: "Błąd serwera" });
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
