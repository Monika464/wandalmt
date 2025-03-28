import express from "express"; 

import { connectDB } from "./db.js"; 

import dotenv from "dotenv";
dotenv.config();

connectDB();
const app = express();

app.use(express.json());
app.get("/", (req, res) => {
  res.send("Hello World!");
});
console.log("dzia");

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
