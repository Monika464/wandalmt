import mongoose from "mongoose";
const { Document, Schema } = mongoose;

interface IResource extends Document {
  title: string;
  imageUrl: string;
  content: string;
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
  },
  { timestamps: true }
);

const Resource = mongoose.model("Resource", resourceSchema);

export default Resource;
