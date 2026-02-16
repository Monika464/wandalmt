import { mg } from "../utils/mailgunClient.js";

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
}

// 🔧 CZYSTA FUNKCJA DO WYSYŁANIA EMAILI - NIE JEST KONTROLEREM
export const sendOrderConfirmationEmail = async (
  orderData: OrderConfirmationData,
): Promise<{ id: string; message: string }> => {
  // console.log("🔧 sendOrderConfirmationEmail called with data:", {
  //   orderId: orderData.orderId,
  //   email: orderData.email,
  //   totalAmount: orderData.totalAmount,
  //   productsCount: orderData.products.length,
  //   hasInvoice: !!orderData.invoiceUrl,
  // });

  const {
    orderId,
    email,
    totalAmount,
    products,
    invoiceUrl,
    requireInvoice,
    billingDetails,
  } = orderData;

  // Tworzenie treści emaila (ten sam kod co wcześniej)
  const productList = products
    .map((p) => `- ${p.name} x${p.quantity}: ${p.price.toFixed(2)} PLN`)
    .join("\n");

  const invoiceSection = invoiceUrl
    ? `\n\n📄 Faktura została wygenerowana i jest dostępna pod linkiem:\n${invoiceUrl}`
    : requireInvoice
      ? "\n\nℹ️ Faktura nie została wygenerowana. Skontaktuj się z obsługą klienta w sprawie faktury."
      : "\n\nℹ️ Zamówienie zostało złożone bez faktury.";

  const billingInfo = billingDetails?.companyName
    ? `\n\nDane do faktury:\nFirma: ${billingDetails.companyName}\nNIP: ${billingDetails.taxId || "brak"}\nAdres: ${billingDetails.address || "brak"}`
    : "";

  const text = `
Dziękujemy za złożenie zamówienia w Kurs MT!

📋 Numer zamówienia: ${orderId}
📅 Data zamówienia: ${new Date(orderData.createdAt).toLocaleDateString("pl-PL")}
💰 Kwota całkowita: ${totalAmount.toFixed(2)} PLN

🛒 Produkty:
${productList}
${billingInfo}
${invoiceSection}

✅ Dostęp do zakupionych kursów otrzymasz natychmiast po zalogowaniu na swoje konto.

📞 W razie pytań skontaktuj się z nami.

Pozdrawiamy,
Zespół Kurs MT
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
            <h1>🎉 Dziękujemy za zamówienie!</h1>
        </div>
        <div class="content">
            <p>Twoje zamówienie zostało pomyślnie przyjęte i jest w trakcie realizacji.</p>
            
            <div class="order-details">
                <h3>📋 Szczegóły zamówienia</h3>
                <p><strong>Numer zamówienia:</strong> ${orderId}</p>
                <p><strong>Data:</strong> ${new Date(
                  orderData.createdAt,
                ).toLocaleDateString("pl-PL", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}</p>
                
                <h4>🛒 Produkty:</h4>
                ${products
                  .map(
                    (p) => `
                    <div class="product-item">
                        <strong>${p.name}</strong><br>
                        Ilość: ${p.quantity} × ${p.price.toFixed(2)} PLN = ${(p.quantity * p.price).toFixed(2)} PLN
                    </div>
                `,
                  )
                  .join("")}
                
                <div style="text-align: right; margin-top: 15px;">
                    <div class="total">Suma: ${totalAmount.toFixed(2)} PLN</div>
                </div>
            </div>
            
            ${
              billingDetails?.companyName
                ? `
            <div class="order-details">
                <h3>🏢 Dane do faktury</h3>
                <p><strong>Firma:</strong> ${billingDetails.companyName}</p>
                ${billingDetails.taxId ? `<p><strong>NIP:</strong> ${billingDetails.taxId}</p>` : ""}
                ${billingDetails.address ? `<p><strong>Adres:</strong> ${billingDetails.address}</p>` : ""}
            </div>
            `
                : ""
            }
            
            ${
              invoiceUrl
                ? `
            <div style="text-align: center; margin: 25px 0;">
                <h3>📄 Faktura gotowa do pobrania</h3>
                <p>Twoja faktura została wygenerowana i jest dostępna pod poniższym linkiem:</p>
                <a href="${invoiceUrl}" class="invoice-link">📥 Pobierz fakturę</a>
                <p style="font-size: 12px; color: #666; margin-top: 5px;">
                    Link jest aktywny przez 30 dni.
                </p>
            </div>
            `
                : requireInvoice
                  ? `
            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <h3>ℹ️ Informacja o fakturze</h3>
                <p>Faktura nie została wygenerowana automatycznie. Skontaktuj się z obsługą klienta w sprawie faktury.</p>
            </div>
            `
                  : ""
            }
            
            <div style="background-color: #e8f5e9; border: 1px solid #c8e6c9; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <h3>✅ Dostęp do kursów</h3>
                <p>Dostęp do zakupionych kursów otrzymasz natychmiast po zalogowaniu na swoje konto w sekcji "Moje kursy".</p>
            </div>
            
            <p style="margin-top: 20px;">📞 Jeśli masz pytania dotyczące zamówienia, skontaktuj się z nami.</p>
        </div>
        
        <div class="footer">
            <p>Z pozdrowieniami,<br><strong>Zespół Kurs MT</strong></p>
            <p style="font-size: 12px;">To jest automatyczna wiadomość, prosimy nie odpowiadać na ten email.</p>
        </div>
    </div>
</body>
</html>`;

  console.log("🔧 Sending email via Mailgun EU endpoint...");

  const result = await mg.messages.create(
    process.env.MAILGUN_DOMAIN as string,
    {
      from: `Kurs MT <no-reply@${process.env.MAILGUN_DOMAIN}>`,
      to: email,
      subject: `Potwierdzenie zamówienia #${orderId}`,
      text: text,
      html: html,
    },
  );

  console.log(
    `✅ Order confirmation email sent to ${email} for order ${orderId}, ID: ${result.id}`,
  );

  return {
    id: result.id as string,
    message: "Email wysłany pomyślnie",
  };
};

