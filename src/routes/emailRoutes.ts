import { Router, Request, Response } from "express";
import User from "../models/user.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { mg } from "../utils/mailgunClient.js";
import { userAuth } from "../middleware/auth.js";
//import { sendMail } from "controllers/emailController.js";

const router = Router();

//router.post("/send-email", sendMail);

console.log("JWT_SECRET:", process.env.JWT_SECRET);
// ===========================
// 1) REQUEST PASSWORD RESET
// ===========================
router.post(
  "/request-reset",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(400).json({ error: "Email jest wymagany" });
        return;
      }

      const user = await User.findOne({ email });
      if (!user) {
        // bezpieczeństwo — udawaj, że wszystko jest OK
        res.json({ message: "Wyglada na to że nie posiadasz konta" });
        return;
      }

      // token ważny 15 minut
      const resetToken = jwt.sign(
        { userId: user._id },
        process.env.JWT_RESET_SECRET as string,
        { expiresIn: "15m" }
      );

      const resetLink = `http://localhost:5173/reset-password/${resetToken}`;

      // wysyłka maila przez Mailgun
      await mg.messages.create(process.env.MAILGUN_DOMAIN as string, {
        from: "Reset Hasła <postmaster@sandbox8ab4b9ccf4124222a10d8734f869e739.mailgun.org>",
        to: email,
        subject: "Reset hasła",
        text: `Kliknij, aby zresetować hasło: ${resetLink}`,
      });

      res.json({ message: "Email z resetem został wysłany" });
    } catch (err) {
      console.error("RESET ERROR:", err);
      res.status(500).json({ error: "Błąd serwera przy wysyłaniu maila" });
    }
  }
);

// ===========================
// 2) RESET PASSWORD
// ===========================
router.post(
  "/reset-password",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword)
        res.status(400).json({ error: "Brak danych" });
      return;

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_RESET_SECRET as string) as {
          userId: string;
        };
      } catch (err) {
        res.status(400).json({ error: "Nieprawidłowy lub wygasły token" });
        return;
      }

      const hashed = await bcrypt.hash(newPassword, 10);
      await User.findByIdAndUpdate(decoded.userId, { password: hashed });

      res.json({ message: "Hasło zostało zmienione" });
    } catch (err) {
      res.status(500).json({ error: "Błąd serwera przy zmianie hasła" });
    }
  }
);

// ===========================
// 3) CHANGE EMAIL
// ===========================
router.patch(
  "/change-email",
  userAuth, // 🔒 WYMAGA bycia zalogowanym
  async (req: Request, res: Response): Promise<void> => {
    console.log("change-email called");
    console.log("BODY:", req.body);
    try {
      const { newEmail } = req.body;
      const userId = (req as any).user.id; // z userAuth

      if (!newEmail) {
        res.status(400).json({ error: "Nowy email jest wymagany" });
        return;
      }

      // sprawdz, czy email jest wolny
      const exists = await User.findOne({ email: newEmail });
      if (exists) {
        res.status(400).json({ error: "Ten email jest już zajęty" });
        return;
      }

      await User.findByIdAndUpdate(userId, { email: newEmail });

      res.json({ message: "Email został zmieniony" });
    } catch (err) {
      res.status(500).json({ error: "Błąd serwera przy zmianie emaila" });
    }
  }
);

export default router;

// // src/routes/emailRoutes.ts
// import express from "express";
// import { sendMail } from "../controllers/emailController.js";

// const router = express.Router();

// router.post("/send-email", sendMail);

// // GET /api/test-mail → szybki test wysyłki przez przeglądarkę
// router.get("/test-mail", async (req, res) => {
//   try {
//     const { mg } = await import("../utils/mailgunClient.js");
//     const data = await mg.messages.create(
//       process.env.MAILGUN_DOMAIN as string,
//       {
//         from: "Mailgun Test <postmaster@sandbox8ab4b9ccf4124222a10d8734f869e739.mailgun.org>",
//         to: "mkubianka@gmail.com",
//         subject: "✅ Test Mailgun EU",
//         text: "Gratulacje! Twój backend potrafi wysyłać e-maile z EU 🚀",
//       }
//     );
//     res
//       .status(200)
//       .json({ success: true, message: "Test email wysłany!", data });
//   } catch (error: any) {
//     console.error(error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// });

// export default router;
