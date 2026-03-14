import Product from "../../models/product.js";
import { validationResult } from "express-validator";
import { Request, Response, NextFunction } from "express";
import Resource from "../../models/resource.js";

export const fetchProducts = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  console.log("📦 fetchProducts called");
  try {
    const { q, language } = req.query; //

    interface Filter {
      language?: string;
      title?: { $regex: string; $options: string };
    }

    let filter: Filter = {};

    if (language && typeof language === "string") {
      filter.language = language;
    }

    if (q && typeof q === "string") {
      filter = { title: { $regex: q, $options: "i" } };
    }

    const products = await Product.find(filter);
    console.log(`✅ Found ${products.length} products`);
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
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }
    res.status(200).send(product);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).send({ error: "Błąd serwera" });
  }
};

//FETCH PRODUCTS OF SINGLE USER
export const fetchUserProducts = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { userId } = req.params;
    const resources = await Resource.find({ userIds: userId }).populate(
      "productId",
    );
    res.status(200).send(resources);
  } catch (error) {
    console.error("Error fetching user products:", error);
    res.status(500).send({ error: "Błąd serwera" });
  }
};

//CREATE PRODUCT
export const createProduct = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { title, description, price, imageUrl, language } = req.body;

    if (!title || !description || !price || !imageUrl || !language) {
      res.status(400).json({
        error: "Missing required fields",
        missingFields: {
          title: !title,
          description: !description,
          price: !price,
          imageUrl: !imageUrl,
          language: !language,
        },
      });
      return;
    }

    // CREATE NEW PRODUCT
    const newProduct = new Product({
      title,
      description,
      price,
      imageUrl,
      language,
      status: "draft",
    });

    await newProduct.save();

    res.status(201).json({
      message: "Product created successfully",
      product: newProduct,
    });
  } catch (error) {
    console.error("❌ Error creating product:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
};

//GET PRODUCT FOR EDITING
export const getEditProduct = async (req: Request, res: Response) => {
  try {
    const prodId = req.params.productId;
    // console.log("prodId", prodId);

    const product = await Product.findById(prodId);
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    //console.log("product", product);
    res.status(201).json({
      message: "Product fetched successfully",
      product,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
};

//EDIT PRODUCT
export const postEditProduct = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res
        .status(400)
        .json({ message: "Invalid input", errors: errors.array() });
      return;
    }

    const prodId = req.params.productId;
    const { title, price, description, imageUrl, language } = req.body;

    const product = await Product.findById(prodId);
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    product.title = title;
    product.price = price;
    product.description = description;
    product.language = language;
    product.imageUrl = imageUrl;

    await product.save();

    res.status(200).json({ message: "Product updated successfully", product });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
};

//DELETE PRODUCT
export const deleteProduct = async (
  req: Request,
  res: Response,
  next: NextFunction,
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
