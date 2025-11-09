// src/routes/emailRoutes.ts
import express from "express";
import { sendMail } from "../controllers/emailController.js";

const router = express.Router();

router.post("/send-email", sendMail);

// GET /api/test-mail → szybki test wysyłki przez przeglądarkę
router.get("/test-mail", async (req, res) => {
  try {
    const { mg } = await import("../utils/mailgunClient.js");
    const data = await mg.messages.create(
      process.env.MAILGUN_DOMAIN as string,
      {
        from: "Mailgun Test <postmaster@sandbox8ab4b9ccf4124222a10d8734f869e739.mailgun.org>",
        to: "mkubianka@gmail.com",
        subject: "✅ Test Mailgun EU",
        text: "Gratulacje! Twój backend potrafi wysyłać e-maile z EU 🚀",
      }
    );
    res
      .status(200)
      .json({ success: true, message: "Test email wysłany!", data });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
