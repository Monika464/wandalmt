import Product from "../../models/product.js";
import { validationResult } from "express-validator";
import { Request, Response, NextFunction } from "express";
import Resource from "../../models/resource.js";

export const fetchProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { q } = req.query; // np. ?q=sword

    let filter = {};
    if (q && typeof q === "string") {
      // dopasowanie po nazwie (np. "sword") – case-insensitive
      filter = { title: { $regex: q, $options: "i" } };
    }

    const products = await Product.find(filter);
    console.log("prod", products);

    res.status(200).send(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).send({ error: "Błąd serwera" });
  }
};

//FETCH SINGLE PRODUCT
export const fetchProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    //console.log("id product", id);
    const product = await Product.findById(id);
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }
    res.status(200).send(product);
    //res.status(200).send(product);
    //console.log("product", product);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).send({ error: "Błąd serwera" });
  }
};
