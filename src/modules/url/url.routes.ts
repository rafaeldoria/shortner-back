import { Router } from "express";
import { UrlController } from "./url.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();
const controller = new UrlController();

router.post("/", authMiddleware, controller.create);
router.get("/", authMiddleware, controller.list);

export default router;
