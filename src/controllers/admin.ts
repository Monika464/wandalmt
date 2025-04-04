import Product from "../models/product.js";
import { validationResult } from "express-validator";
import { Request, Response, NextFunction } from "express";

import Resource from "../models/resource.js";
import User from "../models/user.js";

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

export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;

    // Szukamy użytkownika w bazie danych
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Usuwamy użytkownika
    await User.deleteOne({ _id: userId });

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
};

export const deleteProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    await Product.deleteOne({ _id: productId });

    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
};
//EDITING RESOURCE

// Zmiana zasobu - wgrywanie nowych rozdziałów

export const editResource = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { resourceId } = req.params;
    console.log("resourceId", resourceId);
    console.log("reqbody", req.body);

    const resource = await Resource.findById(resourceId);

    if (!resource) {
      res.status(404).json({ message: "Resource not found" });
      return;
    }

    // Pobierz dane aktualizacji z ciała żądania
    const updateData = req.body;

    // Zablokuj modyfikację pól, których nie wolno zmieniać
    const protectedFields = [
      "title",
      "imageUrl",
      "content",
      "videoUrl",
      "productId",
      "userIds",
    ];
    for (const field of protectedFields) {
      if (updateData.hasOwnProperty(field)) {
        delete updateData[field];
      }
    }

    // Obsługa aktualizacji rozdziałów
    if (updateData.chapters) {
      if (!Array.isArray(updateData.chapters)) {
        throw new Error("Chapters must be an array");
      }

      if (updateData.chapters.length > 100) {
        throw new Error("Maximum of 100 chapters allowed");
      }

      resource.chapters = updateData.chapters; // zastępuje istniejące
    }

    await resource.save();
    res.status(200).json({
      message: "Resource updated successfully",
      resource,
    });
  } catch (err) {
    if (err instanceof Error) {
      throw new Error("Error updating resource: " + err.message);
    } else {
      throw new Error("Error updating resource: Unknown error occurred");
    }
  }
};

//

////////////////////////////////////////
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
