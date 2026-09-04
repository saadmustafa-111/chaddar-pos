import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import session from 'express-session';
import { AppModule } from './app.module';

console.log('[Bootstrap] Starting...');
console.log('[Bootstrap] PORT:', process.env.PORT);
console.log('[Bootstrap] DATABASE_PATH:', process.env.DATABASE_PATH);
console.log('[Bootstrap] NODE_ENV:', process.env.NODE_ENV);
console.log('[Bootstrap] ATTACHMENTS_DIR:', process.env.ATTACHMENTS_DIR);

async function bootstrap() {
  try {
    console.log('[Bootstrap] Creating NestFactory...');
    const app = await NestFactory.create(AppModule);
    console.log('[Bootstrap] NestFactory created');

    app.setGlobalPrefix('api/v1');
    console.log('[Bootstrap] Global prefix set');

    app.use(
      session({
        secret:
          process.env.SESSION_SECRET ?? 'default-dev-secret-change-in-production',
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: 24 * 60 * 60 * 1000,
        },
      }),
    );
    console.log('[Bootstrap] Session middleware configured');

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    console.log('[Bootstrap] Validation pipe configured');

    app.enableCors({
      origin: process.env.ALLOWED_ORIGIN || '*',
      credentials: true,
    });
    console.log('[Bootstrap] CORS configured');

    const port = process.env.PORT ?? 4000;
    console.log('[Bootstrap] About to listen on port', port);
    await app.listen(port);
    console.log('[Bootstrap] app.listen() completed, listening on port', port);
  } catch (err) {
    console.error('[Bootstrap] ERROR during bootstrap:', err);
    process.exit(1);
  }
}

bootstrap().catch((err) => {
  console.error('[Bootstrap] Unhandled rejection:', err);
  process.exit(1);
});
