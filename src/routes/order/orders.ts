import express, { Request, Response } from "express";
import mongoose from "mongoose";
import Stripe from "stripe";
import Order from "../../models/order.js";
import { adminAuth, userAuth } from "../../middleware/auth.js";
import Resource from "../../models/resource.js";
import User from "../../models/user.js";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// Define the type for the product in the order
interface OrderProduct {
  productId: mongoose.Types.ObjectId;
  title: string;
  price: number;
  discountedPrice?: number;
  quantity: number;
  refundQuantity?: number;
  refunded?: boolean;
  refundedAt?: Date;
  [key: string]: any;
}

// Define the type for refund details
interface RefundDetail {
  productId: mongoose.Types.ObjectId;
  title: string;
  quantity: number;
  price: number;
  amount: number;
  reason: string;
}

/**
 * GET /api/orders
 * 📦 Returns all orders (for admin)
 */
router.get(
  "/",
  adminAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orders = await Order.find().sort({ createdAt: -1 });
      res.status(200).json(orders);
    } catch (error) {
      console.error("Error fetching all orders:", error);
      res.status(500).json({ message: "Server error while fetching orders" });
    }
  },
);

/**
 * GET /api/orders/user
 * 📦 Returns orders for the logged-in user along with their resources
 */
router.get(
  "/user",
  userAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user?._id) {
        res.status(401).json({ message: "Brak autoryzacji" });
        return;
      }

      const userId = new mongoose.Types.ObjectId(req.user._id);

      // 🔹 Get user orders
      const orders = await Order.find({
        "user.userId": userId,
        status: { $in: ["paid", "partially_refunded", "refunded"] },
      })
        .sort({ createdAt: -1 })
        .lean();

      // 🔹 Get the user along with their resources
      const user = await User.findById(userId).populate("resources");
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      const userResources = user.resources || [];

      const response = orders.map((order: any) => {
        const normalizedProducts = order.products
          ? order.products.map((product: any) => {
              // If product has a nested 'product' object, flatten it
              if (product.product && typeof product.product === "object") {
                return {
                  productId: product.product._id || product.productId,
                  title: product.title || product.product.title,
                  price: product.price || product.product.price,
                  discountedPrice: product.discountedPrice,
                  quantity: product.quantity || 1,
                  imageUrl: product.imageUrl || product.product.imageUrl,
                  content: product.content || product.product.content,
                  description:
                    product.description || product.product.description,

                  refunded: product.refunded,
                  refundedAt: product.refundedAt,
                  refundId: product.refundId,
                  refundAmount: product.refundAmount,
                  refundQuantity: product.refundQuantity,

                  product: product.product,
                };
              }
              // If it already has a flat structure, return it as is
              return product;
            })
          : [];

        return {
          ...order,
          products: normalizedProducts,
          userResources: userResources.filter((resource: any) => {
            return normalizedProducts.some((p: any) => {
              const productId = p.productId || (p.product && p.product._id);
              return (
                productId &&
                resource.productId &&
                resource.productId.toString() === productId.toString()
              );
            });
          }),
        };
      });
      const pendingOrdersCount = await Order.countDocuments({
        "user.userId": userId,
        status: "pending",
      });

      res.status(200).json({
        orders: response,
        stats: {
          total: response.length,
          pending: pendingOrdersCount,
          lastUpdated: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error while fetching user orders:", error);
      res.status(500).json({
        message: "Server error while fetching user orders",
      });
    }
  },
);

