import jwt from "jsonwebtoken";
import User from "../models/user.js";

export const tokenRefreshMiddleware = async (req, res, next) => {
  try {
    // Tylko dla autoryzowanych requestów
    if (!req.user || !req.token) {
      return next();
    }

    const authHeader = req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.replace("Bearer ", "");
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      return next();
    }

    // Dekoduj token (bez weryfikacji, żeby sprawdzić czas)
    const decoded = jwt.decode(token);

    if (!decoded || !decoded.exp) {
      return next();
    }

    // Sprawdź czy token wygaśnie w ciągu najbliższych 30 minut
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = decoded.exp - nowInSeconds;

    // Jeśli token wygaśnie w ciągu 30 minut, odśwież go
    if (timeUntilExpiry > 0 && timeUntilExpiry < 30 * 60) {
      const user = await User.findById(decoded._id);

      if (user) {
        // Usuń stary token
        user.tokens = user.tokens.filter((t) => t.token !== token);

        // Wygeneruj nowy token
        const newToken = await user.generateAuthToken();

        // Dodaj nowy token do odpowiedzi
        res.set("X-New-Token", newToken);
        res.set("X-Token-Refreshed", "true");

        // Możesz też automatycznie ustawić w headerze
        // req.newToken = newToken;
      }
    }

    next();
  } catch (error) {
    console.error("Błąd w tokenRefreshMiddleware:", error);
    next();
  }
};
