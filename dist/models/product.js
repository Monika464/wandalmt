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
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
    resourceId: {
        type: Schema.Types.ObjectId,
        ref: "Product",
        required: false, // Każdy zasób musi być powiązany z produktem
    },
}, { timestamps: true });
const Product = model("Product", productSchema);
//const Product = mongoose.model("Product", productSchema);
export default Product;
