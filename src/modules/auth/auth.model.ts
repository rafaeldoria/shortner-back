import { Schema, model } from "mongoose";

export interface IUser {
    login: string;
    password: string;
    createdAt: Date;
}

const UserSchema = new Schema<IUser>({
    login: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
        min: 6
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

export const UserModel = model<IUser>("User", UserSchema);