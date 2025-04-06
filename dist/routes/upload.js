import express from "express";
import { upload, handleUploadErrors } from "../utils/b2Uploader.js";
import { s3 } from "../utils/b2Uploader.js"; // assuming s3 is an instance of S3
const router = express.Router();
router.post("/upload", upload.array("files", 5), // input name="files"
async (req, res) => {
    const files = req.files;
    if (!files || files.length === 0) {
        res.status(400).json({ error: "Brak przesłanych plików" });
        return;
    }
    try {
        const uploadedUrls = [];
        for (const file of files) {
            const key = `${Date.now()}-${file.originalname}`;
            // We are directly calling putObject here
            await s3.putObject({
                Bucket: process.env.B2_BUCKET_NAME,
                Key: key,
                Body: file.buffer,
                ContentType: file.mimetype,
                ACL: "public-read",
            });
            // Build the URL after upload
            const url = `https://s3.eu-central-003.backblazeb2.com/${process.env.B2_BUCKET_NAME}/${key}`;
            uploadedUrls.push(url);
        }
        res
            .status(200)
            .json({ message: "Wszystkie pliki przesłane", urls: uploadedUrls });
    }
    catch (error) {
        console.error("Błąd przy uploadzie:", error);
        res.status(500).json({ error: error.message || "Błąd serwera" });
    }
}, handleUploadErrors);
export default router;
