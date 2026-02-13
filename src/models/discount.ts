// models/discount.ts
import mongoose, { Document, Schema, model, Types } from "mongoose";

export interface IDiscount extends Document {
  // Podstawowe informacje
  name: string;
  code: string;
  type: "percentage" | "fixed" | "product";
  value: number;
  minPurchaseAmount: number;
  maxDiscountAmount: number | null;
  maxUses: number | null;
  usedCount: number;
  userId: Types.ObjectId | null;
  productId: Types.ObjectId | null;
  validFrom: Date;
  validUntil: Date | null;
  isActive: boolean;
  usageHistory: Array<{
    userId: Types.ObjectId;
    orderId: Types.ObjectId;
    usedAt: Date;
    discountAmount: number;
  }>;
  createdAt: Date;
  updatedAt: Date;

  // Metody
  isValid(): boolean;
  calculateDiscount(
    amount: number,
    productId?: Types.ObjectId | string | null,
  ): number;
  useDiscount(
    userId: Types.ObjectId | string,
    orderId: Types.ObjectId | string,
    discountAmount: number,
  ): Promise<void>;
}

const discountSchema = new Schema<IDiscount>(
  {
    // Podstawowe informacje
    name: {
      type: String,
      required: [true, "Nazwa kuponu jest wymagana"],
      trim: true,
    },
    code: {
      type: String,
      required: [true, "Kod kuponu jest wymagany"],
      unique: true,
      uppercase: true,
      trim: true,
    },

    // Typ kuponu
    type: {
      type: String,
      enum: {
        values: ["percentage", "fixed", "product"],
        message: "Nieprawidłowy typ kuponu",
      },
      required: [true, "Typ kuponu jest wymagany"],
    },

    // Wartość zniżki
    value: {
      type: Number,
      required: [true, "Wartość zniżki jest wymagana"],
      min: [0, "Wartość zniżki nie może być ujemna"],
    },

    // Minimalna kwota zamówienia dla kuponu
    minPurchaseAmount: {
      type: Number,
      default: 0,
      min: [0, "Minimalna kwota zamówienia nie może być ujemna"],
    },

    // Maksymalna kwota zniżki (dla procentów)
    maxDiscountAmount: {
      type: Number,
      default: null,
      min: [0, "Maksymalna kwota zniżki nie może być ujemna"],
    },

    // Liczba użyć
    maxUses: {
      type: Number,
      default: null,
      min: [1, "Liczba użyć musi być większa niż 0"],
    },

    // Liczba już użytych
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Użytkownik, który może użyć kuponu (null = każdy)
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Produkt, na który działa kupon (tylko dla type: 'product')
    productId: {
      type: Schema.Types.ObjectId,
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
      default: null,
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
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        orderId: {
          type: Schema.Types.ObjectId,
          ref: "Order",
          required: true,
        },
        usedAt: {
          type: Date,
          default: Date.now,
        },
        discountAmount: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],
  },
  {
    timestamps: true, // Automatycznie obsługuje createdAt i updatedAt
  },
);

// Indeksy dla efektywnego wyszukiwania
discountSchema.index({ code: 1 }, { unique: true });
discountSchema.index({ isActive: 1, validUntil: 1 });
discountSchema.index({ productId: 1 });
discountSchema.index({ userId: 1 });
discountSchema.index({ type: 1, isActive: 1 });
discountSchema.index({ validFrom: 1, validUntil: 1 });

// Metoda sprawdzająca czy kupon jest ważny
discountSchema.methods.isValid = function (this: IDiscount): boolean {
  const now = new Date();

  if (!this.isActive) return false;
  if (this.validUntil && now > this.validUntil) return false;
  if (this.validFrom && now < this.validFrom) return false;
  if (this.maxUses && this.usedCount >= this.maxUses) return false;

  return true;
};

