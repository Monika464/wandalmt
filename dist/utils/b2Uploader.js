// utils/b2Uploader.ts
import AWS from "aws-sdk";
import multer from "multer";
import dotenv from "dotenv";
dotenv.config();
export const s3 = new AWS.S3({
    endpoint: "https://s3.eu-central-003.backblazeb2.com",
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APP_KEY,
    region: "eu-central-003",
    s3ForcePathStyle: true,
    signatureVersion: "v4", // <- kluczowe dla kompatybilności
});
// Multer config zostaje taki sam
export const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
});
export const uploadFile = async (file) => {
    const params = {
        Bucket: process.env.B2_BUCKET_NAME,
        Key: `${Date.now()}-${file.originalname}`,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: "public-read", // opcjonalnie
    };
    return await s3.upload(params).promise();
};
export const handleUploadErrors = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        res.status(400).json({ error: err.message });
        return;
    }
    else if (err) {
        res.status(500).json({ error: err.message });
        return;
    }
    next();
};
