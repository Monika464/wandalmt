// models/Resource.ts
import mongoose, { Schema, Document, Types } from "mongoose";
import type { IUser } from "../models/user.js";

interface Chapter {
  _id?: Types.ObjectId;
  title: string;
  description?: string;
  videoId?: string;
  order?: number;
}

export interface IResource extends Document {
  title: string;
  content?: string;
  productId: mongoose.Types.ObjectId;
  chapters?: Chapter[];
  users?: IUser[];
}

const ChapterSchema = new Schema<Chapter>({
  title: { type: String, required: true },
  description: { type: String },
  videoId: { type: String },
  order: { type: Number, default: 0 },
});

const ResourceSchema = new Schema<IResource>(
  {
    title: { type: String, required: true },
    content: { type: String },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    chapters: [ChapterSchema],
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

export default mongoose.model<IResource>("Resource", ResourceSchema);
