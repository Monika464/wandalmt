// src/controllers/emailController.ts

import { Request, Response } from "express";
import {
  sendOrderConfirmationEmail,
  sendInvoiceEmail,
  OrderConfirmationData,
} from "../services/emailService.js";

// 🔧 CONTROLLER - only for handling HTTP requests
export const sendOrderConfirmation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const orderData: OrderConfirmationData = req.body;

    const result = await sendOrderConfirmationEmail(orderData);

    res.json({
      success: true,
      message: "Confirmation email has been sent",
      messageId: result.id,
    });
  } catch (error: any) {
    console.error("❌ Error sending order confirmation email:", {
      message: error.message,
      status: error.status,
      details: error.details,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: "Error sending email",
      details: error.message,
    });
  }
};

// 🔧 CONTROLLER for sending invoices via HTTP
export const sendInvoice = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { email, orderId, invoiceUrl, invoiceNumber } = req.body;

    if (!email || !orderId || !invoiceUrl || !invoiceNumber) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const result = await sendInvoiceEmail(
      email,
      orderId,
      invoiceUrl,
      invoiceNumber,
    );

    res.json({
      success: true,
      message: "Invoice has been sent",
      messageId: result.id,
    });
  } catch (error: any) {
    console.error("❌ Error sending invoice email:", error);
    res.status(500).json({
      success: false,
      error: "Error sending invoice",
      details: error.message,
    });
  }
};
