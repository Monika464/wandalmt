// JavaScript variant (works in TS with types adjusted)
import express from "express";
import axios from "axios";
import multer from "multer";
import stream from "stream";

const router = express.Router();
const upload = multer();

// env
const BUNNY_API_KEY = process.env.BUNNY_API_KEY!;
const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID!;

if (!BUNNY_API_KEY || !BUNNY_LIBRARY_ID) {
  console.warn("Bunny: missing BUNNY_API_KEY or BUNNY_LIBRARY_ID");
}

/**
 * 1) Create video object in Bunny library -> returns videoId
 */
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

    // resp.data contains the created video object with videoId (guid)
    return res.json(resp.data);
  } catch (err: any) {
    console.error(
      "Bunny create-video error",
      err?.response?.data ?? err?.message
    );
    return res
      .status(500)
      .json({
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

    return res.json({ success: true, bunnyResponse: resp.data });
  } catch (err: any) {
    console.error("Bunny upload error", err?.response?.data ?? err?.message);
    return res
      .status(500)
      .json({
        error: "upload-failed",
        details: err?.response?.data ?? err?.message,
      });
  }
});

export default router;
