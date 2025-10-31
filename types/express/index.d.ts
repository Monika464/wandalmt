import mongoose from "mongoose";
import { IUser } from "../../models/user.js";

declare global {
  namespace Express {
    interface Request {
      user?: (mongoose.Document<unknown, any, IUser> & IUser) | null;
      token?: string;
    }
  }
}
// declare global {
//   namespace Express {
//     interface User extends IUser {
//       _id: mongoose.Types.ObjectId;
//     }

//     interface Request {
//       user?: (mongoose.Document<unknown, any, IUser> & IUser) | null;
//       token?: string;
//     }
//   }
// }

export {};
