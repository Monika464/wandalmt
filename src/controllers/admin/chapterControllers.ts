// // controllers/chapterController.ts

// controllers/chapterController.ts
import mongoose from "mongoose";
import { Request, Response } from "express";
import Resource from "../../models/resource.js";
import Video from "../../models/video.js";
import axios from "axios";

const BUNNY_API_KEY = process.env.BUNNY_API_KEY || "";
const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID || "";

// ADD Chapter
export const addChapter = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { description, title, number, bunnyVideoId, videoId } = req.body;

  try {
    const resource = await Resource.findById(id);
    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    if (!resource.chapters) resource.chapters = [];

    if (resource.chapters.length >= 100) {
      return res
        .status(400)
        .json({ error: "Maximum number of chapters reached (100)" });
    }

    let video = null;
    //let videoId = undefined;
    let videoDetails = null;
    let finalVideoId = undefined;

    // Jeśli podano bunnyVideoId, sprawdź czy video istnieje
    if (videoId && mongoose.Types.ObjectId.isValid(videoId)) {
      video = await Video.findById(videoId);
      if (video) {
        finalVideoId = video._id;
        videoDetails = {
          _id: video._id,
          bunnyGuid: video.bunnyGuid,
          title: video.title,
          thumbnailUrl: video.thumbnailUrl,
          createdAt: video.createdAt,
        };
      } else if (bunnyVideoId) {
        video = await Video.findOne({ bunnyGuid: bunnyVideoId });
        if (video) {
          finalVideoId = video._id;
          videoDetails = {
            _id: video._id,
            bunnyGuid: video.bunnyGuid,
            title: video.title,
            thumbnailUrl: video.thumbnailUrl,
            createdAt: video.createdAt,
          };
        } else {
          console.warn(
            `Video with bunnyGuid ${bunnyVideoId} not found in database, but chapter will be saved`
          );
        }
      }

      const newChapter = {
        number: number || resource.chapters.length + 1,
        title,
        description,
        bunnyVideoId: bunnyVideoId || undefined,
        videoId: finalVideoId || undefined,
      };

      resource.chapters.push(newChapter);
      await resource.save();

      const savedChapter = resource.chapters[resource.chapters.length - 1];

      res.status(200).json({
        success: true,
        message: "Chapter added",
        chapter: {
          ...savedChapter.toObject(),
          video: videoDetails,
        },
        chapters: resource.chapters,
      });
    }
  } catch (err) {
    console.error("Error adding chapter:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Server error",
    });
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
    if (!resource) {
      res.status(404).json({ error: "Resource not found" });
      return;
    }

    const chapter = (resource.chapters as any).id(chapterId);
    if (!chapter) {
      res.status(404).json({ error: "Chapter not found" });
      return;
    }

    // Obsługa bunnyVideoId
    if (updateData.bunnyVideoId !== undefined) {
      if (updateData.bunnyVideoId === "" || updateData.bunnyVideoId === null) {
        // Usuwamy video
        chapter.bunnyVideoId = undefined;
        chapter.videoId = undefined;
      } else {
        // Sprawdź czy video istnieje
        const video = await Video.findOne({
          bunnyGuid: updateData.bunnyVideoId,
        });

        if (video) {
          // Zapisujemy OBA identyfikatory
          chapter.bunnyVideoId = updateData.bunnyVideoId;
          chapter.videoId = video._id;
        } else {
          console.warn(
            `Video with bunnyGuid ${updateData.bunnyVideoId} not found`
          );
          // Zapisujemy tylko bunnyVideoId
          chapter.bunnyVideoId = updateData.bunnyVideoId;
          chapter.videoId = undefined;
        }
      }
    }

    // Aktualizuj inne pola
    if (updateData.number !== undefined) chapter.number = updateData.number;
    if (updateData.title !== undefined) chapter.title = updateData.title;
    if (updateData.description !== undefined)
      chapter.description = updateData.description;

    await resource.save();

    // Pobierz szczegóły video jeśli istnieje
    let videoDetails = null;
    if (chapter.bunnyVideoId) {
      const video = await Video.findOne({ bunnyGuid: chapter.bunnyVideoId });
      if (video) {
        videoDetails = {
          _id: video._id,
          bunnyGuid: video.bunnyGuid,
          title: video.title,
          thumbnailUrl: video.thumbnailUrl,
          createdAt: video.createdAt,
        };

        // Jeśli videoId się nie zgadza, zaktualizuj
        if (
          !chapter.videoId ||
          chapter.videoId.toString() !== video._id.toString()
        ) {
          chapter.videoId = video._id;
          await resource.save();
        }
      }
    }

    res.json({
      success: true,
      chapter: {
        ...chapter.toObject(),
        video: videoDetails,
      },
      resource,
    });
  } catch (error) {
    console.error("Error editing chapter:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// DELETE Chapter Video
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

    if (!chapter.bunnyVideoId) {
      return res.status(400).json({ error: "Chapter has no video assigned" });
    }

    const bunnyVideoId = chapter.bunnyVideoId;

    // 1. Usuń video z Bunny
    try {
      await axios.delete(
        `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${bunnyVideoId}`,
        {
          headers: {
            AccessKey: BUNNY_API_KEY,
            Accept: "application/json",
          },
        }
      );
      console.log("✅ Video removed from Bunny:", bunnyVideoId);
    } catch (bunnyErr: any) {
      console.warn(
        "⚠️ Bunny delete failed (continuing):",
        bunnyErr?.response?.data ?? bunnyErr?.message
      );
    }

    // 2. Usuń video z bazy danych
    try {
      await Video.findOneAndDelete({ bunnyGuid: bunnyVideoId });
      console.log("✅ Video removed from database:", bunnyVideoId);
    } catch (dbErr) {
      console.warn("⚠️ Could not delete video from database:", dbErr);
    }

    // 3. Wyczyść pola video w chapterze
    chapter.bunnyVideoId = undefined;
    chapter.videoId = undefined;
    await resource.save();

    res.json({
      success: true,
      message: "Video deleted successfully",
      chapterId,
      removedBunnyVideoId: bunnyVideoId,
    });
  } catch (err) {
    console.error("Error deleting chapter video:", err);
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

    // Używamy bunnyVideoId do znalezienia video
    if (chapter.bunnyVideoId) {
      const video = await Video.findOne({ bunnyGuid: chapter.bunnyVideoId });
      if (video) {
        videoDetails = {
          _id: video._id,
          bunnyGuid: video.bunnyGuid,
          title: video.title,
          thumbnailUrl: video.thumbnailUrl,
          createdAt: video.createdAt,
          status: video.status,
          processingProgress: video.processingProgress,
        };
      } else {
        videoDetails = {
          bunnyGuid: chapter.bunnyVideoId,
          status: "unknown",
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
    console.error("Error getting chapter with video:", err);
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

    // Jeśli chapter ma video, usuń je z Bunny
    if (chapter.bunnyVideoId) {
      try {
        await axios.delete(
          `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${chapter.bunnyVideoId}`,
          {
            headers: {
              AccessKey: BUNNY_API_KEY,
              Accept: "application/json",
            },
          }
        );
        console.log("✅ Video removed from Bunny:", chapter.bunnyVideoId);

        // Usuń z bazy danych
        await Video.findOneAndDelete({ bunnyGuid: chapter.bunnyVideoId });
        console.log("✅ Video removed from database:", chapter.bunnyVideoId);
      } catch (err) {
        console.warn("Error deleting chapter video:", err);
      }
    }

    // Usuń chapter
    chapter.deleteOne();
    await resource.save();

    res.json({
      success: true,
      message: "Chapter deleted",
      resource,
    });
  } catch (error) {
    console.error("Error deleting chapter:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Ustaw video dla chaptera
export const setChapterVideo = async (req: Request, res: Response) => {
  try {
    const { id, chapterId } = req.params;
    const { bunnyVideoId } = req.body;

    if (!bunnyVideoId) {
      return res.status(400).json({ error: "bunnyVideoId is required" });
    }

    const resource = await Resource.findById(id);
    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    const chapter = (resource.chapters as any).id(chapterId);
    if (!chapter) {
      return res.status(404).json({ error: "Chapter not found" });
    }

    // Sprawdź czy video istnieje
    const video = await Video.findOne({ bunnyGuid: bunnyVideoId });
    if (!video) {
      console.warn(
        `Video with bunnyGuid ${bunnyVideoId} not found in database`
      );
    }

    // Ustaw pola
    chapter.bunnyVideoId = bunnyVideoId;
    chapter.videoId = video ? video._id : undefined;

    await resource.save();

    res.json({
      success: true,
      chapterId,
      bunnyVideoId,
      videoId: video ? video._id : null,
    });
  } catch (err) {
    console.error("Error setting chapter video:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Server error",
    });
  }
};

// controllers/chapterController.ts
// import { Request, Response } from "express";
// import Resource from "../../models/resource.js";
// import Video from "../../models/video.js";
// import axios from "axios";

// const BUNNY_API_KEY = process.env.BUNNY_API_KEY || "";
// const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID || "";

// // ADD Chapter - ZAKTUALIZOWANE: używa tylko bunnyVideoId
// export const addChapter = async (req: Request, res: Response) => {
//   const { id } = req.params;
//   const { description, title, number, bunnyVideoId } = req.body; // ZMIANA: bunnyVideoId zamiast videoId/bunnyGuid

//   //console.log("Adding chapter to resource ID:", id);
//   //console.log("Chapter data:", { bunnyVideoId, description, title, number });

//   try {
//     const resource = await Resource.findById(id);
//     if (!resource) {
//       return res.status(404).json({ error: "Resource not found" });
//     }

//     if (!resource.chapters) resource.chapters = [];

//     if (resource.chapters.length >= 100) {
//       return res
//         .status(400)
//         .json({ error: "Maximum number of chapters reached (100)" });
//     }

//     let video = null;
//     let videoId = undefined;
//     let videoDetails = null;

//     // Jeśli podano bunnyVideoId, sprawdź czy video istnieje
//     if (bunnyVideoId) {
//       video = await Video.findOne({ bunnyGuid: bunnyVideoId });
//       if (video) {
//         videoId = video._id;
//         videoDetails = {
//           _id: video._id,
//           bunnyGuid: video.bunnyGuid,
//           title: video.title,
//           thumbnailUrl: video.thumbnailUrl,
//           createdAt: video.createdAt,
//         };

//         if (!video) {
//           console.warn(
//             `Video with bunnyGuid ${bunnyVideoId} not found in database, but chapter will be saved`
//           );
//           // Nie zwracamy błędu - chapter może mieć bunnyVideoId bez video w bazie
//         }
//       }

//       const newChapter = {
//         number: number || resource.chapters.length + 1,
//         title,
//         description,
//         bunnyVideoId: bunnyVideoId || undefined, // ZAPISUJEMY tylko bunnyVideoId
//         videoId: videoId || undefined, // ZAPISUJEMY videoId jeśli znalezione
//       };

//       resource.chapters.push(newChapter);
//       await resource.save();

//       const savedChapter = resource.chapters[resource.chapters.length - 1];

//       res.status(200).json({
//         success: true,
//         message: "Chapter added",
//         chapter: {
//           ...savedChapter.toObject(),
//           video: videoDetails,
//         },
//         chapters: resource.chapters,
//       });
//     }
//   } catch (err) {
//     console.error("Error adding chapter:", err);
//     res.status(500).json({
//       error: err instanceof Error ? err.message : "Server error",
//     });
//   }
// };

// // EDIT Chapter - ZAKTUALIZOWANE
// export const editChapter = async (
//   req: Request,
//   res: Response
// ): Promise<void> => {
//   try {
//     const { id, chapterId } = req.params;
//     const updateData = req.body;

//     const resource = await Resource.findById(id);
//     if (!resource) {
//       res.status(404).json({ error: "Resource not found" });
//       return;
//     }

//     const chapter = (resource.chapters as any).id(chapterId);
//     if (!chapter) {
//       res.status(404).json({ error: "Chapter not found" });
//       return;
//     }

//     // Obsługa bunnyVideoId
//     if (updateData.bunnyVideoId !== undefined) {
//       if (updateData.bunnyVideoId === "" || updateData.bunnyVideoId === null) {
//         // Usuwamy video
//         chapter.bunnyVideoId = undefined;
//       } else {
//         // Sprawdź czy video istnieje (opcjonalnie)
//         const video = await Video.findOne({
//           bunnyGuid: updateData.bunnyVideoId,
//         });

//             if (video) {
//           // Zapisujemy OBA identyfikatory
//           chapter.bunnyVideoId = updateData.bunnyVideoId; // Bunny GUID
//           chapter.videoId = video._id; // MongoDB ID
//         } else {
//           console.warn(
//             `Video with bunnyGuid ${updateData.bunnyVideoId} not found`
//           );
//         if (!video) {
//           console.warn(
//             `Video with bunnyGuid ${updateData.bunnyVideoId} not found`
//           );
//         }
//         chapter.bunnyVideoId = updateData.bunnyVideoId;
//       }

//       // Usuń stare pola jeśli przypadkiem tam są
//       chapter.videoId = undefined;
//       chapter.bunnyGuid = undefined;
//     }

//     // Aktualizuj inne pola
//     if (updateData.number !== undefined) chapter.number = updateData.number;
//     if (updateData.title !== undefined) chapter.title = updateData.title;
//     if (updateData.description !== undefined)
//       chapter.description = updateData.description;

//     await resource.save();

//     // Pobierz szczegóły video jeśli istnieje
//     let videoDetails = null;
//     if (chapter.bunnyVideoId) {
//       const video = await Video.findOne({ bunnyGuid: chapter.bunnyVideoId });
//       if (video) {
//         videoDetails = {
//           _id: video._id,
//           bunnyGuid: video.bunnyGuid,
//           title: video.title,
//           thumbnailUrl: video.thumbnailUrl,
//           createdAt: video.createdAt,
//         };

//           // Jeśli videoId się nie zgadza, zaktualizuj
//         if (chapter.videoId?.toString() !== video._id.toString()) {
//           chapter.videoId = video._id;
//           await resource.save();
//         }
//       }
//     }

//     res.json({
//       success: true,
//       chapter: {
//         ...chapter.toObject(),
//         video: videoDetails,
//       },
//       resource,
//     });
//   } catch (error) {
//     console.error("Error editing chapter:", error);
//     res.status(500).json({
//       error: error instanceof Error ? error.message : "Unknown error",
//     });
//   }
// };

// // DELETE Chapter Video - ZAKTUALIZOWANE
// export const deleteChapterVideo = async (req: Request, res: Response) => {
//   try {
//     const { id, chapterId } = req.params;

//     const resource = await Resource.findById(id);
//     if (!resource) {
//       return res.status(404).json({ error: "Resource not found" });
//     }

//     const chapter = (resource.chapters as any).id(chapterId);
//     if (!chapter) {
//       return res.status(404).json({ error: "Chapter not found" });
//     }

//     if (!chapter.bunnyVideoId) {
//       // ZMIANA: sprawdzamy bunnyVideoId
//       return res.status(400).json({ error: "Chapter has no video assigned" });
//     }

//     const bunnyVideoId = chapter.bunnyVideoId;

//     // 1. Usuń video z Bunny
//     try {
//       await axios.delete(
//         `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${bunnyVideoId}`,
//         {
//           headers: {
//             AccessKey: BUNNY_API_KEY,
//             Accept: "application/json",
//           },
//         }
//       );
//       console.log("✅ Video removed from Bunny:", bunnyVideoId);
//     } catch (bunnyErr: any) {
//       // Jeśli video już nie istnieje w Bunny, kontynuuj
//       console.warn(
//         "⚠️ Bunny delete failed (continuing):",
//         bunnyErr?.response?.data ?? bunnyErr?.message
//       );
//     }

//     // 2. Usuń video z bazy danych (opcjonalnie)
//     try {
//       await Video.findOneAndDelete({ bunnyGuid: bunnyVideoId });
//       console.log("✅ Video removed from database:", bunnyVideoId);
//     } catch (dbErr) {
//       console.warn("⚠️ Could not delete video from database:", dbErr);
//     }

//     // 3. Wyczyść bunnyVideoId z chaptera
//     chapter.bunnyVideoId = undefined;
//     await resource.save();

//     res.json({
//       success: true,
//       message: "Video deleted successfully",
//       chapterId,
//       removedBunnyVideoId: bunnyVideoId, // ZMIANA: nazwa pola
//     });
//   } catch (err) {
//     console.error("Error deleting chapter video:", err);
//     res.status(500).json({
//       error: err instanceof Error ? err.message : "Server error",
//     });
//   }
// };

// // GET Chapter with Video details - ZAKTUALIZOWANE
// export const getChapterWithVideo = async (req: Request, res: Response) => {
//   try {
//     const { id, chapterId } = req.params;

//     const resource = await Resource.findById(id);
//     if (!resource) {
//       return res.status(404).json({ error: "Resource not found" });
//     }

//     const chapter = (resource.chapters as any).id(chapterId);
//     if (!chapter) {
//       return res.status(404).json({ error: "Chapter not found" });
//     }

//     let videoDetails = null;

//     // Używamy bunnyVideoId do znalezienia video
//     if (chapter.bunnyVideoId) {
//       const video = await Video.findOne({ bunnyGuid: chapter.bunnyVideoId });
//       if (video) {
//         videoDetails = {
//           _id: video._id,
//           bunnyGuid: video.bunnyGuid,
//           title: video.title,
//           thumbnailUrl: video.thumbnailUrl,
//           createdAt: video.createdAt,
//           status: video.status,
//           processingProgress: video.processingProgress,
//         };
//       } else {
//         // Jeśli nie ma video w bazie, ale mamy bunnyVideoId
//         videoDetails = {
//           bunnyGuid: chapter.bunnyVideoId,
//           status: "unknown",
//         };
//       }
//     }

//     res.json({
//       success: true,
//       chapter: {
//         ...chapter.toObject(),
//         video: videoDetails,
//       },
//     });
//   } catch (err) {
//     console.error("Error getting chapter with video:", err);
//     res.status(500).json({
//       error: err instanceof Error ? err.message : "Server error",
//     });
//   }
// };

// // DELETE Chapter - ZAKTUALIZOWANE
// export const deleteChapter = async (
//   req: Request,
//   res: Response
// ): Promise<void> => {
//   try {
//     const { id, chapterId } = req.params;

//     const resource = await Resource.findById(id);
//     if (!resource) {
//       res.status(404).json({ error: "Resource not found" });
//       return;
//     }

//     const chapter = (resource.chapters as any).id(chapterId);
//     if (!chapter) {
//       res.status(404).json({ error: "Chapter not found" });
//       return;
//     }

//     console.log("Deleting chapter:", chapterId);
//     console.log("Chapter data:", {
//       bunnyVideoId: chapter.bunnyVideoId,
//       videoId: chapter.videoId,
//       bunnyGuid: chapter.bunnyGuid,
//     });

//     // Jeśli chapter ma video, usuń je z Bunny
//     if (chapter.bunnyVideoId) {
//       try {
//         await axios.delete(
//           `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${chapter.bunnyVideoId}`,
//           {
//             headers: {
//               AccessKey: BUNNY_API_KEY,
//               Accept: "application/json",
//             },
//           }
//         );
//         console.log("✅ Video removed from Bunny:", chapter.bunnyVideoId);

//         // Opcjonalnie: usuń z bazy danych
//         await Video.findOneAndDelete({ bunnyGuid: chapter.bunnyVideoId });
//         console.log("✅ Video removed from database:", chapter.bunnyVideoId);
//       } catch (err) {
//         console.warn("Error deleting chapter video:", err);
//         // Kontynuuj usuwanie chaptera nawet jeśli błąd
//       }
//     }

//     // Usuń chapter
//     chapter.deleteOne();
//     await resource.save();

//     res.json({
//       success: true,
//       message: "Chapter deleted",
//       resource,
//     });
//   } catch (error) {
//     console.error("Error deleting chapter:", error);
//     res.status(500).json({
//       error: error instanceof Error ? error.message : "Unknown error",
//     });
//   }
// };

// // Dodatkowa funkcja: ustaw video dla chaptera (backward compatibility)
// export const setChapterVideo = async (req: Request, res: Response) => {
//   try {
//     const { id, chapterId } = req.params;
//     const { bunnyVideoId } = req.body; // ZMIANA: bunnyVideoId zamiast videoId

//     if (!bunnyVideoId) {
//       return res.status(400).json({ error: "bunnyVideoId is required" });
//     }

//     const resource = await Resource.findById(id);
//     if (!resource) {
//       return res.status(404).json({ error: "Resource not found" });
//     }

//     const chapter = (resource.chapters as any).id(chapterId);
//     if (!chapter) {
//       return res.status(404).json({ error: "Chapter not found" });
//     }

//     // Sprawdź czy video istnieje (opcjonalnie)
//     const video = await Video.findOne({ bunnyGuid: bunnyVideoId });
//     if (!video) {
//       console.warn(
//         `Video with bunnyGuid ${bunnyVideoId} not found in database`
//       );
//     }

//     // Ustaw tylko bunnyVideoId
//     chapter.bunnyVideoId = bunnyVideoId;
//     await resource.save();

//     res.json({
//       success: true,
//       chapterId,
//       bunnyVideoId,
//     });
//   } catch (err) {
//     console.error("Error setting chapter video:", err);
//     res.status(500).json({
//       error: err instanceof Error ? err.message : "Server error",
//     });
//   }
// };
