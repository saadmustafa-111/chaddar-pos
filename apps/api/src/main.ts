import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import session from 'express-session';
import { AppModule } from './app.module';

console.log('[Bootstrap] Starting...');
console.log('[Bootstrap] PORT:', process.env.PORT);
console.log('[Bootstrap] DATABASE_PATH:', process.env.DATABASE_PATH);
console.log('[Bootstrap] NODE_ENV:', process.env.NODE_ENV);

async function bootstrap() {
  console.log('[Bootstrap] Creating NestFactory...');
  const app = await NestFactory.create(AppModule);
  console.log('[Bootstrap] NestFactory created');

  app.setGlobalPrefix('api/v1');

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

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: process.env.ALLOWED_ORIGIN || '*',
    credentials: true,
  });

  const port = process.env.PORT ?? 4000;
  console.log('[Bootstrap] About to listen on port', port);
  await app.listen(port);
  console.log('[Bootstrap] app.listen() completed, listening on port', port);
}
bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
