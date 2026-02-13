import mongoose, { Schema } from "mongoose";
const VideoSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    bunnyGuid: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    status: {
        type: String,
        enum: ["uploading", "processing", "ready", "error"],
        default: "uploading",
    },
    processingProgress: { type: Number, default: 0 },
    // metadata – wypełniane gdy Status === 4
    duration: {
        type: Number,
    },
    width: {
        type: Number,
    },
    height: {
        type: Number,
    },
    errorMessage: { type: String },
}, {
    timestamps: true,
});
export default mongoose.model("Video", VideoSchema);
// import mongoose, { Schema, Document } from "mongoose";
// export interface IVideo extends Document {
//   title: string;
//   bunnyGuid: string;
//   thumbnailUrl?: string;
//   createdAt: Date;
// }
// const VideoSchema = new Schema<IVideo>(
//   {
//     title: { type: String, required: true },
//     bunnyGuid: {
//       type: String,
//       required: true,
//       unique: true,
//     },
//     thumbnailUrl: { type: String },
//   },
//   { timestamps: true }
// );
// export default mongoose.model<IVideo>("Video", VideoSchema);
