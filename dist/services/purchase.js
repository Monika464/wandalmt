// export const purchaseProductAndAssignResource = async (
//   userId: string,
//   productId: string
// ): Promise<void> => {
//   const user = await User.findById(userId);
//   if (!user) throw new Error("User not found");
export {};
//   const resource = await Resource.findOne({ productId });
//   if (!resource) throw new Error("No resource found for this product");
//   const alreadyOwned = user.resources.some(
//     (resId) => resId.toString() === resource._id.toString()
//   );
//   if (!alreadyOwned) {
//     user.resources.push(resource._id);
//     await user.save();
//   }
// };
//await purchaseProductAndAssignResource(userId, purchasedProductId);
// export const updateUserResources = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const userId = req.params.userId;
//     // Sprawdzamy, czy użytkownik istnieje
