/// <reference types="jest" />

import { Request, Response } from "express";
import { AuthRequest } from "../../../middleware/auth.middleware";
import { env } from "../../../config/env";
import { AuthController } from "../auth.controller";
import { AuthServiceError } from "../auth.service";

jest.mock("../auth.service", () => {
  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    changePassword: jest.fn(),
    verifyEmail: jest.fn(),
  };

  class AuthServiceError extends Error {
    constructor(message: string, public readonly statusCode: number) {
      super(message);
    }
  }

  return {
    __mockAuthService: mockAuthService,
    AuthService: jest.fn(() => mockAuthService),
    AuthServiceError,
  };
});

const { __mockAuthService: mockAuthService } = jest.requireMock("../auth.service") as {
  __mockAuthService: {
    register: jest.Mock;
    login: jest.Mock;
    changePassword: jest.Mock;
    verifyEmail: jest.Mock;
  };
};

function makeResponse() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
  };

  return res as unknown as Response & typeof res;
}

describe("AuthController", () => {
  const controller = new AuthController();

  beforeEach(() => {
    env.frontendUrl = "https://app.example.com";
  });

  describe("register", () => {
    it("responds with 201 and created user data", async () => {
      const user = {
        id: "user-1",
        username: "ti",
        email: "ti@example.com",
      };
      mockAuthService.register.mockResolvedValue(user);
      const req = { body: { username: "ti" } } as Request;
      const res = makeResponse();

      await controller.register(req, res);

      expect(mockAuthService.register).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(user);
    });

    it("responds with service error status and message", async () => {
      mockAuthService.register.mockRejectedValue(
        new AuthServiceError("User already exists", 400),
      );
      const req = { body: { username: "ti" } } as Request;
      const res = makeResponse();

      await controller.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "User already exists" });
    });
  });

  describe("login", () => {
    it("responds with 200 and session data", async () => {
      mockAuthService.login.mockResolvedValue({
        token: "jwt-token",
        username: "ti",
      });
      const req = { body: { login: "ti", password: "Strong1!" } } as Request;
      const res = makeResponse();

      await controller.login(req, res);

      expect(mockAuthService.login).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        token: "jwt-token",
        username: "ti",
      });
    });

    it("responds with 401 for an empty body", async () => {
      const req = {} as Request;
      const res = makeResponse();

      await controller.login(req, res);

      expect(mockAuthService.login).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Empty body." });
    });
  });

  describe("changePassword", () => {
    it("passes authenticated user id to the service", async () => {
      mockAuthService.changePassword.mockResolvedValue({
        message: "Password updated successfully",
      });
      const req = {
        userId: "user-1",
        body: {
          currentPassword: "Current1!",
          newPassword: "Newpass1!",
        },
      } as AuthRequest;
      const res = makeResponse();

      await controller.changePassword(req, res);

      expect(mockAuthService.changePassword).toHaveBeenCalledWith("user-1", req.body);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Password updated successfully",
      });
    });
  });

  describe("verifyEmail", () => {
    it("redirects to frontend success URL when verification succeeds", async () => {
      mockAuthService.verifyEmail.mockResolvedValue({
        message: "Email verified successfully",
      });
      const req = { query: { token: "email-token" } } as unknown as Request;
      const res = makeResponse();

      await controller.verifyEmail(req, res);

      expect(mockAuthService.verifyEmail).toHaveBeenCalledWith("email-token");
      expect(res.redirect).toHaveBeenCalledWith("https://app.example.com/?verified=success");
    });

    it("redirects to frontend error URL when verification fails", async () => {
      mockAuthService.verifyEmail.mockRejectedValue(new Error("invalid token"));
      const req = { query: { token: "email-token" } } as unknown as Request;
      const res = makeResponse();

      await controller.verifyEmail(req, res);

      expect(res.redirect).toHaveBeenCalledWith("https://app.example.com/?verified=error");
    });
  });

  it("responds to logout with a success message", () => {
    const req = {} as AuthRequest;
    const res = makeResponse();

    controller.logout(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: "Logged out successfully" });
  });
});
