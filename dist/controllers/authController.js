import crypto from "crypto";
import User from "../models/user.js";
import { mg } from "../utils/mailgunClient.js";
export const requestPasswordReset = async (req, res) => {
    const { email } = req.body;
    console.log("Request password reset for email:", email);
    const user = await User.findOne({ email });
    if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
    }
    console.log("Found user for password reset:", user);
    // Tworzymy token i zapisujemy w DB z expires
    const token = crypto.randomBytes(32).toString("hex");
    user.resetToken = token;
    user.resetTokenExpiration = new Date(Date.now() + 3600000); // 1h
    await user.save();
    console.log("Generated reset token:", token);
    // Wysyłamy maila
    const resetLink = `http://localhost:5173/reset-password/${token}`;
    await mg.messages.create(process.env.MAILGUN_DOMAIN, {
        from: `Kurs MT <no-reply@${process.env.MAILGUN_DOMAIN}>`,
        to: email,
        subject: "Reset hasła",
        text: `Kliknij w link, aby zresetować hasło: ${resetLink}`,
    });
    res.json({ success: true, message: "Link do resetu wysłany" });
};
export const resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;
    const user = await User.findOne({
        resetToken: token,
        resetTokenExpiration: { $gt: new Date() },
    });
    if (!user) {
        res.status(400).json({ error: "Token invalid or expired" });
        return;
    }
    user.password = newPassword;
    user.resetToken = undefined;
    user.resetTokenExpiration = undefined;
    await user.save();
    res.json({ success: true, message: "Hasło zostało zmienione" });
};
export const changeEmail = async (req, res) => {
    const { newEmail } = req.body;
    const user = req.user; // z authMiddleware
    if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    user.email = newEmail;
    await user.save();
    res.json({ success: true, message: "E-mail został zmieniony" });
};
