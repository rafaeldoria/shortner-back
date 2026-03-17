import { nanoid } from "nanoid";
import { UrlModel } from "./url.model";

export class UrlService {

  async create(originalUrl: string, userId: string) {
    const count = await UrlModel.countDocuments({ userId });

    if (count >= 5) {
      throw new Error("You have reached the maximum of 5 URLs");
    }

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
