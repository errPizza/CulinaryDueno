import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, ChartColumn, ChefHat, CircleAlert, CloudSun, Ellipsis, HandCoins, HeartHandshake, LogOut, RefreshCw, Settings2, TrendingUp, Users, UtensilsCrossed, Wallet } from 'lucide-react';
import * as api from './api';
import { CashView, ProductsView, StaffView } from './detail';
import { AlertsView, AreasBlock, CustomersView, ForecastView, GoalsBlock, KitchenView, NowMore, ProfitView, ShiftsBlock, TrendView } from './insights';
import { SettingsView } from './settings';
import { channelLabel, clockHour, cutoffHour, dayOrder, daysIn, hourLabel, MAX_DAYS, message, money, percent, PERIODS, plural, previous, range, rangeLabel, seenAt, shiftDay, soFar, todayOf, whole, type Period, type Range } from './format';
import { Gate } from './gate';
import { Privacy } from './privacy';
import { Days, Hours, METRICS, type Metric } from './hours';
import { allLite, Behind, Block, branchNames, Delta, Facts, OutOfRange, ProNote, Rows, Skeleton, useCountUp, Versus } from './parts';

const REFRESH_MS = 60_000;

const sum = <T,>(rows: readonly T[], read: (row: T) => number) => rows.reduce((total, row) => total + read(row), 0);

export type Section = 'summary' | 'products' | 'cash' | 'staff' | 'trend' | 'forecast' | 'profit' | 'kitchen' | 'customers' | 'alerts' | 'settings';

const SECTIONS: { id: Section; label: string; Icon: typeof ChartColumn }[] = [
    { id: 'summary', label: 'Resumen', Icon: ChartColumn },
    { id: 'products', label: 'Productos', Icon: UtensilsCrossed },
    { id: 'cash', label: 'Caja', Icon: Wallet },
    { id: 'staff', label: 'Personal', Icon: Users }
];
// Under «Más»: on the phone the bar keeps five buttons.
const MORE: { id: Section; label: string; Icon: typeof ChartColumn }[] = [
    { id: 'trend', label: 'Tendencia', Icon: TrendingUp },
    { id: 'forecast', label: 'Pronóstico', Icon: CloudSun },
    { id: 'profit', label: 'Rentabilidad', Icon: HandCoins },
    { id: 'kitchen', label: 'Cocina', Icon: ChefHat },
    { id: 'customers', label: 'Clientes', Icon: HeartHandshake },
    { id: 'alerts', label: 'Alertas', Icon: Bell },
    { id: 'settings', label: 'Ajustes', Icon: Settings2 }
];
// These read their own stretch, or none, so the period picker steps aside.
const OWN_SPAN = new Set<Section>(['trend', 'forecast', 'alerts', 'settings']);

export type Data =
    | { section: 'summary'; summary: api.Summary; before: api.Summary; goals: api.Goals | null }
    | { section: 'products'; products: api.Products; cash: api.Cash; menu: api.Menu }
    | { section: 'cash'; summary: api.Summary; cash: api.Cash; closings: api.Closings }
    | { section: 'staff'; staff: api.Staff; team: api.Team }
    | { section: 'trend'; trend: api.Trend }
    | { section: 'forecast'; forecast: api.Forecast }
    | { section: 'profit'; profit: api.Profit }
    | { section: 'kitchen'; kitchen: api.Kitchen }
    | { section: 'customers'; customers: api.Customers }
    | { section: 'alerts'; alerts: api.Alerts }
    | { section: 'settings'; settings: api.Settings; canEdit: boolean };

export type View = { me: api.Me; scope: api.Branch[]; today: string; span: Range; loadedAt: number; data: Data; asked?: string };

/** Each section asks only for what it shows. The summary brings the stretch it is compared with. */
/** Weeks: the last twelve; months: the last twelve; years: this one so far, each against the year before. */
function trendSpan(by: api.Trend['by'], today: string): Range {

    if (by === 'week') return { from: shiftDay(today, -83), to: today };

    const [year, month] = today.split('-').map(Number) as [number, number];

    return { from: by === 'year' ? `${year}-01-01` : new Date(Date.UTC(year, month - 12, 1)).toISOString().slice(0, 10), to: today };
}