// Metoda obliczająca wysokość zniżki
discountSchema.methods.calculateDiscount = function (
  this: IDiscount,
  amount: number,
  productId?: Types.ObjectId | string | null,
): number {
  if (!this.isValid()) return 0;

  // Sprawdź minimalną kwotę zamówienia
  if (amount < this.minPurchaseAmount) return 0;

  // Dla kuponów produktowych sprawdź czy produkt pasuje
  if (this.type === "product" && productId) {
    if (!this.productId) return 0;

    const productIdStr =
      typeof productId === "string" ? productId : productId.toString();
    const thisProductIdStr = this.productId.toString();

    if (thisProductIdStr !== productIdStr) {
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
      if (productId && this.productId) {
        const productIdStr =
          typeof productId === "string" ? productId : productId.toString();
        const thisProductIdStr = this.productId.toString();

        if (thisProductIdStr === productIdStr) {
          discount = this.value;
          if (discount > amount) {
            discount = amount;
          }
        }
      }
      break;
  }

  return Math.max(0, discount);
};

// Metoda do rejestrowania użycia kuponu
discountSchema.methods.useDiscount = async function (
  this: IDiscount,
  userId: Types.ObjectId | string,
  orderId: Types.ObjectId | string,
  discountAmount: number,
): Promise<void> {
  this.usedCount += 1;

  this.usageHistory.push({
    userId: typeof userId === "string" ? new Types.ObjectId(userId) : userId,
    orderId:
      typeof orderId === "string" ? new Types.ObjectId(orderId) : orderId,
    usedAt: new Date(),
    discountAmount,
  });

  await this.save();
};

// Statyczne metody
discountSchema.statics.findValidByCode = async function (
  code: string,
): Promise<IDiscount | null> {
  return this.findOne({
    code: code.toUpperCase(),
    isActive: true,
    $or: [{ validUntil: null }, { validUntil: { $gt: new Date() } }],
    $and: [{ validFrom: { $lte: new Date() } }],
  });
};

// Pre-save middleware
discountSchema.pre("save", function (this: IDiscount, next) {
  // Automatycznie ustaw kod na wielkie litery
  if (this.isModified("code")) {
    this.code = this.code.toUpperCase();
  }

  // Walidacja dla kuponów produktowych
  if (this.type === "product" && !this.productId) {
    next(new Error("Kupon produktowy wymaga określenia produktu"));
  }

  // Walidacja wartości dla różnych typów
  if (this.type === "percentage" && this.value > 100) {
    next(new Error("Zniżka procentowa nie może przekraczać 100%"));
  }

  next();
});

// Export modelu
const Discount = model<IDiscount>("Discount", discountSchema);
export default Discount;

// // models/discount.js
// import mongoose from "mongoose";

// const discountSchema = new mongoose.Schema({
//   // Podstawowe informacje
//   name: {
//     type: String,
//     required: true,
//     trim: true,
//   },
//   code: {
//     type: String,
//     required: true,
//     unique: true,
//     uppercase: true,
//     trim: true,
//   },

//   // Typ kuponu
//   type: {
//     type: String,
//     enum: ["percentage", "fixed", "product"],
//     required: true,
//   },

//   // Wartość zniżki
//   value: {
//     type: Number,
//     required: true,
//     min: 0,
//   },

//   // Minimalna kwota zamówienia dla kuponu
//   minPurchaseAmount: {
//     type: Number,
//     default: 0,
//   },

//   // Maksymalna kwota zniżki (dla procentów)
//   maxDiscountAmount: {
//     type: Number,
//     default: null,
//   },

//   // Liczba użyć
//   maxUses: {
//     type: Number,
//     default: null, // null = unlimited
//   },

//   // Liczba już użytych
//   usedCount: {
//     type: Number,
//     default: 0,
//   },

//   // Użytkownik, który może użyć kuponu (null = każdy)
//   userId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "User",
//     default: null,
//   },

//   // Produkt, na który działa kupon (tylko dla type: 'product')
//   productId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "Product",
//     default: null,
//   },

//   // Okres ważności
//   validFrom: {
//     type: Date,
//     default: Date.now,
//   },
//   validUntil: {
//     type: Date,
//     default: null, // null = nie wygasa
//   },

//   // Czy aktywny
//   isActive: {
//     type: Boolean,
//     default: true,
//   },

//   // Informacje o użyciach
//   usageHistory: [
//     {
//       userId: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: "User",
//       },
//       orderId: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: "Order",
//       },
//       usedAt: {
//         type: Date,
//         default: Date.now,
//       },
//       discountAmount: Number,
//     },
//   ],

//   // Timestamps
//   createdAt: {
//     type: Date,
//     default: Date.now,
//   },
//   updatedAt: {
//     type: Date,
//     default: Date.now,
//   },
// });

// // Indeksy dla efektywnego wyszukiwania
// discountSchema.index({ code: 1 }, { unique: true });
// discountSchema.index({ isActive: 1, validUntil: 1 });
// discountSchema.index({ productId: 1 });
// discountSchema.index({ userId: 1 });

// // Metoda sprawdzająca czy kupon jest ważny
// discountSchema.methods.isValid = function () {
//   const now = new Date();

//   if (!this.isActive) return false;
//   if (this.validUntil && now > this.validUntil) return false;
//   if (this.validFrom && now < this.validFrom) return false;
//   if (this.maxUses && this.usedCount >= this.maxUses) return false;

//   return true;
// };

// discountSchema.methods.calculateDiscount = function (
//   amount: number,
//   productId = null,
// ) {
//   if (!this.isValid()) return 0;

//   if (this.type === "product" && productId) {
//     if (!this.productId || !this.productId.equals(productId)) {
//       return 0;
//     }
//   }

//   let discount = 0;

//   switch (this.type) {
//     case "percentage":
//       discount = (amount * this.value) / 100;
//       if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
//         discount = this.maxDiscountAmount;
//       }
//       break;

//     case "fixed":
//       discount = this.value;
//       if (discount > amount) {
//         discount = amount;
//       }
//       break;

//     case "product":
//       if (productId && this.productId && this.productId.equals(productId)) {
//         discount = this.value;
//         if (discount > amount) {
//           discount = amount;
//         }
//       }
//       break;
//   }

//   return discount;
// };

// // Pre-save hook
// discountSchema.pre("save", function (next) {
//   this.updatedAt = new Date();
//   next();
// });

// export default mongoose.model("Discount", discountSchema);
