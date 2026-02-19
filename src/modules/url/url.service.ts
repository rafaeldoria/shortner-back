import { nanoid } from "nanoid";
import { UrlModel } from "./url.model";

export class UrlService {

  async create(originalUrl: string, userId: string) {
    const code = nanoid(7);

    const url = await UrlModel.create({
      code,
      originalUrl,
      userId,
    });

    return url;
  }

  async findByUser(userId: string) {
    return UrlModel
      .find({ userId }, 'code originalUrl createdAt -_id')
      .sort({ createdAt: -1 })
      .lean()
  }
}
