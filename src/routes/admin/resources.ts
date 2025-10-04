// routes/resourceRoutes.ts
import express from "express";
import {
  createResource,
  updateResource,
  deleteResource,
  getResourceByProduct,
  getResourceByProductId,
  getResourceById,
} from "../../controllers/admin/resourceControllers.js";
import {
  addChapter,
  editChapter,
  deleteChapter,
} from "../../controllers/admin/chapterControllers.js";
const router = express.Router();

// Resource
router.post("/resources", createResource);
router.put("/resources/:id", updateResource);
router.delete("/resources/:id", deleteResource);
router.get("/resources/:productId", getResourceByProduct);
router.get("/resources/id/:id", getResourceById);
router.get("/resources/:productId", getResourceByProductId);

// Chapters
router.post("/resources/:id/chapters", addChapter);
router.put("/resources/:id/chapters/:chapterId", editChapter);
router.delete("/resources/:id/chapters/:chapterId", deleteChapter);

export default router;

// import express from "express";
// import { adminAuth } from "../../middleware/auth.js";

// import {
//   addChapterToResource,
//   deleteChapterFromResource,
//   editResource,
//   fetchUserResources,
//   updateChapterInResource,
// } from "../../controllers/admin/resourceCotrollers.js";

// import { body } from "express-validator";

// const router = express.Router();

// //RESOURCE ROUTES
// router.put("/edit-resource/:resourceId", adminAuth, editResource);
// router.post("/resources/:id/chapters", adminAuth, addChapterToResource);
// router.patch(
//   "/resources/:id/chapters/:chapterIndex",
//   adminAuth,
//   updateChapterInResource
// );
// router.delete(
//   "/resources/:id/chapters/:chapterIndex",
//   adminAuth,
//   deleteChapterFromResource
// );

// router.get("/resources/:userId", adminAuth, fetchUserResources);

// export default router;
