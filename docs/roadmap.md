# Roadmap de evolución

Cómo crece la plataforma desde una máquina hasta una red de franquicias. Cada fase agrega capacidades sin rediseñar lo anterior: los contratos, el agente y el kiosco se mantienen; cambian adaptadores, infraestructura y alcance operativo.

| Fase | Objetivo | Qué se agrega | Qué no cambia |
|---|---|---|---|
| **0 · Mock completo (hoy)** | Demostrar el producto de extremo a extremo en una laptop sin hardware ni nube | Kiosco con webcam o cámara sintética, guía documental local, edición, composición, impresión simulada, pagos y IA simulados, administración completa con dataset demo, flota simulada, despliegues simulados | — |
| **1 · Piloto de una máquina** | Operar una estación real en una ubicación amiga | Adaptador de impresora real (CUPS/driver del fabricante) detrás del puerto de impresión; captura con la cámara industrial vía `getUserMedia` o un puente local; bloqueo de kiosco en el sistema operativo; control-plane en un servidor pequeño; enrolamiento real; primer terminal de pago (Nayax o QR de Mercado Pago) detrás de `PaymentTerminal`; consentimiento y libro mayor activos | Contratos, kiosco, motor de configuración, bundles, protocolo de flota |
| **2 · Red propia (10–50 máquinas)** | Varias ubicaciones y ciudades operadas por la empresa | Postgres y almacenamiento de objetos, releases firmadas y rollouts por canal, monitoreo y alertas desde eventos, checklists de mantenimiento en campo, consumibles con umbrales, entrega digital (WhatsApp/correo) detrás de `DeliveryChannel`, campañas estacionales reales, vistas guardadas y exportaciones | Agente, API de estación, modelo de datos, RBAC |
| **3 · Franquicias (50–500)** | Terceros operan bajo la marca | Portal de franquicia con entitlements por plan, bloqueos contractuales de branding y precios, campañas obligatorias con campos editables, soporte remoto acotado, facturación y conciliación (fiscal/CRM detrás de sus puertos), documentación operativa por franquicia, auditoría exigible | Jerarquía de seis niveles, herencia con procedencia, aislamiento por alcance |
| **4 · Escala y nuevas superficies (500–1 000+)** | Multi-país, multi-marca, hardware heterogéneo | Kiosco empaquetado en Android/WebView con agente embebido, canal WebSocket/MQTT opcional, agregados materializados de métricas, particiones por organización, experiencias de IA con proveedores externos bajo consentimiento explícito, cuentas de cliente opcionales separadas de usuarios administrativos | Todo lo anterior |

## Principios que gobiernan cada paso
- Una integración real entra siempre como adaptador de un puerto existente, con feature flag, consentimiento cuando aplica, registro en el libro mayor y rollout gradual por canal.
- Ninguna fase exige internet para atender a un cliente: la matriz de degradación de `docs/arquitectura/00-vision-general.md` §4.3 se mantiene.
- Cada cambio de contrato es aditivo dentro de `v1`; un cambio incompatible abre `v2` y las máquinas antiguas siguen operando hasta actualizarse.
- Las decisiones de arquitectura se registran como ADR antes de implementarse.

## Cómo se decide pasar de fase
Una fase termina cuando sus escenarios de aceptación (`docs/requisitos-producto.md` §49) se demuestran con datos reales de operación y `docs/trazabilidad.md` marca `completo` lo que la fase prometía.
