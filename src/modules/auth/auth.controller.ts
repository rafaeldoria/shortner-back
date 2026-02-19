import { Request, Response } from "express";
import { AuthService } from "./auth.service";

const authService = new AuthService();

export class AuthController {
    async register(req: Request, res: Response) {
        try {
            if (req.body == undefined) {
                throw new Error("Empty body.");
            }

            const user = await authService.register(req.body);

            return res.status(201).json(user);
        } catch (error: any) {
            return res.status(400).json({ message: error.message })
        }
    }

    async login(req: Request, res: Response) {
        try {
            if (req.body == undefined) {
                throw new Error("Empty body.");
            }

            const user = await authService.login(req.body);

            return res.status(200).json(user);
        } catch (error: any) {
            return res.status(401).json({ message: error.message })
        }
    }
}