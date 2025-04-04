import { Schema, model } from "mongoose";
const chapterSchema = new Schema({
    videoUrl: { type: String },
    description: { type: String },
}, { _id: false } // Nie potrzebujemy oddzielnego _id dla każdego rozdziału
);
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
    videoUrl: {
        type: String,
        required: false,
    },
    productId: {
        type: Schema.Types.ObjectId,
        ref: "Product",
        required: true,
    },
    userIds: [
        {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
    ],
    chapters: {
        type: [chapterSchema],
        validate: [
            (val) => val.length <= 100,
            "Maksymalnie 100 rozdziałów dozwolonych",
        ],
    },
}, { timestamps: true });
const Resource = model("Resource", resourceSchema);
export default Resource;
// import mongoose, { Types, Document, Schema, model } from "mongoose";
// interface IResource extends Document {
//   title: string;
//   imageUrl: string;
//   content: string;
//   videoUrl?: string;
//   productId: Types.ObjectId;
//   userIds?: Types.ObjectId[];
// }
// const resourceSchema = new Schema<IResource>(
//   {
//     title: {
//       type: String,
//       required: true,
//     },
//     imageUrl: {
//       type: String,
//       required: true,
//     },
//     content: {
//       type: String,
//       required: true,
//     },
//     videoUrl: {
//       type: String,
//       required: false, // Opcjonalne, jeśli nie każdy zasób ma film
//     },
//     productId: {
//       type: Schema.Types.ObjectId,
//       ref: "Product",
//       required: true,
//     },
//     userIds: [
//       {
//         type: Schema.Types.ObjectId,
//         ref: "User",
//       },
//     ],
//   },
//   { timestamps: true }
// );
// const Resource = model<IResource>("Resource", resourceSchema);
// export default Resource;
