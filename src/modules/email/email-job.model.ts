import { Schema, Types, model } from "mongoose";

export type EmailJobType = "verify-email";
export type EmailJobStatus = "pending" | "processing" | "sent" | "failed";

export interface IEmailJob {
    type: EmailJobType;
    userId: Types.ObjectId;
    to: string;
    status: EmailJobStatus;
    attempts: number;
    maxAttempts: number;
    nextRunAt: Date;
    lockedAt?: Date;
    lastError?: string;
    providerMessageId?: string;
    createdAt: Date;
    updatedAt: Date;
}

const EmailJobSchema = new Schema<IEmailJob>(
    {
        type: {
            type: String,
            required: true,
            enum: ["verify-email"],
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        to: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            required: true,
            enum: ["pending", "processing", "sent", "failed"],
            default: "pending",
            index: true,
        },
        attempts: {
            type: Number,
            default: 0,
        },
        maxAttempts: {
            type: Number,
            default: 3,
        },
        nextRunAt: {
            type: Date,
            default: Date.now,
            index: true,
        },
        lockedAt: Date,
        lastError: String,
        providerMessageId: String,
    },
    {
        timestamps: true,
    }
);

EmailJobSchema.index({ status: 1, nextRunAt: 1 });

export const EmailJobModel = model<IEmailJob>("EmailJob", EmailJobSchema);
