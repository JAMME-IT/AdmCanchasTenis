/**
 * Idempotent demo seed (Jira ACT-17).
 *
 * One command leaves the dev database demo-ready:
 * - initial admin: Clerk user (email + password) + usuarios/estados_usuario/usuarios_roles,
 * - the club's 3 courts with their initial estados_cancha row,
 * - the 7 operating days and the 08:00-22:00 opening range,
 * - current tariffs: valores_turno, valores_cuota and the operative luz row + estados_luz.
 *
 * Safe to re-run: every entity is looked up before insert (find-first), versioned
 * tariffs are never duplicated and roles/tipos_turno (owned by the initial
 * migration) are only verified.
 *
 * Usage: npm run db:seed (from the repo root).
 * Envs: DATABASE_URL, CLERK_SECRET_KEY, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD.
 */
import 'dotenv/config';
import { createClerkClient } from '@clerk/backend';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

/** Time columns (@db.Time) are represented as dates anchored at the Unix epoch (UTC). */
function time(hours: number, minutes: number): Date {
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));
}

function formatTime(value: Date): string {
  return value.toISOString().slice(11, 16);
}

/**
 * +clerk_test: dev instances accept the fixed OTP 424242 for these addresses
 * and never send mail (Clerk testing contract).
 */
const DEFAULT_ADMIN_EMAIL = 'admin+clerk_test@admcanchastenis.dev';
/** Dev-only fallback: 16 chars with uppercase, digit and special char (Clerk policy). */
const DEFAULT_ADMIN_PASSWORD = 'AdmCanchas#2026';

const ADMIN_PROFILE = {
  username: 'admin',
  nombre: 'Admin',
  apellido: 'Demo',
  dni: '00000000',
  telefono: '+5491100000000',
} as const;

const CANCHAS: { nro_cancha: number; superficie: 'dura' | 'polvo_de_ladrillo' | 'cesped' }[] = [
  { nro_cancha: 1, superficie: 'dura' },
  { nro_cancha: 2, superficie: 'polvo_de_ladrillo' },
  { nro_cancha: 3, superficie: 'cesped' },
];

const RANGO_APERTURA = { nombre: 'Apertura', hora_inicio: time(8, 0), hora_fin: time(22, 0) };

/** Real club data: non-members pay $4000 per person per hour (CONTEXTO §1). */
const VALOR_TURNO_X_HORA = 4000;
/** Demo value reported by the seed summary. */
const VALOR_CUOTA = 12000;
/** Lighting cost for the 18:30-22:00 window. */
const LUZ_COSTO_X_HORA = 4000;
const LUZ_FRANJA = { inicio: time(18, 30), fin: time(22, 0) };

type Stat = { found: number; created: number };

function track(stats: Map<string, Stat>, entity: string, kind: 'found' | 'created'): void {
  const current = stats.get(entity) ?? { found: 0, created: 0 };
  current[kind] += 1;
  stats.set(entity, current);
}

