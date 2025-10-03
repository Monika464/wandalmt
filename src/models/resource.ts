// models/Resource.ts
import mongoose, { Schema, Document, Types } from "mongoose";

interface Chapter {
  _id?: Types.ObjectId;
  title: string;
  description?: string;
  videoUrl?: string;
}

export interface IResource extends Document {
  title: string;
  content?: string;
  videoUrl?: string;
  productId: mongoose.Types.ObjectId;
  chapters: Chapter[];
}

const ChapterSchema = new Schema<Chapter>({
  title: { type: String, required: true },
  description: { type: String },
  videoUrl: { type: String },
});

const ResourceSchema = new Schema<IResource>(
  {
    title: { type: String, required: true },
    content: { type: String },
    videoUrl: { type: String },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    chapters: [ChapterSchema],
  },
  { timestamps: true }
);

export default mongoose.model<IResource>("Resource", ResourceSchema);
