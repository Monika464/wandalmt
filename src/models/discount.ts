// models/discount.js
import mongoose from "mongoose";

const discountSchema = new mongoose.Schema({
  // Podstawowe informacje
  name: {
    type: String,
    required: true,
    trim: true,
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },

  // Typ kuponu
  type: {
    type: String,
    enum: ["percentage", "fixed", "product"],
    required: true,
  },

  // Wartość zniżki
  value: {
    type: Number,
    required: true,
    min: 0,
  },

  // Minimalna kwota zamówienia dla kuponu
  minPurchaseAmount: {
    type: Number,
    default: 0,
  },

  // Maksymalna kwota zniżki (dla procentów)
  maxDiscountAmount: {
    type: Number,
    default: null,
  },

  // Liczba użyć
  maxUses: {
    type: Number,
    default: null, // null = unlimited
  },

  // Liczba już użytych
  usedCount: {
    type: Number,
    default: 0,
  },

  // Użytkownik, który może użyć kuponu (null = każdy)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },

  // Produkt, na który działa kupon (tylko dla type: 'product')
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    default: null,
  },

  // Okres ważności
  validFrom: {
    type: Date,
    default: Date.now,
  },
  validUntil: {
    type: Date,
    default: null, // null = nie wygasa
  },

  // Czy aktywny
  isActive: {
    type: Boolean,
    default: true,
  },

  // Informacje o użyciach
  usageHistory: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
      },
      usedAt: {
        type: Date,
        default: Date.now,
      },
      discountAmount: Number,
    },
  ],

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Indeksy dla efektywnego wyszukiwania
discountSchema.index({ code: 1 }, { unique: true });
discountSchema.index({ isActive: 1, validUntil: 1 });
discountSchema.index({ productId: 1 });
discountSchema.index({ userId: 1 });

// Metoda sprawdzająca czy kupon jest ważny
discountSchema.methods.isValid = function () {
  const now = new Date();

  if (!this.isActive) return false;
  if (this.validUntil && now > this.validUntil) return false;
  if (this.validFrom && now < this.validFrom) return false;
  if (this.maxUses && this.usedCount >= this.maxUses) return false;

  return true;
};

// Metoda obliczająca zniżkę
discountSchema.methods.calculateDiscount = function (amount, productId = null) {
  if (!this.isValid()) return 0;

  // Sprawdź czy kupon jest dla konkretnego produktu
  if (this.type === "product" && productId) {
    if (!this.productId || !this.productId.equals(productId)) {
      return 0;
    }
  }

  let discount = 0;

  switch (this.type) {
    case "percentage":
      discount = (amount * this.value) / 100;
      if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
        discount = this.maxDiscountAmount;
      }
      break;

    case "fixed":
      discount = this.value;
      if (discount > amount) {
        discount = amount;
      }
      break;

    case "product":
      if (productId && this.productId && this.productId.equals(productId)) {
        discount = this.value;
        if (discount > amount) {
          discount = amount;
        }
      }
      break;
  }

  return discount;
};

// Pre-save hook
discountSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model("Discount", discountSchema);
