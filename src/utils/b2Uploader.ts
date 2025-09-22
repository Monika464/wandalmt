import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { ObjectCannedACL } from "@aws-sdk/client-s3";
import multer from "multer";
import dotenv from "dotenv";
import { Request, Response, NextFunction } from "express";
import { PutObjectCommand } from "@aws-sdk/client-s3";
dotenv.config();

export const s3 = new S3Client({
  region: "eu-central-003",
  endpoint: "https://s3.eu-central-003.backblazeb2.com",
  credentials: {
    accessKeyId: process.env.B2_KEY_ID!,
    secretAccessKey: process.env.B2_APP_KEY!,
  },
  forcePathStyle: true,
  //signatureVersion: "v4", // <- kluczowe dla kompatybilności
});

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});
export const uploadFile = async (file: Express.Multer.File) => {
  const params = {
    Bucket: process.env.B2_BUCKET_NAME!,
    Key: `${Date.now()}-${file.originalname}`,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: "public-read" as ObjectCannedACL, // publiczne pliki
  };
  // Odpowiednik s3.upload() z v2
  // const uploader = new Upload({
  //   client: s3,
  //   params: uploadParams,
  // });
  const command = new PutObjectCommand(params);
  return await s3.send(command); // używamy .send(), nie .putObject()

  //return uploader.done(); // zwraca Promise z informacjami o uploadzie
  //return await s3.upload(params).promise();
};

export const handleUploadErrors = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: err.message });
    return;
  } else if (err) {
    res.status(500).json({ error: err.message });
    return;
  }
  next();
};

// Funkcja do listowania plików w bucket
export const listFilesInBucket = async () => {
  try {
    const command = new ListObjectsV2Command({
      Bucket: process.env.B2_BUCKET_NAME!,
    });

    const data = await s3.send(command);
    console.log("Objects in bucket:", data.Contents);
    return data.Contents;
  } catch (error) {
    console.error("Error listing objects:", error);
    throw error;
  }
};

/// check files in bucket
// const params = {
//   Bucket: process.env.B2_BUCKET_NAME!,
// };

// s3.listObjectsV2(params, (err, data) => {
//   if (err) {
//     console.log("Error listing objects:", err);
//   } else {
//     // console.log("Objects in bucket:", data);
//   }
// });
