export const env = {
    port: process.env.PORT || '3100',
    mongoUri: process.env.MONGO_URI as string,
    baseUrl: process.env.BASE_URL as string,
    frontendUrl: process.env.FRONTEND_URL as string,
    jwtSecret: process.env.JWT_SECRET as string,
    jwtExpires: process.env.JWT_EXPIRES_IN as string,
    resendApiKey: process.env.RESEND_API_KEY as string,
    emailFrom: process.env.EMAIL_FROM as string,
    emailVerificationExpires: process.env.EMAIL_VERIFICATION_EXPIRES_IN || '1d',
}
