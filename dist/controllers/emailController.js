import { mg } from "../utils/mailgunClient.js";
export const sendMail = async (req, res) => {
    try {
        const { to, subject, text } = req.body;
        if (!to || !subject || !text) {
            res.status(400).json({ error: "Missing required fields" });
            return;
        }
        const data = await mg.messages.create(process.env.MAILGUN_DOMAIN, {
            from: "Mailgun Sandbox <postmaster@sandbox8ab4b9ccf4124222a10d8734f869e739.mailgun.org>",
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
