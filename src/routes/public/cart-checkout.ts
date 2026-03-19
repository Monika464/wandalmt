import express, { Request, Response } from "express";
import Stripe from "stripe";
import mongoose from "mongoose";
import Order from "../../models/order.js";
import User from "../../models/user.js";
import Product from "../../models/product.js";
import Resource from "../../models/resource.js";
import Discount from "../../models/discount.js";
import { userAuth } from "../../middleware/auth.js";
import {
  sendOrderConfirmationEmail,
  sendInvoiceEmail,
} from "../../services/emailService.js";
import { t } from "../../utils/translations.js";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// Rozszerz typ Request o language
interface RequestWithLang extends Request {
  lang?: string;
}

// ==================== HELPER FUNCTIONS ====================

const isValidImageUrl = (url: string): boolean => {
  if (!url || typeof url !== "string" || url.trim() === "") return false;
  try {
    const parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) return false;
  } catch {
    return false;
  }
  const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
  return imageExtensions.some((ext) => url.toLowerCase().includes(ext));
};

const getOptimizedImageUrl = (imageUrl: string): string => {
  if (!imageUrl) return "";
  if (imageUrl.includes("cloudinary.com") && imageUrl.includes("/upload/")) {
    return imageUrl.replace(
      "/upload/",
      "/upload/w_400,h_400,c_fill,f_auto,q_auto/",
    );
  }
  if (imageUrl.includes("imgix.net")) {
    return `${imageUrl}?w=400&h=400&fit=crop&auto=format`;
  }
  return imageUrl;
};

// ==================== CART CHECKOUT SESSION ====================

