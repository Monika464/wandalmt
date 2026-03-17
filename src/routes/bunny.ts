// src/routes/bunny.ts
import express, { Request, Response } from "express";
import axios from "axios";
import multer from "multer";
import stream from "stream";
import Video from "../models/video.js";
import sharp from "sharp";
import {
  getBunnyVideo,
  getDirectBunnyStatus,
} from "../controllers/bunnyWebhook.js";

const router = express.Router();
const upload = multer();

// env
const BUNNY_API_KEY = process.env.BUNNY_API_KEY!;
const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID!;

if (!BUNNY_API_KEY || !BUNNY_LIBRARY_ID) {
  console.warn("Bunny: missing BUNNY_API_KEY or BUNNY_LIBRARY_ID");
}

// router.get("/test", (req, res) => {
//   res.send("TEST ROUTE DZIAŁA");
// });

router.get("/direct-status/:videoId", getDirectBunnyStatus);

// ==================== CREATE VIDEO ====================
router.post(
  "/create-video",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { title } = req.body || {};
      const url = `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos`;

      const resp = await axios.post(
        url,
        { title: title || "upload-from-app" },
        {
          headers: {
            AccessKey: BUNNY_API_KEY,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        },
      );
      const { guid, thumbnailFileName } = resp.data;

      const thumbnailUrl = thumbnailFileName
        ? `https://vz-${BUNNY_LIBRARY_ID}-${guid}.b-cdn.net/${thumbnailFileName}`
        : null;

      const video = await Video.create({
        title: title || "untitled",
        bunnyGuid: guid,
        thumbnailUrl,
        status: "uploading",
        processingProgress: 0,
      });

      res.json({ success: true, video, bunnyGuid: guid });
    } catch (err: any) {
      console.error(
        "Bunny create-video error",
        err?.response?.data ?? err?.message,
      );
      res.status(500).json({
        error: "create-video-failed",
        details: err?.response?.data ?? err?.message,
      });
    }
  },
);

// ==================== UPLOAD VIDEO ====================
router.post(
  "/upload/:videoId",
  upload.single("file"),

  async (req: Request, res: Response): Promise<void> => {
    let videoId;
    if (!videoId || Array.isArray(videoId)) {
      res.status(400).json({ error: "Invalid video ID format" });
      return;
    }
    try {
      //const { videoId } = req.params;
      videoId = req.params.videoId;

      if (!videoId) {
        res.status(400).json({ error: "missing videoId" });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "missing file" });
        return;
      }

      const uploadUrl = `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${videoId}`;

      // create a readable stream from buffer
      const bufferStream = new stream.PassThrough();
      bufferStream.end(req.file.buffer);

      const resp = await axios.put(uploadUrl, bufferStream, {
        headers: {
          AccessKey: BUNNY_API_KEY,
          "Content-Type": "application/octet-stream",
          "Content-Length": String(req.file.size),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      console.log("✅ File uploaded successfully");

      res.json({ success: true, bunnyResponse: resp.data });
    } catch (err: any) {
      // 🔥🔥🔥 ADDING HANDLING FOR ERROR 400 (already uploaded)
      if (
        err?.response?.status === 400 &&
        err?.response?.data?.message === "The video has already been uploaded."
      ) {
        console.log("⚠️ Video already exists in Bunny, treating as success");

        // Znajdź video w bazie po bunnyGuid (videoId)
        const video = await Video.findOne({ bunnyGuid: videoId });

        if (video) {
          // Optional: Update status if needed
          res.json({
            success: true,
            alreadyExists: true,
            message: "Video already uploaded",
            videoId: video._id,
            bunnyGuid: video.bunnyGuid,
          });
          return;
        }
      }

      //normal error
      console.error("Bunny upload error", err?.response?.data ?? err?.message);
      res.status(500).json({
        error: "upload-failed",
        details: err?.response?.data ?? err?.message,
      });
    }
  },
);

// ==================== GET ALL VIDEOS ====================
router.get("/videos", async (req: Request, res: Response): Promise<void> => {
  try {
    const videos = await Video.find().sort({ createdAt: -1 });
    res.json(videos);
  } catch (error) {
    res.status(500).json({ error: "get-video-failed" });
  }
});

// ==================== CHECK VIDEO STATUS ====================
router.get(
  "/status/:videoId",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { videoId } = req.params;
      if (!videoId || Array.isArray(videoId)) {
        res.status(400).json({ error: "Invalid video ID format" });
        return;
      }

      let video;

      if (videoId.match(/^[0-9a-fA-F]{24}$/)) {
        video = await Video.findById(videoId);
      } else {
        video = await Video.findOne({ bunnyGuid: videoId });
      }

      if (!video) {
        res.status(404).json({
          success: false,
          error: "Video not found",
        });
        return;
      }

      // Optional: Check with Bunny
      let bunnyStatus = null;
      if (video.bunnyGuid) {
        try {
          const bunnyVideo = await getBunnyVideo(video.bunnyGuid);
          bunnyStatus = {
            status: bunnyVideo.status,
            encodeProgress: bunnyVideo.encodeProgress,
          };
        } catch (error: any) {
          console.warn(
            "Could not fetch Bunny status:",
            error?.message || error,
          );
        }
      }

      res.json({
        success: true,
        video: {
          _id: video._id,
          bunnyGuid: video.bunnyGuid,
          title: video.title,
          status: video.status,
          processingProgress: video.processingProgress,
          thumbnailUrl: video.thumbnailUrl,
          errorMessage: video.errorMessage,
          createdAt: video.createdAt,
        },
        bunnyStatus,
      });
    } catch (error) {
      console.error("Error getting video status:", error);
      res.status(500).json({
        success: false,
        error: "get-video-status-failed",
      });
    }
  },
);

