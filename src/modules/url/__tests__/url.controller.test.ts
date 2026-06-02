/// <reference types="jest" />

import { Response } from "express";
import { AuthRequest } from "../../../middleware/auth.middleware";
import { env } from "../../../config/env";
import { UrlController } from "../url.controller";
import { UrlServiceError } from "../url.service";

jest.mock("../url.service", () => {
  const mockUrlService = {
    create: jest.fn(),
    findByUser: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  class UrlServiceError extends Error {
    constructor(message: string, public readonly statusCode = 400) {
      super(message);
      this.name = "UrlServiceError";
    }
  }

  return {
    __mockUrlService: mockUrlService,
    UrlService: jest.fn(() => mockUrlService),
    UrlServiceError,
  };
});

const { __mockUrlService: mockUrlService } = jest.requireMock("../url.service") as {
  __mockUrlService: {
    create: jest.Mock;
    findByUser: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
};

function makeResponse() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };

  return res as unknown as Response & typeof res;
}

describe("UrlController", () => {
  const controller = new UrlController();

  beforeEach(() => {
    env.baseUrl = "https://sho.rt";
  });

  describe("create", () => {
    it("responds with 201 and a public short URL", async () => {
      mockUrlService.create.mockResolvedValue({
        code: "abc1234",
        originalUrl: "https://example.com",
      });
      const req = {
        userId: "user-1",
        body: { originalUrl: "https://example.com" },
      } as AuthRequest;
      const res = makeResponse();

      await controller.create(req, res);

      expect(mockUrlService.create).toHaveBeenCalledWith("https://example.com", "user-1");
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        code: "abc1234",
        shortUrl: "https://sho.rt/abc1234",
      });
    });

    it("responds with service error status and message", async () => {
      mockUrlService.create.mockRejectedValue(
        new UrlServiceError("You have reached the maximum of 5 URLs", 400),
      );
      const req = {
        userId: "user-1",
        body: { originalUrl: "https://example.com" },
      } as AuthRequest;
      const res = makeResponse();

      await controller.create(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "You have reached the maximum of 5 URLs",
      });
    });
  });

  describe("list", () => {
    it("responds with URLs owned by the authenticated user", async () => {
      const urls = [{ code: "abc1234", originalUrl: "https://example.com" }];
      mockUrlService.findByUser.mockResolvedValue(urls);
      const req = { userId: "user-1" } as AuthRequest;
      const res = makeResponse();

      await controller.list(req, res);

      expect(mockUrlService.findByUser).toHaveBeenCalledWith("user-1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(urls);
    });
  });

  describe("update", () => {
    it("responds with updated URL data", async () => {
      const updatedUrl = {
        code: "abc1234",
        originalUrl: "https://new.example.com",
      };
      mockUrlService.update.mockResolvedValue(updatedUrl);
      const req = {
        userId: "user-1",
        params: { code: "abc1234" },
        body: { originalUrl: "https://new.example.com" },
      } as unknown as AuthRequest;
      const res = makeResponse();

      await controller.update(req, res);

      expect(mockUrlService.update).toHaveBeenCalledWith(
        "abc1234",
        "https://new.example.com",
        "user-1",
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(updatedUrl);
    });

    it("responds with 400 when code param is missing", async () => {
      const req = {
        userId: "user-1",
        params: {},
        body: { originalUrl: "https://new.example.com" },
      } as unknown as AuthRequest;
      const res = makeResponse();

      await controller.update(req, res);

      expect(mockUrlService.update).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "code is required" });
    });
  });

  describe("delete", () => {
    it("responds with 204 after deleting an URL", async () => {
      mockUrlService.delete.mockResolvedValue(undefined);
      const req = {
        userId: "user-1",
        params: { code: "abc1234" },
      } as unknown as AuthRequest;
      const res = makeResponse();

      await controller.delete(req, res);

      expect(mockUrlService.delete).toHaveBeenCalledWith("abc1234", "user-1");
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalledTimes(1);
    });

    it("responds with service error when delete fails", async () => {
      mockUrlService.delete.mockRejectedValue(new UrlServiceError("URL not found", 404));
      const req = {
        userId: "user-1",
        params: { code: "missing" },
      } as unknown as AuthRequest;
      const res = makeResponse();

      await controller.delete(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "URL not found" });
    });
  });
});
