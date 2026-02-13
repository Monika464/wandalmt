import { mg } from "../utils/mailgunClient.js";
export const sendOrderConfirmation = async (req, res) => {
    try {
        const orderData = req.body;
        console.log("🔧 sendOrderConfirmation called with data:", {
            orderId: orderData.orderId,
            email: orderData.email,
            totalAmount: orderData.totalAmount,
            productsCount: orderData.products.length,
        });
        const { orderId, email, totalAmount, products, invoiceUrl, requireInvoice, billingDetails, } = orderData;
        // Tworzenie treści emaila
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
                <p><strong>Data:</strong> ${new Date(orderData.createdAt).toLocaleDateString("pl-PL", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })}</p>
                
                <h4>🛒 Produkty:</h4>
                ${products
            .map((p) => `
                    <div class="product-item">
                        <strong>${p.name}</strong><br>
                        Ilość: ${p.quantity} × ${p.price.toFixed(2)} PLN = ${(p.quantity * p.price).toFixed(2)} PLN
                    </div>
                `)
            .join("")}
                
                <div style="text-align: right; margin-top: 15px;">
                    <div class="total">Suma: ${totalAmount.toFixed(2)} PLN</div>
                </div>
            </div>
            
            ${billingDetails?.companyName
            ? `
            <div class="order-details">
                <h3>🏢 Dane do faktury</h3>
                <p><strong>Firma:</strong> ${billingDetails.companyName}</p>
                ${billingDetails.taxId ? `<p><strong>NIP:</strong> ${billingDetails.taxId}</p>` : ""}
                ${billingDetails.address ? `<p><strong>Adres:</strong> ${billingDetails.address}</p>` : ""}
            </div>
            `
            : ""}
            
            ${invoiceUrl
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
                : ""}
            
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
</html>
    `;
        console.log("🔧 Sending email via Mailgun EU endpoint...");
        const result = await mg.messages.create(process.env.MAILGUN_DOMAIN, {
            from: `Kurs MT <no-reply@${process.env.MAILGUN_DOMAIN}>`,
            to: email,
            subject: `Potwierdzenie zamówienia #${orderId}`,
            text: text,
            html: html,
        });
        console.log(`✅ Order confirmation email sent to ${email} for order ${orderId}, ID: ${result.id}`);
        res.json({
            success: true,
            message: "Email potwierdzający został wysłany",
            messageId: result.id,
        });
    }
    catch (error) {
        console.error("❌ Error sending order confirmation email:", {
            message: error.message,
            status: error.status,
            details: error.details,
            stack: error.stack,
        });
        res.status(500).json({
            success: false,
            error: "Błąd przy wysyłaniu emaila",
            details: error.message,
        });
    }
};
/////////
export const sendMail = async (req, res) => {
    try {
        const { to, subject, text } = req.body;
        if (!to || !subject || !text) {
            res.status(400).json({ error: "Missing required fields" });
            return;
        }
        const data = await mg.messages.create(process.env.MAILGUN_DOMAIN, {
            from: "Mailgun Sandbox <postmaster@boxingonline.eu>",
            to: "muaythaikrakow@gmail.com",
            subject: "✅ Test Mailgun działa!",
            text: "Gratulacje, Twój backend potrafi wysyłać e-maile 🚀",
        });
        console.log("mailgun response sent", data);
        res.status(200).json({ success: true, message: "Email sent!" });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
