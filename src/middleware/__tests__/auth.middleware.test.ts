/// <reference types="jest" />

import jwt from "jsonwebtoken";
import { Response } from "express";
import { env } from "../../config/env";
import { AuthRequest, authMiddleware } from "../auth.middleware";

jest.mock("jsonwebtoken", () => ({
  __esModule: true,
  default: {
    verify: jest.fn(),
  },
}));

const mockedJwt = jest.mocked(jwt);

function makeResponse() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  return res as unknown as Response & typeof res;
}

describe("authMiddleware", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    env.authCookieName = "shortener_session";
    env.jwtSecret = "test-secret";
  });

  it("rejects requests without authorization header", () => {
    const req = { headers: {} } as AuthRequest;
    const res = makeResponse();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Token missing" });
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects authorization headers without token", () => {
    const req = { headers: { authorization: "Bearer" } } as AuthRequest;
    const res = makeResponse();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Error token" });
    expect(next).not.toHaveBeenCalled();
  });

  it("sets userId and calls next when token is valid", () => {
    const req = {
      headers: { authorization: "Bearer valid-token" },
    } as AuthRequest;
    const res = makeResponse();
    const next = jest.fn();
    mockedJwt.verify.mockReturnValue({ userId: "user-1" } as never);

    authMiddleware(req, res, next);

    expect(mockedJwt.verify).toHaveBeenCalledWith(
      "valid-token",
      "test-secret",
      { algorithms: ["HS256"] },
    );
    expect(req.userId).toBe("user-1");
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("sets userId from the auth cookie when no bearer token is present", () => {
    const req = {
      headers: { cookie: "theme=dark; shortener_session=cookie-token" },
    } as AuthRequest;
    const res = makeResponse();
    const next = jest.fn();
    mockedJwt.verify.mockReturnValue({ userId: "user-1" } as never);

    authMiddleware(req, res, next);

    expect(mockedJwt.verify).toHaveBeenCalledWith(
      "cookie-token",
      "test-secret",
      { algorithms: ["HS256"] },
    );
    expect(req.userId).toBe("user-1");
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("rejects tokens without a string userId", () => {
    const req = {
      headers: { authorization: "Bearer valid-token" },
    } as AuthRequest;
    const res = makeResponse();
    const next = jest.fn();
    mockedJwt.verify.mockReturnValue({ userId: 123 } as never);

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid token" });
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects invalid tokens", () => {
    const req = {
      headers: { authorization: "Bearer invalid-token" },
    } as AuthRequest;
    const res = makeResponse();
    const next = jest.fn();
    mockedJwt.verify.mockImplementation(() => {
      throw new Error("invalid");
    });

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid token" });
    expect(next).not.toHaveBeenCalled();
  });
});
