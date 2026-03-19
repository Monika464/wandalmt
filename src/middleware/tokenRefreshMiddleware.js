import jwt from "jsonwebtoken";
import User from "../models/user.js";

export const tokenRefreshMiddleware = async (req, res, next) => {
  try {
    // Only for authorized requests
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

    // Decode token (no verification to check time)
    const decoded = jwt.decode(token);

    if (!decoded || !decoded.exp) {
      return next();
    }

    // Check if the token will expire in the next 30 minutes
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = decoded.exp - nowInSeconds;

    // If the token will expire in the next 30 minutes, refresh it
    if (timeUntilExpiry > 0 && timeUntilExpiry < 30 * 60) {
      const user = await User.findById(decoded._id);

      if (user) {
        // Remove the old token
        user.tokens = user.tokens.filter((t) => t.token !== token);

        // Generate a new token
        const newToken = await user.generateAuthToken();

        // Add the new token to the response
        res.set("X-New-Token", newToken);
        res.set("X-Token-Refreshed", "true");

        // You can also automatically set it in the header
        // req.newToken = newToken;
      }
    }

    next();
  } catch (error) {
    console.error("Error in tokenRefreshMiddleware:", error);
    next();
  }
};
