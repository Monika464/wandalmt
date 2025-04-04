import Product from "../models/product.js";
import { validationResult } from "express-validator";
import { Request, Response, NextFunction } from "express";

import Resource from "../models/resource.js";

export const createProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
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

    // 3️⃣ Aktualizujemy produkt o resourceId
    newProduct.resourceId = newResource._id as typeof newProduct.resourceId;
    await newProduct.save();

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
};

export const getEditProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const prodId = req.params.productId;
    // console.log("prodId", prodId);

    const product = await Product.findById(prodId);
    //console.log("product", product);
    res.status(201).json({
      message: "Product fetched successfully",
      product: product,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
};
export const postEditProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res
        .status(400)
        .json({ message: "Invalid input", errors: errors.array() });
      return;
    }

    const { productId, title, price, description } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    // Additional logic here...

    // Odkomentuj gdy zaimplementujesz autoryzację
    // if (product.userId.toString() !== req.user.id) {
    //   return res.status(403).json({ message: "Not authorized" });
    // }

    product.title = title;
    product.price = price;
    product.description = description;

    await product.save();

    res.status(200).json({ message: "Product updated successfully", product });
    return;
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
    return;
  }
};
// export const postEditProduct = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res
//         .status(400)
//         .json({ message: "Invalid input", errors: errors.array() });
//     }

//     const { productId, title, price, description } = req.body;
//     //const image = req.file; // Jeśli plik został przesłany

//     // Pobranie produktu z bazy
//     const product = await Product.findById(productId);
//     if (!product) {
//       return res.status(404).json({ message: "Product not found" });
//     }

//     // Sprawdzenie, czy użytkownik jest właścicielem produktu
//     // if (product.userId.toString() !== req.user.id) {
//     //   return res.status(403).json({ message: "Not authorized" });
//     // }

//     // Aktualizacja pól
//     product.title = title;
//     product.price = price;
//     product.description = description;

//     // Jeśli przesłano nowy obraz, usuń stary
//     // if (image) {
//     //   deleteFile(product.imageUrl); // Usunięcie starego pliku
//     //   product.imageUrl = image.path; // Zapis nowej ścieżki
//     // }

//     // Zapis do bazy danych
//     await product.save();

//     return res
//       .status(200)
//       .json({ message: "Product updated successfully", product });
//   } catch (error) {
//     //next(error);
//     console.error(error);
//     return res.status(500).json({ message: "Internal server error" });
//   }
// };
