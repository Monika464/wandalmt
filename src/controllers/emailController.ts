// src/controllers/emailController.ts
import { Request, Response } from "express";
import { mg } from "../utils/mailgunClient.js";

export const sendMail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { to, subject, text } = req.body;

    if (!to || !subject || !text) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const data = await mg.messages.create(
      process.env.MAILGUN_DOMAIN as string,
      {
        from: "Mailgun Sandbox <postmaster@boxingonline.eu>",
        to: "muaythaikrakow@gmail.com",
        subject: "✅ Test Mailgun działa!",
        text: "Gratulacje, Twój backend potrafi wysyłać e-maile 🚀",
      },
    );

    console.log("mailgun response sent", data);

    res.status(200).json({ success: true, message: "Email sent!" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
