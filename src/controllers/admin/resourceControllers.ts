//RESOURCE CONTROLLERS

import { Request, Response } from "express";
import Resource from "../../models/resource.js";
import axios from "axios";
import Video from "../../models/video.js";

// env
const BUNNY_API_KEY = process.env.BUNNY_API_KEY!;
const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID!;

if (!BUNNY_API_KEY || !BUNNY_LIBRARY_ID) {
  console.warn("Bunny: missing BUNNY_API_KEY or BUNNY_LIBRARY_ID");
}

//FETCH ALL RESOURCES

export const fetchResources = async (req: Request, res: Response) => {
  try {
    // --- 1️⃣ Pobierz parametry zapytania ---
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const q = (req.query.q as string) || "";
    const sortField = (req.query.sortField as string) || "createdAt";
    const sortOrder = (req.query.sortOrder as string) === "asc" ? 1 : -1;

    // --- 2️⃣ Zbuduj filtr wyszukiwania ---
    const filter: any = {};
    if (q) {
      filter.$or = [
        { title: new RegExp(q, "i") }, // wyszukiwanie po nazwie (case-insensitive)
        { content: new RegExp(q, "i") },
      ];
    }

    // --- 3️⃣ Policz całkowitą liczbę zasobów ---
    const total = await Resource.countDocuments(filter);

    // --- 4️⃣ Pobierz zasoby z paginacją ---
    const items = await Resource.find(filter)
      .sort({ [sortField]: sortOrder })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(); // .lean() = szybsze, zwraca zwykłe obiekty JS

    // --- 5️⃣ Zwróć dane ---
    res.status(200).json({
      items, // lista zasobów
      total, // łączna liczba zasobów (dla paginacji)
      page, // aktualna strona
      pageSize, // ilość elementów na stronie
    });
  } catch (error) {
    console.error("❌ Error fetching resources:", error);
    res.status(500).json({ error: "Błąd serwera" });
  }
};

// CREATE Resource
export const createResource = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { productId, title, content } = req.body;
    const resource = new Resource({
      productId,
      title,
      content,
      chapters: [],
    });
    //console.log("resource", resource);
    await resource.save();
    res.status(201).json(resource);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// UPDATE Resource
export const updateResource = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const updated = await Resource.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    // if (!updated) return res.status(404).json({ error: "Resource not found" });
    if (!updated) return;
    res.json(updated);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// DELETE Resource
// DELETE /api/resources/:id

