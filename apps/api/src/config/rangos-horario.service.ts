import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ActualizarRangosHorarioDto, RangoHorarioDto } from './dto/actualizar-rangos-horario.dto';
import { HORA_REGEX, horaDesdeTexto, minutosDeHoraTexto } from './hora';
import {
  toRangosHorarioResponse,
  type RangoHorarioFila,
  type RangoHorarioResponse,
} from './rangos-horario-response';

/** One body entry paired with the stored row it will update (absent → create). */
interface RangoResuelto {
  rango: RangoHorarioDto;
  fila?: RangoHorarioFila;
}

/**
 * Opening time ranges business logic (API contract §5.6, RF-34).
 * The club's bookable hours are a replaceable set: `PUT` upserts the body's
 * ranges inside one transaction and deletes every stored row the body dropped.
 * Ranges are half-open `[horaInicio, horaFin)`, so adjacent ranges are valid.
 */
@Injectable()
export class RangosHorarioService {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /config/rangos-horario (RF-34): every stored range, ascending by start. */
  async listar(): Promise<RangoHorarioResponse[]> {
    const filas = await this.prisma.rangos_horario.findMany({
      orderBy: { hora_inicio: 'asc' },
    });
    return toRangosHorarioResponse(filas);
  }

  /**
   * PUT /config/rangos-horario (RF-34): replaces the whole set in one
   * transaction and returns the resulting ranges. An entry with `id` updates
   * that row (an unknown `id` is a 400); an entry without `id` is upserted by
   * `nombre`. Omitted rows are deleted. Duplicate `nombre` in the body, or two
   * entries resolving to the same stored row, is a 409.
   */
  async actualizar(dto: ActualizarRangosHorarioDto): Promise<RangoHorarioResponse[]> {
    const rangos = dto.rangos;
    this.validarRangos(rangos);

    const actuales = await this.prisma.rangos_horario.findMany();
    const porId = new Map(actuales.map((fila) => [fila.id, fila]));
    const porNombre = new Map(actuales.map((fila) => [fila.nombre, fila]));

    const resueltos: RangoResuelto[] = [];
    const idsConservados = new Set<string>();
    for (const rango of rangos) {
      const fila = rango.id ? porId.get(rango.id) : porNombre.get(rango.nombre);
      if (rango.id && !fila) {
        throw new BadRequestException(`El rango ${rango.id} no existe`);
      }
      if (fila) {
        if (idsConservados.has(fila.id)) {
          throw new ConflictException('Dos rangos del body apuntan a la misma franja');
        }
        idsConservados.add(fila.id);
      }
      resueltos.push({ rango, fila });
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // Delete first so a rename cannot collide with a row that leaves the set.
        await tx.rangos_horario.deleteMany({
          where: { id: { notIn: [...idsConservados] } },
        });

        const renombres: Array<{ id: string; nombre: string }> = [];

        for (const { rango, fila } of resueltos) {
          const data = {
            nombre: rango.nombre,
            hora_inicio: horaDesdeTexto(rango.horaInicio),
            hora_fin: horaDesdeTexto(rango.horaFin),
            updated_at: new Date(),
          };
          if (!fila) {
            await tx.rangos_horario.upsert({
              where: { nombre: rango.nombre },
              update: data,
              create: {
                nombre: rango.nombre,
                hora_inicio: data.hora_inicio,
                hora_fin: data.hora_fin,
              },
            });
          } else if (fila.nombre === rango.nombre) {
            await tx.rangos_horario.update({ where: { id: fila.id }, data });
          } else {
            // Two-phase rename: another kept row may still hold the target name
            // (e.g. two ranges swapping names), and Postgres checks the unique
            // index on every statement. Release the name with a temporary one
            // first, then write the final name in the second pass.
            await tx.rangos_horario.update({
              where: { id: fila.id },
              data: { ...data, nombre: `tmp-${randomUUID()}` },
            });
            renombres.push({ id: fila.id, nombre: rango.nombre });
          }
        }

        for (const renombre of renombres) {
          await tx.rangos_horario.update({
            where: { id: renombre.id },
            data: { nombre: renombre.nombre },
          });
        }
      });
    } catch (error) {
      if (esViolacionDeUnicidad(error)) {
        throw new ConflictException('El nombre de la franja ya existe');
      }
      throw error;
    }

    return this.listar();
  }

  /**
   * Cross-item rules the DTO cannot express: duplicate `id` (400), duplicate
   * `nombre` (409), valid `HH:MM`, `horaFin > horaInicio` and no overlaps (400).
   */
  private validarRangos(rangos: RangoHorarioDto[]): void {
    if (rangos.length === 0) {
      throw new BadRequestException('rangos no puede estar vacio');
    }

    const ids = new Set<string>();
    const nombres = new Set<string>();
    const franjas: Array<{ inicio: number; fin: number }> = [];

    for (const rango of rangos) {
      if (rango.id) {
        if (ids.has(rango.id)) {
          throw new BadRequestException('No se admite un id duplicado en el body');
        }
        ids.add(rango.id);
      }

      if (nombres.has(rango.nombre)) {
        throw new ConflictException(`El nombre ${rango.nombre} esta duplicado`);
      }
      nombres.add(rango.nombre);

      if (!HORA_REGEX.test(rango.horaInicio) || !HORA_REGEX.test(rango.horaFin)) {
        throw new BadRequestException('Las horas deben tener formato HH:MM');
      }
      const inicio = minutosDeHoraTexto(rango.horaInicio);
      const fin = minutosDeHoraTexto(rango.horaFin);
      if (fin <= inicio) {
        throw new BadRequestException(
          `La hora de fin de ${rango.nombre} debe ser posterior a la de inicio`,
        );
      }
      franjas.push({ inicio, fin });
    }

    const ordenadas = [...franjas].sort((a, b) => a.inicio - b.inicio);
    for (let i = 1; i < ordenadas.length; i += 1) {
      if (ordenadas[i].inicio < ordenadas[i - 1].fin) {
        throw new BadRequestException('Los rangos horarios no pueden solaparse');
      }
    }
  }
}

/** Prisma unique-violation (`uq_rangos_horario_nombre` race → 409). */
function esViolacionDeUnicidad(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
