import { Request, Response } from "express";
import crypto from "crypto";
import User from "../models/user.js";
import { mg } from "../utils/mailgunClient.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Funkcja pomocnicza do tłumaczeń
const getTranslations = (lang: string = "pl") => {
  const translations = {
    pl: {
      // Walidacja
      emailRequired: "Proszę podać poprawny adres email",
      userNotFound:
        "Jeśli konto z tym emailem istnieje, otrzymasz link do resetu hasła",

      // Email - reset hasła
      emailSubject: "🔐 Resetowanie hasła - Kurs MT",
      emailHeader: "Resetowanie hasła",
      emailSubheader: "Kurs MT - Panel użytkownika",
      emailGreeting: "Witaj,",
      emailRequest:
        "Otrzymaliśmy prośbę o resetowanie hasła dla konta powiązanego z adresem",
      emailButton: "Ustaw nowe hasło",
      emailLinkInfo: "Lub skopiuj poniższy link i wklej go w przeglądarce:",
      emailWarning: "⚠️ Ważne:",
      emailWarningText: "Link jest aktywny przez 1 godzinę.",
      emailIgnore:
        "Jeśli to nie Ty prosiłeś o reset hasła, zignoruj tę wiadomość.",
      emailFooter: "Z pozdrowieniami,",
      emailFooterText:
        "To jest automatyczna wiadomość, prosimy nie odpowiadać na ten email.",

      // Email - potwierdzenie zmiany hasła
      confirmSubject: "✅ Hasło zostało zmienione - Kurs MT",
      confirmHeader: "Potwierdzenie zmiany hasła",
      confirmText: "Twoje hasło zostało pomyślnie zmienione.",
      confirmChanged: "✅ Zmiana została zarejestrowana:",
      confirmAccount: "📧 Konto:",
      confirmWarning:
        "⚠️ Jeśli to nie Ty zmieniałeś hasło, niezwłocznie skontaktuj się z nami.",

      // Email - zmiana adresu email
      emailChangeSubject: "📧 Adres email został zmieniony - Kurs MT",
      emailChangeHeader: "Potwierdzenie zmiany adresu email",
      emailChangeText: "Twój adres email został pomyślnie zmieniony.",
      emailChangeOld: "📧 Stary adres:",
      emailChangeNew: "📧 Nowy adres:",
      emailChangeWarning:
        "⚠️ Jeśli to nie Ty zmieniałeś adres email, niezwłocznie skontaktuj się z nami.",

      // Błędy
      errorGeneric: "Wystąpił błąd podczas przetwarzania żądania",
      errorMissingData: "Brak wymaganych danych: token i nowe hasło",
      errorPasswordLength: "Hasło musi mieć co najmniej 6 znaków",
      errorTokenExpired: "Link resetujący wygasł. Wygeneruj nowy link.",
      errorInvalidToken: "Nieprawidłowy lub uszkodzony token",
      errorWrongTokenType: "Nieprawidłowy typ tokena",
      errorUserNotFound: "Użytkownik nie istnieje",
      errorTokenUsed: "Token został już użyty lub jest nieprawidłowy",
      errorTokenExpired2: "Token wygasł",
      successPasswordChanged: "Hasło zostało pomyślnie zmienione",
      errorUnauthorized: "Brak autoryzacji",
      errorMissingToken: "Brak tokena",
      errorEmailExists: "Ten adres email jest już zajęty",
      successEmailChanged: "Adres email został pomyślnie zmieniony",
    },
    en: {
      // Validation
      emailRequired: "Please provide a valid email address",
      userNotFound:
        "If an account with this email exists, you will receive a password reset link",

      // Email - password reset
      emailSubject: "🔐 Password Reset - Kurs MT",
      emailHeader: "Password Reset",
      emailSubheader: "Kurs MT - User Panel",
      emailGreeting: "Hello,",
      emailRequest:
        "We received a request to reset the password for the account associated with",
      emailButton: "Set New Password",
      emailLinkInfo: "Or copy and paste this link into your browser:",
      emailWarning: "⚠️ Important:",
      emailWarningText: "The link is valid for 1 hour.",
      emailIgnore: "If you didn't request this, please ignore this email.",
      emailFooter: "Best regards,",
      emailFooterText: "This is an automated message, please do not reply.",

      // Email - password change confirmation
      confirmSubject: "✅ Password Changed - Kurs MT",
      confirmHeader: "Password Change Confirmation",
      confirmText: "Your password has been successfully changed.",
      confirmChanged: "✅ Change registered:",
      confirmAccount: "📧 Account:",
      confirmWarning:
        "⚠️ If you didn't change your password, please contact us immediately.",

      // Email - email change confirmation
      emailChangeSubject: "📧 Email Address Changed - Kurs MT",
      emailChangeHeader: "Email Change Confirmation",
      emailChangeText: "Your email address has been successfully changed.",
      emailChangeOld: "📧 Old address:",
      emailChangeNew: "📧 New address:",
      emailChangeWarning:
        "⚠️ If you didn't change your email address, please contact us immediately.",

      // Errors
      errorGeneric: "An error occurred while processing your request",
      errorMissingData: "Missing required data: token and new password",
      errorPasswordLength: "Password must be at least 6 characters long",
      errorTokenExpired: "Reset link has expired. Please generate a new link.",
      errorInvalidToken: "Invalid or corrupted token",
      errorWrongTokenType: "Invalid token type",
      errorUserNotFound: "User does not exist",
      errorTokenUsed: "Token has already been used or is invalid",
      errorTokenExpired2: "Token has expired",
      successPasswordChanged: "Password has been successfully changed",
      errorUnauthorized: "Unauthorized",
      errorMissingToken: "Missing token",
      errorEmailExists: "This email address is already taken",
      successEmailChanged: "Email address has been successfully changed",
    },
  };

  return translations[lang as keyof typeof translations] || translations.pl;
};

