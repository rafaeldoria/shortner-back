import mongoose from "mongoose";
import { env } from "../config/env";

export async function connectDatabase() {
  try {
    console.log("🔄 Connecting to Mongo..");
    await mongoose.connect(env.mongoUri);
    console.log("✅ Mongo connected");
  } catch (error) {
    console.error("❌ Mongo connection error:", error);
  }
}