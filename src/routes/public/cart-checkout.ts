import express, { Request, Response } from "express";
import Stripe from "stripe";
import mongoose from "mongoose";
import Order from "../../models/order.js";
import User from "../../models/user.js";
import Product from "../../models/product.js";
import Resource from "../../models/resource.js";
import { userAuth } from "../../middleware/auth.js";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

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
      "/upload/w_400,h_400,c_fill,f_auto,q_auto/"
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
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { items, couponCode, requireInvoice, invoiceData } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: "Brak produktów w koszyku" });
        return;
      }

      if (!req.user) {
        res.status(401).json({ error: "Użytkownik nieautoryzowany" });
        return;
      }

      // Pobierz pełne dane produktów
      const productIds = items.map((item) => item._id);
      const products = await Product.find({ _id: { $in: productIds } })
        .select("title price description imageUrl content userId")
        .lean();

      if (products.length !== items.length) {
        res
          .status(404)
          .json({ error: "Niektóre produkty nie zostały znalezione" });
        return;
      }

      // Przygotuj mapę produktów
      const productMap: Record<string, any> = {};
      products.forEach((product) => {
        productMap[product._id.toString()] = product;
      });

      // Przygotuj dane produktów do zamówienia
      const orderProducts = items.map((item) => {
        const product = productMap[item._id];
        return {
          productId: product._id,
          title: product.title,
          price: product.price,
          quantity: item.quantity || 1,
          imageUrl: product.imageUrl,
          content: product.content,
          userId: product.userId,
        };
      });

      // Oblicz sumę zamówienia
      const totalAmount = orderProducts.reduce((sum, item) => {
        return sum + item.price * item.quantity;
      }, 0);

      // 1. ZAPISZ ZAMÓWIENIE W BAZIE (BEZ stripeSessionId NA POCZĄTKU)
      const newOrder = new Order({
        user: {
          userId: new mongoose.Types.ObjectId(req.user._id),
          email: req.user.email,
        },
        products: orderProducts,
        totalAmount,
        status: "pending",
        couponCode: couponCode || null,
        requireInvoice: requireInvoice || false,
        invoiceData: requireInvoice ? invoiceData : null,
        createdAt: new Date(),
        // NIE DODAWAJ stripeSessionId JESZCZE!
      });

      await newOrder.save();
      console.log(`✅ Order saved in DB with ID: ${newOrder._id}`);

      // 2. PRZYGOTUJ LINE_ITEMS DLA STRIPE (Z OBRAZKAMI!)
      const lineItems = items.map((item) => {
        const product = productMap[item._id];
        const productData: any = {
          name: product.title,
          description: product.description?.substring(0, 200) || "",
          metadata: {
            productId: product._id.toString(),
          },
        };

        // DODAJ OBRAZEK
        if (product.imageUrl && isValidImageUrl(product.imageUrl)) {
          const optimizedImage = getOptimizedImageUrl(product.imageUrl);
          productData.images = [optimizedImage];
        }

        return {
          price_data: {
            currency: "pln",
            product_data: productData,
            unit_amount: Math.round(product.price * 100),
          },
          quantity: item.quantity || 1,
        };
      });

      // 3. KONFIGURACJA SESJI STRIPE
      console.log("fronturl", process.env.FRONTEND_URL);
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
        },
      };

      // Faktura
      if (requireInvoice) {
        sessionConfig.billing_address_collection = "required";
        sessionConfig.invoice_creation = { enabled: true };

        if (invoiceData?.companyName) {
          sessionConfig.metadata.companyName =
            invoiceData.companyName.substring(0, 50);
          sessionConfig.metadata.taxId =
            invoiceData.taxId?.substring(0, 20) || "";
        }
      } else {
        sessionConfig.billing_address_collection = "auto";
      }

      // Kupon
      if (couponCode) {
        sessionConfig.allow_promotion_codes = true;
        sessionConfig.metadata.couponCode = couponCode.substring(0, 20);
      }

      // Custom text
      sessionConfig.custom_text = {
        submit: {
          message:
            "Dziękujemy za zakupy! Dostęp do kursów otrzymasz natychmiast po płatności.",
        },
      };

      sessionConfig.automatic_tax = { enabled: true };

      // 4. STWÓRZ SESJĘ STRIPE
      const session = await stripe.checkout.sessions.create(sessionConfig);
      console.log("✅ Stripe session created!");
      console.log("Session ID:", session.id);
      console.log("Session URL:", session.url);
      console.log("Success URL in session:", session.success_url);
      console.log("Cancel URL in session:", session.cancel_url);

      // 5. ZAKTUALIZUJ ZAMÓWIENIE O PRAWDZIWE stripeSessionId
      newOrder.stripeSessionId = session.id;
      await newOrder.save();

      console.log(`✅ Order updated with Stripe session ID: ${session.id}`);

      console.log(
        `🔄 Order ${newOrder._id} updated with Stripe session ID: ${session.id}`
      );

      res.json({
        url: session.url,
        sessionId: session.id,
        orderId: newOrder._id,
      });
    } catch (err: any) {
      console.error("Stripe error:", err);

      if (err.code === 11000 && err.keyPattern?.stripeSessionId) {
        // Błąd duplikatu - najprawdopodobniej masz unikalny indeks
        res.status(400).json({
          error: "Konflikt danych. Proszę spróbować ponownie.",
          code: "DUPLICATE_SESSION_ID",
        });
      } else if (
        err.type === "StripeInvalidRequestError" &&
        err.message.includes("metadata")
      ) {
        res.status(400).json({
          error: "Błąd danych - zbyt duże metadane",
        });
      } else {
        res.status(500).json({
          error: "Błąd tworzenia sesji płatności",
          message: err.message,
        });
      }
    }
  }
);

