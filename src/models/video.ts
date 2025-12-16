import mongoose, { Schema, Document } from "mongoose";

export interface IVideo extends Document {
  title: string;
  bunnyGuid: string;

  status: number; // status Bunny (0–5)
  duration?: number; // sekundy
  width?: number;
  height?: number;

  createdAt: Date;
  updatedAt: Date;
}

const VideoSchema = new Schema<IVideo>(
  {
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

    // Bunny status
    status: {
      type: Number,
      default: 0, // CREATED
      index: true,
    },

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
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IVideo>("Video", VideoSchema);

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
