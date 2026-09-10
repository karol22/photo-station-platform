# Dónde vive cada mecánica

Este repositorio sigue dos estándares que se conservan íntegros y en su idioma original:

- [**Repositorio listo para agentes**](repositorio-listo-para-agentes.md) — cómo está estructurado el repositorio para que un agente lo opere en frío. Su medición está en [`auditoria.md`](auditoria.md).
- [**Ingeniería de producto con agentes**](ingenieria-de-producto-con-agentes.md) — cómo se conduce el trabajo: elegir el modo, sostener una campaña, explorar antes de converger, terminar ejerciendo la interfaz.

Esta tabla dice dónde vive cada mecánica del segundo, para que nadie tenga que deducirlo.

| Sección del estándar | Dónde vive aquí |
|---|---|
| 0 · Elegir el trabajo antes de cargar contexto | `AGENTS.md` §0, con tres modos y lo que **no** debe abrir cada uno |
| 1 · Leer el repositorio antes de proponer arquitectura | El apartado *Estado del sistema* de cada campaña, que se escribe antes de cambiar nada |
| 2 · Campaña durable | `ops/campanas/<nombre>/STATE.md`, con su plantilla |
| 3 · Política dura frente a atención activa | `ops/POLITICA.md` y `ops/ATENCION.md`, separados a propósito |
| 3 · Estado de trabajo e historia | `ops/state/PROGRESS.md` y `ops/state/ARTIFACTS.md`; la historia, en git y en la evidencia de cada campaña |
| 4 · Exploración en ramas | Agentes en paralelo con un worktree cada uno; la evidencia de cada rama vive separada en su campaña |
| 5 · Explorar, sintetizar, converger | Los apartados *Caminos considerados* y *Camino elegido* de la campaña |
| 6 · Buscar de lado | *Preguntas abiertas* de la campaña: cuál reduciría más la incertidumbre |
| 7 · Repartir esfuerzo | *Caminos considerados* registra por qué se abandonó una rama |
| 8 · El contexto se elige | Las listas de lectura por modo de `AGENTS.md` §0 |
| 9 · Navegación deliberada | El mapa de `AGENTS.md` §8 y el `README.md` de cada paquete |
| 10 · Hechos por código, juicio por persona | Las compuertas de `tools/gates/` comprueban hechos; el criterio vive en `ops/ATENCION.md` y en los documentos de producto. Nunca se inventa un número para automatizar algo subjetivo |
| 11 · El trabajo de interfaz termina en la interfaz | `AGENTS.md` §7 paso 5, con la lista de estados que se inspeccionan |
| 12 · Evaluación por comportamiento | `ops/evals/` y las pruebas de cada paquete; lo que queda de juicio se marca como tal en la campaña |
| 13 · El bucle más pequeño | `pnpm gate:quick` como verificador estrecho entre pasos |
| 14 · La verificación manda sobre el flujo | Ninguna compuerta en rojo permite declarar terminado; un salto se registra en la campaña |
| 15 · Evidencia, no volcados | La carpeta de cada campaña guarda reproducciones, capturas y referencias exactas, no transcripciones |
| 16 · Mejorar el entorno sólo cuando la falla lo gana | Cada mecanismo de esta tabla nombra la falla que evita, abajo |
| 17 · Los cambios de ingeniería de agentes exigen evidencia | `ops/notes/rechazos.md` guarda la falla observada que motivó cada cambio |
| 18 · Varios agentes no son progreso | Se usan cuando hay búsqueda independiente de verdadero valor; si no, un agente con buenas herramientas |
| 19 · Autoridad centralizada | La sesión principal integra; los agentes en paralelo no fusionan decisiones de arquitectura |
| 20 · Revisión de producto al final | `AGENTS.md` §7 pasos 5 y 6, y el apartado *Verificación* de la campaña |

## Qué falla evita cada mecanismo

Un mecanismo que no nombra la falla que evita sobra, y se borra.

| Mecanismo | La falla que evita, observada en este repositorio |
|---|---|
| Tres modos con su lista de lectura | Trabajo de producto que se desvía hacia la maquinaria de agentes, y al revés |
| `ops/ATENCION.md` | Criterio que se pierde con la compresión del contexto: se propuso subir fotografías a la nube contradiciendo un principio central del producto |
| `ops/POLITICA.md` en el borde de la herramienta | Una regla que sólo es prosa no se cumple |
| Campañas con estado reescrito | Un corte por límite de uso dejó siete trabajos a medias; se retomaron leyendo disco |
| Compuerta de texto de negocio | Se escribió una frase de la marca dentro del código de la interfaz, rompiendo el multi-marca |
| Compuerta de catálogo | Una capacidad sin registrar no existe para quien llega en frío |
| Terminar ejerciendo la interfaz | Varios defectos visibles (marcadores sin sustituir, texto invertido por el espejo, un hook mal colocado) sólo aparecieron al recorrer la pantalla, nunca leyendo el código |
