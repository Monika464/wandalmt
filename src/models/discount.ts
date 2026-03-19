// models/discount.ts
import { Document, Schema, model, Types } from "mongoose";

export interface IDiscount extends Document {
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
    name: {
      type: String,
      required: [true, "Coupon name is required"],
      trim: true,
    },
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      uppercase: true,
      trim: true,
    },

    type: {
      type: String,
      enum: {
        values: ["percentage", "fixed", "product"],
        message: "Invalid coupon type",
      },
      required: [true, "Coupon type is required"],
    },

    value: {
      type: Number,
      required: [true, "Discount value is required"],
      min: [0, "Discount value cannot be negative"],
    },

    minPurchaseAmount: {
      type: Number,
      default: 0,
      min: [0, "The minimum order amount cannot be negative"],
    },

    maxDiscountAmount: {
      type: Number,
      default: null,
      min: [0, "The maximum discount amount cannot be negative"],
    },

    // Number of allowed uses
    maxUses: {
      type: Number,
      default: null,
      min: [1, "The number of uses must be greater than 0"],
    },

    // Number of already used
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // User who can use the coupon (null = anyone)
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Product that the coupon applies to (only for type: 'product')
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },

    // Validity period
    validFrom: {
      type: Date,
      default: Date.now,
    },
    validUntil: {
      type: Date,
      default: null,
    },

    // isActive?
    isActive: {
      type: Boolean,
      default: true,
    },

    // Usage Information
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
    timestamps: true,
  },
);

// Indexes for efficient searching
//discountSchema.index({ code: 1 }, { unique: true });
discountSchema.index({ isActive: 1, validUntil: 1 });
discountSchema.index({ productId: 1 });
discountSchema.index({ userId: 1 });
discountSchema.index({ type: 1, isActive: 1 });
discountSchema.index({ validFrom: 1, validUntil: 1 });

// Method checking if the coupon is valid
discountSchema.methods.isValid = function (this: IDiscount): boolean {
  const now = new Date();

  if (!this.isActive) return false;
  if (this.validUntil && now > this.validUntil) return false;
  if (this.validFrom && now < this.validFrom) return false;
  if (this.maxUses && this.usedCount >= this.maxUses) return false;

  return true;
};

// Method of calculating the discount amount
discountSchema.methods.calculateDiscount = function (
  this: IDiscount,
  amount: number,
  productId?: Types.ObjectId | string | null,
): number {
  if (!this.isValid()) return 0;

  // Check the minimum order amount
  if (amount < this.minPurchaseAmount) return 0;

  //For product coupons, check if the product matches
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
