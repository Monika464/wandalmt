import mongoose, { Document, Schema } from "mongoose";

interface IAdmin extends Document {
  email: string;
  password: string;
  name: string;
  surname: string;
  status: string;
  resources: mongoose.Types.ObjectId[];
  products: mongoose.Types.ObjectId[];
}

const adminSchema = new Schema<IAdmin>({
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },

  products: [
    {
      type: Schema.Types.ObjectId,
      ref: "Products",
    },
  ],
});

const Admin = mongoose.model<IAdmin>("Admin", adminSchema);

export default Admin;
