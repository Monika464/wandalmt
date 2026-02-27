// backend/utils/translations.ts
type TranslationKey =
  | "orders.fetchError"
  | "orders.notFound"
  | "orders.unauthorized"
  | "orders.refundSuccess"
  | "orders.partialRefundSuccess"
  | "orders.refundError"
  | "orders.couponBlocked"
  | "refund.productNotFound"
  | "refund.insufficientQuantity"
  | "refund.amountExceeds"
  | "payment.sessionExpired"
  | "payment.genericError"
  | "orders.refundSuccessDiscounted"
  | "orders.partialRefundSuccessWithAmount"
  // 👇 NOWE KLUCZE DLA CART CHECKOUT
  | "checkout.cartEmpty"
  | "checkout.productsNotFound"
  | "checkout.invalidCoupon"
  | "checkout.couponExpired"
  | "checkout.minPurchaseAmount"
  | "checkout.couponNotAvailable"
  | "checkout.discountPercentage"
  | "checkout.discountFixed"
  | "checkout.couponNotApplicable"
  | "checkout.couponValidationError"
  | "checkout.stripeThankYouMessage"
  | "checkout.dataConflict"
  | "checkout.metadataError"
  | "checkout.stripeError"
  | "checkout.sessionCreationError"
  | "checkout.missingSessionId"
  | "checkout.paymentPending"
  | "checkout.unknownProduct"
  | "checkout.defaultProductDescription"
  | "checkout.product"
  | "checkout.paymentSuccess"
  | "checkout.paymentAlreadyRegistered"
  | "checkout.paymentCheckError"
  | "email.currency"
  | "email.invoiceGenerated"
  | "email.invoiceNotGenerated"
  | "email.orderWithoutInvoice"
  | "email.billingDetails"
  | "email.company"
  | "email.taxId"
  | "email.address"
  | "email.none"
  | "email.thankYou"
  | "email.orderNumber"
  | "email.orderDate"
  | "email.totalAmount"
  | "email.products"
  | "email.accessInfo"
  | "email.contactInfo"
  | "email.regards"
  | "email.team"
  | "email.thankYouTitle"
  | "email.orderReceived"
  | "email.orderDetails"
  | "email.quantity"
  | "email.total"
  | "email.invoiceReady"
  | "email.invoiceReadyMessage"
  | "email.downloadInvoice"
  | "email.invoiceLinkValidity"
  | "email.invoiceInfo"
  | "email.invoiceNotGeneratedMessage"
  | "email.accessTitle"
  | "email.accessMessage"
  | "email.questions"
  | "email.autoMessage"
  | "email.fromName"
  | "email.orderConfirmationSubject"
  | "email.sentSuccess"
  | "email.invoiceSalutation"
  | "email.invoiceReadyForOrder"
  | "email.invoiceAvailable"
  | "email.invoiceTitle"
  | "email.invoiceSubject"
  | "email.invoiceSentSuccess";

// Definiujemy typ dla tłumaczeń
type TranslationsType = {
  [K in TranslationKey]: string;
};