async function fetchSection(section: Section, period: Period, span: Range, by: api.Trend['by'], today: string, branch?: string): Promise<Data> {

    if (section === 'products') { const [products, cash, menu] = await Promise.all([api.products(span.from, span.to, branch), api.cash(span.from, span.to, branch), api.menu(span.from, span.to, branch)]); return { section, products, cash, menu }; }
    if (section === 'trend') { const own = trendSpan(by, today); return { section, trend: await api.trend(own.from, own.to, by, branch) }; }
    if (section === 'forecast') return { section, forecast: await api.forecast(branch) };
    if (section === 'profit') return { section, profit: await api.profit(span.from, span.to, branch) };
    if (section === 'kitchen') return { section, kitchen: await api.kitchen(span.from, span.to, branch) };
    if (section === 'customers') return { section, customers: await api.customers(span.from, span.to, branch) };
    if (section === 'alerts') return { section, alerts: await api.alerts(branch) };
    if (section === 'settings') { const reply = await api.settings(); return { section, settings: reply.settings, canEdit: reply.canEdit }; }
    if (section === 'cash') { const [summary, cash, closings] = await Promise.all([api.summary(span.from, span.to, branch), api.cash(span.from, span.to, branch), api.closings(span.from, span.to, branch)]); return { section, summary, cash, closings }; }
    if (section === 'staff') { const [staff, team] = await Promise.all([api.staff(span.from, span.to, branch), api.team(span.from, span.to, branch)]); return { section, staff, team }; }

    const before = previous(period, span);
    const [summary, earlier, goals] = await Promise.all([api.summary(span.from, span.to, branch), api.summary(before.from, before.to, branch), api.goals(branch).catch(() => null)]);

    return { section, summary, before: earlier, goals };
}

export function App() {

    const [signedIn, setSignedIn] = useState(() => api.session() !== null);

    useEffect(() => api.onSignedOut(() => setSignedIn(false)), []);

    return signedIn ? <Dashboard /> : <Gate onSignedIn={() => setSignedIn(true)} />;
}

