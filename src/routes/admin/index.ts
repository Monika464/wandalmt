import express from "express";
import userRoutes from "./users.js";
import productRoutes from "./products.js";
import resourceRoutes from "./resources.js";
import discountAdminRouter from "./discount.js";

const router = express.Router();

// router.use("/", (req, res, next) => {
//   console.log("  📍 ADMIN INDEX LAYER HIT!");
//   console.log("    fullUrl:", req.originalUrl);
//   console.log("    baseUrl:", req.baseUrl);
//   console.log("    path:", req.path);
//   next();
// });

router.use("/discounts", discountAdminRouter);
router.use("/", userRoutes);
router.use("/", productRoutes);
router.use("/", resourceRoutes);

// console.log("📋 ADMIN INDEX ROUTER STACK:");
// console.log(
//   "Admin router stack:",
//   JSON.stringify(
//     router.stack.map((layer: any) => {
//       if (layer.route) {
//         return {
//           path: layer.route.path,
//           methods: Object.keys(layer.route.methods),
//         };
//       } else if (layer.name === "router" && layer.handle.stack) {
//         return {
//           router: "subrouter",
//           mountPath: layer.regexp.source,
//           routes: layer.handle.stack.map((subLayer: any) => ({
//             path: subLayer.route?.path,
//             methods: subLayer.route?.methods
//               ? Object.keys(subLayer.route.methods)
//               : [],
//           })),
//         };
//       }
//     }),
//     null,
//     2,
//   ),
// );

export default router;
