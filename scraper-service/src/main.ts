/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  
  // Enable CORS for local development
  app.enableCors({
    origin: '*',
    methods: 'GET,POST,PUT,DELETE',
    allowedHeaders: 'Content-Type, Authorization',
  });
  
  const port = process.env.PORT || 3001; // Use different port than main API
  await app.listen(port);
  Logger.log(
    `🚀 Scraper Service is running on: http://localhost:${port}/${globalPrefix}`
  );
  Logger.log(`📡 Scraper endpoints available at: http://localhost:${port}/${globalPrefix}/scraper`);
}

bootstrap();
