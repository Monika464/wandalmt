import mongoose from "mongoose";
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

// export const postEditProduct = async (req, res, next) => {
//   const prodId = req.body.productId;
//   const updatedTitle = req.body.title;
//   const updatedPrice = req.body.price;
//   const updatedDesc = req.body.description;
//   const errors = validationResult(req);
//   const image = req.file;

//   Product.findById(prodId)
//     .then((product) => {
//       if (product.userId.toString() !== req.user._id.toString()) {
//         return res.redirect("/");
//       }
//       product.title = updatedTitle;
//       product.price = updatedPrice;
//       product.description = updatedDesc;

//       if (image) {
//         deleteFile(product.imageUrl);
//         product.imageUrl = image.path;
//       }
//       return product.save().then((result) => {
//         console.log("UPDATED PRODUCT!");
//         res.redirect("/admin/products");
//       });
//     })
//     .catch((err) => console.log(err));
// };
