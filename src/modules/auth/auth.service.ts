import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { UserModel } from "./auth.model";
import { LoginDTO, RegisterDTO } from "./auth.types";
import { env } from "../../config/env";

const MIN_PASSWORD = 5;

export class AuthService {
    async register(data: RegisterDTO) {
        const { username, email, password } = data;

        if (password.length < MIN_PASSWORD) {
            throw new Error("Password is not valid.");
        }

        if (!username || !email || !password) {
            throw new Error("Missing required fields");
        }

        const userExists = await UserModel.findOne({
            $or: [{ username }, { email }]
        });

        if (userExists) {
            throw new Error("User already exists");
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await UserModel.create({
            username,
            email,
            password: hashedPassword,
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

        const user = await UserModel.findOne({
            $or: [{ email: login }, { username: login }]
        });

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
