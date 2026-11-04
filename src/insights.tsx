import type { ReactNode } from 'react';
import { CircleAlert, CloudRain, Info, TriangleAlert } from 'lucide-react';
import type * as api from './api';
import type { View } from './app';
import { branchOf, Headline, Locked, sum, type Of } from './detail';
import { bps, dayName, duration, hourLabel, hoursWorked, kindLabel, modeLabel, money, plural, shortDate, tenths, WEEKDAYS, whole } from './format';
import { allLite, Block, Delta, Facts, ProNote, Rows } from './parts';

// The second half of the panel: goals, shifts and areas on the summary, and the Pro areas built on what the branches
// measure beyond the sale. Every figure comes from the server; the app only words it.

const PERIOD_NAME = { day: 'Meta del día', month: 'Meta del mes', year: 'Meta del año' } as const;

function Progress({ name, value, of, note }: { name: string; value: number; of: number; note: ReactNode }) {

    return <li><div>

        <span className="rank-name">{name}</span>
        <span className="rank-net">{bps(of ? Math.round(value * 10_000 / of) : 0)}</span>
        <span className="rank-bar goal"><span style={{ width: `${Math.min(100, of ? value / of * 100 : 0)}%` }} /></span>
        <span className="rank-state">{note}</span>

    </div></li>;
}

const pace = (g: api.Goal) => g.pace === 'reached' ? 'Meta cumplida.' : g.pace === 'open' ? `Faltan ${money(g.target - g.actual)}.` : g.pace === 'ahead' ? `Vas adelantado: a este ritmo cerrarías en ${money(g.projected)}.` : g.pace === 'close' ? `Vas casi al ritmo: cerrarías en ${money(g.projected)}.` : `Vas atrasado: a este ritmo cerrarías en ${money(g.projected)}.`;

const ARC_R = 92, ARC = Math.PI * ARC_R;
const arcPoint = (share: number, r: number) => [120 - r * Math.cos(Math.PI * share), 112 - r * Math.sin(Math.PI * share)] as const;

/** The first goal as an arc: amber for what is sold, a dark tick where an even pace would be today. */
function Gauge({ goal }: { goal: api.Goal }) {

    const share = goal.target ? Math.min(1, goal.actual / goal.target) : 0;
    const due = goal.target && goal.expected ? Math.min(1, goal.expected / goal.target) : null;
    const [sx, sy] = arcPoint(0, ARC_R), [ex, ey] = arcPoint(1, ARC_R), path = `M${sx} ${sy} A${ARC_R} ${ARC_R} 0 0 1 ${ex} ${ey}`;
    const tick = due === null ? null : [arcPoint(due, ARC_R - 15), arcPoint(due, ARC_R + 15)] as const;

    return <div className="gauge">

        <svg viewBox="0 0 240 124" role="img" aria-label={`${PERIOD_NAME[goal.period]}: ${bps(goal.progressBps)} de ${money(goal.target)}`}>

            <path d={path} className="gauge-track" />
            <path d={path} className="gauge-fill" style={{ strokeDasharray: ARC, strokeDashoffset: ARC * (1 - share) }} />
            {tick && <line x1={tick[0][0]} y1={tick[0][1]} x2={tick[1][0]} y2={tick[1][1]} className="gauge-due" />}

        </svg>
        <div className="gauge-center"><b>{bps(goal.progressBps)}</b><small>{PERIOD_NAME[goal.period].toLowerCase()}</small></div>
        {goal.pace !== 'open' && goal.pace !== 'reached' && goal.expected > 0 && <p className="gauge-pace"><Delta now={goal.actual} before={goal.expected} /><span>contra el ritmo parejo</span></p>}

    </div>;
}

export function GoalsBlock({ goals }: { goals: api.Goals | null }) {

    if (!goals) return null;

    const first = goals.goals[0];

    return <Block title="Metas" className="goals">

        {first && <Gauge goal={first} />}
        {goals.goals.length
            ? <ol className="progress" aria-label="Avance de metas">{goals.goals.map((g, i) => <Progress key={i} name={`${PERIOD_NAME[g.period]}${g.branchName ? ` · ${g.branchName}` : ''}`} value={g.actual} of={g.target} note={<>{money(g.actual)} de {money(g.target)}. {pace(g)}</>} />)}</ol>
            : <p className="quiet">Sin metas. El dueño las define en Ajustes.</p>}

    </Block>;
}

const clock = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

