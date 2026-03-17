import express from "express";
import authRoutes from "./modules/auth/auth.routes";
import urlRoutes from "./modules/url/url.routes";
import rateLimit from "express-rate-limit";

var cors = require('cors');

const app = express();

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://shortner.it-rod.com",
    "https://urlshortner.it-rod.com"
  ],
  credentials: true
}));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200, // 200 requisições por IP
});

app.use(globalLimiter);
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/url", urlRoutes);

export default app;
