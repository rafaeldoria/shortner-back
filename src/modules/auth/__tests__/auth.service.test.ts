/// <reference types="jest" />

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../../../config/env";
import { EmailJobModel } from "../../email/email-job.model";
import { AuthService, AuthServiceError } from "../auth.service";
import { UserModel } from "../auth.model";

jest.mock("bcrypt", () => ({
  __esModule: true,
  default: {
    hash: jest.fn(),
    compare: jest.fn(),
  },
}));

jest.mock("jsonwebtoken", () => ({
  __esModule: true,
  default: {
    sign: jest.fn(),
    verify: jest.fn(),
  },
}));

jest.mock("../auth.model", () => ({
  UserModel: {
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock("../../email/email-job.model", () => ({
  EmailJobModel: {
    create: jest.fn(),
  },
}));

const mockedBcrypt = jest.mocked(bcrypt);
const mockedJwt = jest.mocked(jwt);
const mockedUserModel = jest.mocked(UserModel);
const mockedEmailJobModel = jest.mocked(EmailJobModel);

describe("AuthService", () => {
  const service = new AuthService();

  beforeEach(() => {
    jest.resetAllMocks();
    env.jwtSecret = "test-secret";
    env.jwtExpires = "1h";
  });

  describe("register", () => {
    it("creates a user with a hashed password and queues email verification", async () => {
      const createdAt = new Date("2026-01-01T00:00:00.000Z");
      mockedUserModel.findOne.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue("hashed-password" as never);
      mockedUserModel.create.mockResolvedValue({
        _id: "user-1",
        username: "tir",
        email: "ti@example.com",
        createdAt,
      } as never);
      mockedEmailJobModel.create.mockResolvedValue({ _id: "job-1" } as never);

      await expect(
        service.register({
          username: "tir",
          email: "ti@example.com",
          password: "StrongPass1!",
        }),
      ).resolves.toEqual({
        id: "user-1",
        username: "tir",
        email: "ti@example.com",
        createdAt,
      });

      expect(mockedUserModel.findOne).toHaveBeenCalledWith({
        $or: [{ username: "tir" }, { email: "ti@example.com" }],
      });
      expect(mockedBcrypt.hash).toHaveBeenCalledWith("StrongPass1!", 10);
      expect(mockedUserModel.create).toHaveBeenCalledWith({
        username: "tir",
        email: "ti@example.com",
        password: "hashed-password",
      });
      expect(mockedEmailJobModel.create).toHaveBeenCalledWith({
        type: "verify-email",
        userId: "user-1",
        to: "ti@example.com",
      });
    });

    it("rejects missing required fields", async () => {
      await expect(
        service.register({ username: "", email: "ti@example.com", password: "StrongPass1!" }),
      ).rejects.toMatchObject({
        message: "Missing required fields",
        statusCode: 400,
      });

      expect(mockedUserModel.findOne).not.toHaveBeenCalled();
    });

    it("rejects weak passwords", async () => {
      await expect(
        service.register({ username: "tir", email: "ti@example.com", password: "123456" }),
      ).rejects.toMatchObject({
        message: "Password is not valid.",
        statusCode: 400,
      });
    });

    it("rejects duplicated username or email", async () => {
      mockedUserModel.findOne.mockResolvedValue({ _id: "existing-user" } as never);

      await expect(
        service.register({
          username: "tir",
          email: "ti@example.com",
          password: "StrongPass1!",
        }),
      ).rejects.toMatchObject({
        message: "Unable to create account with these details",
        statusCode: 400,
      });

      expect(mockedBcrypt.hash).not.toHaveBeenCalled();
      expect(mockedEmailJobModel.create).not.toHaveBeenCalled();
    });
  });

  describe("login", () => {
    it("returns a JWT token when credentials are valid and email is verified", async () => {
      mockedUserModel.findOne.mockResolvedValue({
        _id: "user-1",
        username: "ti",
        password: "hashed-password",
        emailVerified: true,
      } as never);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockedJwt.sign.mockReturnValue("signed-token" as never);

      await expect(
        service.login({ login: "ti@example.com", password: "StrongPass1!" }),
      ).resolves.toEqual({
        token: "signed-token",
        username: "ti",
      });

      expect(mockedUserModel.findOne).toHaveBeenCalledWith({
        $or: [{ email: "ti@example.com" }, { username: "ti@example.com" }],
      });
      expect(mockedBcrypt.compare).toHaveBeenCalledWith("StrongPass1!", "hashed-password");
      expect(mockedJwt.sign).toHaveBeenCalledWith(
        { userId: "user-1" },
        "test-secret",
        { algorithm: "HS256", expiresIn: "1h" },
      );
    });

    it("rejects invalid credentials when the user does not exist", async () => {
      mockedUserModel.findOne.mockResolvedValue(null);

      await expect(
        service.login({ login: "missing@example.com", password: "StrongPass1!" }),
      ).rejects.toMatchObject({
        message: "Invalid credentials",
        statusCode: 401,
      });

      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    it("rejects invalid credentials when the password does not match", async () => {
      mockedUserModel.findOne.mockResolvedValue({
        password: "hashed-password",
      } as never);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(
        service.login({ login: "ti", password: "WrongPass1!" }),
      ).rejects.toMatchObject({
        message: "Invalid credentials",
        statusCode: 401,
      });
    });

    it("rejects login when email has not been verified", async () => {
      mockedUserModel.findOne.mockResolvedValue({
        password: "hashed-password",
        emailVerified: false,
      } as never);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      await expect(
        service.login({ login: "ti", password: "StrongPass1!" }),
      ).rejects.toMatchObject({
        message: "Please verify your email before logging in",
        statusCode: 403,
      });

      expect(mockedJwt.sign).not.toHaveBeenCalled();
    });
  });

  describe("changePassword", () => {
    it("updates the password when the current password is valid", async () => {
      const user = {
        password: "current-hash",
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockedUserModel.findById.mockResolvedValue(user as never);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockedBcrypt.hash.mockResolvedValue("new-hash" as never);

      await expect(
        service.changePassword("user-1", {
          currentPassword: "Current123!",
          newPassword: "Newpass123!",
        }),
      ).resolves.toEqual({
        message: "Password updated successfully",
      });

      expect(user.password).toBe("new-hash");
      expect(user.save).toHaveBeenCalledTimes(1);
    });

    it("rejects when new password is equal to the current password", async () => {
      await expect(
        service.changePassword("user-1", {
          currentPassword: "Samepass123!",
          newPassword: "Samepass123!",
        }),
      ).rejects.toMatchObject({
        message: "New password must be different from current password",
        statusCode: 400,
      });

      expect(mockedUserModel.findById).not.toHaveBeenCalled();
    });

    it("rejects new passwords shorter than 8 characters", async () => {
      await expect(
        service.changePassword("user-1", {
          currentPassword: "Current123!",
          newPassword: "Abc123.",
        }),
      ).rejects.toMatchObject({
        message: "Password is not valid.",
        statusCode: 400,
      });

      expect(mockedUserModel.findById).not.toHaveBeenCalled();
    });

    it("rejects new passwords with leading or trailing whitespace", async () => {
      await expect(
        service.changePassword("user-1", {
          currentPassword: "Current123!",
          newPassword: "Abc123. ",
        }),
      ).rejects.toMatchObject({
        message: "Password is not valid.",
        statusCode: 400,
      });

      expect(mockedUserModel.findById).not.toHaveBeenCalled();
    });

    it("rejects when current password comparison fails", async () => {
      mockedUserModel.findById.mockResolvedValue({ password: "current-hash" } as never);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(
        service.changePassword("user-1", {
          currentPassword: "Current123!",
          newPassword: "Newpass123!",
        }),
      ).rejects.toMatchObject({
        message: "Invalid credentials",
        statusCode: 401,
      });
    });
  });

  describe("verifyEmail", () => {
    it("marks the user email as verified when token payload is valid", async () => {
      const user = {
        emailVerified: false,
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockedJwt.verify.mockReturnValue({
        userId: "user-1",
        email: "ti@example.com",
        purpose: "email-verification",
      } as never);
      mockedUserModel.findOne.mockResolvedValue(user as never);

      await expect(service.verifyEmail("token")).resolves.toEqual({
        message: "Email verified successfully",
      });

      expect(mockedUserModel.findOne).toHaveBeenCalledWith({
        _id: "user-1",
        email: "ti@example.com",
      });
      expect(user.emailVerified).toBe(true);
      expect(user.save).toHaveBeenCalledTimes(1);
    });

    it("rejects invalid or expired tokens", async () => {
      mockedJwt.verify.mockImplementation(() => {
        throw new Error("expired");
      });

      await expect(service.verifyEmail("token")).rejects.toMatchObject({
        message: "Invalid or expired verification link",
        statusCode: 400,
      });
    });

    it("rejects token payloads with a wrong purpose", async () => {
      mockedJwt.verify.mockReturnValue({
        userId: "user-1",
        email: "ti@example.com",
        purpose: "access-token",
      } as never);

      await expect(service.verifyEmail("token")).rejects.toMatchObject({
        message: "Invalid verification link",
        statusCode: 400,
      });
    });
  });
});