export function ShiftsBlock({ shifts }: { shifts?: api.Summary['shifts'] }) {

    if (!shifts?.some(s => s.tickets)) return null;

    return <Block title="Por turno"><Rows label="Ventas por turno" rows={shifts.map(s => ({ key: s.name, name: `${s.name} · ${clock(s.start)} a ${clock(s.end)}`, value: s.net, note: s.tickets ? `${plural(s.tickets, 'cuenta', 'cuentas')} · ticket ${money(s.averageTicket)}` : 'Sin ventas' }))} /></Block>;
}

export function AreasBlock({ areas }: { areas?: api.Summary['areas'] }) {

    if (!areas || areas.length < 2) return null;

    return <Block title="Por área"><Rows label="Ventas por área" rows={areas.map(a => ({ key: a.area, name: a.area || 'Sin mesa', value: a.net, note: `${plural(a.tickets, 'cuenta', 'cuentas')} · ${plural(a.people, 'comensal', 'comensales')}` }))} /><p className="note">«Sin mesa» agrupa las cuentas que no se abrieron en una mesa.</p></Block>;
}

/** What the floor looks like right now beyond the accounts, from branches that send it. */
export function NowMore({ rows }: { rows: api.Summary['branches'] }) {

    const live = rows.filter(r => r.live && !r.stale).map(r => r.live!);
    const tables = live.filter(l => l.tables), partial = live.filter(l => l.partial), clocked = live.filter(l => l.onClock);

    if (!tables.length && !clocked.length) return null;

    const add = <T,>(list: T[], read: (x: T) => number) => list.reduce((t, x) => t + read(x), 0);
    const items: [string, ReactNode][] = [];

    if (tables.length) items.push(['Mesas libres', `${whole(add(tables, l => l.tables!.free))} de ${whole(add(tables, l => l.tables!.total))}`], ['Por limpiar', whole(add(tables, l => l.tables!.cleaning))]);
    if (partial.length) items.push(['Con pago parcial', whole(add(partial, l => l.partial!.count))]);
    if (clocked.length) items.push(['En turno', whole(add(clocked, l => l.onClock!.people))], ['Costo por hora', money(add(clocked, l => l.onClock!.hourlyCost))]);

    return <Facts items={items} />;
}

// ---------- Trend ----------

const TREND_BY: { id: api.Trend['by']; label: string }[] = [{ id: 'week', label: 'Semanas' }, { id: 'month', label: 'Meses' }, { id: 'year', label: 'Años' }];
const periodName = (key: string, by: api.Trend['by']) => by === 'year' ? key : by === 'month' ? new Date(key + '-15T12:00:00Z').toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : `Semana del ${shortDate(key)}`;

export function TrendView({ view, data, by, choose }: Of<'trend'> & { by: api.Trend['by']; choose: (by: api.Trend['by']) => void }) {

    const { trend } = data;

    if (allLite(view.scope, trend.lite)) return <Locked title="Tendencia" what="Ventas por semana, mes y año contra el año anterior." />;

    const growth = trend.lastYearTotal ? Math.round((trend.total - trend.lastYearTotal) * 10_000 / trend.lastYearTotal) : null;

    return <main className="report">

        <Headline view={{ ...view, span: { from: trend.from, to: trend.to } }} title={`Ventas por ${by === 'week' ? 'semana' : by === 'month' ? 'mes' : 'año'}`} figure={money(trend.total)} outOfRange={trend.outOfRange}>

            <div className="periods inline" role="group" aria-label="Agrupar por">{TREND_BY.map(b => <button key={b.id} aria-pressed={by === b.id} onClick={() => choose(b.id)}>{b.label}</button>)}</div>
            {growth !== null ? <p className="versus"><span>{growth >= 0 ? `${bps(growth)} más` : `${bps(-growth)} menos`} que el mismo tramo del año pasado: {money(trend.lastYearTotal)}</span></p> : <p className="note">Todavía no hay ventas del año pasado para comparar.</p>}
            <ProNote branches={view.scope} lite={trend.lite} locked="" />

        </Headline>
        <div className="col">

            <Block title={by === 'week' ? 'Últimas 12 semanas' : by === 'month' ? 'Últimos 12 meses' : 'Este año'}>{trend.periods.length
                ? <Rows label="Ventas por periodo" rows={[...trend.periods].reverse().map(p => ({ key: p.key, name: periodName(p.key, by), value: p.net, note: `${plural(p.tickets, 'cuenta', 'cuentas')} · ticket ${money(p.averageTicket)}${p.growthBps !== null ? ` · ${p.growthBps >= 0 ? '+' : '−'}${bps(Math.abs(p.growthBps))} contra ${money(p.lastYearNet)} del año pasado` : ''}` }))} />
                : <p className="quiet">Sin ventas en este tramo.</p>}</Block>

        </div>

    </main>;
}