export const deleteResource = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    // 1. Znajdź resource razem z jego chapterami
    const resource = await Resource.findById(id);
    if (!resource) {
      res.status(404).json({ error: "Resource not found" });
      return;
    }

    // 2. Zbierz wszystkie bunnyVideoId z chapterów
    const bunnyVideoIds: string[] = [];

    if (resource.chapters && resource.chapters.length > 0) {
      resource.chapters.forEach((chapter: any) => {
        if (chapter.bunnyVideoId) {
          bunnyVideoIds.push(chapter.bunnyVideoId);
        }
      });
    }

    // 3. Usuń wszystkie video z BunnyStream (równolegle dla wydajności)
    if (bunnyVideoIds.length > 0) {
      const deletePromises = bunnyVideoIds.map(async (bunnyVideoId) => {
        try {
          // Usuń z BunnyStream
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

          // Usuń z bazy danych Video
          await Video.findOneAndDelete({ bunnyGuid: bunnyVideoId });
          console.log("✅ Video removed from database:", bunnyVideoId);

          return { success: true, videoId: bunnyVideoId };
        } catch (err) {
          console.warn(`Error deleting video ${bunnyVideoId} from Bunny:`, err);
          // Kontynuuj nawet jeśli pojawi się błąd - usuwamy dalej
          return { success: false, videoId: bunnyVideoId, error: err };
        }
      });

      // Poczekaj na wszystkie operacje usuwania video
      await Promise.all(deletePromises);
    }

    // 4. Usuń wszystkie video z bazy danych Video, które są powiązane z resource
    // (na wypadek, jeśli jakieś video nie ma bunnyVideoId w chapterze)
    await Video.deleteMany({
      $or: [{ resourceId: id }, { relatedResource: id }],
    });

    // 5. Usuń sam resource z bazy danych
    await Resource.findByIdAndDelete(id);

    console.log(
      `✅ Resource deleted: ${id}, removed ${bunnyVideoIds.length} videos`
    );

    res.json({
      success: true,
      message: "Resource and associated videos deleted successfully",
      deletedResourceId: id,
      deletedVideosCount: bunnyVideoIds.length,
    });
  } catch (error) {
    console.error("Error deleting resource:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// export const deleteResource = async (
//   req: Request,
//   res: Response
// ): Promise<void> => {
//   try {
//     const deleted = await Resource.findByIdAndDelete(req.params.id);
//     // if (!deleted) return res.status(404).json({ error: "Resource not found" });
//     if (!deleted) return;
//     res.json({ message: "Resource deleted" });
//   } catch (error) {
//     res.status(500).json({
//       error: error instanceof Error ? error.message : "Unknown error",
//     });
//   }
// };

///resources/:productId
export const getResourceByProductId = async (req: Request, res: Response) => {
  const { productId } = req.params;
  //console.log("getResourceByProductId", productId);
  try {
    const resource = await Resource.findOne({ productId });
    if (!resource) {
      res.status(404).json({ error: "Resource not found for this product" });
      return;
    }
    res.status(200).json(resource);
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Server error" });
  }
};

///resources/id/:id
export const getResourceById = async (req: Request, res: Response) => {
  const { id } = req.params;
  // console.log("getResourceById", id);
  try {
    const resource = await Resource.findById(id);
    if (!resource) {
      res.status(404).json({ error: "Resource not found" });
      return;
    }
    res.status(200).json(resource);
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Server error" });
  }
};

//CHAPTER CONTROLLERS

//ADD CHAPTER

// export const addChapter = async (req: Request, res: Response) => {
//   const { id } = req.params;
//   const { videoUrl, description } = req.body;

//   try {
//     const resource = await Resource.findById(id);
//     if (!resource) {
//       res.status(404).json({ error: "Resource not found" });
//       return;
//     }

//     if (!resource.chapters) resource.chapters = [];

//     if (resource.chapters.length >= 100) {
//       res
//         .status(400)
//         .json({ error: "Maximum number of chapters reached (100)" });
//       return;
//     }
//     resource.chapters.push({ videoUrl, description });
//     await resource.save();

//     res
//       .status(200)
//       .json({ message: "Chapter added", chapters: resource.chapters });
//   } catch (err) {
//     res
//       .status(500)
//       .json({ error: err instanceof Error ? err.message : "Server error" });
//     return;
//   }
// };

// //FETCH RESOURCES OF SINGLE USER
// export const fetchUserResources = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const { userId } = req.params;
//     const resources = await Resource.find({ userIds: userId });
//     res.status(200).send(resources);
//   } catch (error) {
//     console.error("Error fetching user resources:", error);
//     res.status(500).send({ error: "Błąd serwera" });
//   }
// };

// //EDITING RESOURCE

// export const editResource = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const { resourceId } = req.params;
//     console.log("resourceId", resourceId);
//     console.log("reqbody", req.body);

//     const resource = await Resource.findById(resourceId);

//     if (!resource) {
//       res.status(404).json({ message: "Resource not found" });
//       return;
//     }

//     const updateData = req.body;

//     // ✅ Only these fields can be updated
//     if (typeof updateData.title === "string") {
//       resource.title = updateData.title;
//     }

//     if (typeof updateData.imageUrl === "string") {
//       resource.imageUrl = updateData.imageUrl;
//     }

//     if (typeof updateData.content === "string") {
//       resource.content = updateData.content;
//     }

//     if (typeof updateData.videoUrl === "string") {
//       resource.videoUrl = updateData.videoUrl;
//     }

//     // ✅ Update chapters (if provided)
//     if (updateData.chapters) {
//       if (!Array.isArray(updateData.chapters)) {
//         throw new Error("Chapters must be an array");
//       }

//       if (updateData.chapters.length > 100) {
//         throw new Error("Maximum of 100 chapters allowed");
//       }

//       resource.chapters = updateData.chapters;
//     }

//     await resource.save();

//     res.status(200).json({
//       message: "Resource updated successfully",
//       resource,
//     });
//   } catch (err) {
//     if (err instanceof Error) {
//       res
//         .status(500)
//         .json({ error: "Error updating resource: " + err.message });
//     } else {
//       res.status(500).json({ error: "Unknown server error" });
//     }
//   }
// };

// export const updateChapterInResource = async (req: Request, res: Response) => {
//   const { id, chapterIndex } = req.params;
//   const { videoUrl, description } = req.body;

//   try {
//     const resource = await Resource.findById(id);
//     if (!resource) {
//       res.status(404).json({ error: "Resource not found" });
//       return;
//     }

//     const index = parseInt(chapterIndex);
//     if (
//       isNaN(index) ||
//       index < 0 ||
//       !resource.chapters ||
//       index >= resource.chapters.length
//     ) {
//       res.status(400).json({ error: "Invalid chapter index" });
//       return;
//     }

//     // Zaktualizuj tylko podane pola
//     if (videoUrl !== undefined) {
//       resource.chapters[index].videoUrl = videoUrl;
//     }
//     if (description !== undefined) {
//       resource.chapters[index].description = description;
//     }

//     await resource.save();
//     res.status(200).json({
//       message: "Chapter updated",
//       chapter: resource.chapters[index],
//     });
//   } catch (err) {
//     res
//       .status(500)
//       .json({ error: err instanceof Error ? err.message : "Server error" });
//   }
// };

// //DELETE CHAPTER FROM RESOURCE
// export const deleteChapterFromResource = async (
//   req: Request,
//   res: Response
// ) => {
//   const { id, chapterIndex } = req.params;

//   try {
//     const resource = await Resource.findById(id);
//     if (!resource) {
//       res.status(404).json({ error: "Resource not found" });
//       return;
//     }

//     const index = parseInt(chapterIndex);
//     if (
//       isNaN(index) ||
//       index < 0 ||
//       index >= (resource.chapters?.length || 0)
//     ) {
//       res.status(400).json({ error: "Invalid chapter index" });
//       return;
//     }

//     resource.chapters?.splice(index, 1);
//     await resource.save();

//     res
//       .status(200)
//       .json({ message: "Chapter deleted", chapters: resource.chapters });
//   } catch (err) {
//     res
//       .status(500)
//       .json({ error: err instanceof Error ? err.message : "Server error" });
//   }
// };
