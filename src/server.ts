import 'dotenv/config';
import app from "./app";
import { connectDatabase } from "./database/mongo";
import { env, validateRuntimeEnv } from './config/env';
import { startEmailWorker } from './modules/email/email.worker';
import { startUrlLimitMonitor } from './modules/url/url-monitor.worker';

const port = Number(env.port) || 3100;

async function bootstrap() {
    validateRuntimeEnv();
    await connectDatabase();
    startEmailWorker();
    startUrlLimitMonitor();

    app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on ${port}`)
}) 
}

bootstrap();
