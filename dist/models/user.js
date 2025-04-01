var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
const userSchema = new Schema({
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
userSchema.statics.findByCredentials = function (email, password) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = yield this.findOne({ email });
        if (!user) {
            throw new Error("Invalid login credentials");
        }
        const isMatch = yield bcrypt.compare(password, user.password);
        if (!isMatch) {
            throw new Error("Invalid login credentials");
        }
        return user;
    });
};
userSchema.methods.generateAuthToken = function () {
    const user = this;
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
userSchema.methods.addToCart = function (productId) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = this;
        const cartProductIndex = user.cart.items.findIndex((cp) => cp.productId.toString() === productId.toString());
        let updatedCartItems = [...user.cart.items];
        if (cartProductIndex >= 0) {
            updatedCartItems[cartProductIndex].quantity += 1;
        }
        else {
            updatedCartItems.push({
                productId: productId,
                quantity: 1,
            });
        }
        user.cart.items = updatedCartItems;
        yield user.save();
        return user;
    });
};
// 🔹 Metoda do usuwania produktu z koszyka
userSchema.methods.removeFromCart = function (productId) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = this;
        user.cart.items = user.cart.items.filter((item) => item.productId.toString() !== productId.toString());
        yield user.save();
        return user;
    });
};
const User = mongoose.model("User", userSchema);
export default User;
