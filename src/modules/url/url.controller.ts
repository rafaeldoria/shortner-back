import { Response } from "express";
import { UrlService } from "./url.service";
import { AuthRequest } from "../../middleware/auth.middleware";
import { env } from "../../config/env";

const urlService = new UrlService();

export class UrlController {

  async create(req: AuthRequest, res: Response) {
    try {
        const { originalUrl } = req.body;

        if (!originalUrl) {
            return res.status(400).json({ message: "originalUrl is required" });
        }

        const url = await urlService.create(originalUrl, req.userId as string);

        return res.status(201).json({
            code: url.code,
            shortUrl: `${env.baseUrl}/${url.code}`,
        });

    } catch (error: any) {
        return res.status(400).json({ message: error.message });
    }
  }



  async list(req: AuthRequest, res: Response) {
    try {
      const urls = await urlService.findByUser(req.userId as string);

      return res.status(200).json(urls);
    } catch (error: any) {
        return res.status(400).json({ message: error.message })
    }
  }
}
