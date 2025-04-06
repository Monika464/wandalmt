import Product from "../models/product.js";
export const addToCartHandler = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: "You must be logged in" });
            return;
        }
        const product = await Product.findById(req.body.productId);
        //return res.status(404).json({ error: "Produkt nie znaleziony" });
        if (!product) {
            res.status(404).json({ error: "Product not found" });
            return;
        }
        await req.user.addToCart(product._id);
        res
            .status(200)
            .json({ message: "Product added to cart", cart: req.user.cart });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "An error has occurred" });
    }
};
export const deleteCartProductHandler = async (req, res, next) => {
    try {
        //console.log("req-user", req.user);
        const prodId = req.body.productId;
        //console.log("product id do usuniecia", prodId);
        req.user.removeFromCart(prodId);
        res.status(200).json({ message: "Product removed from cart" });
    }
    catch (error) {
        console.error("Product removed from cart:", error);
        res.status(500).json({ error: "An error has occurred" });
        return;
    }
};
