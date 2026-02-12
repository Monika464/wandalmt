// // routes/public/checkout.ts (dla single product z buttona)
// import express from "express";
// import { userAuth } from "middleware/auth.js";
// import Product from "models/product.js";
// import Stripe from "stripe";
// import Order from "../../models/order.js";
// import User from "../../models/user.js";
// import Resource from "../../models/resource.js";
// import mongoose from "mongoose";

// const router = express.Router();
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// // ==================== HELPER FUNCTIONS ====================

// /**
//  * Walidacja URL obrazka
//  */
// const isValidImageUrl = (url: string): boolean => {
//   if (!url || typeof url !== "string" || url.trim() === "") {
//     return false;
//   }

//   try {
//     const parsedUrl = new URL(url);
//     if (!["http:", "https:"].includes(parsedUrl.protocol)) {
//       return false;
//     }
//   } catch {
//     return false;
//   }

//   const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
//   const urlLower = url.toLowerCase();
//   return imageExtensions.some((ext) => urlLower.includes(ext));
// };

// /**
//  * Optymalizacja URL obrazka dla Stripe
//  */
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

// // ==================== CHECKOUT SESSION ====================

// router.post("/checkout-session", userAuth, async (req, res): Promise<void> => {
//   try {
//     const { productId } = req.body as { productId: string };
//     const user = req.user!;

//     const product = await Product.findById(productId)
//       .select("title price description imageUrl content userId")
//       .lean();

//     if (!product) {
//       res.status(404).json({ error: "Product not found" });
//       return;
//     }

//     const productUserId = product.userId || user._id;

//     // Przygotuj dane produktu dla Stripe
//     const productData: any = {
//       name: product.title,
//       description: product.description || "",
//     };

//     // Dodaj obrazek jeśli istnieje i jest prawidłowy
//     if (product.imageUrl && isValidImageUrl(product.imageUrl)) {
//       const optimizedImage = getOptimizedImageUrl(product.imageUrl);
//       productData.images = [optimizedImage];
//       console.log(`✅ Added optimized image for product: ${product.title}`);
//     } else if (product.imageUrl) {
//       console.log(
//         `⚠️ Invalid image URL for product: ${product.title} - ${product.imageUrl}`
//       );
//     }

//     const session = await stripe.checkout.sessions.create({
//       payment_method_types: ["card"],
//       mode: "payment",
//       line_items: [
//         {
//           price_data: {
//             currency: "pln",
//             product_data: productData,
//             unit_amount: Math.round(product.price * 100),
//           },
//           quantity: 1,
//         },
//       ],
//       customer_email: user.email,
//       // Włącz tworzenie faktur
//       invoice_creation: {
//         enabled: true,
//       },
//       // Pozwól na kupony
//       allow_promotion_codes: true,
//       // Opcjonalne: zbieranie danych do faktury
//       billing_address_collection: "auto", // 'auto', 'required', lub nie podawać
//       // Opcjonalne: automatyczne taksowanie dla Polski
//       automatic_tax: {
//         enabled: true,
//       // },
//       // Ustawienia wyświetlania
//       custom_text: {
//         submit: {
//           message:
//             "Dziękujemy za zakup! Dostęp do kursu otrzymasz natychmiast po płatności.",
//         },
//         // shipping_address: {
//         //   message: "Wprowadź adres do faktury (opcjonalnie)",
//         // },
//       },
//       metadata: {
//         userId: user._id.toString(),
//         productId: product._id.toString(),
//         productData: JSON.stringify({
//           title: product.title,
//           price: product.price,
//           description: product.description,
//           imageUrl: product.imageUrl,
//           content: product.content,
//           productUserId: productUserId.toString(),
//         }),
//       },
//       success_url:
//         "http://localhost:5173/return?session_id={CHECKOUT_SESSION_ID}&success=true",
//       cancel_url: "http://localhost:5173/cancel?canceled=true",
//     });

//     res.json({
//       url: session.url,
//       sessionId: session.id,
//     });
//   } catch (error) {
//     console.error("Stripe error:", error);
//     res.status(500).json({
//       error: (error as Error).message,
//     });
//   }
// });

// // ==================== SESSION STATUS ====================

// router.get("/session-status", userAuth, async (req, res): Promise<void> => {
//   try {
//     const { session_id } = req.query;
//     if (!session_id) {
//       res.status(400).json({ error: "Brak session_id w zapytaniu" });
//       return;
//     }

