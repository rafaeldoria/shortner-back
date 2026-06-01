import 'dotenv/config';
import app from "./app";
import { connectDatabase } from "./database/mongo";
import { env } from './config/env';
import { startEmailWorker } from './modules/email/email.worker';

const port = Number(env.port) || 3100;

async function bootstrap() {
    await connectDatabase();
    startEmailWorker();

    app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on ${port}`)
}) 
}

bootstrap();
