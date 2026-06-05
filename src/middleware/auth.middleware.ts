import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface AuthRequest extends Request {
    userId?: string
}

function getCookieValue(cookieHeader: string | undefined, name: string) {
    if (!cookieHeader) {
        return "";
    }

    const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
    const prefix = `${name}=`;
    const match = cookies.find((cookie) => cookie.startsWith(prefix));

    if (!match) {
        return "";
    }

    try {
        return decodeURIComponent(match.slice(prefix.length));
    } catch {
        return "";
    }
}

function getToken(req: AuthRequest) {
    const authHeader = req.headers.authorization;

    if (authHeader)  {
        const [scheme, token, extra] = authHeader.split(" ");

        if (scheme !== "Bearer" || !token || extra) {
            return null;
        }

        return token;
    }

    return getCookieValue(req.headers.cookie, env.authCookieName) || null;
}

function isAuthTokenPayload(payload: unknown): payload is { userId: string } {
    return Boolean(
        payload
        && typeof payload === "object"
        && "userId" in payload
        && typeof payload.userId === "string"
        && payload.userId.length > 0
    );
}

export function authMiddleware(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    const token = getToken(req);

    if (token === null && !req.headers.authorization && !req.headers.cookie)  {
        return res.status(401).json({ message: "Token missing" })
    }

    if (!token) {
        return res.status(401).json({ message: "Error token" })
    }

    try {
        const decoded = jwt.verify(
            token,
            env.jwtSecret as string,
            { algorithms: ["HS256"] },
        );

        if (!isAuthTokenPayload(decoded)) {
            return res.status(401).json({ message: "Invalid token"});
        }

        req.userId = decoded.userId;

        next();
    } catch {
        return res.status(401).json({ message: "Invalid token"});
    }
}
