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
import { getVideoStatus } from "../../controllers/bunnyWebhook.js";
const router = express.Router();
import { adminAuth } from "../../middleware/auth.js";

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
router.delete("/:id/chapters/:chapterId/video", adminAuth, deleteChapterVideo); // Nowy endpoint
router.get("/:id/chapters/:chapterId", adminAuth, getChapterWithVideo);
router.get("/status/:videoId", getVideoStatus);

export default router;
