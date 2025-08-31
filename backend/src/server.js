// server.js (Refactored)
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middleware ---
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  methods: "GET,POST,PUT,DELETE,OPTIONS",
  allowedHeaders: "Content-Type,Authorization,X-Page-Access-Token",
};
app.use(cors(corsOptions));
app.use(bodyParser.json());

// --- Routes ---
const authRoutes = require("./routes/auth.routes");
const metaRoutes = require("./routes/meta.routes");

// Gắn các router vào ứng dụng
app.use("/auth", authRoutes);
app.use("/meta", metaRoutes);

// --- Khởi động Server ---
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