router.post(
  "/cart-checkout-session",
  userAuth,
  async (req: RequestWithLang, res: Response): Promise<void> => {
    try {
      const lang = (req.headers["accept-language"] as string) || "pl";
      const { items, couponCode, requireInvoice } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: t(lang, "checkout.cartEmpty") });
        return;
      }

      if (!req.user) {
        res.status(401).json({ error: t(lang, "orders.unauthorized") });
        return;
      }

      // Get full product data
      const productIds = items.map((item) => item._id);
      const products = await Product.find({ _id: { $in: productIds } })
        .select("title price description imageUrl content userId")
        .lean();

      if (products.length !== items.length) {
        res.status(404).json({ error: t(lang, "checkout.productsNotFound") });
        return;
      }

      // Prepare a product map
      const productMap: Record<string, any> = {};
      products.forEach((product) => {
        productMap[product._id.toString()] = product;
      });

      // Calculate your initial order total WITHOUT discount
      let totalAmount = items.reduce((sum, item) => {
        const product = productMap[item._id];
        return sum + product.price * (item.quantity || 1);
      }, 0);

      // Initialize variable discounts
      let discountAmount = 0;
      let discountDetails = null;
      let validatedCoupon = null;

      // Validate and calculate discount from coupon
      if (couponCode) {
        try {
          // Find coupon in the database
          const discount = await Discount.findOne({
            code: couponCode.toUpperCase(),
            isActive: true,
          }).populate("productId", "title price");

          if (!discount) {
            res.status(400).json({
              error: t(lang, "checkout.invalidCoupon"),
            });
            return;
          }

          // Check if the coupon is valid
          if (!discount.isValid()) {
            res.status(400).json({
              error: t(lang, "checkout.couponExpired"),
            });
            return;
          }

          // Check minimal order amount
          if (totalAmount < discount.minPurchaseAmount) {
            res.status(400).json({
              error: t(lang, "checkout.minPurchaseAmount", {
                amount: discount.minPurchaseAmount.toFixed(2),
              }),
            });
            return;
          }

          // Check if the coupon is assigned to the user
          if (
            discount.userId &&
            (!req.user._id || !discount.userId.equals(req.user._id))
          ) {
            res.status(403).json({
              error: t(lang, "checkout.couponNotAvailable"),
            });
            return;
          }

          // Calculate discount depending on coupon type
          if (discount.type === "product" && discount.productId) {
            // Coupon for a specific product
            const productId = discount.productId._id.toString();
            const cartItem = items.find((item: any) => item._id === productId);

            if (cartItem) {
              const product = productMap[productId];
              const itemTotal = product.price * (cartItem.quantity || 1);
              discountAmount = discount.calculateDiscount(itemTotal, productId);
            }
          } else {
            // Coupon for the entire order
            discountAmount = discount.calculateDiscount(totalAmount);
          }

          if (discountAmount > 0) {
            validatedCoupon = discount;
            discountDetails = {
              type: "coupon",
              code: discount.code,
              amount: discountAmount,
              description:
                discount.type === "percentage"
                  ? t(lang, "checkout.discountPercentage", {
                      value: discount.value,
                    })
                  : t(lang, "checkout.discountFixed", {
                      value: discount.value,
                    }),
            };

            // Calculate the final amount after discount
            totalAmount = Math.max(0, totalAmount - discountAmount);
          } else {
            res.status(400).json({
              error: t(lang, "checkout.couponNotApplicable"), // 👈 Tłumaczenie
            });
            return;
          }
        } catch (discountError: any) {
          console.error("Discount validation error:", discountError);
          res.status(400).json({
            error: t(lang, "checkout.couponValidationError"), // 👈 Tłumaczenie
          });
          return;
        }
      }

      // Prepare product details for ordering
      const orderProducts = items.map((item) => {
        const product = productMap[item._id];
        const quantity = item.quantity || 1;

        // Calculate the proportional share of the product in the total cart value
        const productTotal = product.price * quantity;
        const cartTotalWithoutDiscount = items.reduce((sum, i) => {
          const p = productMap[i._id];
          return sum + p.price * (i.quantity || 1);
        }, 0);

        // Calculate the discount for this product proportionally
        const productDiscount =
          (productTotal / cartTotalWithoutDiscount) * discountAmount;

        // Calculate the unit price after discount
        const pricePerUnitAfterDiscount =
          (productTotal - productDiscount) / quantity;

        // Round to 2 decimal places
        const discountedPrice =
          Math.round(pricePerUnitAfterDiscount * 100) / 100;

        // console.log("💰 Product price calculation:", {
        //   product: product.title,
        //   originalPrice: product.price,
        //   productTotal,
        //   productDiscount,
        //   pricePerUnitAfterDiscount,
        //   discountedPrice,
        //   quantity,
        // });

        return {
          productId: product._id,
          title: product.title,
          price: product.price,
          discountedPrice: discountedPrice,
          quantity: quantity,
          imageUrl: product.imageUrl,
          content: product.content,
          userId: product.userId,
        };
      });

      // ==========  SUM VALIDATION ==========
      //console.log("🔍 Validating price calculations...");

      const totalDiscounted = orderProducts.reduce(
        (sum, p) => sum + p.discountedPrice * p.quantity,
        0,
      );

      const totalOriginal = orderProducts.reduce(
        (sum, p) => sum + p.price * p.quantity,
        0,
      );

      // console.log("📊 Price summary:", {
      //   totalOriginal,
      //   discountAmount,
      //   totalAfterDiscount: totalAmount,
      //   calculatedDiscountedTotal: totalDiscounted,
      //   difference: totalAmount - totalDiscounted,
      //   shouldBeZero: Math.abs(totalAmount - totalDiscounted) < 0.01,
      // });

      // SUM VALIDATION - difference should be < 1 grosza
      if (Math.abs(totalAmount - totalDiscounted) > 0.01) {
        console.error("❌ ERROR: Discount calculation mismatch!");
        console.error("Recalculating with correction...");

        // Correction: recalculate with better precision
        orderProducts.forEach((p) => {
          const productTotal = p.price * p.quantity;
          const productDiscount =
            (productTotal / totalOriginal) * discountAmount;
          p.discountedPrice =
            Math.round(((productTotal - productDiscount) / p.quantity) * 100) /
            100;
        });

        // Check again
        // const correctedTotal = orderProducts.reduce(
        //   (sum, p) => sum + p.discountedPrice * p.quantity,
        //   0,
        // );

        // console.log("📊 Corrected price summary:", {
        //   correctedTotal,
        //   expectedTotal: totalAmount,
        //   newDifference: totalAmount - correctedTotal,
        // });
      }

      // 1. SAVE THE ORDER IN THE DATABASE (WITHOUT stripeSessionId AT THE BEGINNING)
      const newOrder = new Order({
        user: {
          userId: new mongoose.Types.ObjectId(req.user._id),
          email: req.user.email,
        },
        products: orderProducts,
        totalAmount,
        totalDiscount: discountAmount,
        status: "pending",
        couponCode: couponCode || null,
        discountApplied: discountDetails,
        requireInvoice: requireInvoice || false,
        createdAt: new Date(),
      });

      await newOrder.save();
      //console.log(`✅ Order saved in DB with ID: ${newOrder._id}`);

      // If we have a valid coupon, update the usage counter
      if (validatedCoupon) {
        try {
          validatedCoupon.usedCount += 1;
          validatedCoupon.usageHistory.push({
            userId: new mongoose.Types.ObjectId(req.user._id),
            orderId: newOrder._id,
            usedAt: new Date(),
            discountAmount: discountAmount,
          });
          await validatedCoupon.save();
          console.log(`✅ Discount usage updated for code: ${couponCode}`);
        } catch (updateError) {
          console.error("Error updating discount usage:", updateError);
          // We do not interrupt the checkout process if the coupon update fails.
        }
      }

      // 2. PREPARE LINE_ITEMS FOR STRIPE (WITH IMAGES!)
      const lineItems = items.map((item) => {
        const product = productMap[item._id];
        const itemQuantity = item.quantity || 1;

        // Find the right product at orderProducts
        const orderProduct = orderProducts.find(
          (op) => op.productId.toString() === product._id.toString(),
        );

        // Use discountedPrice if it exists, otherwise calculate
        let unitPrice = product.price;

        if (orderProduct && orderProduct.discountedPrice !== undefined) {
          unitPrice = orderProduct.discountedPrice;
          // console.log("✅ Using discountedPrice from orderProduct:", {
          //   product: product.title,
          //   original: product.price,
          //   discounted: orderProduct.discountedPrice,
          // });
        } else if (discountAmount > 0) {
          // Calculate proportionally as in orderProducts
          const productTotal = product.price * itemQuantity;
          const cartTotalWithoutDiscount = items.reduce((sum, i) => {
            const p = productMap[i._id];
            return sum + p.price * (i.quantity || 1);
          }, 0);

          const productDiscount =
            (productTotal / cartTotalWithoutDiscount) * discountAmount;
          unitPrice = (productTotal - productDiscount) / itemQuantity;
          // console.log("📊 Calculated unit price:", {
          //   product: product.title,
          //   calculated: unitPrice,
          // });
        }

        const productData: any = {
          name: product.title,
          description: product.description?.substring(0, 200) || "",
          metadata: {
            productId: product._id.toString(),
            originalPrice: product.price,
          },
        };

        // ADD IMAGE
        if (product.imageUrl && isValidImageUrl(product.imageUrl)) {
          const optimizedImage = getOptimizedImageUrl(product.imageUrl);
          productData.images = [optimizedImage];
        }

        return {
          price_data: {
            currency: "pln",
            product_data: productData,
            unit_amount: Math.round(unitPrice * 100),
          },
          quantity: itemQuantity,
        };
      });

      // 3. STRIPE SESSION CONFIGURATION
      const sessionConfig: any = {
        payment_method_types: ["card", "p24", "blik"],
        mode: "payment",
        line_items: lineItems,
        success_url: `${
          process.env.FRONTEND_URL || "http://localhost:5173"
        }/cart/return?session_id={CHECKOUT_SESSION_ID}&success=true&orderId=${
          newOrder._id
        }`,
        cancel_url: `${
          process.env.FRONTEND_URL || "http://localhost:5173"
        }/cart/cancel?canceled=true&orderId=${newOrder._id}`,
        customer_email: req.user.email,
        metadata: {
          orderId: newOrder._id.toString(),
          userId: req.user._id.toString(),
          couponCode: couponCode || "",
          originalTotal: (totalAmount + discountAmount).toFixed(2),
          discountAmount: discountAmount.toFixed(2),
          finalTotal: totalAmount.toFixed(2),
          hasDiscount: discountAmount > 0 ? "true" : "false",
        },
      };

      // Invoice
      if (requireInvoice) {
        sessionConfig.invoice_creation = { enabled: true };
        sessionConfig.billing_address_collection = "required";
      } else {
        sessionConfig.billing_address_collection = "auto";
      }

      // Custom text
      sessionConfig.custom_text = {
        submit: {
          message: t(lang, "checkout.stripeThankYouMessage"),
        },
      };

      // ADD TOTAL WITH A DISCOUNT TO YOUR STRIPE SESSION
      if (discountAmount > 0) {
        sessionConfig.metadata.hasDiscount = "true";
        sessionConfig.metadata.discountAmount = discountAmount.toFixed(2);
      }

      // 4. CREATE A STRIPE SESSION
      const session = await stripe.checkout.sessions.create(sessionConfig);
      //console.log("✅ Stripe session created!");

      // 5. UPDATE ORDER WITH REAL stripeSessionId
      newOrder.stripeSessionId = session.id;
      await newOrder.save();

      res.json({
        url: session.url,
        sessionId: session.id,
        orderId: newOrder._id,
        discountApplied: discountAmount > 0,
        discountAmount: discountAmount,
        originalTotal: totalAmount + discountAmount,
        finalTotal: totalAmount,
      });
    } catch (err: any) {
      console.error("Stripe error:", err);
      const lang = (req.headers["accept-language"] as string) || "pl"; // 👈 Download language for error

      if (err.code === 11000 && err.keyPattern?.stripeSessionId) {
        res.status(400).json({
          error: t(lang, "checkout.dataConflict"),
          code: "DUPLICATE_SESSION_ID",
        });
      } else if (
        err.type === "StripeInvalidRequestError" &&
        err.message.includes("metadata")
      ) {
        res.status(400).json({
          error: t(lang, "checkout.metadataError"),
        });
      } else if (err.type === "StripeInvalidRequestError") {
        res.status(400).json({
          error: err.message || t(lang, "checkout.stripeError"),
          code: err.code,
        });
      } else {
        res.status(500).json({
          error: t(lang, "checkout.sessionCreationError"),
          message: err.message,
        });
      }
    }
  },
);

