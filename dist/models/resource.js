import mongoose from "mongoose";
const { Document, Schema } = mongoose;
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
}, { timestamps: true });
const Resource = mongoose.model("Resource", resourceSchema);
export default Resource;
