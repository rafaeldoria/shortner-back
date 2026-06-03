import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { UserModel } from "./auth.model";
import { ChangePasswordDTO, LoginDTO, RegisterDTO } from "./auth.types";
import { env } from "../../config/env";
import { EmailJobModel } from "../email/email-job.model";
import { isEmailVerificationToken } from "../email/email.service";

const MIN_PASSWORD = 6;

function logAuthEvent(message: string, context?: Record<string, unknown>) {
    if (process.env.NODE_ENV === "test") {
        return;
    }

    console.info(`[auth] ${message}`, context ?? {});
}

function isValidPassword(password: string) {
    return password.length >= MIN_PASSWORD
        && /[a-zA-Z]/.test(password)
        && /\d/.test(password)
        && /[^a-zA-Z0-9]/.test(password);
}

export class AuthServiceError extends Error {
    constructor(message: string, public readonly statusCode: number) {
        super(message);
    }
}

export class AuthService {
    async register(data: RegisterDTO) {
        const { username, email, password } = data;

        if (!username || !email || !password) {
            throw new AuthServiceError("Missing required fields", 400);
        }

        if (!isValidPassword(password)) {
            throw new AuthServiceError("Password is not valid.", 400);
        }

        const userExists = await UserModel.findOne({
            $or: [{ username }, { email }]
        });

        if (userExists) {
            throw new AuthServiceError("User already exists", 400);
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await UserModel.create({
            username,
            email,
            password: hashedPassword,
        });

        const emailJob = await EmailJobModel.create({
            type: "verify-email",
            userId: user._id,
            to: user.email,
        });

        logAuthEvent("verification email job queued", {
            userId: String(user._id),
            jobId: String(emailJob._id),
        });

        return {
            id: user._id,
            username: user.username,
            email: user.email,
            createdAt: user.createdAt
        };
    }

    async login(data: LoginDTO) {
        const { login, password } = data;

        if (!login || !password) {
            throw new AuthServiceError("Invalid credentials", 401);
        }

        const user = await UserModel.findOne({
            $or: [{ email: login }, { username: login }]
        });

        if (!user) {
            throw new AuthServiceError("Invalid credentials", 401);
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            throw new AuthServiceError("Invalid credentials", 401);
        }

        if (user.emailVerified !== true) {
            throw new AuthServiceError(
                "Please verify your email before logging in",
                403
            );
        }

        const token = jwt.sign(
            { userId: user._id },
            env.jwtSecret,
            { expiresIn: env.jwtExpires as any }
        );

        return {
            token,
            username: user.username
        };
    }

    async changePassword(userId: string, data: ChangePasswordDTO) {
        const { currentPassword, newPassword } = data;

        if (!currentPassword || !newPassword) {
            throw new AuthServiceError("Missing required fields", 400);
        }

        if (newPassword === currentPassword) {
            throw new AuthServiceError(
                "New password must be different from current password",
                400
            );
        }

        if (!isValidPassword(newPassword)) {
            throw new AuthServiceError("Password is not valid.", 400);
        }

        const user = await UserModel.findById(userId);

        if (!user) {
            throw new AuthServiceError("Invalid credentials", 401);
        }

        const passwordMatch = await bcrypt.compare(currentPassword, user.password);

        if (!passwordMatch) {
            throw new AuthServiceError("Invalid credentials", 401);
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        return {
            message: "Password updated successfully"
        };
    }

    async verifyEmail(token: string) {
        if (!token) {
            throw new AuthServiceError("Invalid verification link", 400);
        }

        let decoded: unknown;

        try {
            decoded = jwt.verify(token, env.jwtSecret);
        } catch {
            throw new AuthServiceError("Invalid or expired verification link", 400);
        }

        if (!isEmailVerificationToken(decoded)) {
            throw new AuthServiceError("Invalid verification link", 400);
        }

        const user = await UserModel.findOne({
            _id: decoded.userId,
            email: decoded.email,
        });

        if (!user) {
            throw new AuthServiceError("Invalid verification link", 400);
        }

        if (user.emailVerified !== true) {
            user.emailVerified = true;
            await user.save();
        }

        return {
            message: "Email verified successfully"
        };
    }
}
