// src/utils/mailgunClient.ts
import Mailgun from "mailgun.js";
import formData from "form-data";
const mailgun = new Mailgun(formData);
export const mg = mailgun.client({
    username: "api",
    key: process.env.MAILGUN_API_KEY,
    url: "https://api.mailgun.net",
});
console.log("Mailgun client initialized with EU endpoint");
