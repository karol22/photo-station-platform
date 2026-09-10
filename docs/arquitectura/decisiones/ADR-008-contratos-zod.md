# ADR-008 · Contratos zod compartidos y aditivos

## Contexto
Cuatro apps intercambian datos. Los agentes de IA necesitan una sola fuente de verdad de formas para no divergir.

## Decisión
`packages/contracts` define con zod todas las entidades, mensajes de API y protocolo. Los tipos TypeScript se infieren de los esquemas. Toda entrada de red se valida con el esquema. Dentro de una versión (`v1`) sólo se agregan campos opcionales; un cambio incompatible crea una versión nueva.

## Consecuencias
- Validación en el borde en control-plane, station-agent y kiosco.
- Los fixtures se validan contra los contratos en las pruebas.
- El catálogo de features, capacidades y permisos son listas cerradas en contratos.