// Funkcja pomocnicza do pobierania języka z headers
const getLanguageFromHeaders = (req: Request): string => {
  // Sprawdź "Accept-Language" header
  const acceptLanguage = req.headers["accept-language"];

  if (acceptLanguage && typeof acceptLanguage === "string") {
    // Może być "en-US,en;q=0.9" - bierzemy pierwszy
    const lang = acceptLanguage.split(",")[0].split("-")[0];
    if (lang === "en" || lang === "pl") {
      return lang;
    }
  }

  // Domyślnie polski
  return "pl";
};

/**
 * Kontroler do resetowania hasła - wysyłanie linku resetującego
 */
export const requestPasswordReset = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { email } = req.body;
    const lang = getLanguageFromHeaders(req);
    const t = getTranslations(lang);

    console.log("🔑 Request password reset for email:", email, "lang:", lang);

    // Walidacja emaila
    if (!email || !email.includes("@")) {
      res.status(400).json({
        success: false,
        error: t.emailRequired,
      });
      return;
    }

    // Szukanie użytkownika
    const user = await User.findOne({ email: email.toLowerCase() });

    // Zawsze zwracaj sukces dla bezpieczeństwa
    if (!user) {
      console.log("⚠️ User not found, but returning success for security");
      res.json({
        success: true,
        message: t.userNotFound,
      });
      return;
    }

    console.log("✅ Found user for password reset:", user.email);

    // Generowanie tokena resetującego
    const resetToken = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        type: "password_reset",
        lang,
      },
      process.env.JWT_RESET_SECRET as string,
      { expiresIn: "1h" },
    );

    // Zapisz hash tokena w bazie
    user.resetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    user.resetTokenExpiration = new Date(Date.now() + 3600000);
    await user.save();

    console.log("🔐 Generated JWT reset token for user:", user.email);

    // Tworzenie linku resetującego
    const resetLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password/${resetToken}`;

    // Treść emaila
    const text = `
${t.emailHeader} - Kurs MT

${t.emailGreeting}

${t.emailRequest} ${user.email}.

🔑 ${t.emailButton}:
${resetLink}

⏰ ${t.emailWarning} ${t.emailWarningText}

⚠️ ${t.emailIgnore}