// 📧 DODATKOWA FUNKCJA DO WYSYŁANIA FAKTURY OSOBNO
export const sendInvoiceEmail = async (
  email: string,
  orderId: string,
  invoiceUrl: string,
  invoiceNumber: string,
): Promise<{ id: string; message: string }> => {
  console.log(`📧 Sending invoice email for order ${orderId} to ${email}`);

  const text = `
Szanowni Państwo,

Faktura VAT nr ${invoiceNumber} dla zamówienia #${orderId} została wygenerowana.

📄 Faktura jest dostępna pod linkiem:
${invoiceUrl}

Link jest aktywny przez 30 dni.

Pozdrawiamy,
Zespół Kurs MT
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
            <h1>📄 Faktura VAT</h1>
        </div>
        <div class="content">
            <p>Szanowni Państwo,</p>
            <p>Faktura VAT nr <strong>${invoiceNumber}</strong> dla zamówienia <strong>#${orderId}</strong> została wygenerowana.</p>
            
            <div style="text-align: center; margin: 25px 0;">
                <a href="${invoiceUrl}" class="invoice-link">📥 Pobierz fakturę</a>
                <p style="font-size: 12px; color: #666; margin-top: 5px;">
                    Link jest aktywny przez 30 dni.
                </p>
            </div>
            
            <p style="margin-top: 20px;">📞 W razie pytań skontaktuj się z nami.</p>
        </div>
        <div class="footer">
            <p>Z pozdrowieniami,<br><strong>Zespół Kurs MT</strong></p>
        </div>
    </div>
</body>
</html>
  `;

  const result = await mg.messages.create(
    process.env.MAILGUN_DOMAIN as string,
    {
      from: `Kurs MT <no-reply@${process.env.MAILGUN_DOMAIN}>`,
      to: email,
      subject: `Faktura VAT #${invoiceNumber} dla zamówienia #${orderId}`,
      text: text,
      html: html,
    },
  );

  console.log(
    `✅ Invoice email sent to ${email} for order ${orderId}, ID: ${result.id}`,
  );

  return {
    id: result.id as string,
    message: "Faktura wysłana pomyślnie",
  };
};