// ==================== CART SESSION STATUS ====================

router.get(
  "/cart-session-status",
  userAuth,
  async (req: RequestWithLang, res: Response): Promise<void> => {
    console.log("🔔 /cart-session-status called with query:", req.query);
    try {
      const lang = (req.headers["accept-language"] as string) || "pl";

      const { session_id, orderId } = req.query;

      if (!session_id) {
        res.status(400).json({ error: t(lang, "checkout.missingSessionId") });
        return;
      }

      // Function for downloading sessions with the possibility of retrying
      const fetchSessionWithRetry = async (retries = 3, delay = 2000) => {
        for (let i = 0; i < retries; i++) {
          console.log(`🔄 Fetching session (attempt ${i + 1}/${retries})...`);

          try {
            const session = await stripe.checkout.sessions.retrieve(
              session_id as string,
              {
                expand: [
                  "line_items.data.price.product",
                  "total_details.breakdown",
                  "invoice",
                ],
              },
            );

            //If we have an invoice or it's the last attempt, return the session
            if (session.invoice || i === retries - 1) {
              if (session.invoice) {
                console.log(`✅ Invoice found on attempt ${i + 1}`);
              } else {
                console.log(`⚠️ No invoice after ${i + 1} attempts`);
              }
              return session;
            }

            // If there is no invoice and it is not the last attempt, wait and try again
            console.log(
              `⏳ No invoice yet, waiting ${delay}ms before retry...`,
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
          } catch (error) {
            console.error(`❌ Error on attempt ${i + 1}:`, error);
            if (i === retries - 1) throw error; // Throw error if last attempt
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }

        // This should never happen, but TypeScript needs a return
        throw new Error("Failed to fetch session after all retries");
      };

      // Use retry function
      const session = await fetchSessionWithRetry(5, 2000); // 5 attempts every 2 seconds

      // console.log("🧾 Session invoice data - full:", session.invoice);
      // console.log(
      //   "🧾 Session invoice details - summary:",
      //   session.invoice
      //     ? {
      //         id: (session.invoice as any).id,
      //         number: (session.invoice as any).number,
      //         status: (session.invoice as any).status,
      //         invoice_pdf: (session.invoice as any).invoice_pdf,
      //         hosted_invoice_url: (session.invoice as any).hosted_invoice_url,
      //       }
      //     : "No invoice data",
      // );

      if (session.payment_status !== "paid") {
        res.json({
          status: "pending",
          message: t(lang, "checkout.paymentPending"),
        });
        return;
      }

      // 1. FIND ORDER BY sessionId OR orderId
      let order;

      if (orderId) {
        order = await Order.findById(orderId);
      }

      if (!order && session.id) {
        order = await Order.findOne({ stripeSessionId: session.id });
      }

      if (!order && session.metadata?.orderId) {
        order = await Order.findById(session.metadata.orderId);
      }

      // 2. IF THE ORDER ALREADY EXISTS - just update it
      if (order) {
        //console.log(`✅ Found existing order: ${order._id}, updating...`);

        order.status = "paid";
        order.paidAt = new Date();

        if (!order.stripeSessionId) {
          order.stripeSessionId = session.id;
        }

        order.stripePaymentIntentId = session.payment_intent as string;

        if (session.total_details?.breakdown?.discounts?.[0]) {
          order.discount = session.total_details.breakdown.discounts[0];
        }

        if (session.invoice) {
          const invoice = session.invoice as any;

          // console.log("✅ Invoice FOUND when updating order:", {
          //   id: invoice.id,
          //   number: invoice.number,
          // });

          order.invoiceId = invoice.id;

          order.invoiceDetails = {
            invoiceNumber: invoice.number,
            invoicePdf: invoice.invoice_pdf,
            hostedInvoiceUrl: invoice.hosted_invoice_url,
            status: invoice.status,
            amountPaid: invoice.amount_paid / 100,
            createdAt: new Date(invoice.created * 1000),
          };

          // console.log(
          //   `🧾 Invoice created: ${order.invoiceId}, Number: ${invoice.number}`,
          // );
        }

        if (session.customer_details) {
          order.billingDetails = {
            name: session.customer_details.name || "",
            email: session.customer_details.email || "",
            phone: session.customer_details.phone || "",
            address: session.customer_details.address || {},
          };
        }

        await order.save();
        //console.log(`✅ Order ${order._id} updated as paid`);
      } else {
        console.log(`⚠️ Creating new order from cart-session-status...`);

        const productsData: any[] = [];

        if (session.metadata?.productsData) {
          try {
            const parsed = JSON.parse(session.metadata.productsData);
            if (Array.isArray(parsed)) {
              productsData.push(...parsed);
            }
          } catch (e) {
            console.error("Error parsing productsData from metadata:", e);
          }
        }

        if (productsData.length === 0 && session.line_items?.data) {
          session.line_items.data.forEach((item: any) => {
            if (item.price?.product) {
              const product = item.price.product;
              productsData.push({
                productId: product.metadata?.productId || "unknown",
                title: product.name || t(lang, "checkout.unknownProduct"), // 👈 Tłumaczenie
                price: item.price.unit_amount / 100,
                quantity: item.quantity,
                imageUrl: product.images?.[0] || "",
                description: product.description || "",
              });
            }
          });
        }

        if (productsData.length === 0 && session.amount_total) {
          productsData.push({
            productId: "unknown",
            title: t(lang, "checkout.unknownProduct"), // 👈 Tłumaczenie
            price: session.amount_total / 100,
            quantity: 1,
            imageUrl: "",
            description: t(lang, "checkout.defaultProductDescription"), // 👈 Tłumaczenie
          });
        }

        const totalAmount = productsData.reduce((sum, item) => {
          return sum + item.price * item.quantity;
        }, 0);

        const newOrder = new Order({
          stripeSessionId: session.id,
          stripePaymentIntentId: session.payment_intent as string,
          status: "paid",
          paidAt: new Date(),
          user: {
            userId: new mongoose.Types.ObjectId(
              session.metadata?.userId || req.user?._id,
            ),
            email:
              session.customer_email ||
              req.user?.email ||
              "unknown@example.com",
          },

          products: productsData.map((item) => ({
            productId:
              item.productId !== "unknown"
                ? new mongoose.Types.ObjectId(item.productId)
                : undefined,
            title: item.title,
            price: item.price,
            quantity: item.quantity,
            imageUrl: item.imageUrl,
            content: item.description,
          })),
          totalAmount,
          couponCode: session.metadata?.couponCode || null,
          requireInvoice: session.metadata?.requireInvoice === "true",
          discount: session.total_details?.breakdown?.discounts?.[0] || null,
          billingDetails: session.customer_details
            ? {
                name: session.customer_details.name || "",
                email: session.customer_details.email || "",
                phone: session.customer_details.phone || "",
                address: session.customer_details.address || {},
              }
            : null,
          createdAt: new Date(session.created * 1000),
        });

        if (session.invoice) {
          const invoice = session.invoice as any;
          //console.log("✅ Invoice found:", invoice.id, invoice.number);
          newOrder.invoiceId = invoice.id;

          newOrder.invoiceDetails = {
            invoiceNumber: invoice.number,
            invoicePdf: invoice.invoice_pdf,
            hostedInvoiceUrl: invoice.hosted_invoice_url,
            status: invoice.status,
            amountPaid: invoice.amount_paid / 100,
            createdAt: new Date(invoice.created * 1000),
          };

          // console.log(
          //   `🧾 Invoice created: ${newOrder.invoiceId}, Number: ${invoice.number}`,
          // );
        }

        await newOrder.save();
        order = newOrder;
        console.log(
          `✅ Created new order ${order._id} from cart-session-status`,
        );
      }

      // 4. ASSIGN RESOURCES TO USER
      if (order && order.products.length > 0 && order.user?.userId) {
        const productIds = order.products
          .map((p) => p.productId)
          .filter((id) => id && mongoose.Types.ObjectId.isValid(id));

        if (productIds.length > 0) {
          const resources = await Resource.find({
            productId: { $in: productIds },
          }).select("_id");

          if (resources.length > 0) {
            await User.updateOne(
              { _id: order.user.userId },
              {
                $addToSet: {
                  resources: { $each: resources.map((r) => r._id) },
                },
              },
            );
            console.log(
              `🔹 ${resources.length} resources assigned to user ${order.user.userId}`,
            );
          }
        }
      }

      // 5. SEND CONFIRMATION EMAIL
      setTimeout(async () => {
        try {
          //console.log(`📧 Preparing to send emails for order ${order._id}`);

          const baseEmailData = {
            orderId: order._id.toString(),
            email: order.user.email,
            userName: order.user.name || order.user.email.split("@")[0],
            totalAmount: order.totalAmount,
            products: order.products.map((p: any) => ({
              name: p.title || p.name || t(lang, "checkout.product"),
              quantity: p.quantity,
              price: p.discountedPrice || p.price,
            })),
            requireInvoice: order.requireInvoice || false,
            createdAt: order.paidAt || order.createdAt,
            billingDetails: order.billingDetails || null,
            language: lang,
          };

          const invoiceUrl =
            order.invoiceDetails?.hostedInvoiceUrl ||
            order.invoiceDetails?.invoicePdf ||
            (order.invoiceId
              ? `https://dashboard.stripe.com/invoices/${order.invoiceId}`
              : null);

          await sendOrderConfirmationEmail({
            ...baseEmailData,
            invoiceUrl: invoiceUrl,
          });

          if (order.invoiceDetails) {
            const invoiceLink =
              order.invoiceDetails.hostedInvoiceUrl ||
              order.invoiceDetails.invoicePdf;

            if (invoiceLink) {
              console.log(
                `📧 Sending separate invoice email for order ${order._id}`,
              );
              await sendInvoiceEmail(
                order.user.email,
                order._id.toString(),
                invoiceLink,
                order.invoiceDetails.invoiceNumber,
                lang,
              );
              console.log(`✅ Invoice email sent for order ${order._id}`);
            }
          }

          console.log(`✅ All emails sent successfully for order ${order._id}`);
        } catch (emailError) {
          console.error("❌ Error in email sending process:", {
            error: emailError,
            orderId: order._id,
            email: order.user.email,
          });
        }
      }, 500);

      // 6. PREPARE AN ANSWER
      const response: any = {
        status: "complete",
        message: t(lang, "checkout.paymentSuccess"),
        orderId: order._id,
        invoiceId: order.invoiceId,
        totalAmount: order.totalAmount,
      };

      if (order.invoiceId) {
        response.invoiceUrl = `https://dashboard.stripe.com/invoices/${order.invoiceId}`;
        console.log(`✅ Returning invoiceUrl: ${response.invoiceUrl}`);
      } else {
        console.log(`❌ No invoiceId for order: ${order._id}`);
      }

      if (order.discount && order.discount.amount) {
        response.discountApplied = true;
        response.discountAmount = order.discount.amount / 100;
      }

      res.json(response);
    } catch (err: any) {
      console.error("Payment status error:", err.message || err);
      const lang = (req.headers["accept-language"] as string) || "pl";

      if (err.code === 11000 && err.keyPattern?.stripeSessionId) {
        try {
          const existingOrder = await Order.findOne({
            stripeSessionId: req.query.session_id,
          });
          if (existingOrder) {
            res.json({
              status: "complete",
              message: t(lang, "checkout.paymentAlreadyRegistered"),
              orderId: existingOrder._id,
              invoiceId: existingOrder.invoiceId,
              totalAmount: existingOrder.totalAmount,
            });
            return;
          }
        } catch (findErr) {
          // Continue with error
        }
      }

      res.status(500).json({
        error: err.message || t(lang, "checkout.paymentCheckError"), // 👈 Tłumaczenie
        code: err.code || "UNKNOWN_ERROR",
      });
    }
  },
);

export default router;
