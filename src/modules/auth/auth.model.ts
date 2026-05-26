import { Schema, model } from "mongoose";

export interface IUser {
    username: string;
    email: string;
    password: string;
    emailVerified: boolean;
    createdAt: Date;
}

const UserSchema = new Schema<IUser>({
    username: {
        type: String,
        required: true,
        unique: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
        min: 6
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

export const UserModel = model<IUser>("User", UserSchema);