const translations: Record<string, TranslationsType> = {
  pl: {
    // ... istniejące klucze ...
    "orders.fetchError": "Błąd przy pobieraniu zamówień",
    "orders.notFound": "Nie znaleziono zamówienia",
    "orders.unauthorized": "Brak autoryzacji",
    "orders.refundSuccess": "Zwrot wykonany pomyślnie",
    "orders.partialRefundSuccess": "Częściowy zwrot został wykonany pomyślnie",
    "orders.refundError": "Błąd serwera przy zwrocie",
    "orders.couponBlocked":
      "Częściowy zwrot jest niemożliwy dla zamówień z kuponem lub zniżką. Skontaktuj się z obsługą klienta.",
    "refund.productNotFound": "Produkt nie znaleziony",
    "refund.insufficientQuantity":
      "Niewystarczająca ilość do zwrotu dla produktu",
    "refund.amountExceeds": "Żądana kwota zwrotu jest większa niż dostępna",
    "payment.sessionExpired": "Sesja wygasła. Zaloguj się ponownie.",
    "payment.genericError": "Wystąpił błąd podczas płatności",
    "orders.refundSuccessDiscounted":
      "Pełny zwrot wykonany pomyślnie (zniżka została zachowana w rozliczeniu). Zasoby usunięte z konta użytkownika",
    "orders.partialRefundSuccessWithAmount":
      "Częściowy zwrot {{amount}} PLN został wykonany",

    // NOWE KLUCZE DLA CART CHECKOUT - PL
    "checkout.cartEmpty": "Brak produktów w koszyku",
    "checkout.productsNotFound": "Niektóre produkty nie zostały znalezione",
    "checkout.invalidCoupon": "Nieprawidłowy kod kuponu",
    "checkout.couponExpired": "Kupon wygasł lub został wyczerpany",
    "checkout.minPurchaseAmount":
      "Minimalna kwota zamówienia dla tego kuponu to {{amount}} PLN",
    "checkout.couponNotAvailable":
      "Ten kupon nie jest dostępny dla Twojego konta",
    "checkout.discountPercentage": "{{value}}% zniżki",
    "checkout.discountFixed": "{{value}} PLN zniżki",
    "checkout.couponNotApplicable":
      "Kupon nie może być zastosowany do tego zamówienia",
    "checkout.couponValidationError": "Błąd walidacji kuponu",
    "checkout.stripeThankYouMessage":
      "Dziękujemy za zakupy! Dostęp do kursów otrzymasz natychmiast po płatności.",
    "checkout.dataConflict": "Konflikt danych. Proszę spróbować ponownie.",
    "checkout.metadataError": "Błąd danych - zbyt duże metadane",
    "checkout.stripeError": "Błąd Stripe",
    "checkout.sessionCreationError": "Błąd tworzenia sesji płatności",
    "checkout.missingSessionId": "Brak session_id w zapytaniu",
    "checkout.paymentPending": "⏳ Płatność w trakcie przetwarzania",
    "checkout.unknownProduct": "Nieznany produkt",
    "checkout.defaultProductDescription": "Produkt zakupiony przez Stripe",
    "checkout.product": "Produkt",
    "checkout.paymentSuccess": "✅ Płatność zakończona sukcesem",
    "checkout.paymentAlreadyRegistered":
      "✅ Płatność już została zarejestrowana",
    "checkout.paymentCheckError": "Błąd podczas sprawdzania płatności",
    // ... inne klucze ...
    "email.currency": "PLN",
    "email.invoiceGenerated":
      "Faktura została wygenerowana i jest dostępna pod linkiem",
    "email.invoiceNotGenerated":
      "Faktura nie została wygenerowana. Skontaktuj się z obsługą klienta w sprawie faktury",
    "email.orderWithoutInvoice": "Zamówienie zostało złożone bez faktury",
    "email.billingDetails": "Dane do faktury",
    "email.company": "Firma",
    "email.taxId": "NIP",
    "email.address": "Adres",
    "email.none": "brak",
    "email.thankYou": "Dziękujemy za złożenie zamówienia w Kurs MT",
    "email.orderNumber": "Numer zamówienia",
    "email.orderDate": "Data zamówienia",
    "email.totalAmount": "Kwota całkowita",
    "email.products": "Produkty",
    "email.accessInfo":
      "Dostęp do zakupionych kursów otrzymasz natychmiast po zalogowaniu na swoje konto",
    "email.contactInfo": "W razie pytań skontaktuj się z nami",
    "email.regards": "Pozdrawiamy",
    "email.team": "Zespół Kurs MT",
    "email.thankYouTitle": "Dziękujemy za zamówienie!",
    "email.orderReceived":
      "Twoje zamówienie zostało pomyślnie przyjęte i jest w trakcie realizacji.",
    "email.orderDetails": "Szczegóły zamówienia",
    "email.quantity": "Ilość",
    "email.total": "Suma",
    "email.invoiceReady": "Faktura gotowa do pobrania",
    "email.invoiceReadyMessage":
      "Twoja faktura została wygenerowana i jest dostępna pod poniższym linkiem:",
    "email.downloadInvoice": "Pobierz fakturę",
    "email.invoiceLinkValidity": "Link jest aktywny przez 30 dni.",
    "email.invoiceInfo": "Informacja o fakturze",
    "email.invoiceNotGeneratedMessage":
      "Faktura nie została wygenerowana automatycznie. Skontaktuj się z obsługą klienta w sprawie faktury.",
    "email.accessTitle": "Dostęp do kursów",
    "email.accessMessage":
      'Dostęp do zakupionych kursów otrzymasz natychmiast po zalogowaniu na swoje konto w sekcji "Moje kursy".',
    "email.questions":
      "Jeśli masz pytania dotyczące zamówienia, skontaktuj się z nami.",
    "email.autoMessage":
      "To jest automatyczna wiadomość, prosimy nie odpowiadać na ten email.",
    "email.fromName": "Kurs MT",
    "email.orderConfirmationSubject": "Potwierdzenie zamówienia #{{orderId}}",
    "email.sentSuccess": "Email wysłany pomyślnie",
    "email.invoiceSalutation": "Szanowni Państwo",
    "email.invoiceReadyForOrder":
      "Faktura VAT nr {{invoiceNumber}} dla zamówienia #{{orderId}} została wygenerowana",
    "email.invoiceAvailable": "Faktura jest dostępna pod linkiem",
    "email.invoiceTitle": "Faktura VAT",
    "email.invoiceSubject":
      "Faktura VAT #{{invoiceNumber}} dla zamówienia #{{orderId}}",
    "email.invoiceSentSuccess": "Faktura wysłana pomyślnie",
  },
  en: {
    // ... istniejące klucze ...
    "orders.fetchError": "Error fetching orders",
    "orders.notFound": "Order not found",
    "orders.unauthorized": "Unauthorized",
    "orders.refundSuccess": "Refund processed successfully",
    "orders.partialRefundSuccess": "Partial refund processed successfully",
    "orders.refundError": "Server error while processing refund",
    "orders.couponBlocked":
      "Partial refund is not possible for orders with coupons or discounts. Please contact customer support.",
    "refund.productNotFound": "Product not found",
    "refund.insufficientQuantity": "Insufficient quantity for refund",
    "refund.amountExceeds": "Requested refund amount exceeds available amount",
    "payment.sessionExpired": "Session expired. Please login again.",
    "payment.genericError": "An error occurred during payment",
    "orders.refundSuccessDiscounted":
      "Full refund processed successfully (discount was preserved). Resources removed from user account",
    "orders.partialRefundSuccessWithAmount":
      "Partial refund of {{amount}} PLN has been processed",

    // NOWE KLUCZE DLA CART CHECKOUT - EN
    "checkout.cartEmpty": "No products in cart",
    "checkout.productsNotFound": "Some products were not found",
    "checkout.invalidCoupon": "Invalid coupon code",
    "checkout.couponExpired": "Coupon has expired or been exhausted",
    "checkout.minPurchaseAmount":
      "Minimum purchase amount for this coupon is {{amount}} PLN",
    "checkout.couponNotAvailable":
      "This coupon is not available for your account",
    "checkout.discountPercentage": "{{value}}% discount",
    "checkout.discountFixed": "{{value}} PLN discount",
    "checkout.couponNotApplicable": "Coupon cannot be applied to this order",
    "checkout.couponValidationError": "Coupon validation error",
    "checkout.stripeThankYouMessage":
      "Thank you for your purchase! You will get access to courses immediately after payment.",
    "checkout.dataConflict": "Data conflict. Please try again.",
    "checkout.metadataError": "Data error - metadata too large",
    "checkout.stripeError": "Stripe error",
    "checkout.sessionCreationError": "Error creating payment session",
    "checkout.missingSessionId": "Missing session_id in request",
    "checkout.paymentPending": "⏳ Payment is being processed",
    "checkout.unknownProduct": "Unknown product",
    "checkout.defaultProductDescription": "Product purchased via Stripe",
    "checkout.product": "Product",
    "checkout.paymentSuccess": "✅ Payment completed successfully",
    "checkout.paymentAlreadyRegistered":
      "✅ Payment has already been registered",
    "checkout.paymentCheckError": "Error checking payment status",
    // ... inne klucze ...
    "email.currency": "PLN",
    "email.invoiceGenerated":
      "Invoice has been generated and is available at the link",
    "email.invoiceNotGenerated":
      "Invoice was not generated. Please contact customer support regarding the invoice",
    "email.orderWithoutInvoice": "Order was placed without an invoice",
    "email.billingDetails": "Billing details",
    "email.company": "Company",
    "email.taxId": "Tax ID",
    "email.address": "Address",
    "email.none": "none",
    "email.thankYou": "Thank you for your order in Kurs MT",
    "email.orderNumber": "Order number",
    "email.orderDate": "Order date",
    "email.totalAmount": "Total amount",
    "email.products": "Products",
    "email.accessInfo":
      "You will get access to purchased courses immediately after logging into your account",
    "email.contactInfo": "If you have any questions, please contact us",
    "email.regards": "Best regards",
    "email.team": "Kurs MT Team",
    "email.thankYouTitle": "Thank you for your order!",
    "email.orderReceived":
      "Your order has been successfully received and is being processed.",
    "email.orderDetails": "Order details",
    "email.quantity": "Quantity",
    "email.total": "Total",
    "email.invoiceReady": "Invoice ready for download",
    "email.invoiceReadyMessage":
      "Your invoice has been generated and is available at the link below:",
    "email.downloadInvoice": "Download invoice",
    "email.invoiceLinkValidity": "The link is valid for 30 days.",
    "email.invoiceInfo": "Invoice information",
    "email.invoiceNotGeneratedMessage":
      "Invoice was not generated automatically. Please contact customer support regarding the invoice.",
    "email.accessTitle": "Access to courses",
    "email.accessMessage":
      'You will get access to purchased courses immediately after logging into your account in the "My Courses" section.',
    "email.questions":
      "If you have questions about your order, please contact us.",
    "email.autoMessage":
      "This is an automated message, please do not reply to this email.",
    "email.fromName": "Kurs MT",
    "email.orderConfirmationSubject": "Order confirmation #{{orderId}}",
    "email.sentSuccess": "Email sent successfully",
    "email.invoiceSalutation": "Dear Customer",
    "email.invoiceReadyForOrder":
      "Invoice no. {{invoiceNumber}} for order #{{orderId}} has been generated",
    "email.invoiceAvailable": "Invoice is available at the link",
    "email.invoiceTitle": "VAT Invoice",
    "email.invoiceSubject": "Invoice #{{invoiceNumber}} for order #{{orderId}}",
    "email.invoiceSentSuccess": "Invoice sent successfully",
  },
};

export const t = (
  lang: string = "pl",
  key: TranslationKey,
  params?: Record<string, any>,
): string => {
  const language = lang === "pl" ? "pl" : "en";

  // Pobierz tłumaczenia dla danego języka lub użyj polskich jako fallback
  const langTranslations = translations[language] || translations.pl;

  // Pobierz wiadomość lub zwróć klucz jeśli nie znaleziono
  let message = langTranslations[key];

  // Jeśli nie znaleziono, spróbuj z polskim
  if (!message) {
    message = translations.pl[key];
  }

  // Jeśli nadal nie znaleziono, zwróć klucz
  if (!message) {
    console.warn(`Missing translation for key: ${key} in language: ${lang}`);
    return key;
  }

  // Podstawianie parametrów
  if (params) {
    Object.keys(params).forEach((param) => {
      message = message.replace(new RegExp(`{{${param}}}`, "g"), params[param]);
    });
  }

  return message;
};
