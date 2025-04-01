var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import Product from "../models/product.js";
export const addToCartHandler = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user) {
            res.status(401).json({ error: "Musisz być zalogowany" });
            return;
        }
        const product = yield Product.findById(req.body.productId);
        //return res.status(404).json({ error: "Produkt nie znaleziony" });
        if (!product) {
            res.status(404).json({ error: "Produkt nie znaleziony" });
            return;
        }
        yield req.user.addToCart(product._id);
        res
            .status(200)
            .json({ message: "Produkt dodany do koszyka", cart: req.user.cart });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Wystąpił błąd" });
    }
});
