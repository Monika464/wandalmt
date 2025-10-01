import Product from "../../models/product.js";
import { validationResult } from "express-validator";
import { Request, Response, NextFunction } from "express";
import Resource from "../../models/resource.js";

//FETCH PRODUCTS
export const fetchProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const products = await Product.find();
    res.status(200).send(products);
    console.log("products", products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).send({ error: "Błąd serwera" });
  }
};

//FETCH PRODUCTS OF SINGLE USER
export const fetchUserProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;
    const resources = await Resource.find({ userIds: userId }).populate(
      "productId"
    );
    res.status(200).send(resources);
  } catch (error) {
    console.error("Error fetching user products:", error);
    res.status(500).send({ error: "Błąd serwera" });
  }
};

//FETCH RESOURCES OF SINGLE USER
export const fetchUserResources = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;
    const resources = await Resource.find({ userIds: userId });
    res.status(200).send(resources);
  } catch (error) {
    console.error("Error fetching user resources:", error);
    res.status(500).send({ error: "Błąd serwera" });
  }
};

//CREATE PRODUCT AND RESOURCE
export const createProduct = async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      price,
      resourceTitle,
      imageUrl,
      content,
      videoUrl = "",
    } = req.body;

    // 1️⃣ Tworzymy nowy produkt
    const newProduct = new Product({
      title,
      description,
      price,
      content,
      imageUrl,
      status: "draft", // Domyślny status
    });
    await newProduct.save();

    // 2️⃣ Tworzymy powiązany zasób i przypisujemy mu `productId`
    const newResource = new Resource({
      title: resourceTitle || title,
      imageUrl,
      videoUrl,
      content,
      productId: newProduct._id,
    });

    await newProduct.save();

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
  res: Response
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
    const { title, price, description, imageUrl, content } = req.body;

    const product = await Product.findById(prodId);
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    product.title = title;
    product.price = price;
    product.description = description;
    product.imageUrl = imageUrl;
    product.content = content;

    await product.save();

    res.status(200).json({ message: "Product updated successfully", product });
  } catch (error) {
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

    const updateData = req.body;

    // ✅ Only these fields can be updated
    if (typeof updateData.title === "string") {
      resource.title = updateData.title;
    }

    if (typeof updateData.imageUrl === "string") {
      resource.imageUrl = updateData.imageUrl;
    }

    if (typeof updateData.content === "string") {
      resource.content = updateData.content;
    }

    if (typeof updateData.videoUrl === "string") {
      resource.videoUrl = updateData.videoUrl;
    }

    // ✅ Update chapters (if provided)
    if (updateData.chapters) {
      if (!Array.isArray(updateData.chapters)) {
        throw new Error("Chapters must be an array");
      }

      if (updateData.chapters.length > 100) {
        throw new Error("Maximum of 100 chapters allowed");
      }

      resource.chapters = updateData.chapters;
    }

    await resource.save();

    res.status(200).json({
      message: "Resource updated successfully",
      resource,
    });
  } catch (err) {
    if (err instanceof Error) {
      res
        .status(500)
        .json({ error: "Error updating resource: " + err.message });
    } else {
      res.status(500).json({ error: "Unknown server error" });
    }
  }
};

export const addChapterToResource = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { videoUrl, description } = req.body;

  try {
    const resource = await Resource.findById(id);
    if (!resource) {
      res.status(404).json({ error: "Resource not found" });
      return;
    }

    if (!resource.chapters) resource.chapters = [];

    if (resource.chapters.length >= 100) {
      res
        .status(400)
        .json({ error: "Maximum number of chapters reached (100)" });
      return;
    }
    resource.chapters.push({ videoUrl, description });
    await resource.save();

    res
      .status(200)
      .json({ message: "Chapter added", chapters: resource.chapters });
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Server error" });
    return;
  }
};

export const updateChapterInResource = async (req: Request, res: Response) => {
  const { id, chapterIndex } = req.params;
  const { videoUrl, description } = req.body;

  try {
    const resource = await Resource.findById(id);
    if (!resource) {
      res.status(404).json({ error: "Resource not found" });
      return;
    }

    const index = parseInt(chapterIndex);
    if (
      isNaN(index) ||
      index < 0 ||
      !resource.chapters ||
      index >= resource.chapters.length
    ) {
      res.status(400).json({ error: "Invalid chapter index" });
      return;
    }

    // Zaktualizuj tylko podane pola
    if (videoUrl !== undefined) {
      resource.chapters[index].videoUrl = videoUrl;
    }
    if (description !== undefined) {
      resource.chapters[index].description = description;
    }

    await resource.save();
    res.status(200).json({
      message: "Chapter updated",
      chapter: resource.chapters[index],
    });
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Server error" });
  }
};

//DELETE CHAPTER FROM RESOURCE
export const deleteChapterFromResource = async (
  req: Request,
  res: Response
) => {
  const { id, chapterIndex } = req.params;

  try {
    const resource = await Resource.findById(id);
    if (!resource) {
      res.status(404).json({ error: "Resource not found" });
      return;
    }

    const index = parseInt(chapterIndex);
    if (
      isNaN(index) ||
      index < 0 ||
      index >= (resource.chapters?.length || 0)
    ) {
      res.status(400).json({ error: "Invalid chapter index" });
      return;
    }

    resource.chapters?.splice(index, 1);
    await resource.save();

    res
      .status(200)
      .json({ message: "Chapter deleted", chapters: resource.chapters });
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Server error" });
  }
};
