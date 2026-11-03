import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global ValidationPipe — validasi semua DTO secara otomatis
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          // strip field yang tidak ada di DTO
      forbidNonWhitelisted: true,
      transform: true,          // auto-transform tipe (string → number, dll)
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  });

  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`[SGZA] API running on http://localhost:${port}/api`);
}

bootstrap();

