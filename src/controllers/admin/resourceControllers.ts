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
    const language = req.query.language as string;

    // --- 2️⃣ Zbuduj filtr wyszukiwania ---
    const filter: any = {};

    if (language) {
      filter.language = language;
    }

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
      .lean();

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
  res: Response,
): Promise<void> => {
  try {
    const { productId, title, content, language } = req.body;

    // Walidacja języka
    if (language !== "pl" && language !== "en") {
      res.status(400).json({ error: "Language must be either 'pl' or 'en'" });
      return;
    }

    const resource = new Resource({
      productId,
      title,
      content,
      language,
      chapters: [],
    });

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
  res: Response,
): Promise<void> => {
  try {
    const { title, content, language } = req.body; // 🔥 DODAJEMY language

    // Walidacja języka jeśli podano
    if (language && language !== "pl" && language !== "en") {
      res.status(400).json({ error: "Language must be either 'pl' or 'en'" });
      return;
    }

    const updateData: any = { title, content };
    if (language) {
      updateData.language = language; // 🔥 DODAJEMY
    }

    const updated = await Resource.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
      },
    );
    if (!updated) {
      res.status(404).json({ error: "Resource not found" });
      return;
    }

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
  res: Response,
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
            },
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
      `✅ Resource deleted: ${id}, removed ${bunnyVideoIds.length} videos`,
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
  const { language } = req.query;
  //console.log("getResourceByProductId", productId);
  try {
    const filter: any = { productId };
    if (language) {
      filter.language = language;
    }
    const resource = await Resource.findOne(filter);
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
