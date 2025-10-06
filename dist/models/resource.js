// models/Resource.ts
import mongoose, { Schema } from "mongoose";
const ChapterSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String },
    videoUrl: { type: String },
});
const ResourceSchema = new Schema({
    title: { type: String, required: true },
    content: { type: String },
    videoUrl: { type: String },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    chapters: [ChapterSchema],
}, { timestamps: true });
export default mongoose.model("Resource", ResourceSchema);
