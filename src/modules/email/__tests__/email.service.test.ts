/// <reference types="jest" />

import jwt from "jsonwebtoken";
import { Resend } from "resend";
import { env } from "../../../config/env";
import { EmailService, isEmailVerificationToken } from "../email.service";

const mockSend = jest.fn();

jest.mock("jsonwebtoken", () => ({
  __esModule: true,
  default: {
    sign: jest.fn(),
  },
}));

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: mockSend,
    },
  })),
}));

const mockedJwt = jest.mocked(jwt);
const mockedResend = jest.mocked(Resend);

describe("EmailService", () => {
  beforeEach(() => {
    env.baseUrl = "https://api.example.com";
    env.emailFrom = "Shortner <noreply@example.com>";
    env.jwtSecret = "test-secret";
    env.emailVerificationExpires = "1d";
    env.resendApiKey = "re_test";
    mockedJwt.sign.mockReturnValue("email-token" as never);
  });

  it("sends a verification email with signed token and idempotency key", async () => {
    mockSend.mockResolvedValue({ data: { id: "email-1" }, error: null });

    const messageId = await new EmailService().sendVerificationEmail({
      userId: "user-1",
      username: "Ti <Admin>",
      email: "ti@example.com",
      jobId: "job-1",
    });

    expect(messageId).toBe("email-1");
    expect(mockedResend).toHaveBeenCalledWith("re_test");
    expect(mockedJwt.sign).toHaveBeenCalledWith(
      {
        userId: "user-1",
        email: "ti@example.com",
        purpose: "email-verification",
      },
      "test-secret",
      { expiresIn: "1d" },
    );
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Shortner <noreply@example.com>",
        to: ["ti@example.com"],
        subject: "Valide seu e-mail",
        html: expect.stringContaining("Ti &lt;Admin&gt;"),
        text: expect.stringContaining("https://api.example.com/auth/verify-email?token=email-token"),
      }),
      {
        idempotencyKey: "verify-email/job-1",
      },
    );
  });

  it("throws when Resend returns an error", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: "provider unavailable" },
    });

    await expect(
      new EmailService().sendVerificationEmail({
        userId: "user-1",
        username: "Ti",
        email: "ti@example.com",
        jobId: "job-1",
      }),
    ).rejects.toThrow("provider unavailable");
  });

  it("throws before sending when required email configuration is missing", async () => {
    env.emailFrom = undefined as unknown as string;

    await expect(
      new EmailService().sendVerificationEmail({
        userId: "user-1",
        username: "Ti",
        email: "ti@example.com",
        jobId: "job-1",
      }),
    ).rejects.toThrow("EMAIL_FROM is not configured");

    expect(mockSend).not.toHaveBeenCalled();
  });

  it("sends a URL limit alert email with idempotency key", async () => {
    mockSend.mockResolvedValue({ data: { id: "email-2" }, error: null });

    const messageId = await new EmailService().sendUrlLimitAlertEmail({
      to: "alerts@example.com",
      threshold: 100,
      urlCount: 123,
      jobId: "job-2",
    });

    expect(messageId).toBe("email-2");
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Shortner <noreply@example.com>",
        to: ["alerts@example.com"],
        subject: "Alerta de limite de URLs: 100",
        html: expect.stringContaining("123 URLs cadastradas"),
        text: expect.stringContaining("Limite monitorado: 100 URLs"),
      }),
      {
        idempotencyKey: "url-limit-alert/job-2",
      },
    );
  });
});

describe("isEmailVerificationToken", () => {
  it("accepts payloads generated for email verification", () => {
    expect(
      isEmailVerificationToken({
        userId: "user-1",
        email: "ti@example.com",
        purpose: "email-verification",
      }),
    ).toBe(true);
  });

  it("rejects payloads with a different purpose or invalid shape", () => {
    expect(
      isEmailVerificationToken({
        userId: "user-1",
        email: "ti@example.com",
        purpose: "access-token",
      }),
    ).toBe(false);
    expect(isEmailVerificationToken(null)).toBe(false);
  });
});
