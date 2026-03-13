import { mg } from "../utils/mailgunClient.js";
import { t } from "../utils/translations.js";

export interface OrderConfirmationData {
  orderId: string;
  email: string;
  userName?: string;
  totalAmount: number;
  products: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  invoiceUrl?: string;
  requireInvoice: boolean;
  createdAt: Date;
  billingDetails?: {
    companyName?: string;
    taxId?: string;
    address?: string;
  };
  language?: string; // 👈 Dodaj opcjonalny język
}

// 🔧 FUNKCJA DO WYSYŁANIA EMAILI
export const sendOrderConfirmationEmail = async (
  orderData: OrderConfirmationData,
): Promise<{ id: string; message: string }> => {
  const lang = orderData.language || "pl";

  const {
    orderId,
    email,
    userName,
    totalAmount,
    products,
    invoiceUrl,
    requireInvoice,
    billingDetails,
  } = orderData;

  // Tworzenie treści emaila
  const productList = products
    .map(
      (p) =>
        `- ${p.name} x${p.quantity}: ${p.price.toFixed(2)} ${t(lang, "email.currency")}`,
    )
    .join("\n");

  const invoiceSection = invoiceUrl
    ? `\n\n📄 ${t(lang, "email.invoiceGenerated")}:\n${invoiceUrl}`
    : requireInvoice
      ? `\n\nℹ️ ${t(lang, "email.invoiceNotGenerated")}`
      : `\n\nℹ️ ${t(lang, "email.orderWithoutInvoice")}`;

  const billingInfo = billingDetails?.companyName
    ? `\n\n${t(lang, "email.billingDetails")}:\n${t(lang, "email.company")}: ${billingDetails.companyName}\n${t(lang, "email.taxId")}: ${billingDetails.taxId || t(lang, "email.none")}\n${t(lang, "email.address")}: ${billingDetails.address || t(lang, "email.none")}`
    : "";

  const userNameText = userName ? ` ${userName}` : "";

  const text = `
${t(lang, "email.thankYou")}${userNameText}!

📋 ${t(lang, "email.orderNumber")}: ${orderId}
📅 ${t(lang, "email.orderDate")}: ${new Date(orderData.createdAt).toLocaleDateString(lang === "pl" ? "pl-PL" : "en-US")}
💰 ${t(lang, "email.totalAmount")}: ${totalAmount.toFixed(2)} ${t(lang, "email.currency")}

🛒 ${t(lang, "email.products")}:
${productList}
${billingInfo}
${invoiceSection}

✅ ${t(lang, "email.accessInfo")}

📞 ${t(lang, "email.contactInfo")}

${t(lang, "email.regards")},
${t(lang, "email.team")}
  `.trim();

  const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
        .order-details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .product-item { border-bottom: 1px solid #eee; padding: 10px 0; }
        .total { font-size: 18px; font-weight: bold; color: #4F46E5; }
        .invoice-link { background-color: #4F46E5; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
        .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 ${t(lang, "email.thankYouTitle")}</h1>
        </div>
        <div class="content">
            <p>${t(lang, "email.orderReceived")}</p>
            
            <div class="order-details">
                <h3>📋 ${t(lang, "email.orderDetails")}</h3>
                <p><strong>${t(lang, "email.orderNumber")}:</strong> ${orderId}</p>
                <p><strong>${t(lang, "email.orderDate")}:</strong> ${new Date(
                  orderData.createdAt,
                ).toLocaleDateString(lang === "pl" ? "pl-PL" : "en-US", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}</p>
                
                <h4>🛒 ${t(lang, "email.products")}:</h4>
                ${products
                  .map(
                    (p) => `
                    <div class="product-item">
                        <strong>${p.name}</strong><br>
                        ${t(lang, "email.quantity")}: ${p.quantity} × ${p.price.toFixed(2)} ${t(lang, "email.currency")} = ${(p.quantity * p.price).toFixed(2)} ${t(lang, "email.currency")}
                    </div>
                `,
                  )
                  .join("")}
                
                <div style="text-align: right; margin-top: 15px;">
                    <div class="total">${t(lang, "email.total")}: ${totalAmount.toFixed(2)} ${t(lang, "email.currency")}</div>
                </div>
            </div>
            
            ${
              billingDetails?.companyName
                ? `
            <div class="order-details">
                <h3>🏢 ${t(lang, "email.billingDetails")}</h3>
                <p><strong>${t(lang, "email.company")}:</strong> ${billingDetails.companyName}</p>
                ${billingDetails.taxId ? `<p><strong>${t(lang, "email.taxId")}:</strong> ${billingDetails.taxId}</p>` : ""}
                ${billingDetails.address ? `<p><strong>${t(lang, "email.address")}:</strong> ${billingDetails.address}</p>` : ""}
            </div>
            `
                : ""
            }
            
            ${
              invoiceUrl
                ? `
            <div style="text-align: center; margin: 25px 0;">
                <h3>📄 ${t(lang, "email.invoiceReady")}</h3>
                <p>${t(lang, "email.invoiceReadyMessage")}</p>
                <a href="${invoiceUrl}" class="invoice-link">📥 ${t(lang, "email.downloadInvoice")}</a>
                <p style="font-size: 12px; color: #666; margin-top: 5px;">
                    ${t(lang, "email.invoiceLinkValidity")}
                </p>
            </div>
            `
                : requireInvoice
                  ? `
            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <h3>ℹ️ ${t(lang, "email.invoiceInfo")}</h3>
                <p>${t(lang, "email.invoiceNotGeneratedMessage")}</p>
            </div>
            `
                  : ""
            }
            
            <div style="background-color: #e8f5e9; border: 1px solid #c8e6c9; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <h3>✅ ${t(lang, "email.accessTitle")}</h3>
                <p>${t(lang, "email.accessMessage")}</p>
            </div>
            
            <p style="margin-top: 20px;">📞 ${t(lang, "email.questions")}</p>
        </div>
        
        <div class="footer">
            <p>${t(lang, "email.regards")},<br><strong>${t(lang, "email.team")}</strong></p>
            <p style="font-size: 12px;">${t(lang, "email.autoMessage")}</p>
        </div>
    </div>
</body>
</html>`;

  console.log(`🔧 Sending order confirmation email to ${email}...`);

  const result = await mg.messages.create(
    process.env.MAILGUN_DOMAIN as string,
    {
      from: `${t(lang, "email.fromName")} <no-reply@${process.env.MAILGUN_DOMAIN}>`,
      to: email,
      subject: t(lang, "email.orderConfirmationSubject", { orderId }),
      text: text,
      html: html,
    },
  );

  console.log(
    `✅ Order confirmation email sent to ${email} for order ${orderId}, ID: ${result.id}`,
  );

  return {
    id: result.id as string,
    message: t(lang, "email.sentSuccess"),
  };
};

// 📧 FUNKCJA DO WYSYŁANIA FAKTURY
export const sendInvoiceEmail = async (
  email: string,
  orderId: string,
  invoiceUrl: string,
  invoiceNumber: string,
  language: string = "pl", // 👈 Dodaj parametr języka
): Promise<{ id: string; message: string }> => {
  const lang = language;

  console.log(`📧 Sending invoice email for order ${orderId} to ${email}`);

  const text = `
${t(lang, "email.invoiceSalutation")},

${t(lang, "email.invoiceReadyForOrder", { orderId, invoiceNumber })}:

📄 ${t(lang, "email.invoiceAvailable")}:
${invoiceUrl}

${t(lang, "email.invoiceLinkValidity")}

${t(lang, "email.regards")},
${t(lang, "email.team")}
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
        .invoice-link { background-color: #4F46E5; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📄 ${t(lang, "email.invoiceTitle")}</h1>
        </div>
        <div class="content">
            <p>${t(lang, "email.invoiceSalutation")},</p>
            <p>${t(lang, "email.invoiceReadyForOrder", { orderId, invoiceNumber })}</p>
            
            <div style="text-align: center; margin: 25px 0;">
                <a href="${invoiceUrl}" class="invoice-link">📥 ${t(lang, "email.downloadInvoice")}</a>
                <p style="font-size: 12px; color: #666; margin-top: 5px;">
                    ${t(lang, "email.invoiceLinkValidity")}
                </p>
            </div>
            
            <p style="margin-top: 20px;">📞 ${t(lang, "email.questions")}</p>
        </div>
        <div class="footer">
            <p>${t(lang, "email.regards")},<br><strong>${t(lang, "email.team")}</strong></p>
        </div>
    </div>
</body>
</html>
  `;

  const result = await mg.messages.create(
    process.env.MAILGUN_DOMAIN as string,
    {
      from: `${t(lang, "email.fromName")} <no-reply@${process.env.MAILGUN_DOMAIN}>`,
      to: email,
      subject: t(lang, "email.invoiceSubject", { invoiceNumber, orderId }),
      text: text,
      html: html,
    },
  );

  console.log(
    `✅ Invoice email sent to ${email} for order ${orderId}, ID: ${result.id}`,
  );

  return {
    id: result.id as string,
    message: t(lang, "email.invoiceSentSuccess"),
  };
};
