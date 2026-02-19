import { Router } from "express";
import { AuthController } from "./auth.controller";
import rateLimit from "express-rate-limit";

const router = Router();
const controller = new AuthController();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: "Too many login attempts" },
});

router.get("/test", (req, res) => {
    res.send('OK');
});

router.post("/register", controller.register);
router.post("/login", loginLimiter, controller.login);

export default router;