// ==================== CART SESSION STATUS ====================

router.get(
  "/cart-session-status",
  userAuth,
  async (req: Request, res: Response): Promise<void> => {
    console.log("🔔 /cart-session-status called with query:", req.query);
    try {
      const { session_id, orderId } = req.query;

      if (!session_id) {
        res.status(400).json({ error: "Brak session_id w zapytaniu" });
        return;
      }

      const session = await stripe.checkout.sessions.retrieve(
        session_id as string,
        {
          expand: [
            "line_items.data.price.product",
            "total_details.breakdown",
            "invoice",
          ],
        }
      );

      if (session.payment_status !== "paid") {
        res.json({
          status: "pending",
          message: "⏳ Płatność w trakcie przetwarzania",
        });
        return;
      }

      // 1. ZNAJDŹ ZAMÓWIENIE PO sessionId LUB orderId
      let order;

      // Spróbuj najpierw po orderId z URL
      if (orderId) {
        order = await Order.findById(orderId);
        console.log(
          `🔍 Looking for order by orderId: ${orderId}, found: ${
            order ? "yes" : "no"
          }`
        );
      }

      // Jeśli nie znaleziono, szukaj po stripeSessionId
      if (!order && session.id) {
        order = await Order.findOne({ stripeSessionId: session.id });
        console.log(
          `🔍 Looking for order by stripeSessionId: ${session.id}, found: ${
            order ? "yes" : "no"
          }`
        );
      }

      // Jeśli nadal nie znaleziono, spróbuj po metadata
      if (!order && session.metadata?.orderId) {
        order = await Order.findById(session.metadata.orderId);
        console.log(
          `🔍 Looking for order by metadata.orderId: ${
            session.metadata.orderId
          }, found: ${order ? "yes" : "no"}`
        );
      }

      // 2. JEŚLI ZAMÓWIENIE JUŻ ISTNIEJE - tylko je zaktualizuj
      if (order) {
        console.log(`✅ Found existing order: ${order._id}, updating...`);

        // Zaktualizuj status
        order.status = "paid";
        order.paidAt = new Date();

        if (!order.stripeSessionId) {
          order.stripeSessionId = session.id;
        }

        order.stripePaymentIntentId = session.payment_intent as string;

        // Dodaj dane z Stripe
        if (session.total_details?.breakdown?.discounts?.[0]) {
          order.discount = session.total_details.breakdown.discounts[0];
        }

        if (session.invoice) {
          order.invoiceId = session.invoice.toString();
        }

        // if (session.total_details?.breakdown?.taxes) {
        //   order.tax = session.total_details.breakdown.taxes;
        // }

        if (session.customer_details) {
          order.billingDetails = {
            name: session.customer_details.name || "",
            email: session.customer_details.email || "",
            phone: session.customer_details.phone || "",
            address: session.customer_details.address || {},
          };
        }

        await order.save();
        console.log(`✅ Order ${order._id} updated as paid`);
      } else {
        // 3. JEŚLI ZAMÓWIENIE NIE ISTNIEJE - STWÓRZ NOWE (TYLKO W OSTATECZNOŚCI)
        console.log(`⚠️ Creating new order from cart-session-status...`);

        // Pobierz dane z metadata lub line_items
        const productsData: any[] = [];

        if (session.metadata?.productsData) {
          // Stara wersja - produkty w metadata
          try {
            const parsed = JSON.parse(session.metadata.productsData);
            if (Array.isArray(parsed)) {
              productsData.push(...parsed);
            }
          } catch (e) {
            console.error("Error parsing productsData from metadata:", e);
          }
        }

        // Jeśli nie ma w metadata, spróbuj z line_items
        if (productsData.length === 0 && session.line_items?.data) {
          session.line_items.data.forEach((item: any) => {
            if (item.price?.product) {
              const product = item.price.product;
              productsData.push({
                productId: product.metadata?.productId || "unknown",
                title: product.name || "Unknown Product",
                price: item.price.unit_amount / 100,
                quantity: item.quantity,
                imageUrl: product.images?.[0] || "",
                description: product.description || "",
              });
            }
          });
        }

        // Jeśli nadal nie ma danych, użyj minimalnych
        if (productsData.length === 0) {
          productsData.push({
            productId: "unknown",
            title: "Unknown Product",
            price: session.amount_total / 100,
            quantity: 1,
            imageUrl: "",
            description: "Product purchased via Stripe checkout",
          });
        }

        // Oblicz sumę
        const totalAmount = productsData.reduce((sum, item) => {
          return sum + item.price * item.quantity;
        }, 0);

        // Stwórz nowe zamówienie
        const newOrder = new Order({
          stripeSessionId: session.id,
          stripePaymentIntentId: session.payment_intent as string,
          status: "paid",
          paidAt: new Date(),

          user: {
            userId: new mongoose.Types.ObjectId(
              session.metadata?.userId || req.user?._id
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
          invoiceId: session.invoice?.toString() || null,
          //tax: session.total_details?.breakdown?.taxes || [],

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

        await newOrder.save();
        order = newOrder;
        console.log(
          `✅ Created new order ${order._id} from cart-session-status`
        );
      }

      // 4. PRZYPISZ ZASOBY DO UŻYTKOWNIKA
      if (order && order.products.length > 0 && order.user.userId) {
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
              }
            );
            console.log(
              `🔹 ${resources.length} resources assigned to user ${order.user.userId}`
            );
          }
        }
      }

      // 5. PRZYGOTUJ ODPOWIEDŹ
      const response: any = {
        status: "complete",
        message: "✅ Płatność zakończona sukcesem",
        orderId: order._id,
        invoiceId: order.invoiceId,
        totalAmount: order.totalAmount,
      };

      if (order.invoiceId) {
        response.invoiceUrl = `https://dashboard.stripe.com/invoices/${order.invoiceId}`;
      }

      if (order.discount) {
        response.discountApplied = true;
        response.discountAmount = order.discount.amount / 100;
      }

      res.json(response);
    } catch (err: any) {
      console.error("Payment status error:", err.message || err);

      // Specjalna obsługa błędu duplikacji
      if (err.code === 11000 && err.keyPattern?.stripeSessionId) {
        // Zamówienie już istnieje - spróbuj je znaleźć i zwrócić
        try {
          const existingOrder = await Order.findOne({
            stripeSessionId: req.query.session_id,
          });
          if (existingOrder) {
            res.json({
              status: "complete",
              message: "✅ Płatność już została zarejestrowana",
              orderId: existingOrder._id,
              invoiceId: existingOrder.invoiceId,
              totalAmount: existingOrder.totalAmount,
            });
            return;
          }
        } catch (findErr) {
          // Kontynuuj z błędem
        }
      }

      res.status(500).json({
        error: err.message || "Błąd podczas sprawdzania płatności",
        code: err.code || "UNKNOWN_ERROR",
      });
    }
  }
);
export default router;

