import { Router } from "express";
import { AuthController } from "./auth.controller";
import rateLimit from "express-rate-limit";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();
const controller = new AuthController();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: "Too many login attempts" },
});
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: "Too many register attempts" },
});

router.get("/test", (req, res) => {
    res.send('OK');
});

router.post("/register", registerLimiter, controller.register);
router.post("/login", loginLimiter, controller.login);
router.get("/verify-email", controller.verifyEmail);
router.post("/logout", authMiddleware, controller.logout);
router.patch("/password", authMiddleware, controller.changePassword);

export default router;
