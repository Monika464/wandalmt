// src/controllers/bunnyController.ts
import { Request, Response } from "express";
import axios from "axios";
import Video from "../models/video.js";
import fs from "fs";
import path from "path";

//https://www.google.com/search?client=ubuntu-sn&channel=fs&q=buny+how+to+make+video+public#fpstate=ive&vld=cid:745dcd86,vid:PjIuNZqyK8E,st:73

export const checkVideoStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    console.log("Webhook Bunny received:", req.body);

    const { VideoGuid, Status } = req.body;

    // Status 4 = VideoReady/Completed w Bunny
    if (Status === 4) {
      console.log("status 4 received");
      console.log(`Video ${VideoGuid} is ready! Updating database...`);

      // 1. Pobierz pełne info o wideo z Bunny API
      const bunnyUrl = `https://video.bunnycdn.com/library/${process.env.BUNNY_LIBRARY_ID}/videos/${VideoGuid}`;
      const bunnyResponse = await axios.get(bunnyUrl, {
        headers: { AccessKey: process.env.BUNNY_API_KEY },
      });

      const bunnyData = bunnyResponse.data;
      console.log("Bunny video data:", bunnyData);

      // if (!bunnyData.isPublic) {
      //   console.log("Setting video to public...");
      //   try {
      //     await axios.patch(
      //       bunnyUrl, // TEN SAM URL CO W KROKU 1
      //       { isPublic: true }, // TYLKO to pole zmieniamy
      //       {
      //         headers: { AccessKey: process.env.BUNNY_API_KEY },
      //       }
      //     );
      //     console.log("✅ Video set to public");

      //     // Poczekaj 3 sekundy na propagację
      //     await new Promise((resolve) => setTimeout(resolve, 3000));
      //   } catch (publicError) {
      //     console.error("❌ Failed to set video public:", publicError.message);
      //     // Kontynuuj mimo błędu - może już jest publiczne
      //   }
      // }

      // 2. Zbuduj URL thumbnaila
      const thumbnailUrl = `https://video.bunnycdn.com/library/${process.env.BUNNY_LIBRARY_ID}/videos/${VideoGuid}/thumbnail`;

      try {
        const response = await axios.post(
          thumbnailUrl,
          {},
          {
            headers: {
              AccessKey: process.env.BUNNY_API_KEY,
              accept: "application/json",
            },
            responseType: "arraybuffer",
          }
        );
        // `response.data` zawiera teraz dane binarne pliku JPEG
        // Możesz je zapisać lokalnie, np. fs.writeFileSync(ścieżka, response.data);
        console.log(
          "Miniaturka pobrana pomyślnie, rozmiar:",
          response.data.length
        );
      } catch (error) {
        console.error(
          "Błąd API przy pobieraniu miniatury:",
          error.response?.status,
          error.message
        );
      }

      // 3. Zaktualizuj wideo w bazie
      await Video.findOneAndUpdate(
        { bunnyGuid: VideoGuid },
        {
          status: "ready",
          thumbnailUrl: thumbnailUrl || "/images/default-thumbnail.jpg",
          lastUpdated: new Date(),
        }
      );

      console.log(`Video ${VideoGuid} updated with thumbnail: ${thumbnailUrl}`);
    }

    // Zawsze odpowiadaj 200, żeby Bunny nie próbował ponownie
    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    // Nadal odpowiadaj 200, żeby Bunny nie spamował
    res
      .status(200)
      .json({ received: true, error: "Processing failed but acknowledged" });
  }
};
