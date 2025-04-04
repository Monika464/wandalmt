import Product from "../models/product.js";
import { validationResult } from "express-validator";
import Resource from "../models/resource.js";
import User from "../models/user.js";
export const createProduct = async (req, res, next) => {
    try {
        const { title, description, price, resourceTitle, imageUrl, content, videoUrl, } = req.body;
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
        newProduct.resourceId = newResource._id;
        await newProduct.save();
        res.status(201).json({
            message: "Product and Resource created successfully",
            product: newProduct,
            resource: newResource,
        });
    }
    catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Unknown error occurred",
        });
    }
};
export const getEditProduct = async (req, res, next) => {
    try {
        const prodId = req.params.productId;
        // console.log("prodId", prodId);
        const product = await Product.findById(prodId);
        //console.log("product", product);
        res.status(201).json({
            message: "Product fetched successfully",
            product: product,
        });
    }
    catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Unknown error occurred",
        });
    }
};
export const postEditProduct = async (req, res, next) => {
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
    }
    catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Unknown error occurred",
        });
        return;
    }
};
export const deleteUser = async (req, res, next) => {
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
    }
    catch (error) {
        console.error(error);
        res.status(500).json({
            error: error instanceof Error ? error.message : "Unknown error occurred",
        });
    }
};
export const deleteProduct = async (req, res, next) => {
    try {
        const { productId } = req.params;
        const product = await Product.findById(productId);
        if (!product) {
            res.status(404).json({ message: "Product not found" });
            return;
        }
        await Product.deleteOne({ _id: productId });
        res.status(200).json({ message: "Product deleted successfully" });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({
            error: error instanceof Error ? error.message : "Unknown error occurred",
        });
    }
};
//EDITING RESOURCE
export const editResource = async (req, res, next) => {
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
        // ✅ Tylko te pola można aktualizować
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
        // ✅ Aktualizacja rozdziałów (jeśli są podane)
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
    }
    catch (err) {
        if (err instanceof Error) {
            res
                .status(500)
                .json({ error: "Error updating resource: " + err.message });
        }
        else {
            res.status(500).json({ error: "Unknown server error" });
        }
    }
};
export const addChapterToResource = async (req, res) => {
    const { id } = req.params;
    const { videoUrl, description } = req.body;
    try {
        const resource = await Resource.findById(id);
        if (!resource) {
            res.status(404).json({ error: "Resource not found" });
            return;
        }
        if (!resource.chapters)
            resource.chapters = [];
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
    }
    catch (err) {
        res
            .status(500)
            .json({ error: err instanceof Error ? err.message : "Server error" });
        return;
    }
};
export const updateChapterInResource = async (req, res) => {
    const { id, chapterIndex } = req.params;
    const { videoUrl, description } = req.body;
    try {
        const resource = await Resource.findById(id);
        if (!resource) {
            res.status(404).json({ error: "Resource not found" });
            return;
        }
        const index = parseInt(chapterIndex);
        if (isNaN(index) ||
            index < 0 ||
            !resource.chapters ||
            index >= resource.chapters.length) {
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
    }
    catch (err) {
        res
            .status(500)
            .json({ error: err instanceof Error ? err.message : "Server error" });
    }
};
export const deleteChapterFromResource = async (req, res) => {
    const { id, chapterIndex } = req.params;
    try {
        const resource = await Resource.findById(id);
        if (!resource) {
            res.status(404).json({ error: "Resource not found" });
            return;
        }
        const index = parseInt(chapterIndex);
        if (isNaN(index) ||
            index < 0 ||
            index >= (resource.chapters?.length || 0)) {
            res.status(400).json({ error: "Invalid chapter index" });
            return;
        }
        resource.chapters?.splice(index, 1);
        await resource.save();
        res
            .status(200)
            .json({ message: "Chapter deleted", chapters: resource.chapters });
    }
    catch (err) {
        res
            .status(500)
            .json({ error: err instanceof Error ? err.message : "Server error" });
    }
};
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
