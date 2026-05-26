import { Request, Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { AuthService, AuthServiceError } from "./auth.service";

const authService = new AuthService();

function errorResponse(error: unknown, fallbackStatus: number) {
    if (error instanceof AuthServiceError) {
        return {
            status: error.statusCode,
            message: error.message
        };
    }

    return {
        status: fallbackStatus,
        message: error instanceof Error ? error.message : "Unexpected error"
    };
}

export class AuthController {
    async register(req: Request, res: Response) {
        try {
            if (req.body == undefined) {
                throw new Error("Empty body.");
            }

            const user = await authService.register(req.body);

            return res.status(201).json(user);
        } catch (error: unknown) {
            const response = errorResponse(error, 400);
            return res.status(response.status).json({ message: response.message });
        }
    }

    async login(req: Request, res: Response) {
        try {
            if (req.body == undefined) {
                throw new Error("Empty body.");
            }

            const user = await authService.login(req.body);

            return res.status(200).json(user);
        } catch (error: unknown) {
            const response = errorResponse(error, 401);
            return res.status(response.status).json({ message: response.message });
        }
    }

    async changePassword(req: AuthRequest, res: Response) {
        try {
            if (req.body == undefined) {
                throw new AuthServiceError("Empty body.", 400);
            }

            const result = await authService.changePassword(
                req.userId as string,
                req.body
            );

            return res.status(200).json(result);
        } catch (error: unknown) {
            const response = errorResponse(error, 400);
            return res.status(response.status).json({ message: response.message });
        }
    }

    logout(_req: AuthRequest, res: Response) {
        return res.status(200).json({ message: "Logged out successfully" });
    }
}
