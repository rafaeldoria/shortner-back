import net from "node:net";
import { nanoid } from "nanoid";
import { UrlModel } from "./url.model";

const SYSTEM_URL_LIMIT = 150;
const USER_URL_LIMIT = 5;
const MAX_URL_LENGTH = 2048;
const MAX_CODE_RETRIES = 3;

export class UrlServiceError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = "UrlServiceError";
  }
}

function stripIpv6Brackets(hostname: string) {
  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
}

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map((part) => Number(part));

  if (
    parts.length !== 4
    || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  const a = parts[0] as number;
  const b = parts[1] as number;

  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 192 && b === 0)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224;
}

function mappedIpv4FromIpv6(hostname: string) {
  const prefix = "::ffff:";

  if (!hostname.startsWith(prefix)) {
    return "";
  }

  const mapped = hostname.slice(prefix.length);

  if (mapped.includes(".")) {
    return mapped;
  }

  const segments = mapped.split(":");

  if (segments.length !== 2) {
    return "";
  }

  const high = Number.parseInt(segments[0] as string, 16);
  const low = Number.parseInt(segments[1] as string, 16);

  if (!Number.isInteger(high) || !Number.isInteger(low)) {
    return "";
  }

  return [
    (high >> 8) & 255,
    high & 255,
    (low >> 8) & 255,
    low & 255,
  ].join(".");
}

function isPrivateIpv6(hostname: string) {
  const normalized = hostname.toLowerCase();
  const mappedIpv4 = mappedIpv4FromIpv6(normalized);

  return normalized === "::"
    || normalized === "::1"
    || normalized.startsWith("fc")
    || normalized.startsWith("fd")
    || normalized.startsWith("fe8")
    || normalized.startsWith("fe9")
    || normalized.startsWith("fea")
    || normalized.startsWith("feb")
    || normalized.startsWith("ff")
    || normalized.startsWith("2001:db8")
    || Boolean(mappedIpv4 && isPrivateIpv4(mappedIpv4));
}

function isBlockedHostname(hostname: string) {
  const normalized = stripIpv6Brackets(hostname.toLowerCase());

  if (
    normalized === "localhost"
    || normalized.endsWith(".localhost")
    || normalized.endsWith(".local")
    || normalized.endsWith(".internal")
  ) {
    return true;
  }

  const ipVersion = net.isIP(normalized);

  if (ipVersion === 4) {
    return isPrivateIpv4(normalized);
  }

  if (ipVersion === 6) {
    return isPrivateIpv6(normalized);
  }

  return false;
}

function isDuplicateKeyError(error: unknown) {
  return Boolean(
    error
    && typeof error === "object"
    && "code" in error
    && error.code === 11000
  );
}

function normalizeOriginalUrl(originalUrl: unknown) {
  if (typeof originalUrl !== "string") {
    throw new UrlServiceError("originalUrl is required");
  }

  const trimmedUrl = originalUrl.trim();

  if (!trimmedUrl) {
    throw new UrlServiceError("originalUrl is required");
  }

  if (trimmedUrl.length > MAX_URL_LENGTH) {
    throw new UrlServiceError("originalUrl is too long");
  }

  try {
    const url = new URL(trimmedUrl);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Unsupported protocol");
    }

    if (url.username || url.password) {
      throw new Error("Embedded credentials are not allowed");
    }

    if (isBlockedHostname(url.hostname)) {
      throw new Error("Blocked hostname");
    }

    return trimmedUrl;
  } catch {
    throw new UrlServiceError("originalUrl must be a valid public http or https URL");
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
    const totalCount = await UrlModel.countDocuments({});

    if (totalCount >= SYSTEM_URL_LIMIT) {
      throw new UrlServiceError("System URL limit reached", 403);
    }

    const count = await UrlModel.countDocuments({ userId });

    if (count >= USER_URL_LIMIT) {
      throw new UrlServiceError("You have reached the maximum of 5 URLs");
    }

    const normalizedOriginalUrl = normalizeOriginalUrl(originalUrl);

    for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt += 1) {
      const code = nanoid(7);

      try {
        const url = await UrlModel.create({
          code,
          originalUrl: normalizedOriginalUrl,
          clicks: 0,
          userId,
        });

        const [newTotalCount, newUserCount] = await Promise.all([
          UrlModel.countDocuments({}),
          UrlModel.countDocuments({ userId }),
        ]);

        if (newTotalCount > SYSTEM_URL_LIMIT || newUserCount > USER_URL_LIMIT) {
          await UrlModel.deleteOne({ _id: url._id });
          throw new UrlServiceError(
            newTotalCount > SYSTEM_URL_LIMIT
              ? "System URL limit reached"
              : "You have reached the maximum of 5 URLs",
            newTotalCount > SYSTEM_URL_LIMIT ? 403 : 400,
          );
        }

        return url;
      } catch (error) {
        if (!isDuplicateKeyError(error) || attempt === MAX_CODE_RETRIES - 1) {
          throw error;
        }
      }
    }

    throw new UrlServiceError("Unable to create short URL", 500);
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
