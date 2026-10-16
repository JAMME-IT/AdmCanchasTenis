import 'reflect-metadata';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PagosTurnoController } from './pagos-turno.controller';
import { PagosTurnoService } from './pagos-turno.service';
import type { CrearPagoTurnoDto } from './dto/crear-pago-turno.dto';
import type { ConsultarPagosTurnoDto } from './dto/consultar-pagos-turno.dto';
import type { PagoTurnoResponse } from './pago-turno-response';

describe('PagosTurno - Integración Controller-Service (ACT-54)', () => {
  const turnoId = '123e4567-e89b-12d3-a456-426614174000';
  const pagoId = '123e4567-e89b-12d3-a456-426614174001';

  const pagoMock: PagoTurnoResponse = {
    id: pagoId,
    turnoId,
    montoTotalTurno: 1000,
    fechaPago: new Date().toISOString(),
    turno: {
      id: turnoId,
      fecha: '2024-01-15',
      horaInicio: '10:00',
      canchaId: 'cancha-1',
    },
    usuario: {
      id: 'user-1',
      nombre: 'Juan',
      apellido: 'Pérez',
      numeroSocio: null,
    },
    lineas: [],
  };

  describe('POST /pagos-turno - Happy Path', () => {
    it('debería crear un pago exitosamente con el formato correcto', async () => {
      const serviceMock = {
        registrarPago: async (dto: CrearPagoTurnoDto) => pagoMock,
      };
      const controller = new PagosTurnoController(serviceMock as any);

      const dto: CrearPagoTurnoDto = {
        turnoId,
        montoTotalTurno: 1000,
      };

      const result = await controller.registrar(dto);

      assert.equal(result.id, pagoId);
      assert.equal(result.turnoId, turnoId);
      assert.equal(result.montoTotalTurno, 1000);
      assert.equal(result.usuario.nombre, 'Juan');
    });

    it('debería crear un pago con líneas de desglose', async () => {
      const pagoConLineas: PagoTurnoResponse = {
        ...pagoMock,
        lineas: [
          { id: 'linea-1', montoTurnoPago: 500 },
          { id: 'linea-2', montoTurnoPago: 500 },
        ],
      };
      const serviceMock = {
        registrarPago: async (dto: CrearPagoTurnoDto) => pagoConLineas,
      };
      const controller = new PagosTurnoController(serviceMock as any);

      const dto: CrearPagoTurnoDto = {
        turnoId,
        montoTotalTurno: 1000,
        lineas: [
          { montoTurnoPago: 500 },
          { montoTurnoPago: 500 },
        ],
      };

      const result = await controller.registrar(dto);

      assert.equal(result.lineas.length, 2);
      assert.equal(result.lineas[0].montoTurnoPago, 500);
      assert.equal(result.lineas[1].montoTurnoPago, 500);
    });
  });

  describe('POST /pagos-turno - Errores', () => {
    it('debería lanzar 404 si el turno no existe', async () => {
      const serviceMock = {
        registrarPago: async () => {
          throw new NotFoundException('Turno inexistente');
        },
      };
      const controller = new PagosTurnoController(serviceMock as any);

      const dto: CrearPagoTurnoDto = {
        turnoId,
        montoTotalTurno: 1000,
      };

      await assert.rejects(async () => controller.registrar(dto), NotFoundException);
    });

    it('debería lanzar 409 si ya existe un pago para el turno', async () => {
      const serviceMock = {
        registrarPago: async () => {
          throw new ConflictException('Ya existe un pago registrado para este turno');
        },
      };
      const controller = new PagosTurnoController(serviceMock as any);

      const dto: CrearPagoTurnoDto = {
        turnoId,
        montoTotalTurno: 1000,
      };

      await assert.rejects(async () => controller.registrar(dto), ConflictException);
    });

    it('debería lanzar 422 si el turno está cancelado', async () => {
      const serviceMock = {
        registrarPago: async () => {
          throw new UnprocessableEntityException('El turno está cancelado');
        },
      };
      const controller = new PagosTurnoController(serviceMock as any);

      const dto: CrearPagoTurnoDto = {
        turnoId,
        montoTotalTurno: 1000,
      };

      await assert.rejects(async () => controller.registrar(dto), UnprocessableEntityException);
    });

    it('debería lanzar 400 si las líneas no suman el monto total', async () => {
      const serviceMock = {
        registrarPago: async () => {
          throw new BadRequestException('La suma de líneas debe igualar el montoTotalTurno');
        },
      };
      const controller = new PagosTurnoController(serviceMock as any);

      const dto: CrearPagoTurnoDto = {
        turnoId,
        montoTotalTurno: 1000,
        lineas: [
          { montoTurnoPago: 500 },
          { montoTurnoPago: 400 },
        ],
      };

      await assert.rejects(async () => controller.registrar(dto), BadRequestException);
    });

    it('debería lanzar 400 si montoTotalTurno es menor o igual a 0', async () => {
      const serviceMock = {
        registrarPago: async () => {
          throw new BadRequestException('montoTotalTurno debe ser mayor a 0');
        },
      };
      const controller = new PagosTurnoController(serviceMock as any);

      const dto: CrearPagoTurnoDto = {
        turnoId,
        montoTotalTurno: 0,
      };

      await assert.rejects(async () => controller.registrar(dto), BadRequestException);
    });
  });

  describe('GET /pagos-turno - Happy Path', () => {
    it('debería listar todos los pagos sin filtros', async () => {
      const serviceMock = {
        listar: async (dto: ConsultarPagosTurnoDto) => [pagoMock],
      };
      const controller = new PagosTurnoController(serviceMock as any);

      const result = await controller.listar({});

      assert.equal(result.length, 1);
      assert.equal(result[0].id, pagoId);
    });

    it('debería filtrar por turnoId', async () => {
      const serviceMock = {
        listar: async (dto: ConsultarPagosTurnoDto) => {
          assert.equal(dto.turnoId, turnoId);
          return [pagoMock];
        },
      };
      const controller = new PagosTurnoController(serviceMock as any);

      const result = await controller.listar({ turnoId });

      assert.equal(result.length, 1);
    });

    it('debería filtrar por usuarioId', async () => {
      const serviceMock = {
        listar: async (dto: ConsultarPagosTurnoDto) => {
          assert.equal(dto.usuarioId, 'user-1');
          return [pagoMock];
        },
      };
      const controller = new PagosTurnoController(serviceMock as any);

      const result = await controller.listar({ usuarioId: 'user-1' });

      assert.equal(result.length, 1);
    });

    it('debería filtrar por rango de fechas', async () => {
      const serviceMock = {
        listar: async (dto: ConsultarPagosTurnoDto) => {
          assert.equal(dto.desde, '2024-01-01T00:00:00Z');
          assert.equal(dto.hasta, '2024-12-31T23:59:59Z');
          return [pagoMock];
        },
      };
      const controller = new PagosTurnoController(serviceMock as any);

      const result = await controller.listar({
        desde: '2024-01-01T00:00:00Z',
        hasta: '2024-12-31T23:59:59Z',
      });

      assert.equal(result.length, 1);
    });

    it('debería devolver array vacío si no hay pagos', async () => {
      const serviceMock = {
        listar: async (dto: ConsultarPagosTurnoDto) => [],
      };
      const controller = new PagosTurnoController(serviceMock as any);

      const result = await controller.listar({});

      assert.equal(result.length, 0);
    });
  });

  describe('GET /pagos-turno - Errores', () => {
    it('debería lanzar 400 si desde es inválido', async () => {
      const serviceMock = {
        listar: async () => {
          throw new BadRequestException('desde debe ser una fecha válida');
        },
      };
      const controller = new PagosTurnoController(serviceMock as any);

      await assert.rejects(
        async () => controller.listar({ desde: 'fecha-invalida' }),
        BadRequestException,
      );
    });

    it('debería lanzar 400 si hasta es inválido', async () => {
      const serviceMock = {
        listar: async () => {
          throw new BadRequestException('hasta debe ser una fecha válida');
        },
      };
      const controller = new PagosTurnoController(serviceMock as any);

      await assert.rejects(
        async () => controller.listar({ hasta: 'no-es-fecha' }),
        BadRequestException,
      );
    });
  });
});