// import express, { Request, Response } from "express";
// import Stripe from "stripe";
// import mongoose from "mongoose";
// import Order from "../../models/order.js";
// import User from "../../models/user.js";
// import Product from "../../models/product.js";
// import Resource from "../../models/resource.js";
// import { userAuth } from "../../middleware/auth.js";

// const router = express.Router();
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// // ==================== HELPER FUNCTIONS ====================

// const isValidImageUrl = (url: string): boolean => {
//   if (!url || typeof url !== "string" || url.trim() === "") return false;
//   try {
//     const parsedUrl = new URL(url);
//     if (!["http:", "https:"].includes(parsedUrl.protocol)) return false;
//   } catch {
//     return false;
//   }
//   const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
//   return imageExtensions.some((ext) => url.toLowerCase().includes(ext));
// };

// const getOptimizedImageUrl = (imageUrl: string): string => {
//   if (!imageUrl) return "";
//   if (imageUrl.includes("cloudinary.com") && imageUrl.includes("/upload/")) {
//     return imageUrl.replace(
//       "/upload/",
//       "/upload/w_400,h_400,c_fill,f_auto,q_auto/"
//     );
//   }
//   if (imageUrl.includes("imgix.net")) {
//     return `${imageUrl}?w=400&h=400&fit=crop&auto=format`;
//   }
//   return imageUrl;
// };

