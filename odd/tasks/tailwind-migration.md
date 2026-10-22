# Migración a Tailwind CSS

Objetivo: Migrar todo el frontend de CSS-in-JS/inline styles a Tailwind CSS. Branch: `feat/tailwind-migration`. Estrategia: single-pr.

## Specs

- S1: "vamos a implementar tailwind" — Tailwind CSS instalado y configurado en apps/web
- S2: "vamos a migrar todo lo que esta hecha con css puro a tailwind" — Todos los componentes y páginas migrados a Tailwind classes
- S3: "0 css a menos que sea 100% necesario" — Sin inline styles ni CSS-in-JS excepto casos justificados
- S4: "en esta sesion o cualquier persona que trabaje en el front" — Decisión persistente: Tailwind es obligatorio para todo el front

## Tasks

- T1 (S1, route: inline, status: pending): Instalar Tailwind CSS v3 + configurar postcss, tailwind.config.js, e index.css
- T2 (S2, route: inline, status: pending): Migrar Layout.tsx (header, nav, dock, footer) a Tailwind
- T3 (S2, route: inline, status: pending): Migrar Home.tsx a Tailwind
- T4 (S2, route: inline, status: pending): Migrar páginas restantes (Admin, Turnos, MisTurnos, MisCuotas, CompletarPerfil, Ingresar, Registro)
- T5 (S2, route: inline, status: pending): Migrar componentes (Feedback, AuthMarca, TurnoGrilla, BloqueoTemporal)
- T6 (S2+S3, route: inline, status: pending): Verificar build + limpieza de tokens innecesarios

## Log

- L1 (2026-10-22, usuario): "Vamos a implementar tailwind y vamos a migrar todo lo que esta hecha con css puro a tailwind. A partir de ahora en mas, en esta sesion o cualquier persona que trabaje en el front, lo tendra que hacer con tailwind, 0 css a menos que sea 100% necesario o se te solicite hacerlo."
