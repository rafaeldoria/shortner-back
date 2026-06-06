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
            { algorithm: "HS256", expiresIn: env.emailVerificationExpires as any }
        );

        const verificationUrl = new URL("/auth/verify-email", baseUrl);
        verificationUrl.searchParams.set("token", token);

        const safeUsername = escapeHtml(params.username);
        const url = verificationUrl.toString();

        const { data, error } = await this.getResend().emails.send(
            {
                from,
                to: [params.email],
                subject: "Valide seu e-mail",
                html: `
                    <p>Olá, ${safeUsername}.</p>
                    <p>Confirme seu e-mail para ativar sua conta no Shortener.</p>
                    <p><a href="${url}">Validar e-mail</a></p>
                    <p>Se você não criou essa conta, ignore esta mensagem.</p>
                `,
                text: `Olá, ${params.username}.\n\nConfirme seu e-mail para ativar sua conta no Shortener: ${url}\n\nSe você não criou essa conta, ignore esta mensagem.`,
                tags: [
                    {
                        name: "category",
                        value: "verify_email",
                    },
                ],
            },
            {
                idempotencyKey: `verify-email/${params.jobId}`,
            }
        );

        if (error) {
            throw new Error(error.message);
        }

        return data?.id;
    }

    async sendUrlLimitAlertEmail(params: SendUrlLimitAlertEmailParams) {
        const from = requiredEnv(env.emailFrom, "EMAIL_FROM");
        const { data, error } = await this.getResend().emails.send(
            {
                from,
                to: [params.to],
                subject: `Alerta de limite de URLs: ${params.threshold}`,
                html: `
                    <p>O Shortener atingiu ${params.urlCount} URLs cadastradas.</p>
                    <p>Limite monitorado: ${params.threshold} URLs.</p>
                `,
                text: `O Shortener atingiu ${params.urlCount} URLs cadastradas.\n\nLimite monitorado: ${params.threshold} URLs.`,
                tags: [
                    {
                        name: "category",
                        value: "url_limit_alert",
                    },
                ],
            },
            {
                idempotencyKey: `url-limit-alert/${params.jobId}`,
            }
        );

        if (error) {
            throw new Error(error.message);
        }

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
