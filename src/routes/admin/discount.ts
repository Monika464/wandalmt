// routes/discounts-admin.ts

import express, { Request, Response } from "express";
import mongoose from "mongoose";
import { adminAuth } from "../../middleware/auth.js";
import Discount from "../../models/discount.js";
import Product from "../../models/product.js";

const router = express.Router();

// Get all coupons (admin)
router.get(
  "/",
  adminAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { page = 1, limit = 20, search = "", isActive } = req.query;

      const query: any = {};

      if (search) {
        const searchString = Array.isArray(search)
          ? search[0]?.toString() || ""
          : search.toString();
        query.$or = [
          { name: { $regex: searchString, $options: "i" } },
          { code: { $regex: searchString.toUpperCase(), $options: "i" } },
        ];
      }

      if (isActive !== undefined) {
        query.isActive = isActive === "true";
      }

      const discounts = await Discount.find(query)
        .populate("productId", "title price")
        .populate("userId", "email username")
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit));

      const total = await Discount.countDocuments(query);

      res.json({
        discounts,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error: any) {
      console.error("Error fetching discounts:", error);
      res.status(500).json({ error: "Błąd podczas pobierania kuponów" });
    }
  },
);

// Create a new coupon (admin)
// console.log("📝 Defining POST route...");
// router.use("/", (req, res, next) => {
//   console.log("    🔥 DISCOUNT LAYER HIT!");
//   console.log("      fullUrl:", req.originalUrl);
//   console.log("      baseUrl:", req.baseUrl);
//   console.log("      path:", req.path);
//   next();
// });
router.post(
  "/",
  adminAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        name,
        code,
        type,
        value,
        minPurchaseAmount,
        maxDiscountAmount,
        maxUses,
        userId,
        productId,
        validFrom,
        validUntil,
        isActive,
      } = req.body;

      // Validate
      console.log("Validating fields...");
      if (!name || !code || !type || !value) {
        console.log("❌ Missing required fields:", { name, code, type, value });
        res.status(400).json({ error: "Brak wymaganych pól" });
        return;
      }

      if (type === "percentage" && (value < 1 || value > 100)) {
        res
          .status(400)
          .json({ error: "Procent zniżki musi być między 1 a 100" });
        return;
      }

      if (type === "fixed" && value < 0) {
        res.status(400).json({ error: "Wartość zniżki nie może być ujemna" });
        return;
      }

      // Check if the coupon already exists
      console.log("Checking existing discount with code:", code.toUpperCase());
      const existingDiscount = await Discount.findOne({
        code: code.toUpperCase(),
      });
      if (existingDiscount) {
        res
          .status(400)
          .json({ error: "A coupon with this code already exists" });
        return;
      }

      // Check product if applicable
      if (productId && type === "product") {
        const product = await Product.findById(productId);
        if (!product) {
          res.status(404).json({ error: "Produkt nie istnieje" });
          return;
        }
      }

      // Check user if applicable
      let userObjectId = null;
      if (userId) {
        try {
          userObjectId = mongoose.Types.ObjectId.createFromHexString(userId);
          //userObjectId = new mongoose.Types.ObjectId(userId);
        } catch (error) {
          res.status(400).json({ error: "Invalid user ID" });
          return;
        }
      }

      // Stwórz kupon
      console.log("✅ Creating new discount...");
      const discount = new Discount({
        name,
        code: code.toUpperCase(),
        type,
        value,
        minPurchaseAmount: minPurchaseAmount || 0,
        maxDiscountAmount: maxDiscountAmount || null,
        maxUses: maxUses || null,
        userId: userObjectId,
        productId: productId || null,
        validFrom: validFrom ? new Date(validFrom) : new Date(),
        validUntil: validUntil ? new Date(validUntil) : null,
        isActive: isActive !== undefined ? isActive : true,
        usedCount: 0,
        usageHistory: [],
      });

      await discount.save();
      console.log("✅ Discount saved with ID:", discount._id);
      const populatedDiscount = await discount.populate([
        "productId",
        "userId",
      ]);
      console.log("✅ Sending success response");
      res.status(201).json({
        message: "Coupon created successfully",
        discount: populatedDiscount,
      });
    } catch (error: any) {
      console.error("Error creating discount:", error);
      res.status(500).json({ error: "Error creating coupon" });
    }
  },
);

