export const env = {
    port: process.env.PORT || '3100',
    mongoUri: process.env.MONGO_URI as string,
    baseUrl: process.env.BASE_URL as string,
    jwtSecret: process.env.JWT_SECRET as string,
    jwtExpires: process.env.JWT_EXPIRES_IN as string,
}