function Dashboard() {

    const [branch, setBranch] = useState(''), [period, setPeriod] = useState<Period>('today'), [section, setSection] = useState<Section>('summary'), [custom, setCustom] = useState<Range | null>(null);
    const [view, setView] = useState<View | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [reading, setReading] = useState(false);
    const [by, setBy] = useState<api.Trend['by']>('month'), [more, setMore] = useState(false), [alertCount, setAlertCount] = useState(0);
    const ask = useRef(0);
    // What the screen is asking for; while the view on hand answers something else, the skeleton stands in.
    const asking = [section, branch, period, custom?.from, custom?.to, by].join('|');
    const load = useCallback(async () => {

        const mine = ++ask.current;

        setLoading(true);

        try {

            const me = await api.me();
            const scope = me.branches.filter(b => !branch || b.licenseId === branch);
            const today = todayOf(scope);
            const span = range(period, today, custom ?? { from: shiftDay(today, -29), to: today });
            const [data, alerts] = await Promise.all([fetchSection(section, period, span, by, today, branch || undefined), api.alerts(branch || undefined).catch(() => null)]);

            if (mine === ask.current) { setView({ me, scope, today, span, loadedAt: Date.now(), data, asked: [section, branch, period, custom?.from, custom?.to, by].join('|') }); setError(''); if (alerts) setAlertCount(alerts.alerts.filter(a => a.level !== 'info').length); }

        } catch (e) { if (mine === ask.current) setError(message(e)); } finally { if (mine === ask.current) setLoading(false); }

    }, [branch, period, section, custom, by]);

    useEffect(() => {

        void load();

        const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, REFRESH_MS);
        const back = () => { if (document.visibilityState === 'visible') void load(); };

        document.addEventListener('visibilitychange', back);

        return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', back); };

    }, [load]);

    const branches = view?.me.branches ?? [];
    // Free dates are Pro: with only Lite branches in view the option is not offered.
    const periods = PERIODS.filter(p => p.id !== 'custom' || period === 'custom' || !view || view.scope.some(b => b.tier === 'pro'));
    const pick = (p: Period) => { if (p === 'custom' && !custom && view) setCustom({ from: shiftDay(view.today, -29), to: view.today }); setPeriod(p); };

    return <div className="shell">

        <header className="top">

            <span className="top-mark"><img src="/symbol.png" alt="" width="24" height="24" /></span>
            <b>Culinary Dueño</b>
            <nav className="sections" aria-label="Secciones">

                {SECTIONS.map(({ id, label, Icon }) => <button key={id} aria-current={section === id ? 'page' : undefined} onClick={() => { setSection(id); setMore(false); }}><Icon size={20} aria-hidden="true" /><span>{label}</span></button>)}
                <button className="more-toggle" aria-current={MORE.some(m => m.id === section) ? 'page' : undefined} aria-expanded={more} aria-haspopup="menu" onClick={() => setMore(!more)}><Ellipsis size={20} aria-hidden="true" /><span>{MORE.find(m => m.id === section)?.label ?? 'Más'}</span></button>
                {more && <div className="more" role="menu" aria-label="Más secciones">{MORE.map(({ id, label, Icon }) => <button key={id} role="menuitem" aria-current={section === id ? 'page' : undefined} onClick={() => { setSection(id); setMore(false); }}><Icon size={18} aria-hidden="true" /><span>{label}</span>{id === 'alerts' && alertCount > 0 && <span className="count">{alertCount}</span>}</button>)}</div>}
                {/* On the desk every section has its own line in the sidebar, so «Más» steps aside. */}
                <p className="side-group" aria-hidden="true">Análisis</p>
                {MORE.map(({ id, label, Icon }) => <button key={`side-${id}`} className="side-item" aria-current={section === id ? 'page' : undefined} onClick={() => { setSection(id); setMore(false); }}><Icon size={20} aria-hidden="true" /><span>{label}</span>{id === 'alerts' && alertCount > 0 && <span className="count">{alertCount}</span>}</button>)}

            </nav>
            <div className="tools">

                <button className="icon bell" onClick={() => { setSection('alerts'); setMore(false); }} aria-label={alertCount ? `Alertas: ${alertCount} por atender` : 'Alertas'}><Bell size={18} />{alertCount > 0 && <span className="count" aria-hidden="true">{alertCount}</span>}</button>
                <button className="icon" onClick={() => void load()} disabled={loading} aria-label="Actualizar"><RefreshCw size={18} className={loading ? 'spin' : ''} /></button>
                <button className="icon" onClick={() => void api.logout()} aria-label={`Cerrar sesión de ${view?.me.account.email ?? 'tu cuenta'}`}><LogOut size={18} /></button>

            </div>
            {view && <p className="account"><span className="avatar" aria-hidden="true">{view.me.account.email.slice(0, 2).toUpperCase()}</span><span><b>{view.me.account.email}</b><small>{view.me.account.role === 'owner' ? 'Dueño' : 'Gerente'} · {plural(view.me.branches.length, 'sucursal', 'sucursales')}</small></span></p>}

        </header>
        <div className="controls">

            {branches.length > 1 && <label className="picker"><span className="sr">Sucursal</span>

                <select value={branch} onChange={e => setBranch(e.target.value)}>

                    <option value="">Todas las sucursales</option>
                    {branches.map(b => <option key={b.licenseId} value={b.licenseId}>{b.name}</option>)}

                </select>

            </label>}
            {!OWN_SPAN.has(section) && <div className="periods" role="group" aria-label="Periodo">{periods.map(p => <button key={p.id} aria-pressed={period === p.id} onClick={() => pick(p.id)}>{p.label}</button>)}</div>}
            {!OWN_SPAN.has(section) && period === 'custom' && custom && view && <Dates key={`${custom.from}|${custom.to}`} span={custom} today={view.today} choose={setCustom} />}

        </div>
        {error && <div className="banner" role="alert"><CircleAlert size={18} /><span>{error}{view && ' Lo que ves es de la última actualización.'}</span></div>}
        {!reading && !error && (!view || view.asked !== asking) && <Skeleton summary={section === 'summary'} />}
        {reading ? <Privacy close={() => setReading(false)} /> : view && view.data.section === section && (view.asked === asking || error) && <Content view={view} period={period} choose={setBranch} chosen={branch} by={by} chooseBy={setBy} />}
        {!reading && <footer className="foot"><button className="link quiet-link" onClick={() => setReading(true)}>Aviso de privacidad</button></footer>}

    </div>;
}