// ---------- Forecast ----------

const factorNote = (d: api.ForecastDay) => [d.trend !== 1 && `tendencia ×${d.trend.toLocaleString('es-MX')}`, d.holiday && `${d.holiday.name} ×${d.holiday.factor.toLocaleString('es-MX')}${d.holiday.learned ? ' (de tu año pasado)' : ''}`, d.weather?.wet && `lluvia ×${d.weather.factor.toLocaleString('es-MX')}`].filter(Boolean).join(' · ');

export function ForecastView({ view, data }: Of<'forecast'>) {

    const { forecast } = data;

    if (allLite(view.scope, forecast.lite)) return <Locked title="El pronóstico" what="Ventas y platillos de los próximos 7 días." />;

    const next = forecast.days[0];
    const thin = forecast.historyDays < 21;

    return <main className="report">

        <section className="headline" aria-label="Pronóstico de mañana">

            <h1>Pronóstico de mañana · {next ? dayName(next.date) : ''}</h1>
            <p className="figure">{next ? money(next.net) : '—'}</p>
            {next && <Facts items={[['Entre', `${money(next.low)} y ${money(next.high)}`], ['Cuentas', whole(next.tickets)], ['Error reciente', forecast.errorBps === null ? 'Sin medir' : bps(forecast.errorBps)]]} />}
            <p className="note">Promedio del mismo día de la semana en las últimas 8 semanas, con la tendencia del último mes, los días festivos de México{forecast.weather?.used ? ' y el clima' : ''}. El error es cuánto se equivocó este cálculo en los últimos 14 días.</p>
            {thin && <p className="plan-note">Hay {plural(forecast.historyDays, 'día', 'días')} de historia: el pronóstico mejora con 4 semanas o más.</p>}
            <ProNote branches={view.scope} lite={forecast.lite} locked="" />

        </section>
        <div className="col">

            <Block title="Próximos 7 días">

                <Rows label="Ventas esperadas" rows={forecast.days.map(d => ({ key: d.date, name: `${dayName(d.date)}${d.holiday ? ` · ${d.holiday.name}` : ''}`, value: d.net, note: <>{d.weather && <><CloudRain size={14} aria-hidden="true" />{`${d.weather.maxC.toLocaleString('es-MX')} °C · lluvia ${whole(d.weather.rainChance)} %`}</>}{` ${money(d.low)} a ${money(d.high)} · ${plural(d.tickets, 'cuenta', 'cuentas')}`}{factorNote(d) && ` · ${factorNote(d)}`}{d.weeks < 4 && ' · poca historia'}</> }))} />
                <p className="note">{forecast.weather ? forecast.weather.used ? `Clima de ${forecast.weather.label}, de Open-Meteo. ${forecast.weather.learned ? 'El efecto de la lluvia sale de tus ventas en días lluviosos.' : 'Con lluvia se estima 7 % menos hasta tener al menos 3 días lluviosos propios.'}` : 'El clima se usa al ver una sola sucursal.' : 'Agrega la ubicación de la sucursal en Ajustes para usar el clima.'} Eventos cercanos y tráfico no se consideran: requieren servicios de pago.</p>

            </Block>

        </div>
        <div className="col">

            <Block title="Qué preparar">

                {forecast.products.length ? <div className="scroll"><table className="grid-table">

                    <thead><tr><th scope="col">Platillo</th>{forecast.days.map(d => <th key={d.date} scope="col">{dayName(d.date).split(' ')[0]}</th>)}</tr></thead>
                    <tbody>{forecast.products.map(p => <tr key={p.name}><td>{p.name}</td>{p.days.map(d => <td key={d.date}>{whole(d.units)}</td>)}</tr>)}</tbody>

                </table></div> : <p className="quiet">Sin ventas de productos en las últimas 4 semanas.</p>}
                <p className="note">Unidades esperadas de los 10 más vendidos. Las existencias para cubrirlas se piden en la sucursal con «Sugerir compra».</p>

            </Block>

        </div>

    </main>;
}

// ---------- Profit ----------

