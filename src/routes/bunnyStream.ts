// JavaScript variant (works in TS with types adjusted)
import express from "express";
import axios from "axios";
import multer from "multer";
import stream from "stream";
import Video from "../models/video.js";
import { useEffect } from "react";

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

router.post("/create-video", async (req, res) => {
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
      }
    );
    const { guid, thumbnailFileName } = resp.data;
    console.log("Bunny create-video response", resp.data);

    const thumbnailUrl = thumbnailFileName
      ? `https://vz-${BUNNY_LIBRARY_ID}-${guid}.b-cdn.net/${thumbnailFileName}`
      : null;

    const video = await Video.create({
      title: title || "untitled",
      bunnyGuid: guid, // jedyny prawdziwy identyfikator filmu
      thumbnailUrl,
    });

    return res.json({ success: true, video });

    // resp.data contains the created video object with videoId (guid)
    // return res.json(resp.data);
  } catch (err: any) {
    console.error(
      "Bunny create-video error",
      err?.response?.data ?? err?.message
    );
    return res.status(500).json({
      error: "create-video-failed",
      details: err?.response?.data ?? err?.message,
    });
  }
});

/**
 * 2) Upload binary file to Bunny for given videoId
 *    We accept multipart/form-data (field 'file'), then stream to Bunny via PUT.
 */
router.post("/upload/:videoId", upload.single("file"), async (req, res) => {
  try {
    const { videoId } = req.params;
    if (!videoId) return res.status(400).json({ error: "missing videoId" });
    if (!req.file) return res.status(400).json({ error: "missing file" });

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
    //const updateUrl = `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${videoId}`;

    // try {
    //   await axios.put(
    //     // Lub PUT - musisz sprawdzić co działa
    //     updateUrl,

    //     {
    //       headers: {
    //         AccessKey: BUNNY_API_KEY,
    //         "Content-Type": "application/json", // WAŻNE: application/json!
    //       },
    //     }
    //   );

    // } catch (updateError) {
    //   console.error("❌ Failed to set video public:", updateError.message);
    //   // Kontynuuj mimo błędu - upload był udany
    // }

    return res.json({ success: true, bunnyResponse: resp.data });
  } catch (err: any) {
    console.error("Bunny upload error", err?.response?.data ?? err?.message);
    return res.status(500).json({
      error: "upload-failed",
      details: err?.response?.data ?? err?.message,
    });
  }
});

router.get("/videos", async (req, res) => {
  try {
    //const videos = await Video.find().sort({ createdAt: -1 });
    const videos = await Video.find();

    res.json(videos);
  } catch (error) {
    res.status(500).json({ error: "get-video-failed" });
  }
});

router.get("/:videoId", async (req, res) => {
  try {
    const { videoId } = req.params;

    const video = await Video.findById(videoId);
    console.log("Found video:", video);
    if (!video) return res.status(404).json({ error: "not-found" });
    console.log("Found video:", {
      _id: video._id.toString(),
      bunnyGuid: video.bunnyGuid,
    });
    const playbackUrl = `https://vz-${BUNNY_LIBRARY_ID}-${video.bunnyGuid}.b-cdn.net`;

    return res.json({
      success: true,
      playbackUrl,
      video,
    });
  } catch (err) {
    res.status(500).json({ error: "get-video-failed" });
  }
});

router.delete("/videos/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // 1️⃣ znajdź w bazie
    const video = await Video.findById(id);
    if (!video) {
      return res.status(404).json({ error: "video-not-found" });
    }

    // 2️⃣ usuń z Bunny
    try {
      await axios.delete(
        `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${video.bunnyGuid}`,
        {
          headers: {
            AccessKey: BUNNY_API_KEY,
            Accept: "application/json",
          },
        }
      );
      console.log("✅ Video removed from Bunny:", video.bunnyGuid);
    } catch (bunnyErr: any) {
      // Bunny może zwrócić 404 – np. już usunięty
      console.warn(
        "⚠️ Bunny delete failed (continuing):",
        bunnyErr?.response?.data ?? bunnyErr?.message
      );
    }

    // 3️⃣ usuń z Mongo
    await Video.findByIdAndDelete(id);

    return res.json({
      success: true,
      removedId: id,
    });
  } catch (err: any) {
    console.error("❌ Delete video failed:", err?.message);
    return res.status(500).json({ error: "delete-video-failed" });
  }
});

export default router;