//     const session = await stripe.checkout.sessions.retrieve(
//       session_id as string,
//       {
//         expand: [
//           "line_items.data.price.product",
//           "total_details.breakdown",
//           "invoice",
//         ],
//       }
//     );

//     if (session.payment_status !== "paid") {
//       res.json({
//         status: "pending",
//         message: "⏳ Płatność w trakcie przetwarzania",
//       });
//       return;
//     }

//     // Płatność zakończona sukcesem
//     const userEmail = session.customer_email || req.user?.email;
//     const userId = session.metadata?.userId;
//     const productData = session.metadata?.productData
//       ? JSON.parse(session.metadata.productData)
//       : null;

//     // Sprawdź, czy zamówienie już istnieje
//     const existing = await Order.findOne({ stripeSessionId: session.id });

//     if (!existing && productData) {
//       console.log("Creating new order...");

//       const lineItem = session.line_items?.data[0];
//       const productId = session.metadata?.productId;

//       const order = new Order({
//         stripeSessionId: session.id,
//         products: [
//           {
//             product: {
//               _id: productId
//                 ? new mongoose.Types.ObjectId(productId)
//                 : undefined,
//               title: productData.title || "Brak tytułu",
//               price: productData.price || (lineItem?.amount_total || 0) / 100,
//               description: productData.description || "",
//               imageUrl: productData.imageUrl || "",
//               content: productData.content || "",
//               userId: productData.productUserId
//                 ? new mongoose.Types.ObjectId(productData.productUserId)
//                 : new mongoose.Types.ObjectId(userId),
//             },
//             quantity: lineItem?.quantity || 1,
//           },
//         ],
//         user: {
//           email: userEmail,
//           userId: new mongoose.Types.ObjectId(userId),
//         },
//         // Zapisz dane o zniżkach jeśli były
//         discount: session.total_details?.breakdown?.discounts?.[0] || null,
//         // Zapisz ID faktury
//         invoiceId: session.invoice?.toString() || null,
//         // Zapisz dane podatkowe
//         tax: session.total_details?.breakdown?.taxes || [],
//         // Zapisz dane billingowe jeśli były zbierane
//         billingDetails: session.customer_details
//           ? {
//               name: session.customer_details.name || "",
//               email: session.customer_details.email || "",
//               phone: session.customer_details.phone || "",
//               address: session.customer_details.address || {},
//             }
//           : null,
//         createdAt: new Date(),
//       });

//       await order.save();
//       console.log("✅ Order saved for single product!");

//       // Log dodatkowych informacji
//       if (session.total_details?.breakdown?.discounts?.length) {
//         console.log(
//           `🎯 Discount applied: ${
//             session.total_details.breakdown.discounts[0].amount / 100
//           } PLN`
//         );
//       }
//       if (session.invoice) {
//         console.log(`🧾 Invoice created: ${session.invoice}`);
//       }
//     }

//     // 🔹 Pobierz zasoby (resources) powiązane z produktem
//     const productId = session.metadata?.productId;
//     if (productId && userId) {
//       const resources = await Resource.find({
//         productId: productId,
//       }).select("_id");

//       if (resources.length > 0) {
//         const updateResult = await User.updateOne(
//           { _id: userId },
//           {
//             $addToSet: {
//               resources: { $each: resources.map((r) => r._id) },
//             },
//           }
//         );
//         console.log(`🔹 ${resources.length} resources assigned to user`);
//       } else {
//         console.log("⚠️ Brak zasobów do przypisania użytkownikowi");
//       }
//     }

//     // Przygotuj odpowiedź z dodatkowymi informacjami
//     const response: any = {
//       status: "complete",
//       message: "✅ Płatność zakończona sukcesem",
//       orderCreated: !existing,
//     };

//     // Dodaj link do faktury jeśli istnieje
//     if (session.invoice) {
//       response.invoiceUrl = `https://dashboard.stripe.com/invoices/${session.invoice}`;
//       response.invoiceId = session.invoice;
//     }

//     // Dodaj informację o zniżce
//     if (session.total_details?.breakdown?.discounts?.length) {
//       response.discountApplied = true;
//       response.discountAmount =
//         session.total_details.breakdown.discounts[0].amount / 100;
//     }

//     res.json(response);
//   } catch (err) {
//     console.error("Payment status error:", (err as Error).message || err);
//     res.status(500).json({
//       error: (err as Error).message || "Błąd podczas sprawdzania płatności",
//     });
//   }
// });

// // ==================== COUPON VALIDATION ====================