function Statement({ lines }: { lines: [string, number, ('total' | 'sub')?][] }) {

    return <dl className="statement">{lines.map(([name, value, kind]) => <div key={name} className={kind}><dt>{name}</dt><dd>{money(value)}</dd></div>)}</dl>;
}

export function ProfitView({ view, data }: Of<'profit'>) {

    const { profit: p } = data;

    if (allLite(view.scope, p.lite)) return <Locked title="La rentabilidad" what="Ventas menos costo de lo vendido, mermas, gastos, horas trabajadas y gastos fijos." />;

    const lines: [string, number, ('total' | 'sub')?][] = [['Ventas con IVA', p.net], ['IVA', -p.tax], ['Ventas sin IVA', p.sales, 'sub'], ['Costo de lo vendido (recetas)', -p.cogs], ['Merma y faltantes', -p.waste], ...p.expenses.map(e => [`Gasto · ${e.account}`, -e.amount] as [string, number]), ...(p.labor.counted ? [['Horas trabajadas (reloj checador)', -p.labor.cost] as [string, number]] : []), ...p.fixed.map(f => [`Fijo · ${f.name}`, -f.amount] as [string, number]), ['Ganancia estimada', p.profit, 'total']];

    return <main className="report">

        <Headline view={view} title="Ganancia estimada" figure={money(p.profit)} outOfRange={p.outOfRange}>

            <Facts items={[['Margen', bps(p.marginBps)], ['Costo de alimentos', bps(p.foodCostBps)], ['Costo laboral', bps(p.laborBps)], ['Gastos fijos', money(p.fixedTotal)]]} />
            <ProNote branches={view.scope} lite={p.lite} locked="" />

        </Headline>
        <div className="col">

            <Block title="Estado de resultados"><Statement lines={lines} /></Block>

        </div>
        <div className="col">

            <Block title="Cómo se calcula">

                <ul className="plain">

                    <li><b>Costo de lo vendido</b><span>Sólo productos con receta.{p.revenueWithoutCost > 0 && ` ${money(p.revenueWithoutCost)} vendidos sin receta no restan costo: la ganancia real es menor.`}</span></li>
                    <li><b>Gastos</b><span>Los registrados en la sucursal por cuenta de gasto y las salidas de caja. Las compras de insumos no entran aquí: entran por la receta al venderse.</span></li>
                    <li><b>Horas trabajadas</b><span>{p.labor.counted ? `${hoursWorked(p.labor.minutes)} a sueldo por hora. Si también registras la nómina como gasto, desactívalo en Ajustes.` : 'No se restan: en Ajustes indicaste que la nómina ya va en los gastos.'}</span></li>
                    <li><b>Gastos fijos</b><span>Los que escribes en Ajustes, repartidos por los días del periodo.</span></li>

                </ul>

            </Block>

        </div>

    </main>;
}

// ---------- Kitchen ----------