// // ==================== CART CHECKOUT SESSION ====================

// router.post(
//   "/cart-checkout-session",
//   userAuth,
//   async (req: Request, res: Response): Promise<void> => {
//     try {
//       const { items, couponCode, requireInvoice, invoiceData } = req.body;

//       if (!items || !Array.isArray(items) || items.length === 0) {
//         res.status(400).json({ error: "Brak produktów w koszyku" });
//         return;
//       }

//       if (!req.user) {
//         res.status(401).json({ error: "Użytkownik nieautoryzowany" });
//         return;
//       }

//       // Pobierz pełne dane produktów
//       const productIds = items.map((item) => item._id);
//       const products = await Product.find({ _id: { $in: productIds } })
//         .select("title price description imageUrl content userId")
//         .lean();

//       if (products.length !== items.length) {
//         res
//           .status(404)
//           .json({ error: "Niektóre produkty nie zostały znalezione" });
//         return;
//       }

//       // Przygotuj mapę produktów
//       const productMap: Record<string, any> = {};
//       products.forEach((product) => {
//         productMap[product._id.toString()] = product;
//       });

//       // Stripe line_items z obrazkami
//       const lineItems = items.map((item) => {
//         const product = productMap[item._id];
//         const productData: any = {
//           name: product.title,
//           description: product.description || "",
//         };

//         if (product.imageUrl && isValidImageUrl(product.imageUrl)) {
//           const optimizedImage = getOptimizedImageUrl(product.imageUrl);
//           productData.images = [optimizedImage];
//         }

//         return {
//           price_data: {
//             currency: "pln",
//             product_data: productData,
//             unit_amount: Math.round(product.price * 100),
//           },
//           quantity: item.quantity || 1,
//         };
//       });

//       // Przygotuj metadata
//       const productMetadata = items.map((item) => {
//         const product = productMap[item._id];
//         return {
//           productId: product._id.toString(),
//           title: product.title,
//           price: product.price,
//           description: product.description,
//           imageUrl: product.imageUrl,
//           content: product.content,
//           productUserId: product.userId
//             ? product.userId.toString()
//             : req.user._id.toString(),
//           quantity: item.quantity || 1,
//         };
//       });

