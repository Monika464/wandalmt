import mongoose from "mongoose";
const { Schema } = mongoose;
const orderSchema = new Schema({
    stripeSessionId: { type: String, required: true, unique: true },
    products: [
        {
            product: { type: Object, required: true },
            quantity: { type: Number, required: true },
        },
    ],
    user: {
        email: {
            type: String,
            required: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: "User",
        },
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    refundedAt: { type: Date, default: null },
    refundId: { type: String, default: null },
});
const Order = mongoose.model("Order", orderSchema);
export default Order;