export function KitchenView({ view, data }: Of<'kitchen'>) {

    const { kitchen: k } = data;

    if (allLite(view.scope, k.lite)) return <Locked title="Cocina" what="Tiempos por platillo y estación, devoluciones y entregas a tiempo." />;

    const onTime = k.promises.length ? Math.round(sum(k.promises, p => p.count - p.late) * 10_000 / Math.max(1, sum(k.promises, p => p.count))) : null;

    return <main className="report">

        <Headline view={view} title="Tiempo promedio en cocina" figure={k.totals.dishes ? duration(k.totals.averageSeconds) : '—'} outOfRange={k.outOfRange}>

            <Facts items={[['Platillos', whole(k.totals.dishes)], ['Devueltos', `${whole(k.totals.returns)} · ${bps(k.totals.returnBps)}`], ['Entregas a tiempo', onTime === null ? 'Sin datos' : bps(onTime)]]} />
            <p className="note">Desde que la comanda llega a cocina hasta que el platillo está listo.</p>
            <ProNote branches={view.scope} lite={k.lite} locked="" />

        </Headline>
        <div className="col">

            <Block title="Los más lentos">{k.dishes.length ? <Rows label="Tiempo por platillo" shown={duration} rows={k.dishes.slice(0, 10).map(d => ({ key: d.name, name: d.name, value: d.averageSeconds, note: `${d.station || 'Sin estación'} · ${plural(d.count, 'preparado', 'preparados')} · espera ${duration(d.averageWait)} · preparación ${duration(d.averagePrep)} · máximo ${duration(d.maxSeconds)}${d.averagePass !== null ? ` · al cliente en ${duration(d.averagePass)}` : ''}` }))} /> : <p className="quiet">Sin platillos marcados como listos en este periodo.</p>}</Block>
            {k.stations.length > 1 && <Block title="Por estación"><Rows label="Tiempo por estación" shown={duration} rows={k.stations.map(s => ({ key: s.station, name: s.station || 'Sin estación', value: s.averageSeconds, note: `${plural(s.count, 'platillo', 'platillos')} · máximo ${duration(s.maxSeconds)}` }))} /></Block>}

        </div>
        <div className="col">

            <Block title="Devoluciones">{k.returns.length ? <ul className="plain">{k.returns.map(r => <li key={r.name}><b>{r.name}</b><span>{plural(r.count, 'devuelto', 'devueltos')} de {whole(r.sold)} vendidos ({bps(r.rateBps)}) · {r.reasons.map(x => `${x.label} ${x.count}`).join(', ')}</span></li>)}</ul> : <p className="quiet">Ningún platillo regresó a cocina en este periodo.</p>}</Block>
            {k.reasons.length > 0 && <Block title="Motivos"><Rows label="Devoluciones por motivo" shown={whole} rows={k.reasons.map(r => ({ key: r.reason, name: r.label, value: r.count }))} /></Block>}
            <Block title="Tiempo prometido">{k.promises.length ? <ul className="plain">{k.promises.map(p => <li key={p.mode}><b>{modeLabel(p.mode)}: {bps(p.onTimeBps)} a tiempo</b><span>{plural(p.late, 'pedido tarde', 'pedidos tarde')} de {whole(p.count)} · se prometieron {duration(p.averagePromised)} y tomó {duration(p.averageActual)} en promedio</span></li>)}</ul> : <p className="quiet">Sin pedidos con hora prometida. La sucursal la registra al crear el pedido.</p>}<p className="note">A domicilio se mide la salida más el tiempo estimado de la ruta; la sucursal no sabe cuándo llegó.</p></Block>

        </div>

    </main>;
}

// ---------- Customers ----------

const stars = (value: number) => `${tenths(value)} de 5`;

export function CustomersView({ view, data }: Of<'customers'>) {

    const { customers: c } = data;

    if (allLite(view.scope, c.lite)) return <Locked title="Clientes" what="Frecuencia, valor de vida y calificaciones de los clientes." />;

    const { known, period, reviews } = c;

    return <main className="report">

        <Headline view={view} title="Clientes identificados" figure={whole(known.identified)} outOfRange={c.outOfRange}>

            <Facts items={[['Regresan', known.active90 ? `${whole(known.repeat90)} de ${whole(known.active90)}` : '—'], ['Días entre visitas', known.averageGapDays ? whole(known.averageGapDays) : '—'], ['Valor de vida', money(known.lifetimeAverage)], ['Visitas por cliente', tenths(known.visitsAverageTenths)]]} />
            <p className="note">Clientes con nombre en la sucursal: domicilio, para llevar y lealtad. «Regresan» cuenta a quienes vinieron más de una vez en 90 días. El panel recibe sólo cifras, nunca nombres ni teléfonos.</p>
            <ProNote branches={view.scope} lite={c.lite} locked="" />

        </Headline>
        <div className="col">

            <Block title="En este periodo"><Facts items={[['Cuentas con cliente', `${whole(period.identifiedTickets)} · ${bps(period.identifiedBps)}`], ['Primera visita', whole(period.first)], ['Regresaron', whole(period.repeat)], ['Ticket', money(period.averageIdentified)]]} /></Block>
            <Block title="Clientes frecuentes">

                <Facts items={[['Frecuentes', whole(known.vip)], [`Sin volver en ${known.lapsedDays} días`, whole(known.vipLapsed)]]} />
                <p className="note">Frecuentes es el 10 % que más ha gastado.{known.vipLapsed > 0 && ' Búscalos desde Clientes en la sucursal: ahí están sus datos.'}</p>

            </Block>

        </div>
        <div className="col">

            <Block title="Calificaciones">

                {reviews.count ? <Facts items={[['General', stars(reviews.overallTenths)], ['Comida', stars(reviews.foodTenths)], ['Servicio', stars(reviews.serviceTenths)], ['Bajas (1 o 2)', whole(reviews.low)]]} /> : <p className="quiet">Sin calificaciones en este periodo.</p>}
                <p className="note">Las que dejan los clientes en la sucursal. Google Maps y TripAdvisor no están conectados.</p>

            </Block>
            {c.best.length > 0 && <Block title="Platillos mejor calificados"><Rows label="Mejor calificados" shown={v => stars(v)} rows={c.best.map(d => ({ key: d.name, name: d.name, value: d.averageTenths, note: plural(d.count, 'calificación', 'calificaciones') }))} /></Block>}
            {c.worst.length > 0 && <Block title="Platillos peor calificados"><Rows label="Peor calificados" shown={v => stars(v)} rows={c.worst.map(d => ({ key: d.name, name: d.name, value: d.averageTenths, note: `${plural(d.count, 'calificación', 'calificaciones')} de las cuentas que lo pidieron` }))} /></Block>}

        </div>

    </main>;
}

