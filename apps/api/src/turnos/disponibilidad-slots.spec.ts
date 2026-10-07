import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  construirSlots,
  diaSemanaISODeFecha,
  duracionPorDefecto,
  esFechaValida,
  formatearHora,
  haySolapamiento,
  minutosDeHora,
} from './disponibilidad-slots';

describe('disponibilidad-slots (ACT-33)', () => {
  it('defaults to 60 min on weekdays and 90 min on weekends', () => {
    for (const dia of [1, 2, 3, 4, 5]) {
      assert.equal(duracionPorDefecto(dia), 60);
    }
    assert.equal(duracionPorDefecto(6), 90);
    assert.equal(duracionPorDefecto(7), 90);
  });

  it('maps YYYY-MM-DD dates to ISO weekdays (2026-09-30 is a Wednesday)', () => {
    assert.equal(diaSemanaISODeFecha('2026-09-30'), 3);
    assert.equal(diaSemanaISODeFecha('2026-10-03'), 6);
    assert.equal(diaSemanaISODeFecha('2026-10-04'), 7);
  });

  it('rejects malformed or impossible dates', () => {
    assert.equal(esFechaValida('2026-09-30'), true);
    assert.equal(esFechaValida('30/09/2026'), false);
    assert.equal(esFechaValida('2026-13-01'), false);
    assert.equal(esFechaValida('2026-02-30'), false);
    assert.equal(esFechaValida('2026-9-3'), false);
    assert.equal(esFechaValida(''), false);
  });

  it('reads Prisma @db.Time values as Date or string', () => {
    assert.equal(minutosDeHora(new Date(Date.UTC(1970, 0, 1, 8, 0))), 480);
    assert.equal(minutosDeHora(new Date(Date.UTC(1970, 0, 1, 18, 30))), 1110);
    assert.equal(minutosDeHora('08:00'), 480);
    assert.equal(minutosDeHora('18:30:00'), 1110);
    assert.equal(formatearHora(480), '08:00');
    assert.equal(formatearHora(1110), '18:30');
  });

  it('treats ranges as half-open [inicio, fin)', () => {
    assert.equal(haySolapamiento(540, 600, 600, 660), false);
    assert.equal(haySolapamiento(540, 601, 600, 660), true);
    assert.equal(haySolapamiento(600, 660, 600, 660), true);
  });

  it('builds consecutive slots fully contained in the range', () => {
    const slots = construirSlots({
      canchas: [{ id: 'c1', nroCancha: 1, estadoActual: 'disponible' }],
      rangos: [{ horaInicio: '08:00', horaFin: '10:00' }],
      turnos: [],
      duracionMinutos: 60,
      luz: null,
    });
    assert.deepEqual(
      slots.map((slot) => [slot.horaInicio, slot.horaFin, slot.disponible, slot.requiereLuz]),
      [
        ['08:00', '09:00', true, false],
        ['09:00', '10:00', true, false],
      ],
    );
    assert.equal(slots[0]?.motivo, null);
  });

  it('drops the trailing partial slot that would exceed the range', () => {
    const slots = construirSlots({
      canchas: [{ id: 'c1', nroCancha: 1, estadoActual: 'disponible' }],
      rangos: [{ horaInicio: '08:00', horaFin: '09:30' }],
      turnos: [],
      duracionMinutos: 60,
      luz: null,
    });
    assert.deepEqual(
      slots.map((slot) => `${slot.horaInicio}-${slot.horaFin}`),
      ['08:00-09:00'],
    );
  });

  it('marks slots overlapped by a booking as unavailable with its state as motivo', () => {
    const slots = construirSlots({
      canchas: [{ id: 'c1', nroCancha: 1, estadoActual: 'disponible' }],
      rangos: [{ horaInicio: '08:00', horaFin: '11:00' }],
      turnos: [{ canchaId: 'c1', horaInicio: '09:00', horaFin: '10:00', estadoActual: 'confirmado' }],
      duracionMinutos: 60,
      luz: null,
    });
    assert.equal(slots[1]?.disponible, false);
    assert.equal(slots[1]?.motivo, 'Turno confirmado');
    assert.equal(slots[0]?.disponible, true);
    assert.equal(slots[2]?.disponible, true);
  });

  it('covers 60 vs 90 min overlaps: a 90-min booking blocks both 60-min slots it touches', () => {
    const slots = construirSlots({
      canchas: [{ id: 'c1', nroCancha: 1, estadoActual: 'disponible' }],
      rangos: [{ horaInicio: '09:00', horaFin: '12:00' }],
      turnos: [{ canchaId: 'c1', horaInicio: '09:00', horaFin: '10:30', estadoActual: 'iniciado' }],
      duracionMinutos: 60,
      luz: null,
    });
    assert.equal(slots[0]?.disponible, false);
    assert.equal(slots[0]?.motivo, 'Turno iniciado');
    assert.equal(slots[1]?.disponible, false);
    assert.equal(slots[2]?.disponible, true);
  });

  it('does not block a slot starting exactly when a booking ends', () => {
    const slots = construirSlots({
      canchas: [{ id: 'c1', nroCancha: 1, estadoActual: 'disponible' }],
      rangos: [{ horaInicio: '08:00', horaFin: '10:00' }],
      turnos: [{ canchaId: 'c1', horaInicio: '08:00', horaFin: '09:00', estadoActual: 'finalizado' }],
      duracionMinutos: 60,
      luz: null,
    });
    assert.equal(slots[0]?.disponible, false);
    assert.equal(slots[1]?.disponible, true);
  });

  it('keeps bookings scoped to their own court', () => {
    const slots = construirSlots({
      canchas: [
        { id: 'c1', nroCancha: 1, estadoActual: 'disponible' },
        { id: 'c2', nroCancha: 2, estadoActual: 'disponible' },
      ],
      rangos: [{ horaInicio: '08:00', horaFin: '09:00' }],
      turnos: [{ canchaId: 'c1', horaInicio: '08:00', horaFin: '09:00', estadoActual: 'confirmado' }],
      duracionMinutos: 60,
      luz: null,
    });
    assert.equal(slots[0]?.disponible, false);
    assert.equal(slots[1]?.disponible, true);
    assert.equal(slots[1]?.canchaId, 'c2');
    assert.equal(slots[1]?.nroCancha, 2);
  });

  it('marks every slot of a non-disponible court with a clear motivo', () => {
    const slots = construirSlots({
      canchas: [{ id: 'c1', nroCancha: 1, estadoActual: 'en_mantenimiento' }],
      rangos: [{ horaInicio: '08:00', horaFin: '10:00' }],
      turnos: [],
      duracionMinutos: 60,
      luz: null,
    });
    assert.equal(slots.length, 2);
    for (const slot of slots) {
      assert.equal(slot.disponible, false);
      assert.equal(slot.motivo, 'Cancha no disponible');
    }
  });

  it('computes requiereLuz from the intersection with the luz franja', () => {
    const slots = construirSlots({
      canchas: [{ id: 'c1', nroCancha: 1, estadoActual: 'disponible' }],
      rangos: [{ horaInicio: '17:00', horaFin: '20:00' }],
      turnos: [],
      duracionMinutos: 60,
      luz: { horaInicio: '18:30', horaFin: '22:00' },
    });
    assert.deepEqual(
      slots.map((slot) => [slot.horaInicio, slot.requiereLuz]),
      [
        ['17:00', false],
        ['18:00', true],
        ['19:00', true],
      ],
    );
  });

  it('does not require luz when the slot only touches the franja boundary', () => {
    const slots = construirSlots({
      canchas: [{ id: 'c1', nroCancha: 1, estadoActual: 'disponible' }],
      rangos: [{ horaInicio: '17:00', horaFin: '19:00' }],
      turnos: [],
      duracionMinutos: 60,
      luz: { horaInicio: '18:00', horaFin: '22:00' },
    });
    assert.equal(slots[0]?.requiereLuz, false);
    assert.equal(slots[1]?.requiereLuz, true);
  });
});
