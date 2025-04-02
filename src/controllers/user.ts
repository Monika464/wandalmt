import { Request, Response, NextFunction } from "express";
import { adminAuth, AuthRequest, userAuth } from "../middleware/auth.js";
import Product from "../models/product.js";

export const addToCartHandler = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Musisz być zalogowany" });
      return;
    }

    const product = await Product.findById(req.body.productId);

    //return res.status(404).json({ error: "Produkt nie znaleziony" });
    if (!product) {
      res.status(404).json({ error: "Produkt nie znaleziony" });
      return;
    }

    await req.user.addToCart(product._id);
    res
      .status(200)
      .json({ message: "Produkt dodany do koszyka", cart: req.user.cart });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Wystąpił błąd" });
  }
};

export const deleteCartProductHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    //console.log("req-user", req.user);
    const prodId = req.body.productId;
    //console.log("product id do usuniecia", prodId);
    req.user.removeFromCart(prodId);
    res.status(200).json({ message: "Produkt usunięty z koszyka" });
  } catch (error) {
    console.error("Błąd podczas usuwania produktu z koszyka:", error);
    res.status(500).json({ error: "Wystąpił błąd" });
    return;
  }
};
