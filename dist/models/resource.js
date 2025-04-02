import { Schema, model } from "mongoose";
const resourceSchema = new Schema({
    title: {
        type: String,
        required: true,
    },
    imageUrl: {
        type: String,
        required: true,
    },
    content: {
        type: String,
        required: true,
    },
    videoUrl: {
        type: String,
        required: false, // Opcjonalne, jeśli nie każdy zasób ma film
    },
    productId: {
        type: Schema.Types.ObjectId,
        ref: "Product",
        required: true,
    },
    userIds: [
        {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
    ],
}, { timestamps: true });
const Resource = model("Resource", resourceSchema);
export default Resource;
