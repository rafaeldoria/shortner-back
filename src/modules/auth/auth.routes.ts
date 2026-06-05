import { Router } from "express";
import { AuthController } from "./auth.controller";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();
const controller = new AuthController();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const login = typeof req.body?.login === "string"
      ? req.body.login.trim().toLowerCase().slice(0, 128)
      : "unknown";

    return `${ipKeyGenerator(req.ip || "")}:${login}`;
  },
  message: { message: "Too many login attempts" },
});
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many register attempts" },
});
const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many password change attempts" },
});
const verifyEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many verification attempts" },
});

router.get("/test", (req, res) => {
    res.send('OK');
});

router.post("/register", registerLimiter, controller.register);
router.post("/login", loginLimiter, controller.login);
router.get("/verify-email", verifyEmailLimiter, controller.verifyEmail);
router.post("/logout", authMiddleware, controller.logout);
router.patch("/password", authMiddleware, passwordLimiter, controller.changePassword);

export default router;
