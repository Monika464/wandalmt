// src/controllers/bunnyController.ts
import { Request, Response } from "express";
import axios from "axios";
import Video from "../models/video.js";

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
  res: Response,
): Promise<void> => {
  try {
    //console.log("Webhook Bunny received:");

    const { VideoGuid, Status } = req.body;

    // console.log("Webhook data:", VideoGuid, Status);

    if (!VideoGuid || Number.isNaN(Status)) {
      res.sendStatus(200);
      return;
    }

    const statusNumber = Number(Status);
    let newStatus: "uploading" | "processing" | "ready" | "error" =
      "processing";
    let processingProgress = 0;
    let errorMessage = "";

    // Mapowanie statusów
    if (statusNumber === 0 || statusNumber === 1) {
      newStatus = "uploading";
    } else if (statusNumber === 2 || statusNumber === 3) {
      newStatus = "processing";
      // Pobierz POSTĘP z API Bunny (bo webhook go nie ma!)
      try {
        const bunnyVideo = await getBunnyVideo(VideoGuid);
        processingProgress = bunnyVideo.encodeProgress || 0;
        console.log(`Progress from API: ${processingProgress}%`);
      } catch (err) {
        console.log("Could not fetch progress from API");
      }

      //processingProgress = Number(EncodeProgress) || 0;
    } else if (statusNumber === 4) {
      newStatus = "ready";
      processingProgress = 100;
    } else if (statusNumber === 5) {
      newStatus = "error";
      errorMessage = "Processing failed";
    }

    const update: any = {
      status: newStatus,
      processingProgress,
      lastWebhook: new Date(),
    };

    console.log("Updating video:", update);

    if (errorMessage) {
      update.errorMessage = errorMessage;
    }

    //const update: any = { status: statusNumber };

    if (Status === 4) {
      try {
        const bunnyVideo = await getBunnyVideo(VideoGuid);
        update.duration = bunnyVideo.length;
        update.width = bunnyVideo.width;
        update.height = bunnyVideo.height;
        if (bunnyVideo.thumbnailFileName) {
          update.thumbnailUrl = `https://vz-b1e17e22-226.b-cdn.net/${VideoGuid}/${bunnyVideo.thumbnailFileName}`;
        }
        update.bunnyData = {
          availableResolutions: bunnyVideo.availableResolutions,
          size: bunnyVideo.size,
          framerate: bunnyVideo.framerate,
        };
      } catch (error) {
        console.error("Error fetching video details:", error);
      }
    }

    await Video.findOneAndUpdate({ bunnyGuid: VideoGuid }, update);
    console.log(
      `Video ${VideoGuid} status updated to ${newStatus} (${processingProgress}%)`,
    );

    res.sendStatus(200);
    return;
  } catch (error) {
    console.error("Error processing webhook:", error);

    res
      .status(200)
      .json({ received: true, error: "Processing failed but acknowledged" });
  }
};

// Nowy endpoint do pobierania statusu video
export const getVideoStatus = async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;

    let video;

    // Sprawdź czy to ObjectId
    if (videoId.match(/^[0-9a-fA-F]{24}$/)) {
      video = await Video.findById(videoId);
    } else {
      // To prawdopodobnie bunnyGuid
      video = await Video.findOne({ bunnyGuid: videoId });
    }

    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    // Opcjonalnie: sprawdź bezpośrednio w Bunny, jeśli potrzebujemy najświeższych danych
    let bunnyStatus = null;
    try {
      const bunnyVideo = await getBunnyVideo(video.bunnyGuid);
      bunnyStatus = {
        status: bunnyVideo.status,
        encodeProgress: bunnyVideo.encodeProgress,
      };
    } catch (error) {
      console.error("Error fetching Bunny status:", error);
    }

    res.json({
      success: true,
      video: {
        _id: video._id,
        bunnyGuid: video.bunnyGuid,
        title: video.title,
        status: video.status,
        processingProgress: video.processingProgress,
        duration: video.duration,
        thumbnailUrl: video.thumbnailUrl,
        errorMessage: video.errorMessage,
        createdAt: video.createdAt,
        updatedAt: video.updatedAt,
      },
      bunnyStatus,
    });
  } catch (error) {
    console.error("Error getting video status:", error);
    res.status(500).json({ error: "Server error" });
  }
};
