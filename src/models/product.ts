import mongoose, { Document, Schema, model } from "mongoose";

export interface IProduct extends Document {
  title: string;
  price: number;
  description: string;
  imageUrl: string;
  content?: Object;
  status: "draft" | "published" | "archived";
  userId: mongoose.Types.ObjectId;
  resourceId?: mongoose.Types.ObjectId;
}

const productSchema = new Schema<IProduct>(
  {
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
  },
  { timestamps: true }
);
const Product = model<IProduct>("Product", productSchema);

export default Product;
