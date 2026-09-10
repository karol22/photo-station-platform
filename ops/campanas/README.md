# Campañas

Una campaña es un trabajo que no cabe en una conversación. Su estado vive aquí para que sobreviva a la compresión del contexto, a una sesión nueva, a un cambio de modelo y a una interrupción.

Cada campaña tiene su carpeta con un `STATE.md` que se **reescribe** conforme cambia el entendimiento. No es una bitácora ni una transcripción: dice lo que es verdad ahora.

La evidencia acompaña al estado en la misma carpeta: reproducciones, capturas, prototipos, mediciones, trazas, referencias exactas a archivos y símbolos. Alguien que llega en frío debe poder continuar leyendo la carpeta, sin la conversación anterior.

Plantilla: [`PLANTILLA.md`](PLANTILLA.md).

| Campaña | Estado |
|---|---|
| [Rediseño visual del kiosco](rediseno-visual-kiosco/STATE.md) · [por dónde empezar](rediseno-visual-kiosco/LEEME.md) | abierta, esperando aprobación |

El progreso general del repositorio, que es otra cosa, vive en [`../state/PROGRESS.md`](../state/PROGRESS.md).

## Cuando la campaña no cabe en una persona

Un trabajo grande se reparte entre varios agentes en paralelo, **un worktree por cada uno**
(`scripts/agent-worktree.sh <nombre>`), que es lo que la política exige para que nadie sobrescriba
lo de otro. Lo aprendido haciéndolo:

- **Repartir por archivos, no por temas.** Antes de lanzar a nadie, el árbol tiene que estar hecho
  de piezas que no se tocan: un archivo de estilos y uno de textos por pantalla, y los índices que
  los juntan escritos de antemano. Sin eso, seis personas se pelean por el mismo archivo.
- **`pnpm install --prefer-offline` en cada worktree**, que tarda segundos y sin él no hay
  `node_modules` y nada se puede probar.
- **El agente de estación es uno solo y se comparte.** Varios kioscos apuntando al mismo `:4100` se
  cancelan las sesiones entre ellos, porque cualquiera que vuelva a atracción llama a
  `releaseSession`. Quien vaya a ejercer el recorrido de seguido levanta su propio agente.
- **Lo que cada quien no pudo comprobar vale tanto como lo que hizo.** Un reporte que dice «no vi
  el destello con mis ojos» ahorra una búsqueda a quien integra; uno que lo calla la provoca.
- **Al fusionar aparecen los choques reales**, y no son de sintaxis: dos ramas que arreglan la misma
  cosa de dos maneras razonables. Ahí se conservan las dos mitades buenas, no la última que llegó.
