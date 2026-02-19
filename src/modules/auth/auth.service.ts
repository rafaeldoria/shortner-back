import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { UserModel } from "./auth.model";
import { RegisterDTO } from "./auth.types";
import { env } from "../../config/env";

const MIN_PASSWORD = 5;

export class AuthService {
    async register(data: RegisterDTO) {
        const { login, password } = data;

        if (password.length < MIN_PASSWORD) {
            throw new Error("Password is not valid.");
        }

        const userExists = await UserModel.findOne({ login });

        if (userExists) {
            throw new Error("User already exists");
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await UserModel.create({
            login,
            password: hashedPassword,
        })

        return {
            id: user._id,
            login: user.login,
            createdAt: user.createdAt
        }
    }

    async login(data: { login: string; password: string}) {
        const { login, password } = data;

        const user = await UserModel.findOne({ login });

        if (!user) {
            throw new Error("Invalid credentials");
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            throw new Error("Invalid credentials");
        }

        const token = jwt.sign(
            { userId: user._id },
            env.jwtSecret,
            { expiresIn: env.jwtExpires as any }
        );

        return {
            token
        };
    }
}