// ==================== GET VIDEO BY ID ====================
router.get("/:videoId", async (req: Request, res: Response): Promise<void> => {
  try {
    const { videoId } = req.params;

    const video = await Video.findById(videoId);
    if (!video) {
      res.status(404).json({ error: "not-found" });
      return;
    }

    const playbackUrl = `https://vz-${BUNNY_LIBRARY_ID}-${video.bunnyGuid}.b-cdn.net`;

    res.json({
      success: true,
      playbackUrl,
      video,
    });
  } catch (err) {
    res.status(500).json({ error: "get-video-failed" });
  }
});

// ==================== DELETE VIDEO ====================
router.delete(
  "/videos/:id",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      // 1️⃣ find in the database
      const video = await Video.findById(id);
      if (!video) {
        res.status(404).json({ error: "video-not-found" });
        return;
      }

      // 2️⃣ remove from Bunny
      try {
        await axios.delete(
          `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${video.bunnyGuid}`,
          {
            headers: {
              AccessKey: BUNNY_API_KEY,
              Accept: "application/json",
            },
          },
        );
        console.log("✅ Video removed from Bunny:", video.bunnyGuid);
      } catch (bunnyErr: any) {
        // Bunny may return 404 - e.g. already deleted
        console.warn(
          "⚠️ Bunny delete failed (continuing):",
          bunnyErr?.response?.data ?? bunnyErr?.message,
        );
      }

      // 3️⃣ remove from  Mongo
      await Video.findByIdAndDelete(id);

      res.json({
        success: true,
        removedId: id,
      });
    } catch (err: any) {
      console.error("❌ Delete video failed:", err?.message);
      res.status(500).json({ error: "delete-video-failed" });
    }
  },
);

// ==================== PROXY THUMBNAIL ====================
router.get(
  "/proxy-thumbnail/:bunnyVideoId",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { width = "96", height = "64" } = req.query;

      // Conversion to numbers with safe parsing
      const parsedWidth = parseInt(width as string, 10) || 96;
      const parsedHeight = parseInt(height as string, 10) || 64;

      const imageUrl = `https://vz-b1e17e22-226.b-cdn.net/${req.params.bunnyVideoId}/thumbnail.jpg`;

      const response = await fetch(imageUrl);

      if (!response.ok) {
        res.status(response.status).send("Nie udało się pobrać obrazu");
        return;
      }

      const buffer = await response.arrayBuffer();

      // Force resize with Sharp
      const resized = await sharp(Buffer.from(buffer))
        .resize(parsedWidth, parsedHeight, {
          fit: "cover",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 70 })
        .toBuffer();

      res.set("Content-Type", "image/jpeg");
      res.set("Cache-Control", "public, max-age=86400");
      res.send(resized);
    } catch (error) {
      console.error("Proxy thumbnail error:", error);
      res.status(500).send("Nie udało się pobrać obrazu");
    }
  },
);

export default router;
