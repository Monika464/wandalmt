var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import express from "express";
import Product from "../models/product.js";
import Resource from "../models/resource.js";
const router = express.Router();
// Tworzenie produktu + powiązanego zasobu
router.post("/products", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("reqbody", req.body);
    // next();
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
        yield newProduct.save();
        // 2️⃣ Tworzymy powiązany zasób i przypisujemy mu `productId`
        const newResource = new Resource({
            title: resourceTitle,
            imageUrl,
            videoUrl,
            content,
            productId: newProduct._id,
        });
        yield newResource.save();
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
}));
export default router;