// Get single coupon (admin)
router.get(
  "/:id",
  adminAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const discount = await Discount.findById(id)
        .populate("productId", "title price")
        .populate("userId", "email username");

      if (!discount) {
        res.status(404).json({ error: "Coupon not found" });
        return;
      }

      res.json(discount);
    } catch (error: any) {
      console.error("Error fetching discount:", error);
      res.status(500).json({ error: "Error fetching coupon" });
    }
  },
);

// Update coupon (admin)
router.put(
  "/:id",
  adminAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // If you change the code, check if there is already another coupon with this code
      if (updateData.code) {
        updateData.code = updateData.code.toUpperCase();
        const existingDiscount = await Discount.findOne({
          code: updateData.code,
          _id: { $ne: id },
        });
        if (existingDiscount) {
          res
            .status(400)
            .json({ error: "Coupon with this code already exists" });
          return;
        }
      }

      if (updateData.userId) {
        try {
          updateData.userId = new mongoose.Types.ObjectId(updateData.userId);
        } catch (error) {
          res.status(400).json({ error: "Invalid user ID" });
          return;
        }
      }

      const discount = await Discount.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      }).populate(["productId", "userId"]);

      if (!discount) {
        res.status(404).json({ error: "Coupon not found" });
        return;
      }

      res.json({
        message: "Coupon updated successfully",
        discount,
      });
    } catch (error: any) {
      console.error("Error updating discount:", error);
      res.status(500).json({ error: "Error updating coupon" });
    }
  },
);

// Delete coupon (admin)
router.delete(
  "/:id",
  adminAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const discount = await Discount.findByIdAndDelete(id);

      if (!discount) {
        res.status(404).json({ error: "Coupon not found" });
        return;
      }

      res.json({ message: "Coupon deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting discount:", error);
      res.status(500).json({ error: "Error deleting coupon" });
    }
  },
);

// Get coupon usage history (admin)
router.get(
  "/:id/usage",
  adminAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const discount = await Discount.findById(id)
        .populate({
          path: "usageHistory.userId",
          select: "email username",
        })
        .populate({
          path: "usageHistory.orderId",
          select: "totalAmount createdAt products",
        });

      if (!discount) {
        res.status(404).json({ error: "Coupon not found" });
        return;
      }

      res.json({
        discount: {
          code: discount.code,
          name: discount.name,
          usedCount: discount.usedCount,
          maxUses: discount.maxUses,
        },
        usageHistory: discount.usageHistory,
      });
    } catch (error: any) {
      console.error("Error fetching discount usage:", error);
      res.status(500).json({ error: "Error fetching coupon usage history" });
    }
  },
);

// Generate coupon report (admin)
router.get(
  "/report/summary",
  adminAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate } = req.query;

      const matchStage: any = {};

      if (startDate || endDate) {
        matchStage.createdAt = {};
        if (startDate)
          matchStage.createdAt.$gte = new Date(startDate as string);
        if (endDate) matchStage.createdAt.$lte = new Date(endDate as string);
      }

      const summary = await Discount.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: "$type",
            count: { $sum: 1 },
            totalUsed: { $sum: "$usedCount" },
            activeCount: {
              $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            type: "$_id",
            count: 1,
            totalUsed: 1,
            activeCount: 1,
            _id: 0,
          },
        },
      ]);

      const totalStats = await Discount.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalCoupons: { $sum: 1 },
            totalUses: { $sum: "$usedCount" },
            activeCoupons: {
              $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
            },
          },
        },
      ]);

      res.json({
        summary,
        total: totalStats[0] || {
          totalCoupons: 0,
          totalUses: 0,
          activeCoupons: 0,
        },
      });
    } catch (error: any) {
      console.error("Error generating discount report:", error);
      res.status(500).json({ error: "Error while generating report" });
    }
  },
);

export default router;
