import { Schema, Types, model } from "mongoose";

export interface IUrl {
  code: string;
  originalUrl: string;
  clicks: number;
  userId: Types.ObjectId;
  createdAt: Date;
}

const UrlSchema = new Schema<IUrl>({
  code: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  originalUrl: {
    type: String,
    required: true,
  },
  clicks: {
    type: Number,
    default: 0,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: "user",
    required: true,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const UrlModel = model<IUrl>("Url", UrlSchema);
