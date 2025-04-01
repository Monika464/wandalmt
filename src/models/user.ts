import mongoose, { Document, Schema, Model } from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  password: string;
  name: string;
  surname: string;
  role: "user" | "admin";
  resources: mongoose.Types.ObjectId[];
  cart: {
    items: ICartItem[];
  };
  generateAuthToken(): Promise<string>;
  addToCart(productId: mongoose.Types.ObjectId): Promise<IUser>;
}

interface ICartItem {
  productId: mongoose.Types.ObjectId;
  quantity: number;
}

interface IUserModel extends Model<IUser> {
  findByCredentials(email: string, password: string): Promise<IUser>;
}

const userSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  surname: {
    type: String,
    required: true,
  },
  role: { type: String, enum: ["user", "admin"], default: "user" },
  resources: [
    {
      type: Schema.Types.ObjectId,
      ref: "Resource",
    },
  ],
  cart: {
    items: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: { type: Number, required: true },
      },
    ],
  },
});

// Statyczna metoda do wyszukiwania użytkownika po e-mailu i haśle
userSchema.statics.findByCredentials = async function (
  email: string,
  password: string
): Promise<IUser> {
  const user = await this.findOne({ email });
  if (!user) {
    throw new Error("Invalid login credentials");
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new Error("Invalid login credentials");
  }

  return user;
};

userSchema.methods.generateAuthToken = function (): string {
  const user = this as IUser;
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT secret is not defined");
  }
  const token = jwt.sign({ _id: user._id.toString() }, secret, {
    expiresIn: "7d",
  });
  return token;
};

// 🔹 Metoda do dodawania produktu do koszyka
userSchema.methods.addToCart = async function (
  productId: mongoose.Types.ObjectId
): Promise<IUser> {
  const user = this as IUser;

  const cartProductIndex = user.cart.items.findIndex(
    (cp) => cp.productId.toString() === productId.toString()
  );

  let updatedCartItems = [...user.cart.items];

  if (cartProductIndex >= 0) {
    updatedCartItems[cartProductIndex].quantity += 1;
  } else {
    updatedCartItems.push({
      productId: productId,
      quantity: 1,
    });
  }

  user.cart.items = updatedCartItems;
  await user.save();
  return user;
};

// 🔹 Metoda do usuwania produktu z koszyka
userSchema.methods.removeFromCart = async function (
  productId: mongoose.Types.ObjectId
): Promise<IUser> {
  const user = this as IUser;
  user.cart.items = user.cart.items.filter(
    (item) => item.productId.toString() !== productId.toString()
  );
  await user.save();
  return user;
};

const User = mongoose.model<IUser, IUserModel>("User", userSchema);

export default User;
