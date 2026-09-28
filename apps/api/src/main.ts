import 'reflect-metadata';
import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { buildDocsPrefillAuthentication } from './dev/docs-prefill';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(','),
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const openApiConfig = new DocumentBuilder()
    .setTitle('AdmCanchasTenis API')
    .setDescription('API del club de tenis: usuarios, turnos, cuotas, pagos, canchas, tarifas y reportes.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, openApiConfig);

  // health is excluded from the global prefix; align the generated path with the real one.
  const healthPath = document.paths['/api/health'];
  if (healthPath) {
    document.paths['/health'] = healthPath;
    delete document.paths['/api/health'];
  }

  // Scalar UI at /api/docs and the raw spec at /api/docs.json (outside the Nest prefix).
  app.use('/api/docs.json', (_req: Request, res: Response) => {
    res.json(document);
  });
  // Dev convenience: each docs load prefills the bearer auth field with a fresh
  // admin session token (~60s TTL). Disabled in production; any failure renders
  // the plain docs page without the prefill.
  const prisma = app.get(PrismaService);
  app.use('/api/docs', (req: Request, res: Response, next: NextFunction) => {
    buildDocsPrefillAuthentication(prisma, { host: req.hostname })
      .then((authentication) => {
        const render = apiReference({
          content: document,
          ...(authentication ? { authentication } : {}),
        });
        (render as unknown as (req: Request, res: Response) => void)(req, res);
      })
      .catch(next);
  });

  await app.listen(3000);
}

void bootstrap();