// ---------- Alerts ----------

const LEVEL = { high: { label: 'Urgente', Icon: TriangleAlert }, medium: { label: 'Atender', Icon: CircleAlert }, info: { label: 'Para saber', Icon: Info } } as const;

export function AlertsView({ data }: Of<'alerts'>) {

    const { alerts } = data.alerts;

    if (!alerts.length) return <main className="empty"><h2>Sin alertas</h2><p>Nada pide tu atención en este momento.</p></main>;

    return <main className="report single">

        <section className="headline" aria-label="Alertas"><h1>Alertas de hoy</h1><p className="figure">{whole(alerts.length)}</p></section>
        <ul className="plain alerts">{alerts.map((a, i) => { const { label, Icon } = LEVEL[a.level]; return <li key={i} className={`alert ${a.level}`}>

            <b><Icon size={16} aria-hidden="true" />{a.title}<span className="tag">{label}</span><span className="tag">{a.area}</span>{a.branchName && <span className="tag">{a.branchName}</span>}</b>
            <span>{a.detail}</span>

        </li>; })}</ul>

    </main>;
}

// ---------- Products: menu engineering ----------

const CLASSES: { id: api.MenuClass; name: string }[] = [{ id: 'star', name: 'Estrellas' }, { id: 'plowhorse', name: 'Caballos de batalla' }, { id: 'puzzle', name: 'Enigmas' }, { id: 'dog', name: 'Perros' }];

