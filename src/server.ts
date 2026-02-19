import app from "./app";
import { connectDatabase } from "./database/mongo";
import 'dotenv/config';
import { env } from './config/env';

const PORT = env.port;

async function bootstrap() {
    await connectDatabase();

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });    
}

bootstrap();
