# Design — Culinary Dueño

World: la tira del corte de caja al final de la noche. Una cifra arriba y debajo renglones separados por una línea fina. Rechaza el tablero de tarjetas iguales.

## Tokens (src/theme.css)

| Rol | Claro | Oscuro |
|---|---|---|
| Barra superior `--top` | #202733 | #202733 |
| Fondo `--bg` | #e7e9ed | #161b23 |
| Texto `--ink` | #242e3b | #eef1f5 |
| Secundario `--muted` | #596575 | #a5afbc |
| Líneas `--line` | #cdd3dc | #323c4a |
| Barras `--bar` | #273241 | #8fa0b5 |
| Acción `--amber` sobre `--amber-ink` | #f2b93b / #29210c | igual |
| Marca sobre fondo `--mark` | #b97b00 | #f2b93b |
| Atraso `--late` | #af2d22 | #ff9f8f |

El tema sigue al sistema: el dueño consulta tanto a mediodía en la calle como de noche.

Tipo: Inter Variable con cifras tabulares.

## Rules

- **Ámbar.** Una sola marca por vista: la acción, el periodo elegido o la hora en curso. `--mark` existe porque #f2b93b no alcanza 3:1 sobre el fondo claro.
- **Rojo.** Sólo una sucursal atrasada o un error, siempre con icono y texto.
- **Sin tarjetas.** Las secciones se separan con una línea, como renglones del corte.
- **Gráficas.** Barras neutras y una sola resaltada. Una figura de una sola serie no lleva leyenda. Toda gráfica tiene vista de tabla, y su cifra aparece en texto sobre la gráfica, sin tooltip flotante, porque en un teléfono el dedo lo taparía.
- **Teléfono primero.** Una columna hasta 900 px. Objetivos de 44 px.
