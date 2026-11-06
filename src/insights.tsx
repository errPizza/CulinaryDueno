import type { ReactNode } from 'react';
import { CalendarDays, CircleAlert, Clock, CloudRain, Info, ReceiptText, Star, Sun, Tag, TriangleAlert, Undo2, Users, UtensilsCrossed } from 'lucide-react';
import type * as api from './api';
import type { View } from './app';
import { branchOf, Headline, HeroBars, Locked, sum, type Of } from './detail';
import { bps, dayName, duration, hourLabel, hoursWorked, kindLabel, modeLabel, money, plural, shortDate, tenths, WEEKDAYS, whole } from './format';
import { allLite, Block, Delta, Facts, HeroRow, ProNote, Rows, StatCard } from './parts';

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

const TICKS = 36;
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
const goalName = (g: api.Goal) => g.period === 'month' ? `Meta de ${MONTHS[Number(g.from.slice(5, 7)) - 1]}` : g.period === 'year' ? `Meta de ${g.from.slice(0, 4)}` : 'Meta del día';

/** The first goal as an arc of marks: amber up to what is sold; the mark of an even pace today is darker. */
function Gauge({ goal, today }: { goal: api.Goal; today: string }) {

    const share = goal.target ? Math.min(1, goal.actual / goal.target) : 0;
    const due = goal.target && goal.expected ? Math.min(1, goal.expected / goal.target) : null;
    const lit = Math.round(TICKS * share), dueTick = due === null ? -1 : Math.min(TICKS - 1, Math.round((TICKS - 1) * due));
    const total = days(goal.from, goal.to), passed = Math.min(total, days(goal.from, today));

    return <>

        <div className="gauge">

            <svg viewBox="0 0 200 112" className="goal-ticks" role="img" aria-label={`${goalName(goal)}: ${bps(goal.progressBps)} de ${money(goal.target)}`}>{Array.from({ length: TICKS }, (_, i) => {

                const a = Math.PI - i / (TICKS - 1) * Math.PI, inner = i === dueTick ? 66 : 74;

                return <line key={i} x1={100 + inner * Math.cos(a)} y1={104 - inner * Math.sin(a)} x2={100 + 94 * Math.cos(a)} y2={104 - 94 * Math.sin(a)} stroke={i === dueTick ? 'var(--ink-2)' : i < lit ? 'var(--amber)' : 'var(--tick)'} />;

            })}</svg>
            <div className="gauge-center"><b>{bps(goal.progressBps)}</b></div>

        </div>
        <small className="gauge-sub">de la meta{goal.period !== 'day' && total > 1 ? ` · ${bps(Math.round(passed * 10_000 / total))} del ${goal.period === 'month' ? 'mes' : 'año'}` : ''}</small>
        <div className="goal-foot"><span><b>{money(goal.actual)}</b> de {money(goal.target)}</span>{goal.pace !== 'open' && goal.pace !== 'reached' && goal.expected > 0 ? <Delta now={goal.actual} before={goal.expected} /> : goal.pace === 'reached' ? <span className="pill good">Cumplida</span> : null}</div>

    </>;
}

export function GoalsBlock({ goals }: { goals: api.Goals | null }) {

    if (!goals) return <Block title="Metas" className="goals"><p className="quiet">No se pudieron leer las metas ahora. Se vuelve a intentar en un minuto.</p></Block>;

    const [first, ...rest] = goals.goals;

    if (!first) return <Block title="Metas" className="goals"><p className="quiet">Sin metas. El dueño las define en Ajustes.</p></Block>;

    const total = days(first.from, first.to);

    return <Block title={first.branchName ? `${goalName(first)} · ${first.branchName}` : goalName(first)} className="goals" meta={first.period === 'day' ? undefined : `día ${Math.min(total, days(first.from, goals.today))} de ${total}`}>

        <Gauge goal={first} today={goals.today} />
        <p className="note">{pace(first)}{first.pace !== 'open' && first.pace !== 'reached' ? ' La píldora compara con el ritmo parejo.' : ''}</p>
        {rest.length > 0 && <ol className="progress" aria-label="Avance de metas">{rest.map((g, i) => <Progress key={i} name={`${PERIOD_NAME[g.period]}${g.branchName ? ` · ${g.branchName}` : ''}`} value={g.actual} of={g.target} note={<>{money(g.actual)} de {money(g.target)}. {pace(g)}</>} />)}</ol>}

    </Block>;
}

const clock = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

export function ShiftsBlock({ shifts }: { shifts?: api.Summary['shifts'] }) {

    return <Block title="Por turno"><Rows label="Ventas por turno" empty="Sin ventas por turno en este periodo." rows={(shifts ?? []).map(s => ({ key: s.name, name: `${s.name} · ${clock(s.start)} a ${clock(s.end)}`, value: s.net, note: s.tickets ? `${plural(s.tickets, 'cuenta', 'cuentas')} · ticket ${money(s.averageTicket)}` : 'Sin ventas' }))} /></Block>;
}