/** The free range: it applies as soon as both dates make a valid period, and says what is wrong otherwise. */
function Dates({ span, today, choose }: { span: Range; today: string; choose: (span: Range) => void }) {

    const [draft, setDraft] = useState(span);
    const problem = !draft.from || !draft.to ? 'Elige las dos fechas.' : draft.from > draft.to ? 'La fecha inicial debe ir antes que la final.' : daysIn(draft) > MAX_DAYS ? `Elige un periodo de hasta ${MAX_DAYS} días.` : '';
    const set = (next: Range) => {

        setDraft(next);

        if (next.from && next.to && next.from <= next.to && daysIn(next) <= MAX_DAYS) choose(next);

    };

    return <div className="dates">

        <label className="field">Desde<input type="date" value={draft.from} max={today} onChange={e => set({ ...draft, from: e.target.value })} /></label>
        <label className="field">Hasta<input type="date" value={draft.to} max={today} onChange={e => set({ ...draft, to: e.target.value })} /></label>
        {problem && <p className="error" role="alert">{problem}</p>}

    </div>;
}

function Content({ view, period, choose, chosen, by, chooseBy }: { view: View; period: Period; choose: (licenseId: string) => void; chosen: string; by: api.Trend['by']; chooseBy: (by: api.Trend['by']) => void }) {

    if (!view.me.branches.length) return <main className="empty"><h2>Aún no hay sucursales en tu cuenta</h2><p>Pide a tu proveedor que revise el acceso de tu cuenta.</p></main>;

    const { data } = view;

    if (data.section === 'products') return <ProductsView view={view} data={data} />;
    if (data.section === 'cash') return <CashView view={view} data={data} />;
    if (data.section === 'staff') return <StaffView view={view} data={data} />;
    if (data.section === 'trend') return <TrendView view={view} data={data} by={by} choose={chooseBy} />;
    if (data.section === 'forecast') return <ForecastView view={view} data={data} />;
    if (data.section === 'profit') return <ProfitView view={view} data={data} />;
    if (data.section === 'kitchen') return <KitchenView view={view} data={data} />;
    if (data.section === 'customers') return <CustomersView view={view} data={data} />;
    if (data.section === 'alerts') return <AlertsView view={view} data={data} />;
    if (data.section === 'settings') return <SettingsView view={view} data={data} />;

    return <SummaryView view={view} data={data} period={period} choose={choose} chosen={chosen} />;
}

/** The day's figure as it climbs, with the cents set smaller so the pesos read first. */
function Figure({ value }: { value: number }) {

    const shown = money(useCountUp(value)), dot = shown.lastIndexOf('.');

    return <p className="figure">{shown.slice(0, dot)}<small>{shown.slice(dot)}</small></p>;
}

type Stat = { label: string; value: string; now?: number; was?: number; shown: (v: number) => string };

