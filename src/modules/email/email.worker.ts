import { EmailJobModel } from "./email-job.model";
import { EmailService } from "./email.service";
import { UserModel } from "../auth/auth.model";

const POLL_INTERVAL_MS = 10_000;
const LOCK_TIMEOUT_MS = 5 * 60 * 1000;
const JOBS_PER_TICK = 10;

const emailService = new EmailService();
let isRunning = false;

function getRetryDate(attempts: number) {
    const delayMinutes = Math.min(2 ** attempts, 30);
    return new Date(Date.now() + delayMinutes * 60 * 1000);
}

async function getNextJob() {
    const now = new Date();
    const staleLockDate = new Date(Date.now() - LOCK_TIMEOUT_MS);

    return EmailJobModel.findOneAndUpdate(
        {
            type: "verify-email",
            $expr: { $lt: ["$attempts", "$maxAttempts"] },
            $or: [
                { status: "pending", nextRunAt: { $lte: now } },
                { status: "processing", lockedAt: { $lte: staleLockDate } },
            ],
        },
        {
            $set: {
                status: "processing",
                lockedAt: now,
            },
            $unset: {
                lastError: "",
            },
        },
        {
            returnDocument: "after",
            sort: { nextRunAt: 1, createdAt: 1 },
        }
    );
}

async function markSent(jobId: string, providerMessageId?: string) {
    await EmailJobModel.findByIdAndUpdate(jobId, {
        $set: {
            status: "sent",
            providerMessageId,
        },
        $unset: {
            lockedAt: "",
            lastError: "",
        },
    });
}

async function markFailed(jobId: string, attempts: number, maxAttempts: number, error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = attempts >= maxAttempts ? "failed" : "pending";

    await EmailJobModel.findByIdAndUpdate(jobId, {
        $set: {
            attempts,
            status,
            lastError: message,
            nextRunAt: getRetryDate(attempts),
        },
        $unset: {
            lockedAt: "",
        },
    });
}

async function processJob() {
    const job = await getNextJob();

    if (!job) {
        return false;
    }

    const jobId = String(job._id);

    try {
        const user = await UserModel.findById(job.userId);

        if (!user) {
            throw new Error("User not found");
        }

        if (user.emailVerified) {
            await markSent(jobId);
            return true;
        }

        const providerMessageId = await emailService.sendVerificationEmail({
            userId: String(user._id),
            username: user.username,
            email: user.email,
            jobId,
        });

        await markSent(jobId, providerMessageId);
    } catch (error) {
        await markFailed(jobId, job.attempts + 1, job.maxAttempts, error);
    }

    return true;
}

async function processAvailableJobs() {
    if (isRunning) {
        return;
    }

    isRunning = true;

    try {
        for (let count = 0; count < JOBS_PER_TICK; count += 1) {
            const processed = await processJob();

            if (!processed) {
                break;
            }
        }
    } finally {
        isRunning = false;
    }
}

export function startEmailWorker() {
    void processAvailableJobs();
    return setInterval(() => {
        void processAvailableJobs();
    }, POLL_INTERVAL_MS);
}
