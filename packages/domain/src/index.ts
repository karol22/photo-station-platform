/**
 * @psp/domain — lógica pura de negocio sin I/O.
 *
 * Superficie pública fijada en `docs/arquitectura/01-apis-de-paquetes.md` (sección @psp/domain).
 * Todo recibe `now: Date` y funciones inyectadas: mismo insumo, misma salida.
 */
export * from './ids';
export * from './time';
export * from './hierarchy';
export * from './rbac';
export * from './capabilities';
export * from './features';
export * from './pricing';
export * from './sessions';
export * from './handoff';
export * from './audit';
export * from './catalog';