//       // Konfiguracja sesji Stripe
//       const sessionConfig: any = {
//         payment_method_types: ["card"],
//         mode: "payment",
//         line_items: lineItems,
//         invoice_creation: { enabled: true },
//         allow_promotion_codes: true,
//         automatic_tax: { enabled: true },
//         custom_text: {
//           submit: {
//             message:
//               "Dziękujemy za zakupy! Dostęp do kursów otrzymasz natychmiast po płatności.",
//           },
//         },
//         success_url: `http://localhost:5173/cart-return?session_id={CHECKOUT_SESSION_ID}&success=true`,
//         cancel_url: `http://localhost:5173/cart-cancel?canceled=true`,
//         customer_email: req.user.email,
//         metadata: {
//           userId: req.user._id.toString(),
//           email: req.user.email,
//           productsData: JSON.stringify(productMetadata),
//           couponCode: couponCode || "",
//           requireInvoice: requireInvoice ? "true" : "false",
//         },
//       };

//       // Jeśli użytkownik chce fakturę, zbierz dane billingowe
//       if (requireInvoice) {
//         sessionConfig.billing_address_collection = "required";
//         if (invoiceData?.companyName) {
//           sessionConfig.metadata.companyName = invoiceData.companyName;
//         }
//       } else {
//         sessionConfig.billing_address_collection = "auto";
//       }

//       // Dodaj kupon jeśli został podany
//       if (couponCode) {
//         sessionConfig.discounts = [{ coupon: couponCode }];
//       }

//       const session = await stripe.checkout.sessions.create(sessionConfig);

//       res.json({
//         url: session.url,
//         sessionId: session.id,
//       });
//     } catch (err) {
//       console.error("Stripe error:", err);
//       res.status(500).json({ error: "Błąd tworzenia sesji płatności" });
//     }
//   }
// );

// // ==================== CART SESSION STATUS ====================

// router.get(
//   "/cart-session-status",
//   userAuth,
//   async (req: Request, res: Response): Promise<void> => {
//     try {
//       const { session_id } = req.query;
//       if (!session_id) {
//         res.status(400).json({ error: "Brak session_id w zapytaniu" });
//         return;
//       }

//       const session = await stripe.checkout.sessions.retrieve(
//         session_id as string,
//         {
//           expand: [
//             "line_items.data.price.product",
//             "total_details.breakdown",
//             "invoice",
//           ],
//         }
//       );

//       if (session.payment_status !== "paid") {
//         res.json({
//           status: "pending",
//           message: "⏳ Płatność w trakcie przetwarzania",
//         });
//         return;
//       }

//       const userId = session.metadata?.userId;
//       const productsData = session.metadata?.productsData
//         ? JSON.parse(session.metadata.productsData)
//         : [];

//       const existing = await Order.findOne({ stripeSessionId: session.id });

//       if (!existing && productsData.length > 0) {
//         console.log("Creating new cart order...");

//         const order = new Order({
//           stripeSessionId: session.id,
//           products: productsData.map((productData) => ({
//             product: {
//               _id: productData.productId
//                 ? new mongoose.Types.ObjectId(productData.productId)
//                 : undefined,
//               title: productData.title || "Brak tytułu",
//               price: productData.price || 0,
//               description: productData.description || "",
//               imageUrl: productData.imageUrl || "",
//               content: productData.content || "",
//               // userId: productData.productUserId
//               //   ? new mongoose.Types.ObjectId(productData.productUserId)
//               //   : new mongoose.Types.ObjectId(userId),
//             },
//             quantity: productData.quantity || 1,
//           })),
//           user: {
//             email: session.customer_email || req.user?.email,
//             userId: new mongoose.Types.ObjectId(userId),
//           },
//           discount: session.total_details?.breakdown?.discounts?.[0] || null,
//           invoiceId: session.invoice?.toString() || null,
//           tax: session.total_details?.breakdown?.taxes || [],
//           billingDetails: session.customer_details
//             ? {
//                 name: session.customer_details.name || "",
//                 email: session.customer_details.email || "",
//                 phone: session.customer_details.phone || "",
//                 address: session.customer_details.address || {},
//               }
//             : null,
//           createdAt: new Date(),
//         });

//         await order.save();
//         console.log("✅ Cart order saved!");

//         // Log dodatkowych informacji
//         if (session.total_details?.breakdown?.discounts?.length) {
//           console.log(
//             `🎯 Discount applied: ${
//               session.total_details.breakdown.discounts[0].amount / 100
//             } PLN`
//           );
//         }
//         if (session.invoice) {
//           console.log(`🧾 Invoice created: ${session.invoice}`);
//         }
//       }

