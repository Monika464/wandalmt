import express from "express";
import { upload, handleUploadErrors } from "../utils/b2Uploader.js";
import { s3 } from "../utils/b2Uploader.js"; // assuming s3 is an instance of S3
import dotenv from "dotenv";
dotenv.config();
const router = express.Router();
// Upload for video files
router.post("/upload/video", upload.array("videos", 3), // Maksymalnie 3 pliki wideo
async (req, res) => {
    const files = req.files;
    if (!files || files.length === 0) {
        res.status(400).json({ error: "Brak przesłanych plików wideo" });
        return;
    }
    try {
        const uploadedUrls = [];
        // Iterate through video files
        for (const file of files) {
            const fileExtension = file.originalname.split(".").pop()?.toLowerCase();
            const allowedExtensions = ["mp4", "avi", "mov"]; // Dozwolone formaty wideo
            if (!allowedExtensions.includes(fileExtension || "")) {
                res.status(400).json({ error: "Nieobsługiwany format wideo" });
                return;
            }
            const key = `${Date.now()}-${file.originalname}`;
            // Upload video file to B2 (Backblaze or AWS S3)
            await s3
                .putObject({
                Bucket: process.env.B2_BUCKET_NAME,
                Key: key,
                Body: file.buffer,
                ContentType: file.mimetype,
                ACL: "private",
            })
                .promise();
            // Generate the file URL
            const url = `https://s3.eu-central-003.backblazeb2.com/${process.env.B2_BUCKET_NAME}/${key}`;
            uploadedUrls.push(url);
        }
        res.status(200).json({
            message: "Wszystkie pliki wideo przesłane",
            urls: uploadedUrls,
        });
    }
    catch (error) {
        console.error("Błąd przy uploadzie plików wideo:", error);
        res.status(500).json({ error: error.message || "Błąd serwera" });
    }
}, handleUploadErrors);
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
            console.log("Uploading file: ", key);
            await s3
                .putObject({
                Bucket: process.env.B2_BUCKET_NAME,
                Key: key,
                Body: file.buffer,
                ContentType: file.mimetype,
                ACL: "private",
            })
                .promise();
            // console.log("File uploaded: ", key);
            //console.log("Response: ", response);
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
