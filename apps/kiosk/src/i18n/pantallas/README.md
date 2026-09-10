# Textos por pantalla

Un archivo por pantalla, con la misma forma que `../extra.ts`: una tupla `[es, en]` por clave.

Existe para que varias personas puedan trabajar en pantallas distintas a la vez sin pelearse por
el mismo archivo. `../extra.ts` los junta; la compuerta `i18n-parity` sigue viendo un solo
catálogo y sigue exigiendo que las dos columnas tengan exactamente las mismas claves.

Ninguna cadena lleva nombre de marca, precio ni ciudad: eso viene del bundle.
