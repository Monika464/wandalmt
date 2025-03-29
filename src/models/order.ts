import mongoose from "mongoose";
const { Schema } = mongoose;

interface IOrder extends Document {
  products: {
    product: {
      title: string;
      price: number;
      description: string;
      imageUrl: string;
      content: string;
      userId: mongoose.Types.ObjectId;
    };
    quantity: number;
  }[];
  user: {
    email: string;
    userId: mongoose.Types.ObjectId;
  };
}

const orderSchema = new Schema<IOrder>({
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
});

const Order = mongoose.model("Order", orderSchema);

export default Order;
