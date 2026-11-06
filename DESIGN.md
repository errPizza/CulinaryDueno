# Design — Culinary Dueño (v3)

World: el corte del día visto en vivo. Una tarjeta grafito con la cifra que responde la pantalla y, alrededor, tarjetas blancas con lo que la explica. Lo que importa resalta; lo demás queda en gris.

## Tokens (src/theme.css)

| Rol | Claro | Oscuro |
|---|---|---|
| Tarjeta protagonista y barra de secciones `--top` | #1b212b | #222a37 |
| Fondo `--bg` | #edf0f4 | #0f1319 |
| Tarjetas `--sheet` | #ffffff | #181e27 |
| Mosaicos dentro de tarjetas `--raised` | #f4f6f9 | #1f2631 |
| Texto `--ink` | #18202b | #f1f4f8 |
| Secundario `--muted` | #5a6575 | #9aa5b4 |
| Cifras neutras `--neutral` | #5b6676 | #a7b1bf |
| Barras neutras `--bar` | #b9c2ce | #4a5566 |
| Acción `--amber` sobre `--amber-ink` | #f2b93b / #2a1f05 | igual |
| Dato principal `--amber-data` | #d99a1c | #f2b93b |
| Bueno `--ok`, píldora `--good-bg` / `--good-ink` | #15803d · #dcfce7 / #166534 | #4ade80 · #123020 / #7ee8a4 |
| Malo `--late`, píldora `--late-wash` / `--bad-ink` | #c2321f · #fee4e2 / #9f1d14 | #ff8a7a · #3a1a17 / #ffb4a8 |

El tema sigue al sistema: el dueño consulta tanto a mediodía en la calle como de noche.

Tipo: Inter Variable con cifras tabulares. Cifras grandes a 650–700 con tracking negativo; los centavos de la cifra principal van más chicos.

## Layout (v3, aprobado el 2026-11-04)

- **Escritorio:** barra lateral con «Viendo» (la sucursal), los grupos «Hoy» (Resumen, Productos, Caja y cortes, Personal) y «Análisis» (Tendencia, Pronóstico, Rentabilidad, Cocina, Clientes); abajo Mensajes, Alertas, Ajustes y la cuenta con su botón de salir.
- **Encabezado de cada pantalla:** título y una frase con lo que importa ahora (`src/heads.tsx`); a la derecha el periodo, actualizar y la acción principal en ámbar.
- **Fila protagonista:** la tarjeta grafito con su gráfica al pie y, a su lado, tres `StatCard` con icono y su cambio (`HeroRow`). Debajo, filas `.row.r3`, `.r21`, `.r2` de tarjetas blancas.
- **Teléfono:** todo en una columna, el selector de sucursal y el periodo arriba, la barra flotante abajo. Objetivos de 40 px en teléfono y 32 px en escritorio.
- La propuesta aprobada está en `diseño-v3/` (`propuesta.html` y sus PNG); `SHOTS=1 npx playwright test -g capturas` saca las pantallas reales en `test-results/v3/`.

## Rules

- **Una tarjeta grafito por vista.** Lleva la cifra que responde la pantalla y, en el Resumen, su gráfica. Todo lo demás va en tarjetas blancas de 20 px, sin borde y con sombra muy suave.
- **Color por significado.** Las cifras neutras van en gris (`--neutral`). Un cambio contra el tramo anterior va en píldora con flecha y signo: verde si fue en la buena dirección, rojo si fue en la mala, gris («Igual») si no cambió. En descuentos, cancelaciones y cortesías subir es malo.
- **Comparar sólo lo comparable.** Hoy se compara con ayer hasta la última hora cerrada. Las píldoras por sucursal, canal y ajustes sólo salen cuando los dos lados son periodos completos con las mismas sucursales.
- **Ámbar.** La acción, el periodo o la cifra elegida y el dato principal de cada gráfica (las ventas de hoy, la barra mayor, lo vendido de la meta).
- **Rojo.** Una cifra mala, una sucursal sin contacto o un error, siempre con icono, flecha o texto.
- **Gráficas.** Barras redondeadas; el tramo anterior como contorno detrás de cada barra. Toda gráfica tiene vista de tabla, y su cifra aparece en texto sobre la gráfica, sin tooltip flotante, porque en un teléfono el dedo lo taparía.
- **Movimiento.** Las tarjetas entran escalonadas, la cifra del día sube desde su valor anterior, las barras crecen y la meta se llena. Con movimiento reducido no se anima nada.
- **Teléfono primero.** Una columna hasta 900 px con la barra de secciones flotando abajo; en escritorio, barra lateral con todas las secciones. Objetivos de 44 px.
- **Plan Pro bloqueado.** Con sólo sucursales Lite a la vista, las áreas Pro (Caja, Personal, Tendencia, Pronóstico, Rentabilidad, Cocina, Clientes) llevan candado en la navegación y se abren bloqueadas al instante, sin esqueleto ni petición al servidor. «Fechas» se ve con candado en vez de desaparecer. Con planes mixtos no se bloquea nada: cada cifra dice qué sucursal Lite no incluye.
- **Mensajes.** Conversación por sucursal (lo tuyo en grafito a la derecha, lo de la sucursal a la izquierda), un mensaje a todas a la vez y solicitudes al soporte de Culinary. Los no leídos van en rojo en la navegación.
