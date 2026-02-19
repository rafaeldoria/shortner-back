import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface AuthRequest extends Request {
    userId?: string
}

export function authMiddleware(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    const authHeader = req.headers.authorization;

    if (!authHeader)  {
        return res.status(401).json({ message: "Token missing" })
    }

    const [, token] = authHeader.split(" ");

    if (!token) {
        return res.status(401).json({ message: "Error token" })
    }

    try {
        const decoded = jwt.verify(
            token,
            env.jwtSecret as string,
        ) as any;

        req.userId = decoded.userId;

        next();
    } catch {
        return res.status(401).json({ message: "Invalid token"});
    }
}