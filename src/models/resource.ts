// models/Resource.ts
import mongoose, { Schema, Document, Types } from "mongoose";
import type { IUser } from "../models/user.js";

interface Chapter {
  _id?: Types.ObjectId;
  number?: number;
  title: string;
  description?: string;
  bunnyVideoId?: string;
  videoId?: Types.ObjectId | string;
}

export interface IResource extends Document {
  title: string;
  content?: string;
  productId: mongoose.Types.ObjectId;
  chapters?: Chapter[];
  users?: IUser[];
}

const ChapterSchema = new Schema<Chapter>({
  number: { type: Number, default: 1, required: true },
  title: { type: String, required: true },
  description: { type: String },
  bunnyVideoId: {
    type: String,
    default: null,
    index: true,
  },
  videoId: { type: Schema.Types.ObjectId, ref: "Video", default: null },
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
