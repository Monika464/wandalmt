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
  // Zniżka Stripe
  stripeDiscount: {
    coupon: String,
    promotion_code: String,
    amount_off: Number,
    percent_off: Number,
  },

  // Zniżka z naszego systemu
  discountApplied: {
    type: {
      type: String,
      enum: ["coupon", "promotion", "manual", null],
      default: null,
    },
    code: String,
    amount: Number,
    description: String,
  },
  status: {
    type: String,
    sparse: true,
    enum: [
      "pending",
      "paid",
      "failed",
      "canceled",
      "refunded",
      "partially_refunded",
    ],
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
      discountedPrice: Number,
      quantity: Number,
      imageUrl: String,
      content: String,
      refundQuantity: { type: Number, default: 0 },
      refunded: { type: Boolean, default: false },
      refundedAt: Date,
    },
  ],

  // Suma
  totalAmount: Number,
  totalDiscount: {
    type: Number,
    default: 0,
  },

  // Kupon rabatowy
  couponCode: String,
  discount: {
    amount: Number,
    description: String,
  },

  // Faktura - ZMIENIAMY STRUKTURĘ
  requireInvoice: {
    type: Boolean,
    default: false,
  },

  // ID faktury Stripe
  invoiceId: String,
  // Szczegóły faktury Stripe - DODAJEMY NOWE POLE
  invoiceDetails: {
    invoiceNumber: String,
    invoicePdf: String,
    hostedInvoiceUrl: String,
    status: String,
    amountPaid: Number,
    createdAt: Date,
  },

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

  // Zwroty
  refundId: String,
  refundAmount: Number,
  refundedAt: Date,

  partialRefunds: [
    {
      refundId: String,
      amount: Number,
      createdAt: {
        type: Date,
        default: Date.now,
      },
      reason: String,
      products: [
        {
          productId: mongoose.Schema.Types.ObjectId,
          title: String,
          quantity: Number,
          amount: Number,
          reason: String,
        },
      ],
    },
  ],

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
    name: "stripeSessionId_sparse_idx",
  },
);

// Dodaj inne przydatne indeksy
orderSchema.index({ status: 1 }, { sparse: true, name: "status_idx" });
orderSchema.index({ "user.userId": 1 }, { name: "user_userId_idx" });
orderSchema.index({ createdAt: -1 }, { name: "createdAt_desc_idx" });
orderSchema.index({ paidAt: -1 }, { name: "paidAt_desc_idx" });
orderSchema.index({ invoiceId: 1 }, { sparse: true, name: "invoiceId_idx" });

export default mongoose.model("Order", orderSchema);
