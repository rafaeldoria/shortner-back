import jwt from "jsonwebtoken";
import { Resend } from "resend";
import { env } from "../../config/env";

const EMAIL_VERIFICATION_PURPOSE = "email-verification";

interface SendVerificationEmailParams {
    userId: string;
    username: string;
    email: string;
    jobId: string;
}

interface SendUrlLimitAlertEmailParams {
    to: string;
    threshold: number;
    urlCount: number;
    jobId: string;
}

function requiredEnv(value: string | undefined, name: string) {
    if (!value) {
        throw new Error(`${name} is not configured`);
    }

    return value;
}

function logEmailService(message: string, context?: Record<string, unknown>) {
    if (process.env.NODE_ENV === "test") {
        return;
    }

    console.info(`[email-service] ${message}`, context ?? {});
}

function logEmailServiceError(message: string, context?: Record<string, unknown>) {
    if (process.env.NODE_ENV === "test") {
        return;
    }

    console.error(`[email-service] ${message}`, context ?? {});
}

function maskEmail(email: string) {
    const [local, domain] = email.split("@");

    if (!local || !domain) {
        return email;
    }

    return `${local.slice(0, 2)}***@${domain}`;
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export class EmailService {
    private resend?: Resend;

    private getResend() {
        if (!this.resend) {
            this.resend = new Resend(requiredEnv(env.resendApiKey, "RESEND_API_KEY"));
        }

        return this.resend;
    }

    async sendVerificationEmail(params: SendVerificationEmailParams) {
        const baseUrl = requiredEnv(env.baseUrl, "BASE_URL");
        const from = requiredEnv(env.emailFrom, "EMAIL_FROM");
        const token = jwt.sign(
            {
                userId: params.userId,
                email: params.email,
                purpose: EMAIL_VERIFICATION_PURPOSE,
            },
            env.jwtSecret,
            { expiresIn: env.emailVerificationExpires as any }
        );

        logEmailService("building verification URL", {
            jobId: params.jobId,
            baseUrl,
            path: "/auth/verify-email",
        });

        let verificationUrl: URL;

        try {
            verificationUrl = new URL("/auth/verify-email", baseUrl);
        } catch (error) {
            logEmailServiceError("failed to build verification URL", {
                jobId: params.jobId,
                baseUrl,
                path: "/auth/verify-email",
                error: error instanceof Error ? error.message : "Unexpected error",
            });
            throw error;
        }

        verificationUrl.searchParams.set("token", token);

        const safeUsername = escapeHtml(params.username);
        const url = verificationUrl.toString();
        const debugUrl = new URL(url);
        debugUrl.searchParams.set("token", "[redacted]");
        const idempotencyKey = `verify-email/${params.jobId}`;

        logEmailService("sending verification email", {
            jobId: params.jobId,
            from,
            to: maskEmail(params.email),
            verificationUrl: debugUrl.toString(),
            tokenLength: token.length,
            idempotencyKey,
        });

        const { data, error } = await this.getResend().emails.send(
            {
                from,
                to: [params.email],
                subject: "Valide seu e-mail",
                html: `
                    <p>Olá, ${safeUsername}.</p>
                    <p>Confirme seu e-mail para ativar sua conta no Shortner.</p>
                    <p><a href="${url}">Validar e-mail</a></p>
                    <p>Se você não criou essa conta, ignore esta mensagem.</p>
                `,
                text: `Olá, ${params.username}.\n\nConfirme seu e-mail para ativar sua conta no Shortner: ${url}\n\nSe você não criou essa conta, ignore esta mensagem.`,
                tags: [
                    {
                        name: "category",
                        value: "verify_email",
                    },
                ],
            },
            {
                idempotencyKey,
            }
        );

        if (error) {
            logEmailServiceError("resend rejected verification email", {
                jobId: params.jobId,
                error: error.message,
            });
            throw new Error(error.message);
        }

        logEmailService("verification email accepted by provider", {
            jobId: params.jobId,
            providerMessageId: data?.id,
        });

        return data?.id;
    }

    async sendUrlLimitAlertEmail(params: SendUrlLimitAlertEmailParams) {
        const from = requiredEnv(env.emailFrom, "EMAIL_FROM");
        const idempotencyKey = `url-limit-alert/${params.jobId}`;

        logEmailService("sending URL limit alert email", {
            jobId: params.jobId,
            from,
            to: maskEmail(params.to),
            threshold: params.threshold,
            urlCount: params.urlCount,
            idempotencyKey,
        });

        const { data, error } = await this.getResend().emails.send(
            {
                from,
                to: [params.to],
                subject: `Alerta de limite de URLs: ${params.threshold}`,
                html: `
                    <p>O Shortner atingiu ${params.urlCount} URLs cadastradas.</p>
                    <p>Limite monitorado: ${params.threshold} URLs.</p>
                `,
                text: `O Shortner atingiu ${params.urlCount} URLs cadastradas.\n\nLimite monitorado: ${params.threshold} URLs.`,
                tags: [
                    {
                        name: "category",
                        value: "url_limit_alert",
                    },
                ],
            },
            {
                idempotencyKey,
            }
        );

        if (error) {
            logEmailServiceError("resend rejected URL limit alert email", {
                jobId: params.jobId,
                threshold: params.threshold,
                urlCount: params.urlCount,
                error: error.message,
            });
            throw new Error(error.message);
        }

        logEmailService("URL limit alert email accepted by provider", {
            jobId: params.jobId,
            providerMessageId: data?.id,
        });

        return data?.id;
    }
}

export function isEmailVerificationToken(payload: unknown): payload is {
    userId: string;
    email: string;
    purpose: typeof EMAIL_VERIFICATION_PURPOSE;
} {
    return Boolean(
        payload
        && typeof payload === "object"
        && "userId" in payload
        && "email" in payload
        && "purpose" in payload
        && payload.purpose === EMAIL_VERIFICATION_PURPOSE
    );
}
