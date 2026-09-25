import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  const total = await prisma.usuarios.count();
  console.log('db-health OK — usuarios:', total);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('db-health FAIL:', e instanceof Error ? e.message : e);
  process.exit(1);
});
