import { nanoid } from "nanoid";
import { UrlModel } from "./url.model";

export class UrlServiceError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = "UrlServiceError";
  }
}

function normalizeOriginalUrl(originalUrl: unknown) {
  if (typeof originalUrl !== "string") {
    throw new UrlServiceError("originalUrl is required");
  }

  const trimmedUrl = originalUrl.trim();

  if (!trimmedUrl) {
    throw new UrlServiceError("originalUrl is required");
  }

  try {
    const url = new URL(trimmedUrl);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Unsupported protocol");
    }

    return trimmedUrl;
  } catch {
    throw new UrlServiceError("originalUrl must be a valid http or https URL");
  }
}

function withClicks<T extends { clicks?: number }>(url: T) {
  return {
    ...url,
    clicks: url.clicks ?? 0,
  };
}

export class UrlService {

  async create(originalUrl: unknown, userId: string) {
    const count = await UrlModel.countDocuments({ userId });

    if (count >= 5) {
      throw new UrlServiceError("You have reached the maximum of 5 URLs");
    }

    const code = nanoid(7);
    const normalizedOriginalUrl = normalizeOriginalUrl(originalUrl);

    const url = await UrlModel.create({
      code,
      originalUrl: normalizedOriginalUrl,
      clicks: 0,
      userId,
    });

    return url;
  }

  async findByUser(userId: string) {
    const urls = await UrlModel
      .find({ userId }, 'code originalUrl clicks createdAt -_id')
      .sort({ createdAt: -1 })
      .lean()

    return urls.map(withClicks);
  }

  async update(code: string, originalUrl: unknown, userId: string) {
    const normalizedOriginalUrl = normalizeOriginalUrl(originalUrl);

    const url = await UrlModel.findOneAndUpdate(
      { code, userId },
      { $set: { originalUrl: normalizedOriginalUrl } },
      {
        returnDocument: "after",
        runValidators: true,
        projection: "code originalUrl clicks createdAt -_id",
      },
    ).lean();

    if (!url) {
      throw new UrlServiceError("URL not found", 404);
    }

    return withClicks(url);
  }

  async delete(code: string, userId: string) {
    const result = await UrlModel.deleteOne({ code, userId });

    if (result.deletedCount === 0) {
      throw new UrlServiceError("URL not found", 404);
    }
  }
}
