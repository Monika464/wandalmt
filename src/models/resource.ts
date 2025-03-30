import mongoose, { Types, Document, Schema, model } from "mongoose";

interface IResource extends Document {
  title: string;
  imageUrl: string;
  content: string;
  videoUrl?: string;
  productId: Types.ObjectId;
  userIds?: Types.ObjectId[];
}

const resourceSchema = new Schema<IResource>(
  {
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
      required: true, // Każdy zasób musi być powiązany z produktem
    },
    userIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);
const Resource = model<IResource>("Resource", resourceSchema);

export default Resource;