//       // Przypisz zasoby do użytkownika
//       const productIds = productsData.map((p) => p.productId);
//       if (productIds.length > 0 && userId) {
//         const resources = await Resource.find({
//           productId: { $in: productIds },
//         }).select("_id");

//         if (resources.length > 0) {
//           const updateResult = await User.updateOne(
//             { _id: userId },
//             {
//               $addToSet: {
//                 resources: { $each: resources.map((r) => r._id) },
//               },
//             }
//           );
//           console.log(`🔹 ${resources.length} resources assigned to user`);
//         }
//       }

//       // Przygotuj odpowiedź
//       const response: any = {
//         status: "complete",
//         message: "✅ Płatność zakończona sukcesem",
//         orderCreated: !existing,
//       };

//       if (session.invoice) {
//         response.invoiceUrl = `https://dashboard.stripe.com/invoices/${session.invoice}`;
//         response.invoiceId = session.invoice;
//       }

//       if (session.total_details?.breakdown?.discounts?.length) {
//         response.discountApplied = true;
//         response.discountAmount =
//           session.total_details.breakdown.discounts[0].amount / 100;
//       }

//       res.json(response);
//     } catch (err: any) {
//       console.error("Payment status error:", err.message || err);
//       res.status(500).json({
//         error: err.message || "Błąd podczas sprawdzania płatności",
//       });
//     }
//   }
// );

// export default router;
////////////////////////////////////

// import express, { Request, Response } from "express";
// import Stripe from "stripe";
// import mongoose from "mongoose";
// import Order from "../../models/order.js";
// import User from "../../models/user.js";
// import Product from "../../models/product.js";
// import Resource from "../../models/resource.js";
// import { userAuth } from "../../middleware/auth.js"; // poprawnie

// const router = express.Router();

// // 🔑 Stripe client
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// // ✅ 1️⃣ Tworzenie sesji płatności Stripe Checkout
// router.post(
//   "/cart-checkout-session",
//   userAuth,
//   async (req: Request, res: Response): Promise<void> => {
//     try {
//       // console.log("Creating cart checkout session backend");
//       const { items } = req.body;
//       //console.log("req body:", req.body, "req user", req.user);

//       if (!items || !Array.isArray(items) || items.length === 0) {
//         res.status(400).json({ error: "Brak produktów w koszyku" });
//         return;
//       }

//       if (!req.user) {
//         res.status(401).json({ error: "Użytkownik nieautoryzowany" });
//         return;
//       }

//       //const productIds = items.map((item) => item._id.toString());

//       // Pobierz PEŁNE dane produktów z bazy
//       const productIds = items.map((item) => item._id);
//       const products = await Product.find({
//         _id: { $in: productIds },
//       })
//         .select("title price description imageUrl content userId")
//         .lean();

//       if (products.length !== items.length) {
//         res
//           .status(404)
//           .json({ error: "Niektóre produkty nie zostały znalezione" });
//         return;
//       }

//       // Przygotuj mapę produktów dla łatwego dostępu
//       const productMap = {};
//       products.forEach((product) => {
//         productMap[product._id.toString()] = product;
//       });

//       // Stripe line_items
//       // const lineItems = items.map((item) => ({
//       //   price_data: {
//       //     currency: "pln",
//       //     product_data: { name: item.title },
//       //     unit_amount: Math.round(item.price * 100),
//       //   },
//       //   quantity: item.quantity,
//       // }));
//       // Stripe line_items z pełnymi danymi
//       const lineItems = items.map((item) => {
//         const product = productMap[item._id];

//         // Przygotuj dane produktu dla Stripe
//         const productData: any = {
//           name: product.title,
//           description: product.description || "",
//         };

//         // DODAJ OBRAZEK jeśli istnieje
//         if (product.imageUrl && product.imageUrl.trim() !== "") {
//           // Stripe oczekuje array obrazków
//           productData.images = [product.imageUrl];
//           console.log(
//             `✅ Adding image for product ${product.title}: ${product.imageUrl}`
//           );
//         } else {
//           console.log(`⚠️ No image for product: ${product.title}`);
//         }