export function MenuBlocks({ view, menu }: { view: View; menu: api.Menu }) {

    const branch = (_licenseId: string, name?: string) => view.scope.length > 1 && name ? `${name} · ` : '';
    const priced = menu.items.filter(i => i.suggestedPrice !== null).sort((a, b) => b.foodCostBps - a.foodCostBps);
    const mix = sum(menu.kinds, k => k.revenue);

    return <>

        <div className="col">

            <Block title="Ingeniería de menú">

                {menu.items.length ? CLASSES.map(c => { const own = menu.items.filter(i => i.class === c.id); return own.length ? <div className="menu-class" key={c.id}>

                    <h3>{c.name} <span className="tag">{own.length}</span></h3>
                    <p className="note">{own[0]!.advice}</p>
                    <Rows label={c.name} rows={own.map(i => ({ key: `${i.category}|${i.name}`, name: i.name, value: i.revenue, note: `${plural(i.quantity, 'vendido', 'vendidos')} · margen ${money(i.unitMargin)} por unidad · costo ${bps(i.foodCostBps)}` }))} />

                </div> : null; }) : <p className="quiet">Hace falta al menos un platillo con receta para clasificar el menú.</p>}
                {menu.items.length > 0 && <p className="note">Popular: se vende al menos el 70 % de lo que le tocaría si todos se vendieran igual ({bps(menu.thresholds.popularShareBps)} de las unidades). Rentable: deja al menos el margen promedio, {money(menu.thresholds.averageMargin)} por unidad. Sólo entran platillos con receta.</p>}
                {menu.uncosted.length > 0 && <p className="note">Sin receta, fuera de la clasificación: {menu.uncosted.slice(0, 6).map(u => u.name).join(', ')}{menu.uncosted.length > 6 ? ` y ${menu.uncosted.length - 6} más` : ''}.</p>}

            </Block>
            {priced.length > 0 && <Block title="Precio sugerido">

                <ul className="plain">{priced.map(i => <li key={`${i.category}|${i.name}`}><b>{i.name}: de {money(i.price)} a {money(i.suggestedPrice!)}</b><span>Cuesta {bps(i.foodCostBps)} de su precio; tu meta es {bps(menu.foodCostTargetBps)}.</span></li>)}</ul>
                <p className="note">Sugerencias: el precio se cambia en la sucursal. Precio promedio cobrado, con IVA.</p>

            </Block>}

        </div>
        <div className="col">

            {menu.kinds.length > 0 && <Block title="Mix de consumo"><Rows label="Ventas por tipo" rows={menu.kinds.map(k => ({ key: k.kind, name: kindLabel(k.kind), value: k.revenue, note: `${plural(k.quantity, 'unidad', 'unidades')} · ${bps(mix ? Math.round(k.revenue * 10_000 / mix) : 0)}` }))} />{menu.kinds.some(k => !k.kind) && <p className="note">Clasifica las categorías en la sucursal (Catálogo › Editar categorías) para separar comida, bebidas y alcohol.</p>}</Block>}
            {(menu.slowDays.length > 0 || menu.peakHours.length > 0) && <Block title="Cuándo promocionar">

                <ul className="plain">

                    {menu.slowDays.map(d => <li key={d.weekday}><b>Los {WEEKDAYS[d.weekday]} venden {bps(d.belowBps)} menos que el promedio</b><span>{money(d.average)} por día. Una promoción ese día llena mesas que de otro modo quedan vacías.</span></li>)}
                    {menu.peakHours.slice(0, 3).map(h => <li key={h.hour}><b>A las {hourLabel(h.hour)} se vende {bps(h.aboveBps)} más que el promedio</b><span>No descuentes en ese horario: ya se llena.</span></li>)}

                </ul>

            </Block>}
            <Block title="Costos que subieron">

                {menu.costAlerts.length ? <ul className="plain">{menu.costAlerts.map(a => <li key={`${a.licenseId}|${a.ingredientId}`}><b>{branch(a.licenseId, a.branchName)}{a.name} subió {bps(a.changeBps)}</b><span>{a.products.length ? a.products.map(p => `${p.name}: costo ${p.cost === null ? '—' : money(p.cost)} de ${money(p.price)}`).join(' · ') : 'Ningún platillo con receta lo usa.'}</span></li>)}</ul> : <p className="quiet">Ninguna compra reciente subió 10 % o más contra la anterior.</p>}
                <p className="note">Compara cada compra recibida con la anterior del mismo insumo. El costo de las recetas se actualiza solo con lo que recibe la sucursal.</p>

            </Block>
            <Block title="Por caducar">

                {menu.expiring.length ? <ul className="plain">{menu.expiring.map(e => <li key={`${e.licenseId}|${e.ingredientId}|${e.expiresOn}`}><b>{branch(e.licenseId, e.branchName)}{e.name}: {e.days < 0 ? 'ya caducó' : e.days === 0 ? 'caduca hoy' : `caduca en ${plural(e.days, 'día', 'días')}`}</b><span>{money(e.cost)} en existencia.{e.products.length ? ` Promociona ${e.products.join(', ')}.` : ''}</span></li>)}</ul> : <p className="quiet">Ningún lote con fecha de caducidad vence en los próximos 3 días.</p>}
                <p className="note">Sólo los lotes a los que la sucursal les puso fecha de caducidad al recibirlos.</p>

            </Block>

        </div>

    </>;
}

// ---------- Staff: efficiency, labour and patterns ----------

const SCHEDULE_HOURS = (rows: api.Team['schedule']) => [...new Set(rows.map(r => r.hour))].sort((a, b) => a - b);

