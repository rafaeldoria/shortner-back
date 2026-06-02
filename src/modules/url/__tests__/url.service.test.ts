/// <reference types="jest" />

import { nanoid } from "nanoid";
import { UrlModel } from "../url.model";
import { UrlService, UrlServiceError } from "../url.service";

jest.mock("nanoid", () => ({
  nanoid: jest.fn(),
}));

jest.mock("../url.model", () => ({
  UrlModel: {
    countDocuments: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
    deleteOne: jest.fn(),
  },
}));

const mockedNanoid = jest.mocked(nanoid);
const mockedUrlModel = jest.mocked(UrlModel);

describe("UrlService", () => {
  const service = new UrlService();

  describe("create", () => {
    it("creates a short URL with a generated code and normalized original URL", async () => {
      const createdUrl = {
        code: "abc1234",
        originalUrl: "https://example.com/path",
        clicks: 0,
        userId: "user-1",
      };
      mockedUrlModel.countDocuments.mockResolvedValue(0);
      mockedNanoid.mockReturnValue("abc1234");
      mockedUrlModel.create.mockResolvedValue(createdUrl as never);

      await expect(
        service.create("  https://example.com/path  ", "user-1"),
      ).resolves.toBe(createdUrl);

      expect(mockedUrlModel.countDocuments).toHaveBeenCalledWith({ userId: "user-1" });
      expect(mockedNanoid).toHaveBeenCalledWith(7);
      expect(mockedUrlModel.create).toHaveBeenCalledWith({
        code: "abc1234",
        originalUrl: "https://example.com/path",
        clicks: 0,
        userId: "user-1",
      });
    });

    it("rejects when the user has already reached the URL limit", async () => {
      mockedUrlModel.countDocuments.mockResolvedValue(5);

      await expect(
        service.create("https://example.com", "user-1"),
      ).rejects.toMatchObject({
        message: "You have reached the maximum of 5 URLs",
        statusCode: 400,
      });

      expect(mockedUrlModel.create).not.toHaveBeenCalled();
    });

    it("rejects empty original URLs", async () => {
      mockedUrlModel.countDocuments.mockResolvedValue(0);

      await expect(service.create("   ", "user-1")).rejects.toMatchObject({
        message: "originalUrl is required",
        statusCode: 400,
      });
    });

    it("rejects URLs with unsupported protocols", async () => {
      mockedUrlModel.countDocuments.mockResolvedValue(0);

      await expect(
        service.create("ftp://example.com/file", "user-1"),
      ).rejects.toMatchObject({
        message: "originalUrl must be a valid http or https URL",
        statusCode: 400,
      });
    });
  });

  describe("findByUser", () => {
    it("returns user URLs sorted by creation date descending", async () => {
      const urls = [{ code: "abc1234", originalUrl: "https://example.com", clicks: 3 }];
      const lean = jest.fn().mockResolvedValue(urls);
      const sort = jest.fn().mockReturnValue({ lean });
      mockedUrlModel.find.mockReturnValue({ sort } as never);

      await expect(service.findByUser("user-1")).resolves.toEqual(urls);

      expect(mockedUrlModel.find).toHaveBeenCalledWith(
        { userId: "user-1" },
        "code originalUrl clicks createdAt -_id",
      );
      expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(lean).toHaveBeenCalledTimes(1);
    });

    it("returns zero clicks for existing URLs without a clicks field", async () => {
      const lean = jest.fn().mockResolvedValue([
        { code: "abc1234", originalUrl: "https://example.com" },
      ]);
      const sort = jest.fn().mockReturnValue({ lean });
      mockedUrlModel.find.mockReturnValue({ sort } as never);

      await expect(service.findByUser("user-1")).resolves.toEqual([
        { code: "abc1234", originalUrl: "https://example.com", clicks: 0 },
      ]);
    });
  });

  describe("update", () => {
    it("updates an existing user URL and returns the projected document", async () => {
      const updatedUrl = {
        code: "abc1234",
        originalUrl: "https://new.example.com",
        clicks: 7,
      };
      const lean = jest.fn().mockResolvedValue(updatedUrl);
      mockedUrlModel.findOneAndUpdate.mockReturnValue({ lean } as never);

      await expect(
        service.update("abc1234", "https://new.example.com", "user-1"),
      ).resolves.toEqual(updatedUrl);

      expect(mockedUrlModel.findOneAndUpdate).toHaveBeenCalledWith(
        { code: "abc1234", userId: "user-1" },
        { $set: { originalUrl: "https://new.example.com" } },
        {
          returnDocument: "after",
          runValidators: true,
          projection: "code originalUrl clicks createdAt -_id",
        },
      );
    });

    it("returns zero clicks when updating an existing URL without a clicks field", async () => {
      const lean = jest.fn().mockResolvedValue({
        code: "abc1234",
        originalUrl: "https://new.example.com",
      });
      mockedUrlModel.findOneAndUpdate.mockReturnValue({ lean } as never);

      await expect(
        service.update("abc1234", "https://new.example.com", "user-1"),
      ).resolves.toEqual({
        code: "abc1234",
        originalUrl: "https://new.example.com",
        clicks: 0,
      });
    });

    it("rejects when the URL does not belong to the user or does not exist", async () => {
      const lean = jest.fn().mockResolvedValue(null);
      mockedUrlModel.findOneAndUpdate.mockReturnValue({ lean } as never);

      await expect(
        service.update("abc1234", "https://example.com", "user-1"),
      ).rejects.toMatchObject({
        message: "URL not found",
        statusCode: 404,
      });
    });
  });

  describe("delete", () => {
    it("deletes the URL owned by the user", async () => {
      mockedUrlModel.deleteOne.mockResolvedValue({ deletedCount: 1 } as never);

      await expect(service.delete("abc1234", "user-1")).resolves.toBeUndefined();

      expect(mockedUrlModel.deleteOne).toHaveBeenCalledWith({
        code: "abc1234",
        userId: "user-1",
      });
    });

    it("rejects when no URL was deleted", async () => {
      mockedUrlModel.deleteOne.mockResolvedValue({ deletedCount: 0 } as never);

      await expect(service.delete("abc1234", "user-1")).rejects.toMatchObject({
        message: "URL not found",
        statusCode: 404,
      });
    });
  });
});