//         return {
//           price_data: {
//             currency: "pln",
//             product_data: productData,
//             // product_data: {
//             //   name: product.title,
//             //   description: product.description || "",
//             // },
//             unit_amount: Math.round(product.price * 100),
//           },
//           quantity: item.quantity,
//         };
//       });

//       // Przygotuj metadata z WSZYSTKIMI danymi produktów
//       const productMetadata = items.map((item) => {
//         const product = productMap[item._id];
//         return {
//           productId: product._id.toString(),
//           title: product.title,
//           price: product.price,
//           description: product.description,
//           imageUrl: product.imageUrl,
//           content: product.content,
//           productUserId: product.userId
//             ? product.userId.toString()
//             : req.user._id.toString(),
//           quantity: item.quantity,
//         };
//       });
//       const session = await stripe.checkout.sessions.create({
//         payment_method_types: ["card"],
//         mode: "payment",
//         line_items: lineItems,
//         success_url: `http://localhost:5173/cart-return?session_id={CHECKOUT_SESSION_ID}`,
//         cancel_url: `http://localhost:5173/cart-cancel`,
//         customer_email: req.user.email,
//         metadata: {
//           userId: req.user._id.toString(),
//           email: req.user.email,
//           productsData: JSON.stringify(productMetadata),
//           //productIds: productIds.join(","),
//         },
//       });

//       res.json({ url: session.url });
//     } catch (err) {
//       console.error("Stripe error:", err);
//       res.status(500).json({ error: "Błąd tworzenia sesji płatności" });
//     }
//   }
// );

// // ✅ 2️⃣ Sprawdzanie statusu i zapisywanie zamówienia
// router.get(
//   "/cart-session-status",
//   userAuth,
//   async (req: Request, res: Response): Promise<void> => {
//     try {
//       const { session_id } = req.query;
//       if (!session_id) {
//         res.status(400).json({ error: "Brak session_id w zapytaniu" });
//         return;
//       }

//       const session = await stripe.checkout.sessions.retrieve(
//         session_id as string,
//         { expand: ["line_items.data.price.product"] }
//       );

//       if (session.payment_status !== "paid") {
//         res.json({
//           status: "pending",
//           message: "⏳ Płatność w trakcie przetwarzania",
//         });
//         return;
//       }

//       const userId = session.metadata?.userId;
//       const productsData = session.metadata?.productsData
//         ? JSON.parse(session.metadata.productsData)
//         : [];

//       const existing = await Order.findOne({
//         stripeSessionId: session.id,
//       });

//       if (!existing && productsData.length > 0) {
//         console.log("Creating new order...");

//         const order = new Order({
//           stripeSessionId: session.id,
//           products: productsData.map((productData, index) => ({
//             product: {
//               _id: productData.productId
//                 ? new mongoose.Types.ObjectId(productData.productId)
//                 : undefined,
//               title: productData.title || "Brak tytułu",
//               price: productData.price || 0,
//               description: productData.description || "",
//               imageUrl: productData.imageUrl || "", // Teraz mamy imageUrl
//               content: productData.content || "",
//               userId: productData.productUserId
//                 ? new mongoose.Types.ObjectId(productData.productUserId)
//                 : new mongoose.Types.ObjectId(userId),
//             },
//             quantity: productData.quantity || 1,
//           })),
//           user: {
//             email: session.customer_email || req.user?.email,
//             userId: new mongoose.Types.ObjectId(userId),
//           },
//           createdAt: new Date(),
//         });

//         await order.save();
//         console.log("✅ Order saved with all product data!");
//       }

//       // 🔹 Pobierz zasoby (resources) powiązane z zakupionymi produktami
//       const productIds = productsData.map((p) => p.productId);
//       if (productIds.length > 0) {
//         const resources = await Resource.find({
//           productId: { $in: productIds },
//         }).select("_id");

//         if (resources.length > 0 && userId) {
//           const updateResult = await User.updateOne(
//             { _id: userId },
//             {
//               $addToSet: {
//                 resources: { $each: resources.map((r) => r._id) },
//               },
//             }
//           );
//           console.log("🔹 User resources updated:", updateResult);
//         }
//       }