// /**
//  * Endpoint do walidacji kuponu (możesz też mieć osobny plik)
//  */
// router.post("/validate-coupon", userAuth, async (req, res): Promise<void> => {
//   try {
//     const { couponCode } = req.body;

//     if (!couponCode) {
//       res.status(400).json({ error: "Brak kodu kuponu" });
//       return;
//     }

//     // Sprawdź czy kupon istnieje
//     const coupon = await stripe.coupons.retrieve(couponCode);

//     // Sprawdź czy kupon jest aktywny
//     if (!coupon.valid) {
//       res.status(400).json({ error: "Kupon jest nieaktywny lub wygasł" });
//       return;
//     }

//     // Sprawdź czy przekroczono limit użyć
//     if (
//       coupon.max_redemptions &&
//       coupon.times_redeemed >= coupon.max_redemptions
//     ) {
//       res.status(400).json({
//         error: "Kupon został już wykorzystany maksymalną liczbę razy",
//       });
//       return;
//     }

//     res.json({
//       valid: true,
//       coupon: {
//         id: coupon.id,
//         name: coupon.name,
//         percent_off: coupon.percent_off,
//         amount_off: coupon.amount_off,
//         duration: coupon.duration,
//         duration_in_months: coupon.duration_in_months,
//       },
//     });
//   } catch (err: any) {
//     console.error("Coupon validation error:", err);
//     res.status(400).json({
//       error: "Nieprawidłowy kod kuponu",
//       details: err.message,
//     });
//   }
// });

// // ==================== GET INVOICE ====================

// /**
//  * Endpoint do pobierania faktury
//  */
// router.get("/invoice/:invoiceId", userAuth, async (req, res): Promise<void> => {
//   try {
//     const { invoiceId } = req.params;
//     const userId = req.user?._id.toString();

//     // Najpierw sprawdź czy użytkownik ma dostęp do tej faktury
//     const order = await Order.findOne({
//       invoiceId: invoiceId,
//       "user.userId": new mongoose.Types.ObjectId(userId),
//     });

//     if (!order) {
//       res.status(403).json({ error: "Brak dostępu do tej faktury" });
//       return;
//     }

//     // Pobierz fakturę z Stripe
//     const invoice = await stripe.invoices.retrieve(invoiceId);

//     // Pobierz PDF faktury
//     const invoicePdf = await stripe.invoices.retrieve(invoiceId, {
//       expand: ["invoice_pdf"],
//     });

//     res.json({
//       invoice: {
//         id: invoice.id,
//         number: invoice.number,
//         status: invoice.status,
//         amount_paid: invoice.amount_paid / 100,
//         currency: invoice.currency,
//         created: new Date(invoice.created * 1000),
//         customer_name: invoice.customer_name,
//         customer_email: invoice.customer_email,
//         hosted_invoice_url: invoice.hosted_invoice_url,
//         invoice_pdf: invoice.invoice_pdf,
//       },
//     });
//   } catch (err: any) {
//     console.error("Invoice error:", err);
//     res.status(500).json({
//       error: "Błąd podczas pobierania faktury",
//       details: err.message,
//     });
//   }
// });

// export default router;

// // import express from "express";
// // import { userAuth } from "middleware/auth.js";
// // import Product from "models/product.js";
// // import Stripe from "stripe";
// // import Order from "../../models/order.js";
// // import User from "../../models/user.js";
// // import Resource from "../../models/resource.js";
// // import mongoose from "mongoose";

// // const router = express.Router();
// // //const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
// // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
// // router.post("/checkout-session", userAuth, async (req, res): Promise<void> => {
// //   try {
// //     const { productId } = req.body as { productId: string };
// //     const user = req.user!;

// //     const product = await Product.findById(productId)
// //       .select("title price description imageUrl content userId")
// //       .lean();
// //     if (!product) {
// //       res.status(404).json({ error: "Product not found" });
// //       return;
// //     }

// //     const productUserId = product.userId || user._id;

// //     const session = await stripe.checkout.sessions.create({
// //       payment_method_types: ["card"],
// //       mode: "payment",
// //       line_items: [
// //         {
// //           price_data: {
// //             currency: "pln",
// //             product_data: {
// //               name: product.title,
// //               images: product.imageUrl ? [product.imageUrl] : [],
// //             },
// //             //unit_amount: product.price * 100,
// //             unit_amount: Math.round(product.price * 100),
// //           },
// //           quantity: 1,
// //         },
// //       ],
// //       customer_email: user.email,
// //       metadata: {
// //         userId: user._id.toString(),
// //         productId: (product._id as string).toString(),
// //         productData: JSON.stringify({
// //           title: product.title,
// //           price: product.price,
// //           description: product.description,
// //           imageUrl: product.imageUrl,
// //           content: product.content,
// //           productUserId: productUserId.toString(),
// //         }),
// //       },
// //       success_url:
// //         "http://localhost:5173/return?session_id={CHECKOUT_SESSION_ID}",
// //       cancel_url: "http://localhost:5173/cancel",
// //     });

