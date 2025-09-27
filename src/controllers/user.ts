import { Request, Response, NextFunction } from "express";
import { adminAuth, AuthRequest, userAuth } from "../middleware/auth.js";
import Product from "../models/product.js";
import { IUser } from "models/user.js";

// interface IAuthRequest extends Request {
//   body: IAuthRequestBody;
//   user?: IUser | null;
//   token?: string;
// }

// interface IAuthRequestBody {
//   email: string;
//   password: string;
//   name?: string;
//   surname?: string;
//   role?: "user" | "admin";
// }

interface IDeleteCartProductRequest extends AuthRequest {
  body: {
    productId: string;
  };
}

export const addToCartHandler = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
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

    await req.user.addToCart(product._id as import("mongoose").Types.ObjectId);
    res
      .status(200)
      .json({ message: "Product added to cart", cart: req.user.cart });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error has occurred" });
  }
};

export const deleteCartProductHandler = async (
  req: IDeleteCartProductRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    //console.log("req-user", req.user);
    const prodId = req.body.productId;
    //console.log("product id do usuniecia", prodId);
    if (!req.user) {
      res.status(401).json({ error: "You must be logged in" });
      return;
    }
    req.user.removeFromCart(prodId);
    res.status(200).json({ message: "Product removed from cart" });
  } catch (error) {
    console.error("Product removed from cart:", error);
    res.status(500).json({ error: "An error has occurred" });
    return;
  }
};