//       res.json({
//         status: "complete",
//         message: "✅ Płatność zakończona sukcesem",
//       });
//     } catch (err: any) {
//       console.error("Payment status error:", err.message || err);
//       res.status(500).json({
//         error: err.message || "Błąd podczas sprawdzania płatności",
//       });
//     }
//   }
// );
// // router.get(
// //   "/cart-session-status",
// //   userAuth,
// //   async (req: Request, res: Response): Promise<void> => {
// //     try {
// //       // console.log("Checking cart session status backend");
// //       const { session_id } = req.query;
// //       if (!session_id) {
// //         console.log("No session_id in query");
// //         res.status(400).json({ error: "Brak session_id w zapytaniu" });
// //         return;
// //       }

// //       const session = await stripe.checkout.sessions.retrieve(
// //         session_id as string,
// //         { expand: ["line_items.data.price.product"] }
// //       );

// //       //console.log("Stripe session object:", JSON.stringify(session, null, 2));

// //       //console.log("Payment status:", session.payment_status);
// //       if (session.payment_status !== "paid") {
// //         res.json({
// //           status: "pending",
// //           message: "⏳ Płatność w trakcie przetwarzania",
// //         });
// //         return;
// //       }

// //       if (session.payment_status === "paid") {
// //         const userId = session.metadata?.userId;
// //         const userEmail = session.customer_email || req.user?.email;
// //         const productIds = session.metadata?.productIds
// //           ? session.metadata.productIds.split(",")
// //           : [];
// //         // console.log("User email:", userEmail);
// //         //console.log("User ID from metadata:", session.metadata?.userId);

// //         const existing = await Order.findOne({
// //           stripeSessionId: session.id,
// //           // "user.email": userEmail,
// //           // "user.userId": session.metadata?.userId,
// //         });

// //         //console.log("Existing order found?", existing);

// //         if (!existing) {
// //           //console.log("Creating new order...");

// //           const order = new Order({
// //             stripeSessionId: session.id,
// //             products: session.line_items?.data.map(
// //               (item: any, index: number) => ({
// //                 product: {
// //                   _id: productIds[index]
// //                     ? new mongoose.Types.ObjectId(productIds[index])
// //                     : undefined,
// //                   title: item.description || "Brak tytułu",
// //                   price: (item.amount_total || 0) / 100,
// //                   description: item.description || "",
// //                   imageUrl: "",
// //                   content: "",
// //                   userId: new mongoose.Types.ObjectId(session.metadata?.userId),
// //                 },
// //                 quantity: item.quantity || 1,
// //               })
// //             ),
// //             user: {
// //               email: userEmail,
// //               userId: new mongoose.Types.ObjectId(session.metadata?.userId),
// //             },
// //           });

// //           await order.save();
// //           console.log("Order saved!");
// //         } else {
// //           //console.log("Order already exists, skipping save");
// //         }
// //         ////

// //         // 🔹 Pobierz zasoby (resources) powiązane z zakupionymi produktami
// //         const resources = await Resource.find({
// //           productId: { $in: productIds },
// //         }).select("_id");

// //         // console.log("🔹 Resources found for products:", resources);

// //         if (resources.length > 0) {
// //           // 🔹 Dodaj zasoby do użytkownika (bez duplikatów)
// //           const updateResult = await User.updateOne(
// //             { _id: userId },
// //             {
// //               $addToSet: {
// //                 resources: { $each: resources.map((r) => r._id) },
// //               },
// //             }
// //           );

// //           console.log("🔹 User resources updated:", updateResult);
// //         } else {
// //           console.log("⚠️ Brak zasobów do przypisania użytkownikowi");
// //         }

// //         ////
// //         res.json({
// //           status: "complete",
// //           message: "✅ Płatność zakończona sukcesem",
// //         });
// //         return;
// //       }

// //       console.log("Payment not yet paid");
// //       res.json({
// //         status: "pending",
// //         message: "⏳ Płatność w trakcie przetwarzania",
// //       });
// //     } catch (err: any) {
// //       console.error("Payment status error:", err.message || err);
// //       res
// //         .status(500)
// //         .json({ error: err.message || "Błąd podczas sprawdzania płatności" });
// //     }
// //   }
// // );

// export default router;