${t.emailFooter}
Zespół Kurs MT
    `.trim();

    const html = `
<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${t.emailSubject}</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .container { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px; padding: 40px; color: white; }
        .content { background: white; border-radius: 10px; padding: 30px; margin-top: 20px; color: #333; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
        .button:hover { background: #5a67d8; }
        .footer { margin-top: 30px; font-size: 12px; color: #999; text-align: center; }
        .warning { background: #fff3cd; border: 1px solid #ffeeba; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .link-info { word-break: break-all; background: #f7f7f7; padding: 15px; border-radius: 5px; font-family: monospace; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔐 ${t.emailHeader}</h1>
        <p>${t.emailSubheader}</p>
    </div>
    
    <div class="content">
        <p>${t.emailGreeting}</p>
        
        <p>${t.emailRequest} <strong>${user.email}</strong>.</p>
        
        <div style="text-align: center;">
            <a href="${resetLink}" class="button">🔑 ${t.emailButton}</a>
        </div>
        
        <p>${t.emailLinkInfo}</p>
        <div class="link-info">${resetLink}</div>
        
        <div class="warning">
            <strong>${t.emailWarning}</strong> ${t.emailWarningText}
        </div>
        
        <p>⚠️ ${t.emailIgnore}</p>
        
        <p>${t.emailFooter}<br>Zespół Kurs MT</p>
    </div>
    
    <div class="footer">
        <p>${t.emailFooterText}</p>
    </div>
</body>
</html>
`.trim();

    // Wysłanie emaila
    await mg.messages.create(process.env.MAILGUN_DOMAIN as string, {
      from: `Kurs MT <no-reply@${process.env.MAILGUN_DOMAIN}>`,
      to: user.email,
      subject: t.emailSubject,
      text: text,
      html: html,
    });

    console.log(`✅ Password reset email sent to ${user.email} in ${lang}`);

    res.json({
      success: true,
      message: t.userNotFound,
    });
  } catch (error: any) {
    console.error("❌ Error in requestPasswordReset:", error.message);
    res.status(500).json({
      success: false,
      error: error.message || "Wystąpił błąd podczas przetwarzania żądania",
    });
  }
};

/**
 * Kontroler do ustawiania nowego hasła
 */
export const resetPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { token, newPassword } = req.body;
    const lang = getLanguageFromHeaders(req);
    const t = getTranslations(lang);

    console.log("🔑 Reset password request received with lang:", lang);

    if (!token || !newPassword) {
      res.status(400).json({
        success: false,
        error: t.errorMissingData,
      });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({
        success: false,
        error: t.errorPasswordLength,
      });
      return;
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_RESET_SECRET as string) as {
        userId: string;
        email: string;
        type: string;
        //lang?: string;
      };
      console.log("✅ Token decoded successfully");
    } catch (err: any) {
      console.error("❌ Token verification failed:", err.message);
      res.status(400).json({
        success: false,
        error:
          err.name === "TokenExpiredError"
            ? t.errorTokenExpired
            : t.errorInvalidToken,
      });
      return;
    }

    if (decoded.type !== "password_reset") {
      res.status(400).json({
        success: false,
        error: t.errorWrongTokenType,
      });
      return;
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      res.status(404).json({
        success: false,
        error: t.errorUserNotFound,
      });
      return;
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    if (!user.resetToken || user.resetToken !== tokenHash) {
      res.status(400).json({
        success: false,
        error: t.errorTokenUsed,
      });
      return;
    }

    if (!user.resetTokenExpiration || user.resetTokenExpiration < new Date()) {
      res.status(400).json({
        success: false,
        error: t.errorTokenExpired2,
      });
      return;
    }

    user.password = newPassword;
    user.resetToken = undefined;
    user.resetTokenExpiration = undefined;
    await user.save();

    console.log(`✅ Password successfully reset for user: ${user.email}`);

    // Wyślij email potwierdzający
    //const confirmLang = decoded.lang || "pl";
    const tConfirm = getTranslations(lang);

    const text = `
${tConfirm.confirmHeader} - Kurs MT

${tConfirm.confirmText}

✅ ${tConfirm.confirmChanged} ${new Date().toLocaleString(lang === "pl" ? "pl-PL" : "en-US")}
📧 ${tConfirm.confirmAccount} ${user.email}

⚠️ ${tConfirm.confirmWarning}

${tConfirm.emailFooter}
Zespół Kurs MT
    `.trim();

    await mg.messages.create(process.env.MAILGUN_DOMAIN as string, {
      from: `Kurs MT <no-reply@${process.env.MAILGUN_DOMAIN}>`,
      to: user.email,
      subject: tConfirm.confirmSubject,
      text: text,
    });

    console.log(`✅ Password change confirmation email sent to ${user.email}`);

    res.json({
      success: true,
      message: t.successPasswordChanged,
    });
  } catch (error: any) {
    console.error("❌ Error in resetPassword:", error.message);
    res.status(500).json({
      success: false,
      error: error.message || "Wystąpił błąd podczas zmiany hasła",
    });
  }
};

/**
 * Kontroler do sprawdzania ważności tokena resetującego
 */
export const validateResetToken = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { token, lang = "pl" } = req.query;
    const t = getTranslations(lang as string);

    if (!token || typeof token !== "string") {
      res.status(400).json({
        valid: false,
        error: t.errorMissingToken,
      });
      return;
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_RESET_SECRET as string) as {
        userId: string;
        email: string;
        type: string;
        lang?: string;
      };
    } catch (err: any) {
      res.status(200).json({
        valid: false,
        error:
          err.name === "TokenExpiredError"
            ? t.errorTokenExpired
            : t.errorInvalidToken,
      });
      return;
    }

    if (decoded.type !== "password_reset") {
      res.status(200).json({
        valid: false,
        error: t.errorWrongTokenType,
      });
      return;
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      res.status(200).json({
        valid: false,
        error: t.errorUserNotFound,
      });
      return;
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    if (!user.resetToken || user.resetToken !== tokenHash) {
      res.status(200).json({
        valid: false,
        error: t.errorTokenUsed,
      });
      return;
    }

    if (user.resetTokenExpiration && user.resetTokenExpiration < new Date()) {
      res.status(200).json({
        valid: false,
        error: t.errorTokenExpired2,
      });
      return;
    }

    res.json({
      valid: true,
      email: user.email,
      expiresAt: user.resetTokenExpiration,
      lang: decoded.lang || "pl",
    });
  } catch (error: any) {
    console.error("❌ Error in validateResetToken:", error.message);
    res.status(500).json({
      valid: false,
      error: "Błąd walidacji tokena",
    });
  }
};

/**
 * Kontroler do zmiany adresu email
 */
export const changeEmail = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { newEmail } = req.body;
    const lang = getLanguageFromHeaders(req);
    const t = getTranslations(lang);

    console.log("📧 Change email request with lang from headers:", lang);
    const user = req.user; // z authMiddleware
    if (!user) {
      res.status(401).json({
        success: false,
        error: t.errorUnauthorized,
      });
      return;
    }

    // Sprawdź czy email jest już zajęty
    const existingUser = await User.findOne({
      email: newEmail.toLowerCase(),
      _id: { $ne: user._id }, // pomiń obecnego użytkownika
    });

    if (existingUser) {
      res.status(400).json({
        success: false,
        error: t.errorEmailExists,
      });
      return;
    }

    const oldEmail = user.email;
    user.email = newEmail;
    await user.save();

    console.log(
      `✅ Email changed for user ${user._id}: ${oldEmail} -> ${newEmail}`,
    );

    // Wyślij email potwierdzający na stary adres
    const text = `
${t.emailChangeHeader} - Kurs MT

${t.emailChangeText}

${t.emailChangeOld} ${oldEmail}
${t.emailChangeNew} ${newEmail}

⚠️ ${t.emailChangeWarning}

${t.emailFooter}
Zespół Kurs MT
    `.trim();

    await mg.messages.create(process.env.MAILGUN_DOMAIN as string, {
      from: `Kurs MT <no-reply@${process.env.MAILGUN_DOMAIN}>`,
      to: oldEmail,
      subject: t.emailChangeSubject,
      text: text,
    });

    console.log(`✅ Email change confirmation sent to ${oldEmail}`);

    res.json({
      success: true,
      message: t.successEmailChanged,
    });
  } catch (error: any) {
    console.error("❌ Error in changeEmail:", error.message);
    res.status(500).json({
      success: false,
      error: error.message || "Wystąpił błąd podczas zmiany adresu email",
    });
  }
};

// import { Request, Response } from "express";
// import crypto from "crypto";
// import User from "../models/user.js";
// import { mg } from "../utils/mailgunClient.js";
// import bcrypt from "bcryptjs";
// import jwt from "jsonwebtoken";

// /**
//  * Kontroler do resetowania hasła - wysyłanie linku resetującego
//  */
// export const requestPasswordReset = async (
//   req: Request,
//   res: Response,
// ): Promise<void> => {
//   try {
//     const { email } = req.body;

//     console.log("🔑 Request password reset for email:", email);

//     // Walidacja emaila
//     if (!email || !email.includes("@")) {
//       res.status(400).json({
//         success: false,
//         error: "Proszę podać poprawny adres email",
//       });
//       return;
//     }

//     // Szukanie użytkownika
//     const user = await User.findOne({ email: email.toLowerCase() });

//     // Zawsze zwracaj sukces dla bezpieczeństwa
//     if (!user) {
//       console.log("⚠️ User not found, but returning success for security");
//       res.json({
//         success: true,
//         message:
//           "Jeśli konto z tym emailem istnieje, otrzymasz link do resetu hasła",
//       });
//       return;
//     }

//     console.log("✅ Found user for password reset:", user.email);

//     // Generowanie tokena resetującego
//     const resetToken = jwt.sign(
//       {
//         userId: user._id.toString(),
//         email: user.email,
//         type: "password_reset",
//       },
//       process.env.JWT_RESET_SECRET as string,
//       { expiresIn: "1h" },
//     );

//     // Zapisz hash tokena w bazie
//     user.resetToken = crypto
//       .createHash("sha256")
//       .update(resetToken)
//       .digest("hex");
//     user.resetTokenExpiration = new Date(Date.now() + 3600000); // 1 godzina
//     await user.save();

//     console.log("🔐 Generated JWT reset token for user:", user.email);

//     // Tworzenie linku resetującego
//     const resetLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password/${resetToken}`;

//     // Treść emaila
//     const text = `
// Resetowanie hasła w Kurs MT

// Otrzymaliśmy prośbę o resetowanie hasła dla Twojego konta.

// 🔑 Kliknij w poniższy link, aby ustawić nowe hasło:
// ${resetLink}

// ⏰ Link jest aktywny przez 1 godzinę.

// ⚠️ Jeśli to nie Ty prosiłeś o reset hasła, zignoruj tę wiadomość.
// Twoje hasło pozostanie bez zmian.

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
//         .content { padding: 30px; background-color: #f9f9f9; }
//         .reset-button { display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
//         .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
//     </style>
// </head>
// <body>
//     <div class="container">
//         <div class="header">
//             <h1>🔐 Resetowanie hasła</h1>
//             <p>Kurs MT - Panel użytkownika</p>
//         </div>

//         <div class="content">
//             <p>Witaj,</p>
//             <p>Otrzymaliśmy prośbę o resetowanie hasła dla konta powiązanego z adresem <strong>${user.email}</strong>.</p>

//             <p>Aby ustawić nowe hasło, kliknij przycisk poniżej:</p>

//             <div style="text-align: center;">
//                 <a href="${resetLink}" class="reset-button">Ustaw nowe hasło</a>
//             </div>

//             <p>Lub skopiuj poniższy link i wklej go w przeglądarce:</p>
//             <p><a href="${resetLink}">${resetLink}</a></p>

//             <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
//                 <p><strong>⚠️ Ważne:</strong> Link jest aktywny przez 1 godzinę.</p>
//                 <p>Jeśli to nie Ty prosiłeś o reset hasła, zignoruj tę wiadomość.</p>
//             </div>
//         </div>

//         <div class="footer">
//             <p>Z pozdrowieniami,<br><strong>Zespół Kurs MT</strong></p>
//             <p>To jest automatyczna wiadomość, prosimy nie odpowiadać na ten email.</p>
//         </div>
//     </div>
// </body>
// </html>
//     `;

//     // Wysłanie emaila
//     await mg.messages.create(process.env.MAILGUN_DOMAIN as string, {
//       from: `Kurs MT <no-reply@${process.env.MAILGUN_DOMAIN}>`,
//       to: user.email,
//       subject: "🔐 Resetowanie hasła - Kurs MT",
//       text: text,
//       html: html,
//     });

//     console.log(`✅ Password reset email sent to ${user.email}`);

//     res.json({
//       success: true,
//       message:
//         "Jeśli konto z tym emailem istnieje, otrzymasz link do resetu hasła",
//     });
//   } catch (error: any) {
//     console.error("❌ Error in requestPasswordReset:", error.message);

//     res.status(500).json({
//       success: false,
//       error: "Wystąpił błąd podczas przetwarzania żądania",
//     });
//   }
// };

// /**
//  * Kontroler do ustawiania nowego hasła
//  */
// export const resetPassword = async (
//   req: Request,
//   res: Response,
// ): Promise<void> => {
//   try {
//     const { token, newPassword } = req.body;

//     console.log("🔑 Reset password request received");

//     // Walidacja danych wejściowych
//     if (!token || !newPassword) {
//       res.status(400).json({
//         success: false,
//         error: "Brak wymaganych danych: token i nowe hasło",
//       });
//       return;
//     }

//     // Walidacja siły hasła
//     if (newPassword.length < 6) {
//       res.status(400).json({
//         success: false,
//         error: "Hasło musi mieć co najmniej 6 znaków",
//       });
//       return;
//     }

//     let decoded;
//     try {
//       // Weryfikacja tokena JWT
//       decoded = jwt.verify(token, process.env.JWT_RESET_SECRET as string) as {
//         userId: string;
//         email: string;
//         type: string;
//       };

//       console.log("✅ Token decoded successfully");
//     } catch (err: any) {
//       console.error("❌ Token verification failed:", err.message);

//       if (err.name === "TokenExpiredError") {
//         res.status(400).json({
//           success: false,
//           error: "Link resetujący wygasł. Wygeneruj nowy link.",
//         });
//       } else {
//         res.status(400).json({
//           success: false,
//           error: "Nieprawidłowy lub uszkodzony token",
//         });
//       }
//       return;
//     }

//     // Sprawdź czy to token do resetu hasła
//     if (decoded.type !== "password_reset") {
//       res.status(400).json({
//         success: false,
//         error: "Nieprawidłowy typ tokena",
//       });
//       return;
//     }

//     // Znajdź użytkownika
//     const user = await User.findById(decoded.userId);

//     if (!user) {
//       res.status(404).json({
//         success: false,
//         error: "Użytkownik nie istnieje",
//       });
//       return;
//     }

//     // Sprawdź czy token nie został już użyty (porównaj hashe)
//     const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

//     if (!user.resetToken || user.resetToken !== tokenHash) {
//       res.status(400).json({
//         success: false,
//         error: "Token został już użyty lub jest nieprawidłowy",
//       });
//       return;
//     }

//     if (!user.resetTokenExpiration || user.resetTokenExpiration < new Date()) {
//       res.status(400).json({
//         success: false,
//         error: "Token wygasł",
//       });
//       return;
//     }

//     // Ustaw nowe hasło - middleware w modelu zajmie się hashowaniem
//     user.password = newPassword; // Model automatycznie zahashuje przy save()
//     user.resetToken = undefined;
//     user.resetTokenExpiration = undefined;

//     await user.save();

//     console.log(`✅ Password successfully reset for user: ${user.email}`);

//     // Wysłanie emaila potwierdzającego
//     const text = `
// Potwierdzenie zmiany hasła w Kurs MT

// Twoje hasło zostało pomyślnie zmienione.

// ✅ Zmiana została zarejestrowana: ${new Date().toLocaleString("pl-PL")}
// 📧 Konto: ${user.email}

// ⚠️ Jeśli to nie Ty zmieniałeś hasło, niezwłocznie skontaktuj się z nami.

// Pozdrawiamy,
// Zespół Kurs MT
//     `.trim();

//     await mg.messages.create(process.env.MAILGUN_DOMAIN as string, {
//       from: `Kurs MT <no-reply@${process.env.MAILGUN_DOMAIN}>`,
//       to: user.email,
//       subject: "✅ Hasło zostało zmienione - Kurs MT",
//       text: text,
//     });

//     console.log(`✅ Password change confirmation email sent to ${user.email}`);

//     res.json({
//       success: true,
//       message: "Hasło zostało pomyślnie zmienione",
//     });
//   } catch (error: any) {
//     console.error("❌ Error in resetPassword:", error.message);

//     res.status(500).json({
//       success: false,
//       error: "Wystąpił błąd podczas zmiany hasła",
//     });
//   }
// };

// /**
//  * Kontroler do sprawdzania ważności tokena resetującego
//  */
// /**
//  * Kontroler do sprawdzania ważności tokena resetującego
//  */
// export const validateResetToken = async (
//   req: Request,
//   res: Response,
// ): Promise<void> => {
//   try {
//     const { token } = req.query;

//     if (!token || typeof token !== "string") {
//       res.status(400).json({
//         valid: false,
//         error: "Brak tokena",
//       });
//       return;
//     }

//     let decoded;
//     try {
//       decoded = jwt.verify(token, process.env.JWT_RESET_SECRET as string) as {
//         userId: string;
//         email: string;
//         type: string;
//       };
//     } catch (err: any) {
//       res.status(200).json({
//         valid: false,
//         error:
//           err.name === "TokenExpiredError"
//             ? "Token wygasł"
//             : "Nieprawidłowy token",
//       });
//       return;
//     }

//     const user = await User.findById(decoded.userId);

//     if (!user) {
//       res.status(200).json({
//         valid: false,
//         error: "Użytkownik nie istnieje",
//       });
//       return;
//     }

//     // Sprawdź hash tokena
//     const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

//     if (!user.resetToken || user.resetToken !== tokenHash) {
//       res.status(200).json({
//         valid: false,
//         error: "Token jest nieprawidłowy",
//       });
//       return;
//     }

//     if (user.resetTokenExpiration && user.resetTokenExpiration < new Date()) {
//       res.status(200).json({
//         valid: false,
//         error: "Token wygasł",
//       });
//       return;
//     }

//     res.json({
//       valid: true,
//       email: user.email,
//       expiresAt: user.resetTokenExpiration,
//     });
//   } catch (error: any) {
//     console.error("❌ Error in validateResetToken:", error.message);
//     res.status(500).json({
//       valid: false,
//       error: "Błąd walidacji tokena",
//     });
//   }
// };

// // export const resetPassword = async (
// //   req: Request,
// //   res: Response,
// // ): Promise<void> => {

// //   const { token, newPassword } = req.body;

// //   const user = await User.findOne({
// //     resetToken: token,
// //     resetTokenExpiration: { $gt: new Date() },
// //   });
// //   if (!user) {
// //     res.status(400).json({ error: "Token invalid or expired" });
// //     return;
// //   }

// //   user.password = newPassword;
// //   user.resetToken = undefined;
// //   user.resetTokenExpiration = undefined;
// //   await user.save();

// //   res.json({ success: true, message: "Hasło zostało zmienione" });
// // };

// export const changeEmail = async (
//   req: Request,
//   res: Response,
// ): Promise<void> => {
//   const { newEmail } = req.body;

//   const user = req.user; // z authMiddleware
//   if (!user) {
//     res.status(401).json({ error: "Unauthorized" });
//     return;
//   }

//   user.email = newEmail;
//   await user.save();

//   res.json({ success: true, message: "E-mail został zmieniony" });
// };
