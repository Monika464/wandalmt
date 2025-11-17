import { Schema, model } from "mongoose";
const productSchema = new Schema({
    title: {
        type: String,
        required: true,
    },
    price: {
        type: Number,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    imageUrl: {
        type: String,
        required: true,
    },
    //content: { type: String, required: true },
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
    status: {
        type: String,
        enum: ["draft", "published", "archived"],
        default: "draft",
    },
    resourceId: {
        type: Schema.Types.ObjectId,
        ref: "Resource",
        required: false,
    },
}, { timestamps: true });
const Product = model("Product", productSchema);
export default Product;