export function AreasBlock({ areas }: { areas?: api.Summary['areas'] }) {

    return <Block title="Por área"><Rows label="Ventas por área" empty="Sin ventas por área en este periodo." rows={(areas ?? []).map(a => ({ key: a.area, name: a.area || 'Sin mesa', value: a.net, note: `${plural(a.tickets, 'cuenta', 'cuentas')} · ${plural(a.people, 'comensal', 'comensales')}` }))} /><p className="note">«Sin mesa» agrupa las cuentas que no se abrieron en una mesa.</p></Block>;
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
const periodTick = (key: string, by: api.Trend['by']) => by === 'year' ? key : by === 'month' ? new Date(key + '-15T12:00:00Z').toLocaleDateString('es-MX', { month: 'short', timeZone: 'UTC' }).replace('.', '') : shortDate(key);

/** Columns of the graphite card: this stretch in amber, the earlier one as an outline behind. */
export function Columns({ columns, shown = money, label }: { columns: { key: string; tick: string; name: string; value: number; was?: number; open?: boolean; part?: number; dim?: boolean }[]; shown?: (v: number) => string; label: string }) {

    const top = Math.max(1, ...columns.map(c => Math.max(c.value, c.was ?? 0)));
    const every = Math.ceil(columns.length / 12);

    if (!columns.some(c => c.value || c.was)) return <div className="chart-empty push"><span /><span /><span /><p>Sin datos para la gráfica en este tramo.</p></div>;

    return <figure className="hours push" aria-label={label}>

        <div className="hours-plot">{columns.map(c => <button key={c.key} type="button" className={c.open ? 'now' : undefined} aria-label={`${c.name}: ${shown(c.value)}${c.was !== undefined ? `, antes ${shown(c.was)}` : ''}`}>

            {c.was !== undefined && c.was > 0 && <span className="was-bar" style={{ height: `${c.was / top * 100}%` }} />}
            <span className={c.dim ? 'bar dim' : 'bar mark'} style={{ height: `${Math.max(c.value / top * 100, c.value ? 2 : 0)}%` }}>{c.part ? <span className="part" style={{ height: `${Math.min(100, c.part / Math.max(1, c.value) * 100)}%` }} /> : null}</span>

        </button>)}</div>
        <div className="hours-axis" aria-hidden="true">{columns.map((c, i) => <span key={c.key}>{i % every === 0 ? c.tick : ''}</span>)}</div>

    </figure>;
}

export function TrendView({ view, data, by, choose }: Of<'trend'> & { by: api.Trend['by']; choose: (by: api.Trend['by']) => void }) {

    const { trend } = data;

    if (allLite(view.scope, trend.lite)) return <Locked title="Tendencia" what="Ventas por semana, mes y año contra el año anterior." />;

    const growth = trend.lastYearTotal ? Math.round((trend.total - trend.lastYearTotal) * 10_000 / trend.lastYearTotal) : null;
    const best = [...trend.periods].sort((a, b) => b.net - a.net)[0];
    const tickets = sum(trend.periods, p => p.tickets);
    const unit = by === 'week' ? 'semana' : by === 'month' ? 'mes' : 'año';

    return <main className="report">

        <HeroRow hero={<Headline view={{ ...view, span: { from: trend.from, to: trend.to } }} title={`Ventas por ${unit}`} figure={money(trend.total)} outOfRange={trend.outOfRange}>

            <div className="hero-top">

                {growth !== null ? <p className="versus"><Delta now={trend.total} before={trend.lastYearTotal} /><span>contra {money(trend.lastYearTotal)} del mismo tramo del año pasado</span></p> : <p className="hero-sub">Todavía no hay ventas del año pasado para comparar.</p>}
                <div className="metric-tabs" role="group" aria-label="Agrupar por">{TREND_BY.map(b => <button key={b.id} aria-pressed={by === b.id} onClick={() => choose(b.id)}>{b.label}</button>)}</div>

            </div>
            <ProNote branches={view.scope} lite={trend.lite} locked="" />
            {trend.hasLastYear && <p className="hero-line"><span /><span className="legend"><span><i className="a" />Este año</span><span><i className="o" />Año anterior</span></span></p>}
            <Columns label="Ventas por periodo" columns={trend.periods.map((p, i) => ({ key: p.key, tick: periodTick(p.key, by), name: periodName(p.key, by), value: p.net, was: trend.hasLastYear ? p.lastYearNet : undefined, open: i === trend.periods.length - 1 && p.to >= view.today, dim: p !== best }))} />

        </Headline>} stats={<>

            <StatCard label={`Mejor ${unit}`} value={best ? periodName(best.key, by) : '—'} Icon={CalendarDays}>{best && <>{best.growthBps !== null && <Delta now={best.net} before={best.lastYearNet} percent />}<span>{money(best.net)}</span></>}</StatCard>
            <StatCard label="Ticket promedio" value={tickets ? money(Math.round(trend.total / tickets)) : '—'} Icon={Tag}><span>{plural(tickets, 'cuenta', 'cuentas')} en el tramo</span></StatCard>
            <StatCard label={`Cuentas por ${unit}`} value={trend.periods.length ? whole(Math.round(tickets / trend.periods.length)) : '—'} Icon={ReceiptText}><span>promedio</span></StatCard>

        </>} />
        <Block title={by === 'week' ? 'Semana por semana' : by === 'month' ? 'Mes por mes' : 'Año por año'} meta={trend.hasLastYear ? `contra el mismo ${unit} del año anterior` : undefined}>

            {trend.periods.length ? <div className="scroll"><table className="table">

                <thead><tr><th scope="col">{by === 'week' ? 'Semana' : by === 'month' ? 'Mes' : 'Año'}</th><th scope="col">Ventas</th>{trend.hasLastYear && <th scope="col">Año anterior</th>}{trend.hasLastYear && <th scope="col">Cambio</th>}<th scope="col">Cuentas</th><th scope="col">Ticket</th><th scope="col">Días con venta</th></tr></thead>
                <tbody>{[...trend.periods].reverse().map(p => <tr key={p.key}>

                    <td><b>{periodName(p.key, by)}</b></td>
                    <td><b>{money(p.net)}</b></td>
                    {trend.hasLastYear && <td className="quiet">{money(p.lastYearNet)}</td>}
                    {trend.hasLastYear && <td>{p.growthBps !== null ? <Delta now={p.net} before={p.lastYearNet} percent /> : '—'}</td>}
                    <td>{whole(p.tickets)}</td>
                    <td>{money(p.averageTicket)}</td>
                    <td>{whole(p.days)}</td>

                </tr>)}</tbody>

            </table></div> : <p className="quiet">Sin ventas en este tramo.</p>}

        </Block>

    </main>;
}

// ---------- Forecast ----------

const factorNote = (d: api.ForecastDay) => [d.trend !== 1 && `tendencia ×${d.trend.toLocaleString('es-MX')}`, d.holiday && `${d.holiday.name} ×${d.holiday.factor.toLocaleString('es-MX')}${d.holiday.learned ? ' (de tu año pasado)' : ''}`, d.weather?.wet && `lluvia ×${d.weather.factor.toLocaleString('es-MX')}`].filter(Boolean).join(' · ');
const thousands = (cents: number) => `$${(cents / 100_000).toLocaleString('es-MX', { maximumFractionDigits: 1 })} mil`;

export function ForecastView({ view, data }: Of<'forecast'>) {

    const { forecast } = data;

    if (allLite(view.scope, forecast.lite)) return <Locked title="El pronóstico" what="Ventas y platillos de los próximos 7 días." />;

    const { days } = forecast, total = sum(days, d => d.net);
    const strongest = [...days].sort((a, b) => b.net - a.net)[0];
    const top = Math.max(1, ...days.map(d => d.high));
    const thin = forecast.historyDays < 21;
    const holiday = days.find(d => d.holiday);

    return <main className="report">

        <HeroRow hero={<Headline view={view} title="Venta esperada" label={`Venta esperada · próximos ${plural(days.length, 'día', 'días')}`} figure={money(total)} outOfRange={[]}>

            <p className="versus"><span className="pill flat">entre {money(sum(days, d => d.low))} y {money(sum(days, d => d.high))}</span></p>
            <p className="hero-sub">Con {plural(forecast.historyDays, 'día', 'días')} de historia{forecast.errorBps !== null ? ` · el pronóstico de los últimos 14 días falló por ${bps(forecast.errorBps)}` : ''}</p>
            {thin && <p className="plan-note">El pronóstico mejora con 4 semanas de historia o más.</p>}
            <ProNote branches={view.scope} lite={forecast.lite} locked="" />
            {days.length > 0 && <div className="push">

                <div className="fc" role="img" aria-label="Venta esperada por día">{days.map(d => <div className="c" key={d.date}>

                    <span className={d === strongest ? 'b top' : 'b'} style={{ height: `${d.net / top * 100}%` }} />
                    <span className="r" style={{ bottom: `${d.low / top * 100}%`, height: `${(d.high - d.low) / top * 100}%` }} />
                    <span className="v" style={{ bottom: `calc(${d.high / top * 100}% + 6px)` }}>{thousands(d.net)}</span>

                </div>)}</div>
                <div className="fc-x">{days.map(d => <div key={d.date}><b>{dayName(d.date).split(' ').slice(0, 2).join(' ')}</b>{d.weather ? <small>{d.weather.wet ? <CloudRain size={11} aria-hidden="true" /> : <Sun size={11} aria-hidden="true" />}{d.weather.wet ? `Lluvia ${whole(d.weather.rainChance)} %` : `${whole(Math.round(d.weather.maxC))}°`}</small> : d.holiday ? <small>{d.holiday.name}</small> : null}</div>)}</div>

            </div>}

        </Headline>} stats={<>

            <StatCard label="Día más fuerte" value={strongest ? dayName(strongest.date).split(' ')[0]! : '—'} Icon={CalendarDays}>{strongest && <><span className="pill amber">{money(strongest.net)}</span><span>{plural(strongest.tickets, 'cuenta', 'cuentas')}</span></>}</StatCard>
            <StatCard label="Efecto de la lluvia" value={forecast.weather?.used ? `${forecast.weather.rainFactor < 1 ? '−' : '+'}${bps(Math.round(Math.abs(1 - forecast.weather.rainFactor) * 10_000))}` : '—'} Icon={CloudRain}><span>{forecast.weather ? forecast.weather.used ? forecast.weather.learned ? 'aprendido de tu historia' : 'estimado hasta tener 3 días lluviosos' : 'al ver una sola sucursal' : 'agrega la ciudad en Ajustes'}</span></StatCard>
            <StatCard label="Día festivo cercano" value={holiday ? dayName(holiday.date).split(' ').slice(1).join(' ') : 'Ninguno'} Icon={CalendarDays}>{holiday?.holiday && <><span className="pill amber">×{holiday.holiday.factor.toLocaleString('es-MX')}</span><span>{holiday.holiday.name}</span></>}</StatCard>

        </>} />
        <div className="row r21">

            <Block title="Platillos a preparar" meta="unidades esperadas por día">

                {forecast.products.length ? <div className="scroll"><table className="table">

                    <thead><tr><th scope="col">Platillo</th>{days.map(d => <th key={d.date} scope="col">{dayName(d.date).split(' ')[0]}</th>)}<th scope="col">Semana</th></tr></thead>
                    <tbody>{forecast.products.map(p => <tr key={p.name}><td><b>{p.name}</b></td>{p.days.map(d => <td key={d.date}>{whole(d.units)}</td>)}<td><b>{whole(sum(p.days, d => d.units))}</b></td></tr>)}</tbody>

                </table></div> : <p className="quiet">Sin ventas de productos en las últimas 4 semanas.</p>}
                <p className="note">Los 10 más vendidos. Las existencias para cubrirlos se piden en la sucursal con «Sugerir compra».</p>

            </Block>
            <Block title="Día por día">

                <Rows label="Ventas esperadas" rows={days.map(d => ({ key: d.date, name: `${dayName(d.date)}${d.holiday ? ` · ${d.holiday.name}` : ''}`, value: d.net, note: <>{`${money(d.low)} a ${money(d.high)} · ${plural(d.tickets, 'cuenta', 'cuentas')}`}{factorNote(d) && ` · ${factorNote(d)}`}{d.weeks < 4 && ' · poca historia'}</> }))} />
                <p className="note">Promedio del mismo día de la semana en las últimas 8 semanas, con la tendencia del último mes, los días festivos de México{forecast.weather?.used ? ` y el clima de ${forecast.weather.label}` : ''}.</p>

            </Block>

        </div>

    </main>;
}

// ---------- Profit ----------

function Statement({ lines }: { lines: [string, number, ('total' | 'sub')?][] }) {

    return <dl className="statement">{lines.map(([name, value, kind]) => <div key={name} className={kind}><dt>{name}</dt><dd>{money(value)}</dd></div>)}</dl>;
}

const short = (cents: number) => `${cents < 0 ? '−' : ''}$${Math.round(Math.abs(cents) / 100).toLocaleString('es-MX')}`;

export function ProfitView({ view, data }: Of<'profit'>) {

    const { profit: p } = data;

    if (allLite(view.scope, p.lite)) return <Locked title="La rentabilidad" what="Ventas menos costo de lo vendido, mermas, gastos, horas trabajadas y gastos fijos." />;

    const lines: [string, number, ('total' | 'sub')?][] = [['Ventas con IVA', p.net], ['IVA', -p.tax], ['Ventas sin IVA', p.sales, 'sub'], ['Costo de lo vendido (recetas)', -p.cogs], ['Merma y faltantes', -p.waste], ...p.expenses.map(e => [`Gasto · ${e.account}`, -e.amount] as [string, number]), ...(p.labor.counted ? [['Horas trabajadas (reloj checador)', -p.labor.cost] as [string, number]] : []), ...p.fixed.map(f => [`Fijo · ${f.name}`, -f.amount] as [string, number]), ['Ganancia estimada', p.profit, 'total']];
    // The waterfall: sales, then each cost taken off where the one before left it, then what remains.
    const steps: [string, number][] = [['Costo', p.cogs], ['Mermas', p.waste], ['Gastos', p.expensesTotal], ...(p.labor.counted ? [['Nómina', p.labor.cost] as [string, number]] : []), ['Fijos', p.fixedTotal]];
    const top = Math.max(1, p.sales);
    let level = p.sales;
    const falls = steps.map(([name, value]) => { const from = level; level -= value; return { name, value, low: Math.max(0, Math.min(from, level)), high: Math.max(from, level) }; });

    return <main className="report">

        <HeroRow hero={<Headline view={view} title="Ganancia estimada" figure={money(p.profit)} outOfRange={p.outOfRange}>

            <p className="versus"><span className={p.profit >= 0 ? 'pill good' : 'pill bad'}>margen {bps(p.marginBps)}</span></p>
            <p className="hero-sub">Ventas sin IVA menos costo de lo vendido, mermas, gastos{p.labor.counted ? ', horas del reloj checador' : ''} y gastos fijos del periodo.</p>
            <ProNote branches={view.scope} lite={p.lite} locked="" />
            <div className="push">

                <div className="fall" role="img" aria-label="De las ventas a la ganancia">

                    <div className="c sales"><span style={{ bottom: 0, height: `${p.sales / top * 100}%` }} /><em style={{ bottom: `calc(${p.sales / top * 100}% + 4px)` }}>{short(p.sales)}</em></div>
                    {falls.map(f => <div className="c" key={f.name}><span style={{ bottom: `${f.low / top * 100}%`, height: `${Math.max(0.6, (f.high - f.low) / top * 100)}%` }} /><em style={{ bottom: `calc(${f.high / top * 100}% + 4px)` }}>{short(-f.value)}</em></div>)}
                    <div className={p.profit >= 0 ? 'c total' : 'c total loss'}><span style={{ bottom: 0, height: `${Math.max(0.6, Math.abs(p.profit) / top * 100)}%` }} /><em style={{ bottom: `calc(${Math.abs(p.profit) / top * 100}% + 4px)` }}>{short(p.profit)}</em></div>

                </div>
                <div className="fall-x" aria-hidden="true"><span>Ventas</span>{falls.map(f => <span key={f.name}>{f.name}</span>)}<span>Ganancia</span></div>

            </div>

        </Headline>} stats={<>

            <StatCard label="Costo de lo vendido" value={bps(p.foodCostBps)} Icon={UtensilsCrossed}><span>{money(p.cogs)} con receta</span></StatCard>
            <StatCard label="Costo laboral" value={p.labor.counted ? bps(p.laborBps) : '—'} Icon={Users}><span>{p.labor.counted ? hoursWorked(p.labor.minutes) : 'la nómina va en gastos'}</span></StatCard>
            <StatCard label="Gastos fijos" value={money(p.fixedTotal)} Icon={CalendarDays}><span>repartidos por día</span></StatCard>

        </>} />
        <div className="row r3">

            <Block title="Gastos registrados" meta="de caja y cuentas de gasto"><Rows label="Gastos" empty="Sin gastos registrados en este periodo." rows={p.expenses.map(e => ({ key: e.account, name: e.account, value: e.amount, note: plural(e.count, 'gasto', 'gastos') }))} /></Block>
            <Block title="Gastos fijos" meta="en proporción al periodo"><Rows label="Gastos fijos" empty="Sin gastos fijos. Se escriben en Ajustes." rows={p.fixed.map(f => ({ key: `${f.licenseId}|${f.name}`, name: f.name, value: f.amount, note: `${view.me.branches.find(b => b.licenseId === f.licenseId)?.name ?? 'Todas'} · ${money(f.monthly)} al mes` }))} /></Block>
            <Block title="Cómo se calcula">

                <ul className="plain">

                    <li><b>Costo de lo vendido</b><span>Sólo productos con receta.{p.revenueWithoutCost > 0 && ` ${money(p.revenueWithoutCost)} vendidos sin receta no restan costo: la ganancia real es menor.`}</span></li>
                    <li><b>Gastos</b><span>Los registrados en la sucursal y las salidas de caja. Las compras de insumos entran por la receta al venderse.</span></li>
                    <li><b>Horas trabajadas</b><span>{p.labor.counted ? `${hoursWorked(p.labor.minutes)} a sueldo por hora. Si registras la nómina como gasto, desactívalo en Ajustes.` : 'No se restan: en Ajustes indicaste que la nómina ya va en los gastos.'}</span></li>

                </ul>

            </Block>

        </div>
        <Block title="Estado de resultados"><Statement lines={lines} /></Block>

    </main>;
}

// ---------- Kitchen ----------

export function KitchenView({ view, data }: Of<'kitchen'>) {

    const { kitchen: k } = data;

    if (allLite(view.scope, k.lite)) return <Locked title="Cocina" what="Tiempos por platillo y estación, devoluciones y entregas a tiempo." />;

    const onTime = k.promises.length ? Math.round(sum(k.promises, p => p.count - p.late) * 10_000 / Math.max(1, sum(k.promises, p => p.count))) : null;
    const stations = [...k.stations].sort((a, b) => b.averageSeconds - a.averageSeconds);
    const slowest = Math.max(0, ...k.dishes.map(d => d.maxSeconds));

    return <main className="report">

        <HeroRow hero={<Headline view={view} title="Tiempo de comanda a listo" figure={k.totals.dishes ? duration(k.totals.averageSeconds) : '—'} outOfRange={k.outOfRange}>

            <p className="hero-sub">{plural(k.totals.dishes, 'platillo', 'platillos')} · {plural(k.totals.returns, 'devolución', 'devoluciones')} ({bps(k.totals.returnBps)}){slowest ? ` · el más lento tardó ${duration(slowest)}` : ''}</p>
            <ProNote branches={view.scope} lite={k.lite} locked="" />
            {stations.length > 0 ? <>

                <HeroBars label="Tiempo por estación" rows={stations.map(s => ({ key: s.station, name: s.station || 'Sin estación', value: s.averageSeconds, mark: s.maxSeconds, shown: duration(s.averageSeconds), note: `máx ${duration(s.maxSeconds)}` }))} />
                <p className="hero-line"><span>Barra: promedio · raya roja: el más lento</span></p>

            </> : <div className="chart-empty push"><span /><span /><p>Sin estaciones medidas en este periodo.</p></div>}

        </Headline>} stats={<>

            <StatCard label="Devoluciones" value={whole(k.totals.returns)} Icon={Undo2}><span>{bps(k.totals.returnBps)} de lo servido</span></StatCard>
            {k.promises.length ? k.promises.slice(0, 2).map(p => <StatCard key={p.mode} label={`${modeLabel(p.mode)} a tiempo`} value={bps(p.onTimeBps)} Icon={Clock}><span>prometido {duration(p.averagePromised)} · tomó {duration(p.averageActual)}</span></StatCard>) : <StatCard label="Entregas a tiempo" value={onTime === null ? '—' : bps(onTime)} Icon={Clock}><span>sin pedidos con hora prometida</span></StatCard>}
            {k.promises.length < 2 && <StatCard label="Platillos" value={whole(k.totals.dishes)} Icon={UtensilsCrossed}><span>marcados como listos</span></StatCard>}

        </>} />
        <div className="row r21">

            <Block title="Platillos" meta="de la comanda a la mesa">

                {k.dishes.length ? <div className="scroll"><table className="table">

                    <thead><tr><th scope="col">Platillo</th><th scope="col" className="left">Estación</th><th scope="col">Servidos</th><th scope="col">Espera</th><th scope="col">Preparación</th><th scope="col">Pase</th><th scope="col">Total</th></tr></thead>
                    <tbody>{k.dishes.slice(0, 12).map(d => <tr key={d.name}><td><b>{d.name}</b></td><td className="left quiet">{d.station || 'Sin estación'}</td><td>{whole(d.count)}</td><td>{duration(d.averageWait)}</td><td>{duration(d.averagePrep)}</td><td>{d.averagePass === null ? '—' : duration(d.averagePass)}</td><td><b>{duration(d.averageSeconds)}</b></td></tr>)}</tbody>

                </table></div> : <p className="quiet">Sin platillos marcados como listos en este periodo.</p>}

            </Block>
            <div className="col">

                <Block title="Devoluciones" meta="por motivo">

                    <Rows label="Devoluciones por motivo" empty="Ningún platillo regresó a cocina en este periodo." shown={whole} rows={k.reasons.map(r => ({ key: r.reason, name: r.label, value: r.count }))} />
                    {k.returns.length > 0 && <ul className="plain" style={{ marginTop: 12 }}>{k.returns.map(r => <li key={r.name}><b>{r.name}</b><span>{plural(r.count, 'devuelto', 'devueltos')} de {whole(r.sold)} ({bps(r.rateBps)}) · {r.reasons.map(x => `${x.label} ${x.count}`).join(', ')}</span></li>)}</ul>}

                </Block>
                <Block title="Tiempo prometido">{k.promises.length ? <ul className="plain">{k.promises.map(p => <li key={p.mode}><b>{modeLabel(p.mode)}: {bps(p.onTimeBps)} a tiempo</b><span>{plural(p.late, 'pedido tarde', 'pedidos tarde')} de {whole(p.count)} · se prometieron {duration(p.averagePromised)} y tomó {duration(p.averageActual)}</span></li>)}</ul> : <p className="quiet">Sin pedidos con hora prometida. La sucursal la registra al crear el pedido.</p>}<p className="note">A domicilio se mide la salida más el tiempo estimado de la ruta.</p></Block>

            </div>

        </div>

    </main>;
}

// ---------- Customers ----------

const stars = (value: number) => `${tenths(value)} de 5`;
const starRow = (tenthsValue: number) => '★★★★★'.slice(0, Math.round(tenthsValue / 10)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(tenthsValue / 10));

export function CustomersView({ view, data }: Of<'customers'>) {

    const { customers: c } = data;

    if (allLite(view.scope, c.lite)) return <Locked title="Clientes" what="Frecuencia, valor de vida y calificaciones de los clientes." />;

    const { known, period, reviews } = c;
    const returning = known.active90 ? Math.round(known.repeat90 * 10_000 / known.active90) : null;

    return <main className="report">

        <HeroRow hero={<Headline view={view} title="Clientes que regresan" label="Clientes que regresan · últimos 90 días" figure={returning === null ? '—' : bps(returning)} outOfRange={c.outOfRange}>

            <p className="hero-sub">{known.active90 ? <><b>{whole(known.repeat90)} de {whole(known.active90)}</b> clientes activos vinieron más de una vez{known.averageGapDays ? <> · vuelven cada <b>{plural(known.averageGapDays, 'día', 'días')}</b> en promedio</> : ''}</> : 'Todavía no hay clientes identificados en los últimos 90 días.'}</p>
            <ProNote branches={view.scope} lite={c.lite} locked="" />
            <div className="push">

                <div className="kpis">

                    <div><small>Clientes conocidos</small><b>{whole(known.identified)}</b><span>{whole(known.active90)} activos</span></div>
                    <div><small>Valor de vida</small><b>{money(known.lifetimeAverage)}</b><span>{tenths(known.visitsAverageTenths)} visitas</span></div>
                    <div><small>Frecuentes</small><b>{whole(known.vip)}</b><span>{plural(known.vipLapsed, 'sin volver', 'sin volver')} en {known.lapsedDays} días</span></div>
                    <div><small>Ticket identificado</small><b>{money(period.averageIdentified)}</b><span>en este periodo</span></div>

                </div>
                <div className="stackbar" aria-hidden="true"><span style={{ width: `${period.identifiedBps / 100}%`, background: 'var(--amber)' }} /></div>
                <p className="hero-line" style={{ marginTop: 0 }}><span><b>{whole(period.identifiedTickets)} de {whole(period.tickets)}</b> cuentas con cliente identificado · {plural(period.first, 'primera vez', 'primeras veces')} · {whole(period.repeat)} regresan</span></p>

            </div>

        </Headline>} stats={<>

            <StatCard label="Calificación general" value={reviews.count ? tenths(reviews.overallTenths) : '—'} Icon={Star}>{reviews.count > 0 && <><span className="stars" aria-hidden="true">{starRow(reviews.overallTenths)}</span><span>{plural(reviews.count, 'opinión', 'opiniones')}</span></>}</StatCard>
            <StatCard label="Comida" value={reviews.count ? tenths(reviews.foodTenths) : '—'} Icon={UtensilsCrossed}><span>de 5</span></StatCard>
            <StatCard label="Servicio" value={reviews.count ? tenths(reviews.serviceTenths) : '—'} Icon={Users}><span>{reviews.low ? `${plural(reviews.low, 'opinión baja', 'opiniones bajas')}` : 'de 5'}</span></StatCard>

        </>} />
        <div className="row r3">

            <Block title="Mejor calificados" meta="platillos"><Rows label="Mejor calificados" empty="Sin calificaciones en este periodo." shown={v => stars(v)} rows={c.best.map(d => ({ key: d.name, name: d.name, value: d.averageTenths, note: plural(d.count, 'opinión', 'opiniones') }))} /></Block>
            <Block title="Peor calificados" meta="platillos"><Rows label="Peor calificados" empty="Sin calificaciones en este periodo." shown={v => stars(v)} rows={c.worst.map(d => ({ key: d.name, name: d.name, value: d.averageTenths, note: plural(d.count, 'opinión', 'opiniones') }))} /></Block>
            <Block title="Frecuentes que no han vuelto" meta="sólo cifras">

                <Facts items={[[`Sin venir en ${known.lapsedDays} días`, whole(known.vipLapsed)], ['Frecuentes', whole(known.vip)]]} />
                <p className="note">Frecuentes es el 10 % que más ha gastado. El panel recibe sólo cifras, nunca nombres ni teléfonos.{known.vipLapsed > 0 && ' Búscalos desde Clientes en la sucursal: ahí están sus datos.'}</p>

            </Block>

        </div>

    </main>;
}

// ---------- Alerts ----------

const LEVEL = { high: { label: 'Urgente', Icon: TriangleAlert }, medium: { label: 'Atender', Icon: CircleAlert }, info: { label: 'Para saber', Icon: Info } } as const;

function AlertItem({ a }: { a: api.Alert }) {

    const { Icon } = LEVEL[a.level];

    return <li className={`alert ${a.level}`}>

        <span className="alert-icon" aria-hidden="true"><Icon size={16} /></span>
        <div><b>{a.title}</b><p>{a.detail}</p></div>
        <span className="tag">{a.area}{a.branchName ? ` · ${a.branchName}` : ''}</span>

    </li>;
}

export function AlertsView({ data }: Of<'alerts'>) {

    const { alerts } = data.alerts;

    if (!alerts.length) return <main className="empty"><h2>Sin alertas</h2><p>Nada pide tu atención en este momento.</p></main>;

    const urgent = alerts.filter(a => a.level !== 'info'), info = alerts.filter(a => a.level === 'info');
    const areas = [...alerts.reduce((all, a) => all.set(a.area, (all.get(a.area) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);

    return <main className="report">

        <div className="row r21">

            <div className="col">

                {urgent.length > 0 && <Block title="Por atender" meta={whole(urgent.length)}><ul className="alert-list">{urgent.map((a, i) => <AlertItem a={a} key={i} />)}</ul></Block>}
                {info.length > 0 && <Block title="Para tu información" meta={whole(info.length)}><ul className="alert-list">{info.map((a, i) => <AlertItem a={a} key={i} />)}</ul></Block>}

            </div>
            <Block title="Por área">

                <Rows label="Alertas por área" shown={whole} rows={areas.map(([area, count]) => ({ key: area, name: area, value: count }))} />
                <p className="note">Inventario y caducidad, conexión de sucursales, costos que suben, caja, personal y metas. Se revisan en cada actualización.</p>

            </Block>

        </div>

    </main>;
}

// ---------- Products: menu engineering ----------

const CLASSES: { id: api.MenuClass; name: string; hint: string }[] = [
    { id: 'star', name: 'Estrellas', hint: 'Se piden mucho y dejan buen margen. Cuídalas.' },
    { id: 'plowhorse', name: 'Caballos de batalla', hint: 'Se piden mucho y dejan poco. Sube el precio poco a poco o baja el costo.' },
    { id: 'puzzle', name: 'Enigmas', hint: 'Buen margen, poca venta. Recomiéndalos o muévelos a un lugar visible.' },
    { id: 'dog', name: 'Para revisar', hint: 'Poca venta y poco margen. Considera quitarlos o rehacerlos.' }
];
const branchName = (view: View, name?: string) => view.scope.length > 1 && name ? `${name} · ` : '';

export function MenuQuad({ menu }: { menu: api.Menu }) {

    return <Block title="Ingeniería de menú" meta="popularidad contra margen">

        {menu.items.length ? <div className="quad">{CLASSES.map(c => { const own = menu.items.filter(i => i.class === c.id); return <div key={c.id} className={c.id === 'star' ? 'star' : undefined}>

            <h3>{c.name} <span>{whole(own.length)}</span></h3>
            <p>{c.hint}</p>
            {own.length ? <ul>{own.slice(0, 3).map(i => <li key={`${i.category}|${i.name}`}><span>{i.name}</span><span>{money(i.unitMargin)} c/u</span></li>)}</ul> : <p>Ninguno.</p>}

        </div>; })}</div> : <p className="quiet">Hace falta al menos un platillo con receta para clasificar el menú.</p>}
        {menu.items.length > 0 && <p className="note">Popular: se vende al menos el 70 % de lo que le tocaría ({bps(menu.thresholds.popularShareBps)} de las unidades). Rentable: deja al menos {money(menu.thresholds.averageMargin)} por unidad. Sólo platillos con receta.</p>}
        {menu.uncosted.length > 0 && <p className="note">Sin receta, fuera de la clasificación: {menu.uncosted.slice(0, 6).map(u => u.name).join(', ')}{menu.uncosted.length > 6 ? ` y ${menu.uncosted.length - 6} más` : ''}.</p>}

    </Block>;
}

export function PriceBlock({ menu }: { menu: api.Menu }) {

    const items = [...menu.items].sort((a, b) => (b.suggestedPrice === null ? 0 : 1) - (a.suggestedPrice === null ? 0 : 1) || b.foodCostBps - a.foodCostBps).slice(0, 6);

    return <Block title="Precio sugerido" meta={`para llegar al ${bps(menu.foodCostTargetBps)} de costo`}>

        {items.length ? <div className="scroll"><table className="table">

            <thead><tr><th scope="col">Producto</th><th scope="col">Costo</th><th scope="col">Precio</th><th scope="col">Sugerido</th></tr></thead>
            <tbody>{items.map(i => <tr key={`${i.category}|${i.name}`}>

                <td><b>{i.name}</b><small>{i.category} · {plural(i.quantity, 'vendido', 'vendidos')}</small></td>
                <td>{money(Math.round(i.cost / Math.max(1, i.quantity)))}</td>
                <td>{money(i.price)}</td>
                <td>{i.suggestedPrice === null ? <span className="quiet">En meta</span> : <><b>{money(i.suggestedPrice)}</b> <span className="pill amber">+{bps(Math.round((i.suggestedPrice - i.price) * 10_000 / Math.max(1, i.price)))}</span></>}</td>

            </tr>)}</tbody>

        </table></div> : <p className="quiet">Sin platillos con receta en este periodo.</p>}
        <p className="note">Sugerencias: el precio se cambia en la sucursal. Precio promedio cobrado, con IVA.</p>

    </Block>;
}

export function CostsBlock({ view, menu }: { view: View; menu: api.Menu }) {

    return <Block title="Costos que subieron" meta="contra la compra anterior">

        {menu.costAlerts.length ? <ul className="plain">{menu.costAlerts.map(a => <li key={`${a.licenseId}|${a.ingredientId}`}><b>{a.name} <span className="pill bad">+{bps(a.changeBps)}</span></b><span>{branchName(view, a.branchName)}{a.products.length ? `afecta ${a.products.map(p => p.name).join(', ')}` : 'ningún platillo con receta lo usa'}</span></li>)}</ul> : <p className="quiet">Ninguna compra reciente subió 10 % o más contra la anterior.</p>}

    </Block>;
}

export function ExpiringBlock({ view, menu }: { view: View; menu: api.Menu }) {

    return <Block title="Lotes por caducar" meta="próximos 3 días">

        {menu.expiring.length ? <ul className="plain">{menu.expiring.map(e => <li key={`${e.licenseId}|${e.ingredientId}|${e.expiresOn}`}><b><i className={e.days <= 0 ? 'dot r' : e.days === 1 ? 'dot a' : 'dot'} aria-hidden="true" />{e.name}: {e.days < 0 ? 'ya caducó' : e.days === 0 ? 'caduca hoy' : `caduca en ${plural(e.days, 'día', 'días')}`}</b><span>{branchName(view, e.branchName)}{money(e.cost)} en existencia.{e.products.length ? ` Promociona ${e.products.join(', ')}.` : ''}</span></li>)}</ul> : <p className="quiet">Ningún lote con fecha de caducidad vence en los próximos 3 días.</p>}

    </Block>;
}

export function MixBlock({ menu }: { menu: api.Menu }) {

    const mix = sum(menu.kinds, k => k.revenue);

    return <Block title="Mix de consumo"><Rows label="Ventas por tipo" empty="Sin ventas por tipo en este periodo." rows={menu.kinds.map(k => ({ key: k.kind, name: kindLabel(k.kind), value: k.revenue, note: `${plural(k.quantity, 'unidad', 'unidades')} · ${bps(mix ? Math.round(k.revenue * 10_000 / mix) : 0)}` }))} />{menu.kinds.some(k => !k.kind) && <p className="note">Clasifica las categorías en la sucursal (Catálogo › Editar categorías) para separar comida, bebidas y alcohol.</p>}</Block>;
}

export function PromoBlock({ menu }: { menu: api.Menu }) {

    return <Block title="Cuándo promocionar">

        {menu.slowDays.length || menu.peakHours.length ? <ul className="plain">

            {menu.slowDays.map(d => <li key={d.weekday}><b>Los {WEEKDAYS[d.weekday]} venden {bps(d.belowBps)} menos que el promedio</b><span>{money(d.average)} por día. Una promoción ese día llena mesas que de otro modo quedan vacías.</span></li>)}
            {menu.peakHours.slice(0, 3).map(h => <li key={h.hour}><b>A las {hourLabel(h.hour)} se vende {bps(h.aboveBps)} más que el promedio</b><span>No descuentes en ese horario: ya se llena.</span></li>)}

        </ul> : <p className="quiet">Sin días flojos ni horas pico marcadas en este periodo.</p>}

    </Block>;
}

// ---------- Staff: labour, schedule and turnover ----------

/** Sales by hour with, at the foot of each bar, what the people on the clock cost in that hour. */
export function LaborChart({ team }: { team: api.Team }) {

    const hours = [...team.labor.byHour].sort((a, b) => a.hour - b.hour);

    if (!hours.length) return null;

    return <>

        <p className="hero-line"><span>Venta por hora y, abajo, lo que costó quien estaba en turno</span><span className="legend"><span><i className="a" />Venta</span><span><i className="d" />Costo laboral</span></span></p>
        <Columns label="Venta y costo laboral por hora" columns={hours.map(h => ({ key: String(h.hour), tick: String(h.hour).padStart(2, '0'), name: hourLabel(h.hour), value: h.net, part: h.cost }))} />

    </>;
}

const SCHEDULE_HOURS = (rows: api.Team['schedule']) => [...new Set(rows.map(r => r.hour))].sort((a, b) => a - b);

export function TeamBlocks({ view, team }: { view: View; team: api.Team }) {

    const branch = branchOf(view);
    const worked = team.staff.filter(s => s.minutes > 0 || s.people > 0);
    const over = team.labor.byHour.filter(h => h.laborBps > team.laborTargetBps && h.cost > 0);
    const hours = SCHEDULE_HOURS(team.schedule);
    const most = Math.max(1, ...team.schedule.map(r => r.suggestedPeople));

    return <>

        <div className="row r21">

            <Block title="Personal sugerido para la próxima semana" meta={`para un costo laboral de ${bps(team.laborTargetBps)}`}>

                {hours.length ? <div className="scroll"><table className="grid-table">

                    <thead><tr><th scope="col">Hora</th>{[1, 2, 3, 4, 5, 6, 0].map(d => <th key={d} scope="col">{WEEKDAYS[d]!.slice(0, 3)}</th>)}</tr></thead>
                    <tbody>{hours.map(h => <tr key={h}><td>{hourLabel(h)}</td>{[1, 2, 3, 4, 5, 6, 0].map(d => { const cell = team.schedule.find(r => r.weekday === d && r.hour === h); return <td key={d} style={{ ['--heat' as string]: cell ? cell.suggestedPeople / most : 0 }} className={cell && cell.suggestedPeople < cell.currentPeople - 0.5 ? 'less' : cell && cell.suggestedPeople > cell.currentPeople + 0.5 ? 'more' : undefined} title={cell ? `Hoy en promedio ${cell.currentPeople.toLocaleString('es-MX')}; se esperan ${money(cell.expectedNet)}` : undefined}>{cell ? whole(cell.suggestedPeople) : ''}</td>; })}</tr>)}</tbody>

                </table></div> : <p className="quiet">Hacen falta ventas de las últimas 8 semanas y sueldos por hora para sugerir personal.</p>}
                {hours.length > 0 && <p className="note">Con las ventas promedio de las últimas 8 semanas y un sueldo promedio de {money(team.averageWage)} por hora. En gris donde hoy sobra personal; con borde donde falta.</p>}
                {over.length > 0 && <p className="note">Horas sobre tu meta: {over.map(h => `${hourLabel(h.hour)} (${bps(h.laborBps)})`).join(', ')}.</p>}

            </Block>
            <Block title="Rotación" meta="últimos 12 meses">

                <Facts items={[['Activos', whole(team.roster.active)], ['Rotación', bps(team.roster.turnoverBps)], ['Altas', whole(team.roster.hires)], ['Bajas', whole(team.roster.exits)]]} />
                <p className="note">Bajas del año entre la plantilla promedio, con la fecha de ingreso y la baja de cada empleado en la sucursal.</p>

            </Block>

        </div>
        <div className="row r3">

            <Block title="Eficiencia"><Rows label="Eficiencia por persona" empty="Sin mesas ni horas registradas en este periodo." rows={worked.map(s => ({ key: `${s.licenseId}|${s.staffId}`, name: s.name, value: s.net, note: `${branch(s.licenseId)}${plural(s.tables, 'mesa', 'mesas')} · ${plural(s.people, 'comensal', 'comensales')}${s.minutes ? ` · ${hoursWorked(s.minutes)}` : ''}` }))} /></Block>
            <Block title="Propinas por horas trabajadas">{team.tips.shares.length ? <><Rows label="Reparto de propinas" rows={team.tips.shares.map(s => ({ key: `${s.licenseId}|${s.staffId}`, name: s.name, value: s.share, note: `${branch(s.licenseId)}${hoursWorked(s.minutes)}` }))} /><p className="note">Reparto sugerido de {money(team.tips.total)} según el reloj checador. El reparto real lo decide la sucursal.</p></> : <p className="quiet">Sin horas del reloj checador para repartir propinas.</p>}</Block>
            <Block title="Repartidores"><Rows label="Ventas por repartidor" empty="Sin entregas a domicilio en este periodo." rows={team.couriers.map(c => ({ key: `${c.licenseId}|${c.courierId}`, name: c.name, value: c.net, note: `${branch(c.licenseId)}${plural(c.deliveries, 'entrega', 'entregas')}` }))} /></Block>

        </div>

    </>;
}