function SummaryView({ view, data, period, choose, chosen }: { view: View; data: Extract<Data, { section: 'summary' }>; period: Period; choose: (licenseId: string) => void; chosen: string }) {

    const { span, loadedAt } = view, { summary, before } = data;
    const today = period === 'today', oneDay = span.from === span.to;
    const { totals } = summary;
    const scope = summary.branches;
    const shown = PERIODS.find(p => p.id === period)!;
    const headline = period === 'custom' ? `Ventas del ${rangeLabel(span)}` : shown.headline;
    const clock = clockHour(scope, loadedAt), cutoff = cutoffHour(scope);
    const channels = [...summary.channels].sort((a, b) => b.net - a.net);
    const onlyLite = allLite(view.scope, summary.lite);
    // A Lite branch the earlier stretch leaves out is taken out of this one too, so both sides hold the same branches.
    const dropped = before.outOfRange.filter(id => !summary.outOfRange.includes(id));
    const comparable = dropped.length ? scope.filter(b => !dropped.includes(b.licenseId)).reduce((total, b) => total + b.net, 0) : totals.net;
    const against = `${shown.before} (${rangeLabel(before)})${dropped.length ? `, sin ${branchNames(view.me.branches, dropped)}` : ''}`;
    const [metric, setMetric] = useState<Metric>('net');
    const metrics = METRICS.filter(m => m.id !== 'people' || summary.hours.some(h => h.people !== undefined));
    const beforeName = today ? 'Ayer' : period === 'yesterday' ? 'Semana pasada' : 'Antes';
    // Green and red only where both sides hold the same stretch and the same branches; today meets yesterday hour by hour.
    const fair = !today && !dropped.length;

    // Today meets the earlier day only on the hours already over, so a day in progress is not set against a whole one.
    const upTo = (hours: api.HourRow[], read: (h: api.HourRow) => number) => hours.filter(h => dayOrder(h.hour, cutoff) < dayOrder(clock, cutoff)).reduce((t, h) => t + read(h), 0);
    const side = today
        ? { tickets: [upTo(summary.hours, h => h.tickets), upTo(before.hours, h => h.tickets)], people: [upTo(summary.hours, h => h.people ?? 0), upTo(before.hours, h => h.people ?? 0)], net: [upTo(summary.hours, h => h.net), upTo(before.hours, h => h.net)], note: `ayer antes de las ${hourLabel(clock)}` }
        : fair ? { tickets: [totals.tickets, before.totals.tickets], people: [totals.people, before.totals.people], net: [totals.net, before.totals.net], note: shown.before } : null;
    const ticketOf = (net: number, tickets: number) => tickets ? Math.round(net / tickets) : 0;
    const stats: Stat[] = [
        { label: 'Cuentas', value: whole(totals.tickets), now: side?.tickets[0], was: side?.tickets[1], shown: whole },
        { label: 'Ticket promedio', value: money(totals.averageTicket), now: side ? ticketOf(side.net[0]!, side.tickets[0]!) : undefined, was: side ? ticketOf(side.net[1]!, side.tickets[1]!) : undefined, shown: money },
        { label: 'Comensales', value: whole(totals.people), now: side?.people[0], was: side?.people[1], shown: whole }
    ];

    return <main className="report summary">

        <section className="headline hero" aria-label={headline}>

            <div className="hero-top">

                <div>

                    <h1>{today && <span className="live-dot" aria-hidden="true" />}{headline}</h1>
                    <Figure value={totals.net} />
                    {today
                        ? <Versus now={soFar(summary.hours, clock, cutoff)} before={soFar(before.hours, clock, cutoff)} against={`ayer antes de las ${hourLabel(clock)}`} />
                        : <Versus now={comparable} before={before.totals.net} against={against} />}

                </div>
                {oneDay && metrics.length > 1 && <div className="metric-tabs" role="group" aria-label="Cifra de la gráfica">{metrics.map(m => <button key={m.id} aria-pressed={metric === m.id} onClick={() => setMetric(m.id)}>{m.label}</button>)}</div>}

            </div>
            <Behind rows={scope.filter(b => summary.partial.includes(b.licenseId))} loadedAt={loadedAt} />
            <OutOfRange branches={view.me.branches} ids={summary.outOfRange} />
            {oneDay
                ? <Hours hours={summary.hours} cutoff={cutoff} now={today ? clock : null} metric={metric} before={before.hours} beforeLabel={beforeName} />
                : <div className="hero-chart"><h2>Por día</h2><Days days={summary.days} span={span} /></div>}

        </section>
        <div className="stats">{stats.map(s => <section className="stat" key={s.label} aria-label={s.label}>

            <span className="stat-label">{s.label}</span>
            <span className="stat-value">{s.value}</span>
            {s.now !== undefined && s.was !== undefined && <span className="stat-cmp"><Delta now={s.now} before={s.was} shown={s.shown} /><span>{s.shown(s.now)} contra {s.shown(s.was)} {side!.note}</span></span>}

        </section>)}</div>
        <div className="col">

            <GoalsBlock goals={data.goals} />
            {today && <Now rows={scope} />}
            {!oneDay && <Block title="Horas pico" className="hours-block">

                {!onlyLite ? <Hours hours={summary.hours} cutoff={cutoff} now={null} /> : null}
                <ProNote branches={view.scope} lite={summary.lite} locked="Las horas pico de varios días son del plan Pro." />

            </Block>}
            <ShiftsBlock shifts={summary.shifts} />

        </div>
        <div className="col">

            {(scope.length > 1 || chosen) && <Branches rows={scope} all={!chosen} today={today} choose={choose} loadedAt={loadedAt} before={fair ? before.branches : null} />}
            {<Block title="Por canal"><Rows label="Ventas por canal" empty="Sin ventas cerradas en este periodo." rows={channels.map(c => ({ key: c.channel, name: channelLabel(c.channel), value: c.net, note: <>{plural(c.tickets, 'cuenta', 'cuentas')} · {percent(c.net, sum(channels, x => x.net))}{fair && <Delta now={c.net} before={before.channels.find(b => b.channel === c.channel)?.net ?? 0} />}</> }))} /><ProNote branches={view.scope} lite={summary.lite} locked="" /></Block>}
            <AreasBlock areas={summary.areas} />
            {!onlyLite && <Block title="Descuentos y cancelaciones" className="adjust">

                <Facts items={[
                    ['Descuentos', <>{money(totals.discounts)}{fair && <Delta now={totals.discounts} before={before.totals.discounts} good={-1} />}</>],
                    ['Cancelaciones', <>{whole(totals.voidedCount)} · {money(totals.voidedAmount)}{fair && <Delta now={totals.voidedAmount} before={before.totals.voidedAmount} good={-1} />}</>],
                    ['Cortesías', <>{whole(totals.comps)}{fair && <Delta now={totals.comps} before={before.totals.comps} good={-1} shown={whole} />}</>],
                    ['Comidas de empleados', whole(totals.staffMeals)]
                ]} />
                <ProNote branches={view.scope} lite={summary.lite} locked="" />

            </Block>}

        </div>

    </main>;
}

