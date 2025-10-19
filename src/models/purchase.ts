import mongoose, { Document, Schema, Model } from "mongoose";

// interfejs dla dokumentu Purchase
export interface IPurchase extends Document {
  productId: mongoose.Types.ObjectId;
  sessionId: string;
  customerEmail?: string;
  amount: number;
  status: "complete" | "pending" | "failed";
  createdAt: Date;
}

const purchaseSchema: Schema<IPurchase> = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  sessionId: { type: String, required: true },
  customerEmail: { type: String },
  amount: { type: Number, required: true },
  status: {
    type: String,
    enum: ["complete", "pending", "failed"],
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
});

// typowanie modelu
const Purchase: Model<IPurchase> = mongoose.model<IPurchase>(
  "Purchase",
  purchaseSchema
);

export default Purchase;
