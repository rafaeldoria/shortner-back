import app from "./app";
import { connectDatabase } from "./database/mongo";
import 'dotenv/config';
import { env } from './config/env';

const port = Number(env.port) || 3100;

async function bootstrap() {
    await connectDatabase();

    app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on ${port}`)
}) 
}

bootstrap();
