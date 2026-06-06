import express from "express";
import authRoutes from "./modules/auth/auth.routes";
import urlRoutes from "./modules/url/url.routes";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env";

const DEFAULT_CORS_ORIGINS = [
  "http://localhost:5173",
  "https://shortener.it-rod.com",
  "https://urlshortener.it-rod.com",
];

function getAllowedOrigins() {
  if (!env.corsOrigins) {
    return DEFAULT_CORS_ORIGINS;
  }

  return env.corsOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const app = express();
app.set("trust proxy", 1);

app.use(helmet());

app.use(cors({
  origin(origin, callback) {
    if (!origin || getAllowedOrigins().includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Not allowed by CORS"));
  },
  credentials: true
}));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200, // 200 requisições por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests" },
});

app.use(globalLimiter);
app.use(express.json({ limit: "10kb" }));

app.use("/auth", authRoutes);
app.use("/url", urlRoutes);

export default app;
