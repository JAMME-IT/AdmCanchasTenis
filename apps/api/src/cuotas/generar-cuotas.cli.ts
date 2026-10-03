import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CuotasService } from './cuotas.service';

/**
 * Manual retry for the monthly fee job (RF-20, ACT-39).
 * Usage: npm run cuotas:generar -- --periodo=2026-10
 * Idempotent: re-running never duplicates fees.
 */
async function main(): Promise<void> {
  const periodoArg = process.argv.find((arg) => arg.startsWith('--periodo='));
  const periodo = periodoArg?.split('=')[1];
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'error', 'warn'] });
  try {
    const service = app.get(CuotasService);
    const result = await service.generateMonthlyFees(periodo);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(result));
  } finally {
    await app.close();
  }
}

void main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