function printSummary(stats: Map<string, Stat>): void {
  console.log('\nResumen del seed (encontrado / creado):');
  for (const [entity, stat] of stats) {
    console.log(`  ${entity.padEnd(24)} ${String(stat.found).padStart(2)} / ${String(stat.created).padStart(2)}`);
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Falta DATABASE_URL; copia apps/api/.env.example a apps/api/.env y completa la conexion.');
  }

  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) {
    throw new Error('Falta CLERK_SECRET_KEY (Clerk > API keys); el seed crea el admin inicial en Clerk dev.');
  }

  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? DEFAULT_ADMIN_PASSWORD;

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  const stats = new Map<string, Stat>();
  const failures: string[] = [];

  try {
    // Catalog rows are owned by the initial migration: verify, never duplicate.
    const roles = await prisma.roles.findMany({ select: { id: true, nombre: true } });
    const tiposTurno = await prisma.tipos_turno.count();
    const rolAdmin = roles.find((rol) => rol.nombre === 'admin');
    if (!rolAdmin) {
      throw new Error('No existe el rol admin; corre las migraciones antes del seed (lo siembra la migracion inicial).');
    }
    if (tiposTurno !== 2) {
      console.warn(`[warn] tipos_turno = ${tiposTurno} (se esperaban 2: 60 y 90).`);
    }

    // Admin in Clerk dev: reuse by email, create with email + password when missing.
    const clerk = createClerkClient({ secretKey: clerkSecretKey });
    let clerkUserId: string;
    const clerkExistente = await clerk.users.getUserList({ emailAddress: [adminEmail], limit: 1 });
    if (clerkExistente.totalCount > 0 && clerkExistente.data[0]) {
      clerkUserId = clerkExistente.data[0].id;
    } else {
      try {
        const creado = await clerk.users.createUser({
          emailAddress: [adminEmail],
          password: adminPassword,
        });
        clerkUserId = creado.id;
      } catch (error) {
        // The email may exist without matching the filter: reuse it before failing.
        const reintento = await clerk.users.getUserList({ emailAddress: [adminEmail], limit: 1 });
        if (reintento.totalCount > 0 && reintento.data[0]) {
          clerkUserId = reintento.data[0].id;
        } else {
          throw error;
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      // --- Admin user: usuario + estado inicial + rol admin vigente ---
      const existente = await tx.usuarios.findUnique({ where: { email: adminEmail } });
      let usuarioId: string;
      if (existente) {
        usuarioId = existente.id;
        track(stats, 'admin usuario', 'found');
        if (existente.clerk_user_id !== clerkUserId) {
          await tx.usuarios.update({
            where: { id: existente.id },
            data: { clerk_user_id: clerkUserId, updated_at: new Date() },
          });
          console.log('[info] admin: clerk_user_id actualizado en usuarios.');
        }
        const estados = await tx.estados_usuario.count({ where: { usuario_id: existente.id } });
        if (existente.estado_actual !== 'activo') {
          await tx.usuarios.update({
            where: { id: existente.id },
            data: { estado_actual: 'activo', updated_at: new Date() },
          });
          await tx.estados_usuario.create({ data: { usuario_id: existente.id, valor: 'activo' } });
          console.log('[info] admin: estado_actual reactivado a activo (historial append-only).');
        } else if (estados === 0) {
          await tx.estados_usuario.create({ data: { usuario_id: existente.id, valor: 'activo' } });
        }
      } else {
        const creado = await tx.usuarios.create({
          data: {
            clerk_user_id: clerkUserId,
            email: adminEmail,
            username: ADMIN_PROFILE.username,
            nombre: ADMIN_PROFILE.nombre,
            apellido: ADMIN_PROFILE.apellido,
            dni: ADMIN_PROFILE.dni,
            telefono: ADMIN_PROFILE.telefono,
            estado_actual: 'activo',
          },
        });
        usuarioId = creado.id;
        track(stats, 'admin usuario', 'created');
        await tx.estados_usuario.create({ data: { usuario_id: creado.id, valor: 'activo' } });
      }

      const rolVigente = await tx.usuarios_roles.findFirst({
        where: { usuario_id: usuarioId, fecha_fin: null },
      });
      if (!rolVigente) {
        await tx.usuarios_roles.create({
          data: { usuario_id: usuarioId, rol_id: rolAdmin.id, fecha_inicio: new Date(), fecha_fin: null },
        });
        track(stats, 'admin rol vigente', 'created');
      } else if (rolVigente.rol_id !== rolAdmin.id) {
        // Seed intent: the configured admin must hold the vigente admin role.
        await tx.usuarios_roles.update({
          where: { id: rolVigente.id },
          data: { fecha_fin: new Date() },
        });
        await tx.usuarios_roles.create({
          data: { usuario_id: usuarioId, rol_id: rolAdmin.id, fecha_inicio: new Date(), fecha_fin: null },
        });
        track(stats, 'admin rol vigente', 'created');
        console.log('[info] admin: rol vigente anterior cerrado y reemplazado por admin.');
      } else {
        track(stats, 'admin rol vigente', 'found');
      }

      // --- Canchas: cached state + initial estados_cancha row, same transaction ---
      for (const cancha of CANCHAS) {
        const existente = await tx.canchas.findUnique({ where: { nro_cancha: cancha.nro_cancha } });
        if (existente) {
          track(stats, 'canchas', 'found');
          continue;
        }
        const creada = await tx.canchas.create({
          data: { ...cancha, iluminacion: true, estado_actual: 'disponible' },
        });
        await tx.estados_cancha.create({ data: { cancha_id: creada.id, valor_state: 'disponible' } });
        track(stats, 'canchas', 'created');
      }

      // --- Operating days: all seven enabled (ISO-8601, 1 = Monday) ---
      for (let dia = 1; dia <= 7; dia += 1) {
        const existente = await tx.dias_funcionamiento.findUnique({ where: { dia_semana: dia } });
        if (existente) {
          track(stats, 'dias_funcionamiento', 'found');
          if (!existente.habilitado) {
            await tx.dias_funcionamiento.update({
              where: { dia_semana: dia },
              data: { habilitado: true, updated_at: new Date() },
            });
            console.log(`[info] dias_funcionamiento: dia ${dia} re-habilitado.`);
          }
          continue;
        }
        await tx.dias_funcionamiento.create({ data: { dia_semana: dia, habilitado: true } });
        track(stats, 'dias_funcionamiento', 'created');
      }

      // --- Opening range 08:00-22:00 ---
      const rangoExistente = await tx.rangos_horario.findUnique({ where: { nombre: RANGO_APERTURA.nombre } });
      if (rangoExistente) {
        track(stats, 'rangos_horario', 'found');
      } else {
        await tx.rangos_horario.create({ data: RANGO_APERTURA });
        track(stats, 'rangos_horario', 'created');
      }

      // --- Current tariffs: find-first, never duplicate a current version ---
      const valorTurnoVigente = await tx.valores_turno.findFirst({
        where: { fecha_cambio: { lte: new Date() } },
        orderBy: { fecha_cambio: 'desc' },
      });
      if (valorTurnoVigente) {
        track(stats, 'valores_turno', 'found');
      } else {
        await tx.valores_turno.create({ data: { costo_x_hora: VALOR_TURNO_X_HORA, fecha_cambio: new Date() } });
        track(stats, 'valores_turno', 'created');
      }

      const valorCuotaVigente = await tx.valores_cuota.findFirst({
        where: { fecha_cambio: { lte: new Date() } },
        orderBy: { fecha_cambio: 'desc' },
      });
      if (valorCuotaVigente) {
        track(stats, 'valores_cuota', 'found');
      } else {
        await tx.valores_cuota.create({ data: { precio: VALOR_CUOTA, fecha_cambio: new Date() } });
        track(stats, 'valores_cuota', 'created');
      }

      // --- Operative luz row (single row, no singleton constraint) + estados_luz ---
      const luzExistente = await tx.luz.findFirst({ orderBy: { created_at: 'asc' } });
      if (luzExistente) {
        track(stats, 'luz', 'found');
      } else {
        const luz = await tx.luz.create({
          data: {
            costo_x_hora: LUZ_COSTO_X_HORA,
            franja_horario_inicio: LUZ_FRANJA.inicio,
            franja_horario_fin: LUZ_FRANJA.fin,
          },
        });
        await tx.estados_luz.create({ data: { luz_id: luz.id, costo_x_hora: LUZ_COSTO_X_HORA } });
        track(stats, 'luz', 'created');
      }
    });

    printSummary(stats);

    // --- Post-seed verification (read-only) ---
    const admin = await prisma.usuarios.findUnique({
      where: { email: adminEmail },
      include: { usuarios_roles: { include: { roles: true } } },
    });
    const adminOk =
      admin?.estado_actual === 'activo' &&
      admin.usuarios_roles?.fecha_fin === null &&
      admin.usuarios_roles.roles.nombre === 'admin';

    const [canchasCount, rolesCount, tiposCount, diasCount, rangosCount] = await Promise.all([
      prisma.canchas.count(),
      prisma.roles.count(),
      prisma.tipos_turno.count(),
      prisma.dias_funcionamiento.count(),
      prisma.rangos_horario.count(),
    ]);
    const valorTurno = await prisma.valores_turno.findFirst({
      where: { fecha_cambio: { lte: new Date() } },
      orderBy: { fecha_cambio: 'desc' },
    });
    const valorCuota = await prisma.valores_cuota.findFirst({
      where: { fecha_cambio: { lte: new Date() } },
      orderBy: { fecha_cambio: 'desc' },
    });
    const luz = await prisma.luz.findFirst({ orderBy: { created_at: 'asc' } });

    console.log('\nVerificacion:');
    console.log(`  admin con rol vigente: ${adminOk ? 'OK' : 'FALLA'}`);
    if (!adminOk) failures.push('admin sin rol vigente');
    console.log(`  canchas: ${canchasCount}`);
    if (canchasCount !== 3) failures.push(`canchas = ${canchasCount} (se esperaban 3)`);
    console.log(`  roles: ${rolesCount} | tipos_turno: ${tiposCount}`);
    console.log(`  dias_funcionamiento: ${diasCount} | rangos_horario: ${rangosCount}`);
    if (!valorTurno || !valorCuota || !luz) {
      failures.push('faltan tarifas vigentes (valores_turno/valores_cuota/luz)');
    }
    console.log(
      `  valores_turno vigente: $${valorTurno ? valorTurno.costo_x_hora.toFixed(2) : 'N/A'} /hora` +
        ` | valores_cuota vigente: $${valorCuota ? valorCuota.precio.toFixed(2) : 'N/A'}`,
    );
    if (luz) {
      console.log(
        `  luz: $${luz.costo_x_hora.toFixed(2)} /hora (${formatTime(luz.franja_horario_inicio)}-${formatTime(luz.franja_horario_fin)})`,
      );
    }

    console.log(`\nAdmin inicial: ${adminEmail}`);
    console.log('  (la contrasena se toma de SEED_ADMIN_PASSWORD; este script no imprime su valor)');

    if (failures.length > 0) {
      throw new Error(`Verificacion con fallas: ${failures.join('; ')}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('db:seed FAIL:', error instanceof Error ? error.message : error);
  process.exit(1);
});