router.post(
  "/refund/:id",
  userAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (Array.isArray(id)) {
        res.status(400).json({ message: "Invalid format of identifier" });
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ message: "Invalid order identifier" });
        return;
      }

      const order = await Order.findById(id);
      if (!order) {
        res.status(404).json({ message: "Order not found" });
        return;
      }

      // ✅ Check if order.user exists
      if (!order.user) {
        res.status(400).json({ message: "Missing user data in the order" });
        return;
      }

      if (
        !req.user ||
        (order.user.userId?.toString() !== req.user._id.toString() &&
          req.user.role !== "admin")
      ) {
        res.status(403).json({ message: "No refund entitlement" });
        return;
      }

      // If already returned
      if (order.refundedAt) {
        res
          .status(400)
          .json({ message: "This order has already been refunded." });
        return;
      }

      // 🔹 Check if totalAmount exists
      if (order.totalAmount === undefined || order.totalAmount === null) {
        res.status(400).json({
          message: "Missing order amount - cannot process refund",
        });
        return;
      }

      // 🔹 Find payment_intent based on sessionId
      if (!order.stripeSessionId) {
        res.status(400).json({ message: "Missing Stripe session identifier" });
        return;
      }

      const session = await stripe.checkout.sessions.retrieve(
        order.stripeSessionId,
      );

      if (!session.payment_intent) {
        res.status(400).json({ message: "Payment not found for refund." });
        return;
      }

      // 🔍 GET ACTUAL AMOUNT FROM STRIPE
      const paymentIntent = await stripe.paymentIntents.retrieve(
        session.payment_intent as string,
      );

      // Use the exact amount from Stripe (in cents)
      const exactAmountInCents = paymentIntent.amount;
      const exactAmountInZloty = exactAmountInCents / 100;

      // Check if there are already any refunds
      const existingRefunds = await stripe.refunds.list({
        payment_intent: session.payment_intent as string,
        limit: 100,
      });

      const alreadyRefundedInCents = existingRefunds.data.reduce(
        (sum, refund) => sum + refund.amount,
        0,
      );

      const availableForRefundInCents =
        exactAmountInCents - alreadyRefundedInCents;

      // Safe use of totalAmount with a default value of 0
      const orderTotal = order.totalAmount ?? 0;
      const orderDiscount = order.totalDiscount ?? 0;

      // console.log("💰 Stripe payment details:", {
      //   paymentIntentId: paymentIntent.id,
      //   amountInCents: exactAmountInCents,
      //   amountInZloty: exactAmountInZloty,
      //   alreadyRefundedInCents,
      //   alreadyRefundedInZloty: alreadyRefundedInCents / 100,
      //   availableForRefundInCents,
      //   availableForRefundInZloty: availableForRefundInCents / 100,
      //   orderTotal,
      //   orderTotalInCents: Math.round(orderTotal * 100),
      // });

      // Use the available amount from Stripe, not from the database!
      const refundAmountInCents = availableForRefundInCents;
      const refundAmountInZloty = refundAmountInCents / 100;

      const isDiscountedOrder = !!(order.couponCode || orderDiscount > 0);

      if (isDiscountedOrder) {
        console.log("ℹ️ Full refund for discounted order:", {
          couponCode: order.couponCode,
          totalDiscount: orderDiscount,
          refundAmountFromDB: orderTotal,
          refundAmountFromStripe: refundAmountInZloty,
          refundAmountInCents,
          difference: orderTotal - refundAmountInZloty,
        });
      }

      // 🔹 Execute refund using the exact amount from Stripe
      const refund = await stripe.refunds.create({
        payment_intent: session.payment_intent as string,
        amount: refundAmountInCents, // Use the amount in cents without rounding!
        metadata: {
          orderId: order._id.toString(),
          couponApplied: order.couponCode || "none",
          originalTotal: (orderTotal + orderDiscount).toString(),
          discountAmount: orderDiscount.toString(),
          stripeAmount: refundAmountInCents.toString(),
        },
      });

      // 🔹 Update document in MongoDB
      order.set({
        refundedAt: new Date(),
        refundId: refund.id,
        refundAmount: refundAmountInZloty, // Record the actual refunded amount
        status: "refunded",
      });

      await order.save();

      // 🔹 Remove resources associated with products from this order for the user
      if (order.user?.userId) {
        const userId = order.user.userId;
        const productIds = order.products
          .map((p: any) =>
            typeof p.product === "object" ? p.product._id : p.productId,
          )
          .filter((id: any) => id != null);

        const resourcesToRemove = await Resource.find({
          productId: { $in: productIds },
        }).select("_id");

        if (resourcesToRemove.length > 0) {
          await mongoose.model("User").updateOne(
            { _id: userId },
            {
              $pull: {
                resources: { $in: resourcesToRemove.map((r) => r._id) },
              },
            },
          );
        }
      }

      const responseData: any = {
        message: isDiscountedOrder
          ? "Full refund successfully processed (discount retained in settlement). Assets removed from user's account"
          : "Return successfully completed. Resources removed from user account",
        refund: {
          id: refund.id,
          amount: refundAmountInZloty,
          amountInCents: refundAmountInCents,
          currency: "pln",
        },
        order: {
          id: order._id,
          status: order.status,
          refundedAt: order.refundedAt,
        },
      };

      if (isDiscountedOrder) {
        responseData.note =
          "For orders with a coupon, refunds are only possible for the full amount paid.";
        responseData.originalTotal = orderTotal + orderDiscount;
        responseData.discountApplied = orderDiscount;
      }

      res.status(200).json(responseData);
    } catch (error) {
      console.error("Error processing order refund:", error);
      res.status(500).json({
        message: "Server error during refund",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

//PARTIAL

router.post(
  "/refund/:orderId/partial",
  userAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { orderId } = req.params;
      const { refundItems } = req.body;

      // console.log("🛠️ Partial refund request received:", {
      //   orderId,
      //   refundItems,
      //   timestamp: new Date().toISOString(),
      // });

      if (
        !refundItems ||
        !Array.isArray(refundItems) ||
        refundItems.length === 0
      ) {
        res.status(400).json({ error: "No products to return" });
        return;
      }

      // Find the order
      const order = await Order.findById(orderId);

      if (!order) {
        res.status(404).json({ error: "Order not found" });
        return;
      }

      // console.log("🔍 Order found for refund:", {
      //   orderId,
      //   status: order.status,
      //   totalAmount: order.totalAmount,
      //   products: order.products.map((p: any) => ({
      //     title: p.title,
      //     price: p.price,
      //     discountedPrice: p.discountedPrice,
      //     quantity: p.quantity,
      //     refundQuantity: p.refundQuantity || 0,
      //   })),
      // });

      // ⚠️ BLOCKADE - Check if the order has a coupon/discount
      if (order.couponCode || (order.totalDiscount || 0) > 0) {
        console.log("🚫 Blocking partial refund - order has discount/coupon:", {
          couponCode: order.couponCode,
          totalDiscount: order.totalDiscount,
        });

        res.status(400).json({
          error:
            "Partial refund is not possible for orders with a coupon or discount. Please contact customer support.",
          code: "PARTIAL_REFUND_DISCOUNT_BLOCKED",
        });
        return;
      }

      // Check if the order has been paid
      if (order.status !== "paid" && order.status !== "partially_refunded") {
        res.status(400).json({ error: "Order is not eligible for refund" });
        return;
      }

      // Check if the user has permissions
      if (!order.user) {
        res.status(400).json({ error: "No user data in order" });
        return;
      }

      if (
        req.user._id.toString() !== order.user.userId?.toString() &&
        req.user.role !== "admin"
      ) {
        res.status(403).json({ error: "No permissions" });
        return;
      }

      // 🔍 CHECK AVAILABLE STRIPE AMOUNT FIRST
      let availableInStripe = 0;
      let totalAmountInStripe = 0;
      let alreadyRefundedInStripe = 0;

      try {
        if (!order.stripePaymentIntentId) {
          throw new Error("No Stripe payment intent ID found");
        }

        const paymentIntent = await stripe.paymentIntents.retrieve(
          order.stripePaymentIntentId,
        );
        totalAmountInStripe = paymentIntent.amount / 100;

        const refundsList = await stripe.refunds.list({
          payment_intent: order.stripePaymentIntentId,
          limit: 100,
        });

        alreadyRefundedInStripe = refundsList.data.reduce(
          (sum, refund) => sum + refund.amount / 100,
          0,
        );

        availableInStripe = totalAmountInStripe - alreadyRefundedInStripe;

        // console.log("💰 Stripe refund status:", {
        //   totalAmountInStripe,
        //   alreadyRefundedInStripe,
        //   availableInStripe,
        // });
      } catch (stripeError: any) {
        console.error("❌ Stripe API error:", stripeError.message);
        res.status(500).json({
          error: "Cannot check payment status in Stripe",
          details: stripeError.message,
        });
        return;
      }

      // Calculate refund amount - ONLY FOR SELECTED PRODUCTS
      let totalRefundAmount = 0;
      const refundDetails: RefundDetail[] = [];

      for (const refundItem of refundItems) {
        const product = order.products.find(
          (p: any) => p.productId?.toString() === refundItem.productId,
        ) as OrderProduct | undefined;

        if (!product) {
          res.status(404).json({
            error: `Product not found: ${refundItem.productId}`,
          });
          return;
        }

        // Check available quantity for refund
        const alreadyRefunded = product.refundQuantity || 0;
        const productQuantity = product.quantity || 0;
        const availableToRefund = productQuantity - alreadyRefunded;

        // console.log(`📊 Product: ${product.title}`, {
        //   price: product.price,
        //   discountedPrice: product.discountedPrice,
        //   totalQuantity: productQuantity,
        //   alreadyRefunded,
        //   availableToRefund,
        //   requestedRefund: refundItem.quantity,
        // });

        if (availableToRefund < refundItem.quantity) {
          res.status(400).json({
            error: `Insufficient quantity available for refund for product: ${product.title}`,
            available: availableToRefund,
            requested: refundItem.quantity,
          });
          return;
        }

        // 🔥 FIX: Safe use of priceToUse with default value
        const priceToUse = product.discountedPrice ?? product.price ?? 0;

        if (priceToUse === 0) {
          console.warn(`⚠️ Product ${product.title} has zero price!`);
        }

        const productRefundAmount = priceToUse * refundItem.quantity;
        const roundedAmount = Math.round(productRefundAmount * 100) / 100;

        // console.log("💰 Product refund calculation:", {
        //   product: product.title,
        //   priceUsed: priceToUse,
        //   quantity: refundItem.quantity,
        //   calculatedAmount: productRefundAmount,
        //   roundedAmount,
        // });

        totalRefundAmount += roundedAmount;

        refundDetails.push({
          productId: product.productId,
          title: product.title,
          quantity: refundItem.quantity,
          price: priceToUse,
          amount: roundedAmount,
          reason: refundItem.reason || "Partial refund",
        });
      }

      // Zaokrąglij końcową kwotę
      totalRefundAmount = Math.round(totalRefundAmount * 100) / 100;

      // console.log("💰 Total refund calculation:", {
      //   totalRefundAmount,
      //   refundDetails,
      //   availableInStripe,
      // });

      // CRITICAL VALIDATION - compare with available amount in Stripe
      if (totalRefundAmount > availableInStripe) {
        // console.error("❌ Refund amount exceeds available amount:", {
        //   requested: totalRefundAmount,
        //   available: availableInStripe,
        //   difference: totalRefundAmount - availableInStripe,
        // });

        res.status(400).json({
          error: `Requested refund amount (${totalRefundAmount.toFixed(2)} zł) is greater than available in Stripe (${availableInStripe.toFixed(2)} zł).`,
          details: {
            requestedAmount: totalRefundAmount,
            availableInStripe,
            alreadyRefundedInStripe,
            totalAmountInStripe,
          },
        });
        return;
      }

      if (totalRefundAmount <= 0) {
        res.status(400).json({ error: "No refund amount available" });
        return;
      }

      //console.log("✅ Order validation passed!");

      // Make a refund in Stripe
      try {
        const refund = await stripe.refunds.create({
          payment_intent: order.stripePaymentIntentId,
          amount: Math.round(totalRefundAmount * 100),
          reason: "requested_by_customer",
          metadata: {
            orderId: order._id.toString(),
            refundType: "partial",
            refundItems: JSON.stringify(
              refundDetails.map((item) => ({
                productId: item.productId?.toString(),
                title: item.title,
                quantity: item.quantity,
                amount: item.amount,
              })),
            ),
          },
        });

        // console.log("✅ Stripe refund created:", {
        //   refundId: refund.id,
        //   amount: refund.amount / 100,
        //   status: refund.status,
        // });

        // Update products in your order
        for (const refundDetail of refundDetails) {
          const product = order.products.find(
            (p: any) =>
              p.productId?.toString() === refundDetail.productId?.toString(),
          );

          if (product) {
            product.refundQuantity =
              (product.refundQuantity || 0) + refundDetail.quantity;
            product.refunded = product.refundQuantity === product.quantity;
            product.refundedAt = product.refunded ? new Date() : undefined;
          }
        }

        if (!order.partialRefunds) {
          order.partialRefunds = [] as any;
        }

        // Add a new twist to the story
        (order.partialRefunds as any).push({
          refundId: refund.id,
          amount: totalRefundAmount,
          createdAt: new Date(),
          reason: refundDetails[0]?.reason || "Partial refund",
          products: refundDetails,
        });

        // Update order status
        const allProductsRefunded = order.products.every(
          (p: any) => (p.refundQuantity || 0) === p.quantity,
        );

        if (allProductsRefunded) {
          order.status = "refunded";
          order.refundedAt = new Date();
          order.refundId = refund.id;
          order.refundAmount = order.totalAmount;
        } else {
          order.status = "partially_refunded";
        }

        // Save changes
        await order.save();

        // Delete user resources for returned products
        if (order.user?.userId) {
          const refundedProductIds = refundDetails
            .map((item) => item.productId)
            .filter((id): id is mongoose.Types.ObjectId => id != null);

          if (refundedProductIds.length > 0) {
            // console.log("📦 Looking for resources to remove:", {
            //   userId: order.user.userId,
            //   productIds: refundedProductIds.map((id) => id.toString()),
            // });

            // 🔥  1: Find Resources that have this productId
            const resourcesToRemove = await Resource.find({
              productId: { $in: refundedProductIds },
            }).select("_id");

            const resourceIds = resourcesToRemove.map((r) => r._id);

            // console.log("📦 Found resources to remove:", {
            //   count: resourceIds.length,
            //   resourceIds: resourceIds.map((id: any) => id.toString()),
            // });

            if (resourceIds.length > 0) {
              // 🔥 2: Remove references from User (only those specific Resource IDs)
              const updateResult = await User.updateOne(
                { _id: order.user.userId },
                {
                  $pull: {
                    resources: { $in: resourceIds },
                  },
                },
              );

              // console.log("📦 User resources updated:", {
              //   userId: order.user.userId,
              //   removedResourceIds: resourceIds.map((id: any) => id.toString()),
              //   modifiedCount: updateResult.modifiedCount,
              // });

              // If modifiedCount = 0, it means that no such references were found
              if (updateResult.modifiedCount === 0) {
                console.log(
                  "⚠️ No resources were removed - check if resourceIds match user's resources",
                );
              }

              // 🔥 STEP 3: Optional - delete the Resource itself (if you want)
              // await Resource.deleteMany({ _id: { $in: resourceIds } });
            }
          }
        }

        res.json({
          success: true,
          message: `Partial refund ${totalRefundAmount.toFixed(2)} PLN was made`,
          refund: {
            id: refund.id,
            amount: totalRefundAmount,
            status: refund.status,
          },
          order: {
            id: order._id,
            status: order.status,
            products: order.products.map((p: any) => ({
              title: p.title,
              quantity: p.quantity,
              refundQuantity: p.refundQuantity || 0,
              refunded: p.refunded,
            })),
          },
          details: {
            refundedProducts: refundDetails,
          },
        });
      } catch (stripeRefundError: any) {
        console.error("❌ Stripe refund creation error:", {
          type: stripeRefundError.type,
          message: stripeRefundError.message,
          stack: stripeRefundError.stack,
        });

        if (
          stripeRefundError.type === "StripeInvalidRequestError" &&
          stripeRefundError.message.includes("greater than unrefunded amount")
        ) {
          // Refresh data from Stripe
          const refunds = await stripe.refunds.list({
            payment_intent: order.stripePaymentIntentId,
            limit: 100,
          });

          const totalRefunded = refunds.data.reduce(
            (sum, r) => sum + r.amount / 100,
            0,
          );

          const paymentIntent = await stripe.paymentIntents.retrieve(
            order.stripePaymentIntentId,
          );
          const available = paymentIntent.amount / 100 - totalRefunded;

          res.status(400).json({
            error: `Available amount for refund: ${available.toFixed(2)} PLN`,
            details: {
              availableForRefund: available,
              totalRefunded,
              totalAmount: paymentIntent.amount / 100,
              requestedAmount: totalRefundAmount,
            },
          });
        } else {
          res.status(500).json({
            error: "Error creating refund in Stripe",
            details: stripeRefundError.message,
          });
        }
      }
    } catch (err: any) {
      console.error("❌ Partial refund error:", err);
      res.status(500).json({
        error: "Error creating partial refund",
        details: err.message,
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
      });
    }
  },
);

export default router;
