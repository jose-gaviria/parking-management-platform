import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppExceptionFilter } from './common/filters/app-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(helmet());

  // Detrás de un proxy (Vercel, Nginx) req.ip sería la IP del proxy: sin esto
  // el rate limiting y la auditoría de terminal registran siempre la misma IP.
  if (process.env.TRUST_PROXY === '1') {
    app.set('trust proxy', 1);
  }

  const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AppExceptionFilter());

  // Swagger describe todos los endpoints y su modelo de permisos: se publica
  // solo fuera de producción, o si se habilita explícitamente.
  const swaggerEnabled =
    process.env.ENABLE_SWAGGER === '1' || process.env.NODE_ENV !== 'production';
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('API Parqueadero')
      .setDescription('Sistema de gestión de parqueadero — una sede')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(
    `API lista en http://localhost:${port}${swaggerEnabled ? ' — docs en /docs' : ''}`,
  );
}

void bootstrap();
