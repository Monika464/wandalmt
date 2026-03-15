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
export const getDirectBunnyStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { videoId } = req.params;

    const video = await Video.findById(videoId);
    if (!video) {
      res.status(404).json({ error: "Video not found" });
      return;
    }

    const bunnyVideo = await getBunnyVideo(video.bunnyGuid);

    const status = bunnyVideo.status;
    let mappedStatus: "uploading" | "processing" | "ready" | "error" =
      "processing";
    let progress = bunnyVideo.encodeProgress || 0;

    if (status === 0 || status === 1) mappedStatus = "uploading";
    else if (status === 2 || status === 3) mappedStatus = "processing";
    else if (status === 4) mappedStatus = "ready";
    else if (status === 5) mappedStatus = "error";

    // 🔥 SECURITY: Do not overwrite the "ready" status with a worse status
    if (video.status === "ready" && mappedStatus !== "ready") {
      console.log(
        `⚠️ Video already ready, skipping downgrade to ${mappedStatus}`,
      );
      57;
      // Return the new status to the frontend, but DO NOT update the database
      res.json({
        success: true,
        video: {
          _id: video._id,
          bunnyGuid: video.bunnyGuid,
          title: video.title,
          status: mappedStatus,
          processingProgress: progress,
          duration: bunnyVideo.length,
          thumbnailUrl: video.thumbnailUrl,
          errorMessage: video.errorMessage,
          isComplete: video.status === "ready" || video.status === "error",
          // isComplete based on database status
        },
      });
      return;
    }
    // ONLY if we don't have the "ready" status or the new status is better - update the database
    await Video.findByIdAndUpdate(videoId, {
      status: mappedStatus,
      processingProgress: progress,
      lastChecked: new Date(),
    });

    res.json({
      success: true,
      video: {
        _id: video._id,
        bunnyGuid: video.bunnyGuid,
        title: video.title,
        status: mappedStatus,
        processingProgress: progress,
        duration: bunnyVideo.length,
        thumbnailUrl: video.thumbnailUrl,
        errorMessage: video.errorMessage,
        isComplete: mappedStatus === "ready" || mappedStatus === "error",
      },
    });
  } catch (error) {
    console.error("Error getting Bunny status:", error);
    res.status(500).json({ error: "Failed to get status from Bunny" });
  }
};