function Branches({ rows, all, today, choose, loadedAt, before }: { rows: api.Summary['branches']; all: boolean; today: boolean; choose: (licenseId: string) => void; loadedAt: number; before: api.Summary['branches'] | null }) {

    const top = Math.max(...rows.map(r => r.net), 1);

    return <section className="block branches">

        <h2>{all ? 'Sucursales' : 'Sucursal'}</h2>
        <ol className="ranking">{rows.map(b => {

            const body = <>

                <span className="rank-name">{b.name}</span>
                <span className="rank-net">{b.hasData ? money(b.net) : 'Sin datos'}{b.hasData && before && <Delta now={b.net} before={before.find(x => x.licenseId === b.licenseId)?.net ?? 0} />}</span>
                <span className="rank-bar">{b.net > 0 && <span style={{ width: `${b.net / top * 100}%` }} />}</span>
                <span className={b.stale ? 'rank-state late' : 'rank-state'}>{b.stale ? <CircleAlert size={14} aria-hidden="true" /> : <i className="live-dot" aria-hidden="true" />}{b.stale ? 'Sin contacto' : 'En línea'} · {seenAt(b.lastSeenAt, loadedAt)}{today && b.live && !b.stale ? ` · ${plural(b.live.openAccounts, 'cuenta abierta', 'cuentas abiertas')}` : ''}</span>

            </>;

            return <li key={b.licenseId}>{all ? <button onClick={() => choose(b.licenseId)}>{body}</button> : <div>{body}</div>}</li>;

        })}</ol>
        {!all && <button className="link" onClick={() => choose('')}>Ver todas las sucursales</button>}

    </section>;
}

function Now({ rows }: { rows: api.Summary['branches'] }) {

    const live = rows.filter(r => r.live && !r.stale).map(r => r.live!);

    if (!live.length) return <Block title="Ahora mismo" className="now"><div className="chart-empty"><span /><span /><p>Ninguna sucursal en línea envía el piso en este momento.</p></div></Block>;

    const add = (read: (l: api.Live) => number) => live.reduce((total, l) => total + read(l), 0);

    return <Block title="Ahora mismo" className="now">

        <Facts items={[['Cuentas abiertas', whole(add(l => l.openAccounts))], ['Mesas ocupadas', whole(add(l => l.occupiedTables))], ['Por cobrar', money(add(l => l.openAmount))], ['Cajas abiertas', whole(live.filter(l => l.cashOpen).length)]]} />
        <NowMore rows={rows} />

    </Block>;
}