// //     res.json({ url: session.url });
// //   } catch (error) {
// //     console.error("Stripe error:", error);
// //     res.status(500).json({
// //       error: (error as Error).message,
// //     });
// //   }
// // });
// // router.get("/session-status", userAuth, async (req, res): Promise<void> => {
// //   try {
// //     // console.log("Checking single product session status backend");

// //     const { session_id } = req.query;
// //     if (!session_id) {
// //       res.status(400).json({ error: "Brak session_id w zapytaniu" });
// //       return;
// //     }

// //     const session = await stripe.checkout.sessions.retrieve(
// //       session_id as string,
// //       {
// //         expand: ["line_items.data.price.product"],
// //       }
// //     );

// //     if (session.payment_status !== "paid") {
// //       res.json({
// //         status: "pending",
// //         message: "⏳ Płatność w trakcie przetwarzania",
// //       });
// //       return;
// //     }

// //     // Płatność zakończona sukcesem
// //     const userEmail = session.customer_email || req.user?.email;
// //     const userId = session.metadata?.userId;
// //     const productData = session.metadata?.productData
// //       ? JSON.parse(session.metadata.productData)
// //       : null;

// //     // Sprawdź, czy zamówienie już istnieje
// //     const existing = await Order.findOne({ stripeSessionId: session.id });

// //     if (!existing && productData) {
// //       console.log("Creating new order...");

// //       const lineItem = session.line_items?.data[0];
// //       const productId = session.metadata?.productId;

// //       const order = new Order({
// //         stripeSessionId: session.id,
// //         products: [
// //           {
// //             product: {
// //               _id: productId
// //                 ? new mongoose.Types.ObjectId(productId)
// //                 : undefined,
// //               title: productData.title || "Brak tytułu",
// //               price: productData.price || (lineItem?.amount_total || 0) / 100,
// //               description: productData.description || "",
// //               imageUrl: productData.imageUrl || "", // Teraz mamy imageUrl
// //               content: productData.content || "",
// //               userId: productData.productUserId
// //                 ? new mongoose.Types.ObjectId(productData.productUserId)
// //                 : new mongoose.Types.ObjectId(userId),
// //               // title: lineItem?.description || "Brak tytułu",
// //               // price: (lineItem?.amount_total || 0) / 100,
// //               // description: lineItem?.description || "",
// //               // imageUrl: "",
// //               // content: "",
// //               // userId: new mongoose.Types.ObjectId(userId),
// //             },
// //             quantity: lineItem?.quantity || 1,
// //           },
// //         ],
// //         user: {
// //           email: userEmail,
// //           userId: new mongoose.Types.ObjectId(userId),
// //         },
// //       });

// //       await order.save();
// //       console.log("✅ Order saved for single product!");
// //     } else if (!productData) {
// //       console.error("❌ Brak danych produktu w metadata!");
// //     }
// //     //
// //     // 🔹 Pobierz zasoby (resources) powiązane z zakupionymi produktami
// //     const resources = await Resource.find({
// //       productId: session.metadata?.productId,
// //     }).select("_id");

// //     //console.log("🔹 Resources found for products:", resources);

// //     if (resources.length > 0) {
// //       // 🔹 Dodaj zasoby do użytkownika (bez duplikatów)
// //       const updateResult = await User.updateOne(
// //         { _id: userId },
// //         {
// //           $addToSet: {
// //             resources: { $each: resources.map((r) => r._id) },
// //           },
// //         }
// //       );

// //       //console.log("🔹 User resources updated:", updateResult);
// //     } else {
// //       console.log("⚠️ Brak zasobów do przypisania użytkownikowi");
// //     }
// //     //

// //     res.json({
// //       status: "complete",
// //       message: "✅ Płatność zakończona sukcesem",
// //     });
// //     return;
// //   } catch (err) {
// //     console.error("Payment status error:", (err as Error).message || err);
// //     res.status(500).json({
// //       error: (err as Error).message || "Błąd podczas sprawdzania płatności",
// //     });
// //   }
// // });

// // export default router;
