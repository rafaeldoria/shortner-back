export const env = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: process.env.PORT || '3100',
    mongoUri: process.env.MONGO_URI as string,
    baseUrl: process.env.BASE_URL as string,
    frontendUrl: process.env.FRONTEND_URL as string,
    corsOrigins: process.env.CORS_ORIGINS as string,
    jwtSecret: process.env.JWT_SECRET as string,
    jwtExpires: process.env.JWT_EXPIRES_IN as string,
    authCookieName: process.env.AUTH_COOKIE_NAME || 'shortner_session',
    resendApiKey: process.env.RESEND_API_KEY as string,
    emailFrom: process.env.EMAIL_FROM as string,
    emailVerificationExpires: process.env.EMAIL_VERIFICATION_EXPIRES_IN || '1d',
    alertSendEmail: process.env.ALERT_SEND_EMAIL as string,
}

const REQUIRED_ENV_KEYS = [
    'MONGO_URI',
    'BASE_URL',
    'FRONTEND_URL',
    'JWT_SECRET',
    'JWT_EXPIRES_IN',
] as const;

export function validateRuntimeEnv() {
    const missing = REQUIRED_ENV_KEYS.filter((key) => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    if (env.nodeEnv === 'production' && env.jwtSecret.length < 32) {
        throw new Error('JWT_SECRET must be at least 32 characters long');
    }

    if (env.jwtSecret.length < 32) {
        console.warn('JWT_SECRET should be at least 32 characters long outside local development');
    }

    try {
        new URL(env.baseUrl);
        new URL(env.frontendUrl);
    } catch {
        throw new Error('BASE_URL and FRONTEND_URL must be valid URLs');
    }
}
