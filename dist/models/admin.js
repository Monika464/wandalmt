import mongoose, { Schema } from "mongoose";
const adminSchema = new Schema({
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
const Admin = mongoose.model("Admin", adminSchema);
export default Admin;
