// src/controllers/bunnyController.ts
import { Request, Response } from "express";
import axios from "axios";
import Video from "../models/video.js";
import fs from "fs";
import path from "path";

const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID!;
const BUNNY_API_KEY = process.env.BUNNY_API_KEY!;

export async function getBunnyVideo(videoGuid: string) {
  const url = `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${videoGuid}`;

  const resp = await axios.get(url, {
    headers: {
      AccessKey: BUNNY_API_KEY,
      Accept: "application/json",
    },
  });

  return resp.data;
}

//https://www.google.com/search?client=ubuntu-sn&channel=fs&q=buny+how+to+make+video+public#fpstate=ive&vld=cid:745dcd86,vid:PjIuNZqyK8E,st:73

export const checkVideoStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    console.log("Webhook Bunny received:", req.body);

    const { VideoGuid, Status } = req.body;

    const status = Number(Status);

    if (!VideoGuid || Number.isNaN(status)) {
      res.sendStatus(200);
      return;
    }

    const update: any = { status };

    if (Status === 4) {
      const bunnyVideo = await getBunnyVideo(VideoGuid);
      update.duration = bunnyVideo.length;
      update.width = bunnyVideo.width;
      update.height = bunnyVideo.height;
    }

    await Video.findOneAndUpdate({ bunnyGuid: VideoGuid }, update);

    res.sendStatus(200);
    return;
  } catch (error) {
    console.error("Error processing webhook:", error);

    res
      .status(200)
      .json({ received: true, error: "Processing failed but acknowledged" });
  }
};
