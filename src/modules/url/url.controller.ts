import { Response } from "express";
import { UrlService, UrlServiceError } from "./url.service";
import { AuthRequest } from "../../middleware/auth.middleware";
import { env } from "../../config/env";

const urlService = new UrlService();

function getErrorResponse(error: unknown) {
  if (error instanceof UrlServiceError) {
    return {
      statusCode: error.statusCode,
      message: error.message,
    };
  }

  if (error instanceof Error) {
    return {
      statusCode: 400,
      message: error.message,
    };
  }

  return {
    statusCode: 400,
    message: "Unexpected error",
  };
}

export class UrlController {

  async create(req: AuthRequest, res: Response) {
    try {
        const { originalUrl } = req.body;

        const url = await urlService.create(originalUrl, req.userId as string);

        return res.status(201).json({
            code: url.code,
            shortUrl: `${env.baseUrl}/${url.code}`,
        });

    } catch (error: unknown) {
        const { statusCode, message } = getErrorResponse(error);
        return res.status(statusCode).json({ message });
    }
  }



  async list(req: AuthRequest, res: Response) {
    try {
      const urls = await urlService.findByUser(req.userId as string);

      return res.status(200).json(urls);
    } catch (error: unknown) {
        const { statusCode, message } = getErrorResponse(error);
        return res.status(statusCode).json({ message })
    }
  }

  async update(req: AuthRequest, res: Response) {
    try {
      const { code } = req.params;
      const { originalUrl } = req.body;

      if (typeof code !== "string" || !code) {
        return res.status(400).json({ message: "code is required" });
      }

      const url = await urlService.update(
        code,
        originalUrl,
        req.userId as string,
      );

      return res.status(200).json(url);
    } catch (error: unknown) {
      const { statusCode, message } = getErrorResponse(error);
      return res.status(statusCode).json({ message });
    }
  }

  async delete(req: AuthRequest, res: Response) {
    try {
      const { code } = req.params;

      if (typeof code !== "string" || !code) {
        return res.status(400).json({ message: "code is required" });
      }

      await urlService.delete(code, req.userId as string);

      return res.status(204).send();
    } catch (error: unknown) {
      const { statusCode, message } = getErrorResponse(error);
      return res.status(statusCode).json({ message });
    }
  }
}