export const checkVideoStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  console.log("⚠️ Webhook received but ignored – using direct status only");
  res.sendStatus(200);
  return;
  // try {
  //   const { VideoGuid, Status } = req.body;

  //   if (!VideoGuid || Number.isNaN(Status)) {
  //     res.sendStatus(200);
  //     return;
  //   }

  //   const statusNumber = Number(Status);
  //   let newStatus: "uploading" | "processing" | "ready" | "error" =
  //     "processing";
  //   let processingProgress = 0;
  //   let errorMessage = "";

  //   // Mapowanie statusów
  //   if (statusNumber === 0 || statusNumber === 1) {
  //     newStatus = "uploading";
  //   } else if (statusNumber === 2 || statusNumber === 3) {
  //     newStatus = "processing";
  //     try {
  //       const bunnyVideo = await getBunnyVideo(VideoGuid);
  //       processingProgress = bunnyVideo.encodeProgress || 0;
  //       console.log(`Progress from API: ${processingProgress}%`);
  //     } catch (err) {
  //       console.log("Could not fetch progress from API");
  //     }
  //   } else if (statusNumber === 4) {
  //     newStatus = "ready";
  //     processingProgress = 100;
  //   } else if (statusNumber === 5) {
  //     newStatus = "error";
  //     errorMessage = "Processing failed";
  //   }

  //   // ========== 🔥 NOWA LOGIKA WY MUSZENIA STATUSU ==========
  //   // Jeśli wciąż mamy status uploadingu, sprawdź czas
  //   if (newStatus === "uploading") {
  //     // Znajdź wideo w bazie
  //     const existingVideo = await Video.findOne({ bunnyGuid: VideoGuid });
  //     if (existingVideo) {
  //       const createdAt = existingVideo.createdAt;
  //       const now = new Date();
  //       const minutesDiff = (now.getTime() - createdAt.getTime()) / 60000;

  //       // Jeśli minęły 2 minuty od utworzenia, a wciąż mamy status uploadingu
  //       // – prawdopodobnie upload się zakończył, ale Bunny nie zaktualizował statusu
  //       if (minutesDiff > 2) {
  //         console.log("⚠️ Upload trwa zbyt długo – wymuszam status processing");
  //         newStatus = "processing";
  //         // Opcjonalnie: pobierz progress z API Bunny
  //         try {
  //           const bunnyVideo = await getBunnyVideo(VideoGuid);
  //           processingProgress = bunnyVideo.encodeProgress || 0;
  //         } catch (err) {
  //           processingProgress = 50; // domyślny progress
  //         }
  //       }
  //     }
  //   }
  //   // ========== END OF NEW LOGIC ==========
  // // Check if the video is no longer in its final state
  //   const existingVideo = await Video.findOne({ bunnyGuid: VideoGuid });
  //   if (
  //     existingVideo &&
  //     (existingVideo.status === "ready" || existingVideo.status === "error")
  //   ) {
  //     console.log(
  //       `⚠️ Video ${VideoGuid} already has final status ${existingVideo.status}, skipping webhook update`,
  //     );
  //     res.sendStatus(200);
  //     return;
  //   }

  //   const update: any = {
  //     status: newStatus,
  //     processingProgress,
  //     lastWebhook: new Date(),
  //   };

  //   if (errorMessage) {
  //     update.errorMessage = errorMessage;
  //   }

  //   if (Status === 4) {
  //     try {
  //       const bunnyVideo = await getBunnyVideo(VideoGuid);
  //       update.duration = bunnyVideo.length;
  //       update.width = bunnyVideo.width;
  //       update.height = bunnyVideo.height;
  //       if (bunnyVideo.thumbnailFileName) {
  //         update.thumbnailUrl = `https://vz-b1e17e22-226.b-cdn.net/${VideoGuid}/${bunnyVideo.thumbnailFileName}`;
  //       }
  //       update.bunnyData = {
  //         availableResolutions: bunnyVideo.availableResolutions,
  //         size: bunnyVideo.size,
  //         framerate: bunnyVideo.framerate,
  //       };
  //     } catch (error) {
  //       console.error("Error fetching video details:", error);
  //     }
  //   }

  //   await Video.findOneAndUpdate({ bunnyGuid: VideoGuid }, update);
  //   console.log(
  //     `Video ${VideoGuid} status updated to ${newStatus} (${processingProgress}%)`,
  //   );

  //   res.sendStatus(200);
  //   return;
  // } catch (error) {
  //   console.error("Error processing webhook:", error);
  //   res
  //     .status(200)
  //     .json({ received: true, error: "Processing failed but acknowledged" });
  // }
};

//  🔥 ONLY ONE FUNCTION getVideoStatus (THE ONE WITH isComplete)
export const getVideoStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
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
      res.status(404).json({ error: "Video not found" });
      return;
    }

    // 🔥 PROTECTION AGAINST undefined
    const progress = video.processingProgress ?? 0;

    const isFinalStatus =
      video.status === "ready" ||
      video.status === "error" ||
      (video.status === "processing" && progress >= 100);

    res.json({
      success: true,
      video: {
        _id: video._id,
        bunnyGuid: video.bunnyGuid,
        title: video.title,
        status: video.status,
        processingProgress: progress,
        duration: video.duration,
        thumbnailUrl: video.thumbnailUrl,
        errorMessage: video.errorMessage,
        createdAt: video.createdAt,
        updatedAt: video.updatedAt,
        isComplete: isFinalStatus,
      },
    });
  } catch (error) {
    console.error("Error getting video status:", error);
    res.status(500).json({ error: "Server error" });
  }
};
