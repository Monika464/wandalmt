// models/order.js
import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  // Podstawowe informacje
  stripeSessionId: {
    type: String,
    sparse: true,
    default: null,
  },
  stripePaymentIntentId: String,
  status: {
    type: String,
    sparse: true,
    enum: ["pending", "paid", "failed", "canceled"],
    default: "pending",
  },

  // Użytkownik
  user: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    email: String,
  },

  // Produkty (pełne dane zapisane w bazie)
  products: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
      title: String,
      price: Number,
      quantity: Number,
      imageUrl: String,
      content: String,
    },
  ],

  // Suma
  totalAmount: Number,

  // Kupon rabatowy
  couponCode: String,
  discount: {
    amount: Number,
    description: String,
  },

  // Faktura
  requireInvoice: Boolean,
  invoiceData: {
    companyName: String,
    //taxId: String,
    address: String,
  },
  invoiceId: String,

  // Podatki
  // tax: [
  //   {
  //     amount: Number,
  //     rate: Number,
  //     description: String,
  //   },
  // ],

  // Dane billingowe
  billingDetails: {
    name: String,
    email: String,
    phone: String,
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      postal_code: String,
      country: String,
    },
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
  },
  paidAt: Date,
});
orderSchema.index(
  { stripeSessionId: 1 },
  {
    sparse: true,
    name: "stripeSessionId_sparse_idx", // Unikalna nazwa
  }
);

// Dodaj inne przydatne indeksy
orderSchema.index({ status: 1 }, { sparse: true, name: "status_idx" });
orderSchema.index({ "user.userId": 1 }, { name: "user_userId_idx" });
orderSchema.index({ createdAt: -1 }, { name: "createdAt_desc_idx" });
orderSchema.index({ paidAt: -1 }, { name: "paidAt_desc_idx" });

export default mongoose.model("Order", orderSchema);
