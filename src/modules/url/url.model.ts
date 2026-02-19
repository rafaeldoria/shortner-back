import { Schema, Types, model } from "mongoose";

export interface IUrl {
  code: string;
  originalUrl: string;
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
