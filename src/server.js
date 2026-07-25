require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const connectDB = require("./utils/db");

const testimonialRoutes = require("./routes/testimonials");
const widgetRoutes = require("./routes/widget");

const app = express();

// CORS must be first — before everything
app.use((req, res, next) => {
  const origin = (req.headers.origin || '').replace(/\/$/, '');
  const allowed = [
    'https://advocacy-testimonials-frontend.vercel.app',
    'http://localhost:5173',
  ];
  if (allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});
app.use(express.json({ limit: "10mb" }));

// Connect to MongoDB
const connectOnce = connectDB();

app.use(async (req, res, next) => {
  try {
    await connectOnce;
    next();
  } catch (err) {
    console.error("DB connection failed:", err.message);
    res.status(503).json({ success: false, message: "Database unavailable" });
  }
});

app.use("/api/testimonials", testimonialRoutes);
app.use("/api/widget", widgetRoutes);

app.get("/", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

module.exports = app;
