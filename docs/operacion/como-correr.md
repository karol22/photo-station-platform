# Cómo correr la plataforma

## Requisitos
- Node ≥ 22.13 (probado con 26) y pnpm 11.
- Sin red después de `pnpm install`. Sin hardware: todo tiene mock.

## Arranque completo

```bash
pnpm install
pnpm seed        # crea var/control-plane/control-plane.sqlite con el dataset demo
pnpm dev         # control-plane :4000, station-agent :4100, kiosk :5173, admin :5174
```

- Kiosco: http://localhost:5173 — pide permiso de cámara; sin cámara usa la fuente sintética.
- Admin: http://localhost:5174 — inicia sesión con un usuario demo (abajo).
- Panel técnico del kiosco: toca cinco veces la esquina superior izquierda en la pantalla de atracción; PIN `2468`.

## Usuarios demo

| Usuario | Rol | Alcance |
|---|---|---|
| `owner@platform.demo` | propietario de plataforma | toda la plataforma |
| `admin@unadetodos.demo` | administrador de marca | organización Una de Todos |
| `franq@norte.demo` | propietario de franquicia | franquicia Norte (Una de Todos) |
| `tecnico@norte.demo` | técnico | franquicia Norte |
| `analista@unadetodos.demo` | analista, sólo lectura | organización Una de Todos |
| `admin@fotorapida.demo` | administrador de marca | organización FotoRápida |

La contraseña de todos es `demo`. Son datos ficticios de `packages/fixtures`.

## Máquina que simula el agente

`PSP_STATION_MACHINE_ID` (por defecto `mch_demo_doc_01`, la estación documental universitaria). Otras: `mch_demo_thermal_01` (kiosco térmico de cafetería), `mch_demo_premium_01` (cabina premium). Cambiar la variable y reiniciar el agente cambia productos, branding, capacidades y precios del kiosco.

## Simulaciones

```bash
pnpm psp simulate-fleet --count 100     # 100 agentes virtuales enviando heartbeats
pnpm psp bundle --machine mch_demo_doc_01   # imprime el bundle efectivo con procedencia
pnpm psp catalog                        # capacidades registradas
```

Desde admin: Releases → crear rollout → observar estados por máquina. Desde el panel técnico: simular aprobación, rechazo o expiración de pago; simular impresora sin papel; poner en mantenimiento.

## Estado local
Todo vive en `var/` en la raíz del repo (ignorado por git): `var/control-plane/` (base SQLite y activos) y `var/station/<machineId>/` (base local, identidad, fotos efímeras de sesiones e impresiones simuladas en `prints/`). Borrar `var/` y volver a `pnpm seed` deja el sistema como nuevo.

## Sin nube
El agente arranca aunque el control-plane no exista: usa el último bundle cacheado o, si no hay, materializa el dataset demo localmente. El kiosco funciona igual; `cloudReachable` aparece en falso en el panel técnico y los eventos esperan en el outbox hasta reconectar.