export function TeamBlocks({ view, team }: { view: View; team: api.Team }) {

    const branch = branchOf(view);
    const worked = team.staff.filter(s => s.minutes > 0 || s.people > 0);
    const over = team.labor.byHour.filter(h => h.laborBps > team.laborTargetBps && h.cost > 0);
    const hours = SCHEDULE_HOURS(team.schedule);
    const owner = view.me.account.role === 'owner';

    return <>

        <div className="col">

            <Block title="Eficiencia">

                {worked.length ? <Rows label="Eficiencia por persona" rows={worked.map(s => ({ key: `${s.licenseId}|${s.staffId}`, name: s.name, value: s.net, note: `${branch(s.licenseId)}${plural(s.tables, 'mesa', 'mesas')} · ${plural(s.people, 'comensal', 'comensales')} · ticket ${money(s.averageTicket)}${s.minutes ? ` · ${hoursWorked(s.minutes)} · ${s.salesPerHour === null ? '' : `${money(s.salesPerHour)} por hora`}` : ''}` }))} /> : <p className="quiet">Sin mesas ni horas registradas en este periodo.</p>}

            </Block>
            <Block title="Costo laboral">

                <Facts items={[['Sobre ventas', team.labor.net ? bps(team.labor.laborBps) : '—'], ['Horas', hoursWorked(team.labor.minutes)], ['Costo', money(team.labor.cost)], ['En turno ahora', `${whole(team.labor.now.people)} · ${money(team.labor.now.hourlyCost)}/h`]]} />
                {over.length > 0 && <p className="note">Horas sobre tu meta de {bps(team.laborTargetBps)}: {over.map(h => `${hourLabel(h.hour)} (${bps(h.laborBps)})`).join(', ')}. En esas horas sobra personal para lo que se vende.</p>}
                {!team.labor.minutes && <p className="note">El costo laboral usa el reloj checador y el sueldo por hora de cada empleado en la sucursal.</p>}

            </Block>
            {hours.length > 0 && <Block title="Personal sugerido para la próxima semana">

                <div className="scroll"><table className="grid-table">

                    <thead><tr><th scope="col">Hora</th>{[1, 2, 3, 4, 5, 6, 0].map(d => <th key={d} scope="col">{WEEKDAYS[d]!.slice(0, 3)}</th>)}</tr></thead>
                    <tbody>{hours.map(h => <tr key={h}><td>{hourLabel(h)}</td>{[1, 2, 3, 4, 5, 6, 0].map(d => { const cell = team.schedule.find(r => r.weekday === d && r.hour === h); return <td key={d} className={cell && cell.suggestedPeople < cell.currentPeople - 0.5 ? 'less' : cell && cell.suggestedPeople > cell.currentPeople + 0.5 ? 'more' : undefined} title={cell ? `Hoy en promedio ${cell.currentPeople.toLocaleString('es-MX')}; se esperan ${money(cell.expectedNet)}` : undefined}>{cell ? whole(cell.suggestedPeople) : ''}</td>; })}</tr>)}</tbody>

                </table></div>
                <p className="note">Personas por hora para que el costo laboral quede en {bps(team.laborTargetBps)}, con las ventas promedio de las últimas 8 semanas y el sueldo promedio de {money(team.averageWage)} por hora. En gris donde hoy hay más personal del sugerido; en negritas donde hay menos.</p>

            </Block>}

        </div>
        <div className="col">

            {team.tips.shares.length > 0 && <Block title="Propinas por horas trabajadas">

                <Rows label="Reparto de propinas" rows={team.tips.shares.map(s => ({ key: `${s.licenseId}|${s.staffId}`, name: s.name, value: s.share, note: `${branch(s.licenseId)}${hoursWorked(s.minutes)}` }))} />
                <p className="note">Reparto sugerido de {money(team.tips.total)} en proporción a las horas del reloj checador. El reparto real lo decide la sucursal.</p>

            </Block>}
            {team.couriers.length > 0 && <Block title="Repartidores"><Rows label="Ventas por repartidor" rows={team.couriers.map(c => ({ key: `${c.licenseId}|${c.courierId}`, name: c.name, value: c.net, note: `${branch(c.licenseId)}${plural(c.deliveries, 'entrega', 'entregas')}` }))} /></Block>}
            <Block title="Rotación de personal">

                <Facts items={[['Activos', whole(team.roster.active)], ['Altas en 12 meses', whole(team.roster.hires)], ['Bajas en 12 meses', whole(team.roster.exits)], ['Rotación anual', bps(team.roster.turnoverBps)]]} />
                <p className="note">Bajas del año entre la plantilla promedio. Usa la fecha de ingreso y la desactivación de cada empleado en la sucursal.</p>

            </Block>
            {owner && <Block title="Para revisar">

                {team.anomalies.length ? <ul className="plain">{team.anomalies.map(a => <li key={`${a.licenseId}|${a.staffId}|${a.metric}`}><b>{a.name}: {whole(a.value)} {a.label}</b><span>{branch(a.licenseId)}Lo usual en su sucursal es {a.usual.toLocaleString('es-MX')}.{a.amount ? ` Suman ${money(a.amount)}.` : ''}</span></li>)}</ul> : <p className="quiet">Nadie se aparta de lo usual en cancelaciones, descuentos, reaperturas ni aperturas de cajón.</p>}
                <p className="note">Al menos 3 y el doble de lo usual entre sus compañeros. No prueba nada: es para revisarlo con el gerente. Sólo lo ve el dueño.</p>

            </Block>}

        </div>

    </>;
}
