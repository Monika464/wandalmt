// controllers/chapterController.ts
import { Request, Response } from "express";
import Resource from "../../models/resource.js";
import Video from "../../models/video.js";

// ADD Chapter
export const addChapter = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { videoId, description, title, number } = req.body;

  //console.log("Adding chapter to resource ID:", id);
  //console.log("Chapter data:", { videoId, description, title, number });

  try {
    const resource = await Resource.findById(id);
    if (!resource) {
      res.status(404).json({ error: "Resource not found" });
      return;
    }

    if (!resource.chapters) resource.chapters = [];

    if (resource.chapters.length >= 100) {
      res
        .status(400)
        .json({ error: "Maximum number of chapters reached (100)" });
      return;
    }

    // Jeśli podano videoId, sprawdź czy video istnieje
    if (videoId) {
      const video = await Video.findOne({ bunnyGuid: videoId });
      if (!video) {
        return res.status(404).json({ error: "Video not found" });
      }
    }

    const newChapter = {
      number: number || resource.chapters.length + 1,
      title,
      description,
      videoId,
    };

    resource.chapters.push(newChapter);
    await resource.save();

    const savedChapter = resource.chapters[resource.chapters.length - 1];

    res.status(200).json({
      message: "Chapter added",
      chapter: savedChapter,
      chapters: resource.chapters,
    });
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Server error" });
    return;
  }
};

// EDIT Chapter
export const editChapter = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id, chapterId } = req.params;
    const updateData = req.body;

    const resource = await Resource.findById(id);
    // if (!resource) return res.status(404).json({ error: "Resource not found" });
    if (!resource) {
      res.status(404).json({ error: "Resource not found" });
      return;
    }
    const chapter = (resource.chapters as any).id(chapterId);
    // if (!chapter) return res.status(404).json({ error: "Chapter not found" });
    if (!chapter) {
      res.status(404).json({ error: "Chapter not found" });
      return;
    }
    // Jeśli zmieniamy videoId, sprawdź czy nowe video istnieje
    if (updateData.videoId && updateData.videoId !== chapter.videoId) {
      const video = await Video.findOne({ bunnyGuid: updateData.videoId });
      if (!video) {
        res.status(404).json({ error: "Video not found" });
        return;
      }
    }

    Object.assign(chapter, req.body);
    await resource.save();

    res.json({
      success: true,
      chapter,
      resource,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// DELETE Chapter Video
const BUNNY_API_KEY = process.env.BUNNY_API_KEY || "";
const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID || "";

import axios from "axios";
export const deleteChapterVideo = async (req: Request, res: Response) => {
  try {
    const { id, chapterId } = req.params;

    const resource = await Resource.findById(id);
    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    const chapter = (resource.chapters as any).id(chapterId);
    if (!chapter) {
      return res.status(404).json({ error: "Chapter not found" });
    }

    if (!chapter.videoId) {
      return res.status(400).json({ error: "Chapter has no video assigned" });
    }

    const videoId = chapter.videoId;

    // 1. Usuń video z Bunny
    try {
      await axios.delete(
        `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${videoId}`,
        {
          headers: {
            AccessKey: BUNNY_API_KEY,
            Accept: "application/json",
          },
        }
      );
      console.log("✅ Video removed from Bunny:", videoId);
    } catch (bunnyErr: any) {
      console.warn(
        "⚠️ Bunny delete failed (continuing):",
        bunnyErr?.response?.data ?? bunnyErr?.message
      );
    }

    // 2. Usuń video z bazy danych
    await Video.findOneAndDelete({ bunnyGuid: videoId });

    // 3. Wyczyść videoId z chaptera
    chapter.videoId = undefined;
    await resource.save();

    res.json({
      success: true,
      message: "Video deleted successfully",
      chapterId,
      removedVideoId: videoId,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Server error",
    });
  }
};

// GET Chapter with Video details
export const getChapterWithVideo = async (req: Request, res: Response) => {
  try {
    const { id, chapterId } = req.params;

    const resource = await Resource.findById(id);
    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    const chapter = (resource.chapters as any).id(chapterId);
    if (!chapter) {
      return res.status(404).json({ error: "Chapter not found" });
    }

    let videoDetails = null;
    if (chapter.videoId) {
      const video = await Video.findOne({ bunnyGuid: chapter.videoId });
      if (video) {
        videoDetails = {
          _id: video._id,
          bunnyGuid: video.bunnyGuid,
          title: video.title,
          thumbnailUrl: video.thumbnailUrl,
          createdAt: video.createdAt,
        };
      }
    }

    res.json({
      success: true,
      chapter: {
        ...chapter.toObject(),
        video: videoDetails,
      },
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Server error",
    });
  }
};

// DELETE Chapter
export const deleteChapter = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id, chapterId } = req.params;
    const resource = await Resource.findById(id);

    if (!resource) {
      res.status(404).json({ error: "Resource not found" });
      return;
    }

    const chapter = (resource.chapters as any).id(chapterId);

    if (!chapter) {
      res.status(404).json({ error: "Chapter not found" });
      return;
    }
    // Jeśli chapter ma video, usuń je
    if (chapter.videoId) {
      try {
        // Usuń z Bunny
        await axios.delete(
          `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${chapter.videoId}`,
          {
            headers: {
              AccessKey: BUNNY_API_KEY,
              Accept: "application/json",
            },
          }
        );

        // Usuń z bazy danych
        await Video.findOneAndDelete({ bunnyGuid: chapter.videoId });
      } catch (err) {
        console.warn("Error deleting chapter video:", err);
      }
    }

    chapter.deleteOne();
    await resource.save();
    res.json({
      success: true,
      message: "Chapter deleted",
      resource,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