// // services/emailService.ts
// import formData from "form-data";
// import {mg} from "../utils/mailgunClient.js"; // Import klienta Mailgun z utils

// interface OrderConfirmationData {
//   orderId: string;
//   email: string;
//   userName?: string;
//   totalAmount: number;
//   products: Array<{
//     name: string;
//     quantity: number;
//     price: number;
//   }>;
//   invoiceUrl?: string;
//   requireInvoice: boolean;
//   createdAt: Date;
//   billingDetails?: {
//     companyName?: string;
//     taxId?: string;
//     address?: string;
//   };
// }

// export async function sendOrderConfirmation(
//   data: OrderConfirmationData,
// ): Promise<boolean> {
//   try {
//     console.log("🔧 EmailService starting...");

//     // Sprawdź zmienne środowiskowe
//     if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
//       console.error("❌ Missing Mailgun environment variables");
//       return false;
//     }

//     console.log("🔧 Sending email to:", data.email);

//     const {
//       orderId,
//       email,
//       totalAmount,
//       products,
//       invoiceUrl,
//       requireInvoice,
//       billingDetails,
//     } = data;

//     // Tworzenie treści emaila
//     const productList = products
//       .map((p) => `- ${p.name} x${p.quantity}: ${p.price.toFixed(2)} PLN`)
//       .join("\n");

//     const invoiceSection = invoiceUrl
//       ? `\n\n📄 Faktura została wygenerowana i jest dostępna pod linkiem:\n${invoiceUrl}`
//       : requireInvoice
//         ? "\n\nℹ️ Faktura nie została wygenerowana. Skontaktuj się z obsługą klienta w sprawie faktury."
//         : "\n\nℹ️ Zamówienie zostało złożone bez faktury.";

//     const billingInfo = billingDetails?.companyName
//       ? `\n\nDane do faktury:\nFirma: ${billingDetails.companyName}\nNIP: ${billingDetails.taxId || "brak"}\nAdres: ${billingDetails.address || "brak"}`
//       : "";

//     const text = `
// Dziękujemy za złożenie zamówienia w Kurs MT!

// 📋 Numer zamówienia: ${orderId}
// 📅 Data zamówienia: ${new Date(data.createdAt).toLocaleDateString("pl-PL")}
// 💰 Kwota całkowita: ${totalAmount.toFixed(2)} PLN

// 🛒 Produkty:
// ${productList}
// ${billingInfo}
// ${invoiceSection}

// ✅ Dostęp do zakupionych kursów otrzymasz natychmiast po zalogowaniu na swoje konto.

// 📞 W razie pytań skontaktuj się z nami.

// Pozdrawiamy,
// Zespół Kurs MT
//     `.trim();

//     const html = `
// <!DOCTYPE html>
// <html>
// <head>
//     <meta charset="UTF-8">
//     <style>
//         body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
//         .container { max-width: 600px; margin: 0 auto; padding: 20px; }
//         .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
//         .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
//         .order-details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
//         .product-item { border-bottom: 1px solid #eee; padding: 10px 0; }
//         .total { font-size: 18px; font-weight: bold; color: #4F46E5; }
//         .invoice-link { background-color: #4F46E5; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
//         .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
//     </style>
// </head>
// <body>
//     <div class="container">
//         <div class="header">
//             <h1>🎉 Dziękujemy za zamówienie!</h1>
//         </div>
//         <div class="content">
//             <p>Twoje zamówienie zostało pomyślnie przyjęte i jest w trakcie realizacji.</p>

