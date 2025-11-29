import mongoose, { Schema, Document } from "mongoose";

export interface IVideo extends Document {
  title: string;
  bunnyGuid: string;
  thumbnailUrl?: string;
  createdAt: Date;
}

const VideoSchema = new Schema<IVideo>(
  {
    title: { type: String, required: true },

    bunnyGuid: {
      type: String,
      required: true,
      unique: true,
    },

    thumbnailUrl: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model<IVideo>("Video", VideoSchema);
