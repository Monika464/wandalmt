// routes/resourceRoutes.ts
import express from "express";
import {
  createResource,
  updateResource,
  deleteResource,
  getResourceByProductId,
  getResourceById,
  fetchResources,
} from "../../controllers/admin/resourceControllers.js";
import {
  addChapter,
  editChapter,
  deleteChapter,
  deleteChapterVideo,
  getChapterWithVideo,
} from "../../controllers/admin/chapterControllers.js";
const router = express.Router();
import Resource from "../../models/resource.js";
import { adminAuth } from "middleware/auth.js";

// Fetch all resources
router.get("/resources", adminAuth, fetchResources);

router.post("/resources", adminAuth, createResource);
router.put("/resources/:id", adminAuth, updateResource);
router.delete("/resources/:id", adminAuth, deleteResource);
//router.get("/resources/:productId", getResourceByProduct);
router.get("/resources/id/:id", adminAuth, getResourceById);
router.get("/resources/product/:productId", adminAuth, getResourceByProductId);

// Chapters
router.post("/resources/:id/chapters", adminAuth, addChapter);
router.put("/resources/:id/chapters/:chapterId", adminAuth, editChapter);
router.delete("/resources/:id/chapters/:chapterId", adminAuth, deleteChapter);
router.delete("/:id/chapters/:chapterId/video", deleteChapterVideo); // Nowy endpoint
router.get("/:id/chapters/:chapterId", getChapterWithVideo); // Nowy endpoint

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