//             <div class="order-details">
//                 <h3>📋 Szczegóły zamówienia</h3>
//                 <p><strong>Numer zamówienia:</strong> ${orderId}</p>
//                 <p><strong>Data:</strong> ${new Date(
//                   data.createdAt,
//                 ).toLocaleDateString("pl-PL", {
//                   day: "2-digit",
//                   month: "2-digit",
//                   year: "numeric",
//                   hour: "2-digit",
//                   minute: "2-digit",
//                 })}</p>

//                 <h4>🛒 Produkty:</h4>
//                 ${products
//                   .map(
//                     (p) => `
//                     <div class="product-item">
//                         <strong>${p.name}</strong><br>
//                         Ilość: ${p.quantity} × ${p.price.toFixed(2)} PLN = ${(p.quantity * p.price).toFixed(2)} PLN
//                     </div>
//                 `,
//                   )
//                   .join("")}

//                 <div style="text-align: right; margin-top: 15px;">
//                     <div class="total">Suma: ${totalAmount.toFixed(2)} PLN</div>
//                 </div>
//             </div>

//             ${
//               billingDetails?.companyName
//                 ? `
//             <div class="order-details">
//                 <h3>🏢 Dane do faktury</h3>
//                 <p><strong>Firma:</strong> ${billingDetails.companyName}</p>
//                 ${billingDetails.taxId ? `<p><strong>NIP:</strong> ${billingDetails.taxId}</p>` : ""}
//                 ${billingDetails.address ? `<p><strong>Adres:</strong> ${billingDetails.address}</p>` : ""}
//             </div>
//             `
//                 : ""
//             }

//             ${
//               invoiceUrl
//                 ? `
//             <div style="text-align: center; margin: 25px 0;">
//                 <h3>📄 Faktura gotowa do pobrania</h3>
//                 <p>Twoja faktura została wygenerowana i jest dostępna pod poniższym linkiem:</p>
//                 <a href="${invoiceUrl}" class="invoice-link">📥 Pobierz fakturę</a>
//                 <p style="font-size: 12px; color: #666; margin-top: 5px;">
//                     Link jest aktywny przez 30 dni.
//                 </p>
//             </div>
//             `
//                 : requireInvoice
//                   ? `
//             <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0;">
//                 <h3>ℹ️ Informacja o fakturze</h3>
//                 <p>Faktura nie została wygenerowana automatycznie. Skontaktuj się z obsługą klienta w sprawie faktury.</p>
//             </div>
//             `
//                   : ""
//             }

//             <div style="background-color: #e8f5e9; border: 1px solid #c8e6c9; padding: 15px; border-radius: 5px; margin: 15px 0;">
//                 <h3>✅ Dostęp do kursów</h3>
//                 <p>Dostęp do zakupionych kursów otrzymasz natychmiast po zalogowaniu na swoje konto w sekcji "Moje kursy".</p>
//             </div>

//             <p style="margin-top: 20px;">📞 Jeśli masz pytania dotyczące zamówienia, skontaktuj się z nami.</p>
//         </div>

//         <div class="footer">
//             <p>Z pozdrowieniami,<br><strong>Zespół Kurs MT</strong></p>
//             <p style="font-size: 12px;">To jest automatyczna wiadomość, prosimy nie odpowiadać na ten email.</p>
//         </div>
//     </div>
// </body>
// </html>
//     `;

//     // Wysłanie emaila
//     const result = await mg.messages.create(
//       process.env.MAILGUN_DOMAIN as string,
//       {
//         from: `Kurs MT <no-reply@${process.env.MAILGUN_DOMAIN}>`,
//         to: email,
//         subject: `Potwierdzenie zamówienia #${orderId}`,
//         text: text,
//         html: html,
//       },
//     );

//     console.log(
//       `✅ Order confirmation email sent to ${email} for order ${orderId}, ID: ${result.id}`,
//     );
//     return true;
//   } catch (error: any) {
//     console.error("❌ Error sending order confirmation email:", {
//       message: error.message,
//       statusCode: error.status,
//       details: error.details,
//     });
//     return false;
//   }
// }
