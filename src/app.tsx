import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, ChartColumn, ChefHat, CircleAlert, CloudSun, Ellipsis, FileText, HandCoins, HeartHandshake, Lock, LogOut, MessageSquare, ReceiptText, RefreshCw, Settings2, Tag, TrendingUp, Users, UtensilsCrossed, Wallet } from 'lucide-react';
import * as api from './api';
import { CashView, Locked, ProductsView, StaffView } from './detail';
import { MessagesView } from './messages';
import { AlertsView, AreasBlock, CustomersView, ForecastView, GoalsBlock, KitchenView, ProfitView, ShiftsBlock, TrendView } from './insights';
import { SettingsView } from './settings';
import { FiscalView } from './fiscal';
import { channelLabel, clockHour, cutoffHour, dayOrder, daysIn, hourLabel, MAX_DAYS, message, money, percent, PERIODS, plural, previous, range, rangeLabel, seenAt, shiftDay, soFar, todayOf, whole, type Period, type Range } from './format';
import { Gate } from './gate';
import { Privacy } from './privacy';
import { Days, Hours, METRICS, type Metric } from './hours';
import { allLite, Amount, Behind, Block, branchNames, Delta, Facts, HeroRow, OutOfRange, ProNote, Rows, Skeleton, StatCard, useCountUp, Versus } from './parts';
import { pageLead, pageTitle } from './heads';

const REFRESH_MS = 60_000;

const sum = <T,>(rows: readonly T[], read: (row: T) => number) => rows.reduce((total, row) => total + read(row), 0);

export type Section = 'summary' | 'products' | 'cash' | 'staff' | 'trend' | 'forecast' | 'profit' | 'kitchen' | 'customers' | 'alerts' | 'settings' | 'messages' | 'fiscal';

const SECTIONS: { id: Section; label: string; Icon: typeof ChartColumn }[] = [
    { id: 'summary', label: 'Resumen', Icon: ChartColumn },
    { id: 'products', label: 'Productos', Icon: UtensilsCrossed },
    { id: 'cash', label: 'Caja y cortes', Icon: Wallet },
    { id: 'staff', label: 'Personal', Icon: Users }
];
const CONTACT: { id: Section; label: string; Icon: typeof ChartColumn }[] = [{ id: 'messages', label: 'Mensajes', Icon: MessageSquare }];
// Under «Más»: on the phone the bar keeps five buttons.
const MORE: { id: Section; label: string; Icon: typeof ChartColumn }[] = [
    { id: 'trend', label: 'Tendencia', Icon: TrendingUp },
    { id: 'forecast', label: 'Pronóstico', Icon: CloudSun },
    { id: 'profit', label: 'Rentabilidad', Icon: HandCoins },
    { id: 'kitchen', label: 'Cocina', Icon: ChefHat },
    { id: 'customers', label: 'Clientes', Icon: HeartHandshake },
    { id: 'alerts', label: 'Alertas', Icon: Bell },
    { id: 'fiscal', label: 'Facturación', Icon: ReceiptText },
    { id: 'settings', label: 'Ajustes', Icon: Settings2 }
];
// On the desk the sidebar ends with the people side: messages, alerts and settings.
const ANALYSIS = MORE.filter(m => m.id !== 'alerts' && m.id !== 'settings' && m.id !== 'fiscal');
const BOTTOM = [...CONTACT, ...MORE.filter(m => m.id === 'alerts' || m.id === 'fiscal' || m.id === 'settings')];
// Invoicing is the account owner's alone: a manager does not see the section, and the server answers 403 anyway.
const OWNER_ONLY = new Set<Section>(['fiscal']);
const WIDE = '(min-width: 900px)';

/** Whether the sidebar layout is on; some controls live in one place on the desk and another on the phone. */
function useWide() {

    const [wide, setWide] = useState(() => typeof matchMedia === 'function' && matchMedia(WIDE).matches);

    useEffect(() => {

        if (typeof matchMedia !== 'function') return;

        const query = matchMedia(WIDE), change = () => setWide(query.matches);

        query.addEventListener('change', change);

        return () => query.removeEventListener('change', change);

    }, []);

    return wide;
}
// These read their own stretch, or none, so the period picker steps aside.
const OWN_SPAN = new Set<Section>(['trend', 'forecast', 'alerts', 'settings', 'messages', 'fiscal']);
// Whole areas of the Pro plan. With only Lite branches in view they show locked at once, without asking the server.
const PRO: Partial<Record<Section, [title: string, what: string]>> = {
    cash: ['Caja', 'Cobros por método, propinas, arqueos, retiros y cortes Z.'],
    staff: ['Personal', 'Ventas, cuentas y propinas de cada mesero.'],
    trend: ['Tendencia', 'Ventas por semana, mes y año contra el año anterior.'],
    forecast: ['El pronóstico', 'Ventas y platillos de los próximos 7 días.'],
    profit: ['La rentabilidad', 'Ventas menos costo de lo vendido, mermas, gastos, horas trabajadas y gastos fijos.'],
    kitchen: ['Cocina', 'Tiempos por platillo y estación, devoluciones y entregas a tiempo.'],
    customers: ['Clientes', 'Frecuencia, valor de vida y calificaciones de los clientes.']
};
const inScope = (me: api.Me, branch: string) => me.branches.filter(b => !branch || b.licenseId === branch);
const onlyLite = (branches: api.Branch[]) => branches.length > 0 && branches.every(b => b.tier === 'lite');
const lockedFor = (me: api.Me | undefined, branch: string, section: Section) => !!me && !!PRO[section] && onlyLite(inScope(me, branch));

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
    | { section: 'settings'; settings: api.Settings; canEdit: boolean }
    | { section: 'messages'; inbox: api.Inbox }
    | { section: 'fiscal'; fiscal: api.FiscalBranch[] }
    | { section: 'locked' };

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
    if (section === 'messages') return { section, inbox: await api.inbox() };
    if (section === 'fiscal') return { section, fiscal: (await api.fiscal()).branches };
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
    const [by, setBy] = useState<api.Trend['by']>('month'), [more, setMore] = useState(false), [alertCount, setAlertCount] = useState(0), [unread, setUnread] = useState(0);
    const ask = useRef(0), wide = useWide();
    // What the screen is asking for; while the view on hand answers something else, the skeleton stands in.
    const asking = [section, branch, period, custom?.from, custom?.to, by].join('|');
    const load = useCallback(async () => {

        const mine = ++ask.current;

        setLoading(true);

        try {

            const me = await api.me();
            const scope = inScope(me, branch);
            const today = todayOf(scope);
            const span = range(period, today, custom ?? { from: shiftDay(today, -29), to: today });
            // A locked area asks the server for nothing; the count of unread messages rides along with every look.
            const [data, alerts, inbox] = await Promise.all([lockedFor(me, branch, section) ? { section: 'locked' } as Data : fetchSection(section, period, span, by, today, branch || undefined), api.alerts(branch || undefined).catch(() => null), section === 'messages' ? null : api.inbox().catch(() => null)]);
            const box = data.section === 'messages' ? data.inbox : inbox;

            if (mine === ask.current) { setView({ me, scope, today, span, loadedAt: Date.now(), data, asked: [section, branch, period, custom?.from, custom?.to, by].join('|') }); setError(''); if (alerts) setAlertCount(alerts.alerts.filter(a => a.level !== 'info').length); if (box) setUnread(box.branches.reduce((t, b) => t + b.unread, 0)); }

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
    // Free dates are Pro: with only Lite branches in view the option shows locked.
    const datesLocked = !!view && onlyLite(inScope(view.me, branch));
    const locked = (id: Section) => lockedFor(view?.me, branch, id);
    const lockedNow = locked(section);
    const go = (id: Section) => { setSection(id); setMore(false); };
    const badge = (id: Section) => id === 'alerts' && alertCount > 0 ? <span className="count">{alertCount}</span> : id === 'messages' && unread > 0 ? <span className="count" aria-label={plural(unread, 'mensaje sin leer', 'mensajes sin leer')}>{unread}</span> : locked(id) ? <span className="lock" role="img" aria-label="Plan Pro"><Lock size={14} aria-hidden="true" /></span> : null;
    const allowed = (m: { id: Section }) => !OWNER_ONLY.has(m.id) || view?.me.account.role === 'owner';
    const menu = [...CONTACT, ...MORE].filter(allowed);
    const pick = (p: Period) => { if (p === 'custom' && !custom && view) setCustom({ from: shiftDay(view.today, -29), to: view.today }); setPeriod(p); };

    const picker = (className: string) => branches.length > 1 && section !== 'messages' ? <label className={className}><span className={className.includes('viewing') ? undefined : 'sr'}>{className.includes('viewing') ? <small>Viendo</small> : 'Sucursal'}</span>

        <select value={branch} onChange={e => setBranch(e.target.value)} aria-label="Sucursal">

            <option value="">Todas las sucursales</option>
            {branches.map(b => <option key={b.licenseId} value={b.licenseId}>{b.name}</option>)}

        </select>

    </label> : null;
    const periods = !OWN_SPAN.has(section) && !lockedNow && <div className="periods" role="group" aria-label="Periodo">{PERIODS.map(p => p.id === 'custom' && datesLocked && period !== 'custom'
        ? <button key={p.id} className="is-locked" aria-disabled="true" title="Elegir fechas es del plan Pro"><Lock size={13} aria-hidden="true" />{p.label}<span className="sr"> (plan Pro)</span></button>
        : <button key={p.id} aria-pressed={period === p.id} onClick={() => pick(p.id)}>{p.label}</button>)}</div>;
    const refresh = <button className="icon" onClick={() => void load()} disabled={loading} aria-label="Actualizar"><RefreshCw size={16} className={loading ? 'spin' : ''} /></button>;
    const sideItem = ({ id, label, Icon }: typeof MORE[number]) => <button key={'side-' + id} className={locked(id) ? 'side-item is-locked' : 'side-item'} aria-current={section === id ? 'page' : undefined} onClick={() => go(id)}><Icon size={17} aria-hidden="true" /><span>{label}</span>{badge(id)}</button>;
    const shownData = view && view.data.section === section && view.asked === asking ? view.data : undefined;
    const lead = lockedNow ? PRO[section]![1] : pageLead(view, period, shownData);

    return <div className="shell">

        <header className="top">

            <span className="brand"><span className="top-mark"><img src="/symbol.png" alt="" width="22" height="22" /></span>Culinary Dueño</span>
            {wide && picker('viewing')}
            <nav className="sections" aria-label="Secciones">

                <p className="side-group" aria-hidden="true">Hoy</p>
                {SECTIONS.map(({ id, label, Icon }) => <button key={id} className={locked(id) ? 'is-locked' : undefined} aria-current={section === id ? 'page' : undefined} onClick={() => go(id)}><Icon size={wide ? 17 : 20} aria-hidden="true" /><span>{wide ? label : label.split(' ')[0]}</span>{locked(id) && <span className="lock corner" role="img" aria-label="Plan Pro"><Lock size={12} aria-hidden="true" /></span>}</button>)}
                <button className="more-toggle" aria-current={menu.some(m => m.id === section) ? 'page' : undefined} aria-expanded={more} aria-haspopup="menu" onClick={() => setMore(!more)}><Ellipsis size={20} aria-hidden="true" /><span>{menu.find(m => m.id === section)?.label ?? 'Más'}</span>{unread > 0 && <i className="dot" aria-hidden="true" />}</button>
                {more && <div className="more" role="menu" aria-label="Más secciones">{menu.map(({ id, label, Icon }) => <button key={id} role="menuitem" className={locked(id) ? 'is-locked' : undefined} aria-current={section === id ? 'page' : undefined} onClick={() => go(id)}><Icon size={18} aria-hidden="true" /><span>{label}</span>{badge(id)}</button>)}</div>}
                {/* On the desk every section has its own line in the sidebar, so «Más» steps aside. */}
                <p className="side-group" aria-hidden="true">Análisis</p>
                {ANALYSIS.map(sideItem)}
                <span className="side-spacer" aria-hidden="true" />
                {BOTTOM.filter(allowed).map(sideItem)}

            </nav>
            <div className="tools">

                <button className="icon bell" onClick={() => go('alerts')} aria-label={alertCount ? `Alertas: ${alertCount} por atender` : 'Alertas'}><Bell size={17} />{alertCount > 0 && <span className="count" aria-hidden="true">{alertCount}</span>}</button>
                {!wide && refresh}
                <button className="icon" onClick={() => void api.logout()} aria-label={`Cerrar sesión de ${view?.me.account.email ?? 'tu cuenta'}`}><LogOut size={17} /></button>

            </div>
            {view && <div className="account"><span className="avatar" aria-hidden="true">{view.me.account.email.slice(0, 2).toUpperCase()}</span><span><b>{view.me.account.email}</b><small>{view.me.account.role === 'owner' ? 'Dueño' : 'Gerente'} · {plural(view.me.branches.length, 'sucursal', 'sucursales')}</small></span>{wide && <button className="icon" onClick={() => void api.logout()} aria-label="Cerrar sesión"><LogOut size={15} /></button>}</div>}

        </header>
        {!reading && <div className="page-head">

            <div><h1>{pageTitle(section, period)}</h1>{lead && <p>{lead}</p>}</div>
            {wide && <div className="head-tools">{periods}{refresh}{section === 'summary' && !locked('cash') && <button className="primary action" onClick={() => go('cash')}><ReceiptText size={15} aria-hidden="true" />Cortes de caja</button>}</div>}

        </div>}
        <div className="controls">

            {!wide && picker('picker')}
            {!wide && periods}
            {!OWN_SPAN.has(section) && !lockedNow && period === 'custom' && custom && view && <Dates key={`${custom.from}|${custom.to}`} span={custom} today={view.today} choose={setCustom} />}

        </div>
        {error && <div className="banner" role="alert"><CircleAlert size={18} /><span>{error}{view && ' Lo que ves es de la última actualización.'}</span></div>}
        {!reading && !error && !lockedNow && (!view || view.asked !== asking) && <Skeleton summary={section === 'summary'} />}
        {reading ? <Privacy close={() => setReading(false)} /> : lockedNow ? <Locked title={PRO[section]![0]} what={PRO[section]![1]} /> : view && view.data.section === section && (view.asked === asking || error) && <Content view={view} period={period} choose={setBranch} chosen={branch} by={by} chooseBy={setBy} refresh={() => void load()} />}
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

function Content({ view, period, choose, chosen, by, chooseBy, refresh }: { view: View; period: Period; choose: (licenseId: string) => void; chosen: string; by: api.Trend['by']; chooseBy: (by: api.Trend['by']) => void; refresh: () => void }) {

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
    if (data.section === 'messages') return <MessagesView view={view} data={data} refresh={refresh} />;
    if (data.section === 'fiscal') return <FiscalView data={data} refresh={refresh} />;
    if (data.section === 'locked') return null;

    return <SummaryView view={view} data={data} period={period} choose={choose} chosen={chosen} />;
}

/** The day's figure as it climbs, with the cents set smaller so the pesos read first. */
function Figure({ value }: { value: number }) {

    return <p className="figure"><Amount text={money(useCountUp(value))} /></p>;
}

type Stat = { label: string; value: string; now?: number; was?: number; shown: (v: number) => string; Icon: typeof FileText };

function SummaryView({ view, data, period, choose, chosen }: { view: View; data: Extract<Data, { section: 'summary' }>; period: Period; choose: (licenseId: string) => void; chosen: string }) {

    const { span, loadedAt } = view, { summary, before } = data;
    const today = period === 'today', oneDay = span.from === span.to;
    const { totals } = summary;
    const scope = summary.branches;
    const shown = PERIODS.find(p => p.id === period)!;
    const headline = period === 'custom' ? `Ventas del ${rangeLabel(span)}` : shown.headline;
    const clock = clockHour(scope, loadedAt), cutoff = cutoffHour(scope);
    const channels = [...summary.channels].sort((a, b) => b.net - a.net), channelTotal = sum(channels, c => c.net);
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
        { label: 'Cuentas', value: whole(totals.tickets), now: side?.tickets[0], was: side?.tickets[1], shown: whole, Icon: FileText },
        { label: 'Ticket promedio', value: money(totals.averageTicket), now: side ? ticketOf(side.net[0]!, side.tickets[0]!) : undefined, was: side ? ticketOf(side.net[1]!, side.tickets[1]!) : undefined, shown: money, Icon: Tag },
        { label: 'Comensales', value: whole(totals.people), now: side?.people[0], was: side?.people[1], shown: whole, Icon: Users }
    ];

    return <main className="report summary">

        <HeroRow hero={<section className="headline hero" aria-label={headline}>

            <div className="hero-top">

                <div>

                    <h1>{today && <span className="live-dot" aria-hidden="true" />}{headline}{scope.length > 1 && !chosen ? ' · todas las sucursales' : ''}</h1>
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

        </section>} stats={stats.map(s => <StatCard key={s.label} label={s.label} value={s.value} Icon={s.Icon}>{s.now !== undefined && s.was !== undefined && <><Delta now={s.now} before={s.was} shown={s.shown} /><span>vs {s.shown(s.was)} {side!.note}</span></>}</StatCard>)} />
        <div className="row r3">

            {today ? <Now rows={scope} /> : <Block title="Horas pico" className="hours-block">

                {!onlyLite ? <Hours hours={summary.hours} cutoff={cutoff} now={null} /> : null}
                <ProNote branches={view.scope} lite={summary.lite} locked="Las horas pico de varios días son del plan Pro." />

            </Block>}
            <GoalsBlock goals={data.goals} />
            <Block title="Por canal" meta={plural(totals.tickets, 'cuenta', 'cuentas')}>

                {channels.length > 0 && <div className="stackbar" aria-hidden="true">{channels.map((c, i) => <span key={c.channel} style={{ width: `${c.net / Math.max(1, channelTotal) * 100}%`, background: i ? 'var(--bar)' : 'var(--amber)' }} />)}</div>}
                <Rows label="Ventas por canal" empty="Sin ventas cerradas en este periodo." rows={channels.map(c => ({ key: c.channel, name: channelLabel(c.channel), value: c.net, note: <>{plural(c.tickets, 'cuenta', 'cuentas')} · {percent(c.net, channelTotal)}{fair && <Delta now={c.net} before={before.channels.find(b => b.channel === c.channel)?.net ?? 0} />}</> }))} />
                <ProNote branches={view.scope} lite={summary.lite} locked="" />

            </Block>

        </div>
        <div className={scope.length > 1 || chosen ? 'row r21' : 'row r2'}>

            {(scope.length > 1 || chosen) ? <Branches rows={scope} all={!chosen} today={today} choose={choose} loadedAt={loadedAt} before={fair ? before.branches : null} cutoff={cutoff} clock={clock} /> : <AreasBlock areas={summary.areas} />}
            <ShiftsBlock shifts={summary.shifts} />

        </div>
        {(scope.length > 1 || chosen) && (summary.areas ?? []).length > 0 && <AreasBlock areas={summary.areas} />}
        {!onlyLite && <Block title="Descuentos, cancelaciones y cortesías" className="adjust" meta={fair ? `contra ${shown.before}` : undefined}>

            <Facts items={[
                ['Descuentos', <>{money(totals.discounts)}{fair && <Delta now={totals.discounts} before={before.totals.discounts} good={-1} />}</>],
                ['Cancelaciones', <>{money(totals.voidedAmount)}{fair && <Delta now={totals.voidedAmount} before={before.totals.voidedAmount} good={-1} />}<span>{plural(totals.voidedCount, 'platillo', 'platillos')}</span></>],
                ['Cortesías', <>{whole(totals.comps)}{fair && <Delta now={totals.comps} before={before.totals.comps} good={-1} shown={whole} />}</>],
                ['Comidas de empleados', <>{whole(totals.staffMeals)}<span>sin cobro</span></>]
            ]} />
            <ProNote branches={view.scope} lite={summary.lite} locked="" />

        </Block>}

    </main>;
}

const DAY_MINUTES = 24 * 60;

/** How far into the business day an instant falls, as a share of the day, in the branch's own clock. */
function dayShare(at: string | null, cutoff: number, timeZone: string | null) {

    if (!at) return 0;

    const [h, m] = new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timeZone ?? undefined }).split(':').map(Number) as [number, number];

    return ((h * 60 + m - cutoff * 60 + DAY_MINUTES) % DAY_MINUTES) / DAY_MINUTES;
}

function Branches({ rows, all, today, choose, loadedAt, before, cutoff, clock }: { rows: api.Summary['branches']; all: boolean; today: boolean; choose: (licenseId: string) => void; loadedAt: number; before: api.Summary['branches'] | null; cutoff: number; clock: number }) {

    const ticks = [0, 6, 12, 18].map(h => hourLabel((cutoff + h) % 24));
    const now = ((clock - cutoff + 24) % 24) / 24 + 1 / 48;

    return <section className="block branches">

        <div className="block-head"><h2>{all ? 'Sucursales' : 'Sucursal'}</h2>{today && <small>hasta dónde llegó su señal hoy</small>}</div>
        <ol className="ranking">{rows.map(b => {

            const reached = today ? Math.min(1, dayShare(b.lastSeenAt, cutoff, b.timeZone)) : 1;
            const body = <>

                <span className="br-name">

                    <b className="rank-name"><i className={b.stale ? (b.lastSeenAt ? 'br-dot off' : 'br-dot') : 'br-dot on'} aria-hidden="true" /><span>{b.name}</span></b>
                    <small className={b.stale && b.lastSeenAt ? 'rank-state late' : 'rank-state'}>{b.stale ? (b.lastSeenAt ? 'Sin contacto' : 'Nunca se ha conectado') : 'En línea'}{b.lastSeenAt ? ` · ${seenAt(b.lastSeenAt, loadedAt)}` : ''}{today && b.live && !b.stale ? ` · ${plural(b.live.openAccounts, 'cuenta abierta', 'cuentas abiertas')}` : ''}</small>

                </span>
                <span className="dayline" aria-hidden="true">

                    <span className="t">{b.lastSeenAt && <span className={b.stale ? 'late' : undefined} style={{ width: `${reached * 100}%` }} />}{today && <i style={{ left: `${Math.min(100, now * 100)}%` }} />}</span>
                    <span className="h">{ticks.map(t => <span key={t}>{t}</span>)}</span>

                </span>
                <span className="br-am rank-net">{b.hasData ? money(b.net) : <span className="none">Sin datos</span>}{b.hasData && before && <Delta now={b.net} before={before.find(x => x.licenseId === b.licenseId)?.net ?? 0} />}</span>

            </>;

            return <li key={b.licenseId}>{all ? <button onClick={() => choose(b.licenseId)}>{body}</button> : <div>{body}</div>}</li>;

        })}</ol>
        {rows.filter(b => b.stale && b.lastSeenAt).slice(0, 1).map(b => <p className="callout" key={b.licenseId}><CircleAlert size={15} aria-hidden="true" /><span><b>{b.name}</b> no reporta desde {seenAt(b.lastSeenAt, loadedAt).toLowerCase()}. Sus ventas desde entonces no están en la cifra.</span></p>)}
        {!all && <button className="link" onClick={() => choose('')}>Ver todas las sucursales</button>}

    </section>;
}

function Now({ rows }: { rows: api.Summary['branches'] }) {

    const live = rows.filter(r => r.live && !r.stale).map(r => r.live!);

    const names = rows.filter(r => r.live && !r.stale).map(r => r.name);
    const off = rows.filter(r => r.stale && r.lastSeenAt);

    if (!live.length) return <Block title="Ahora mismo" className="now"><div className="chart-empty"><span /><span /><p>Ninguna sucursal en línea envía el piso en este momento.</p></div></Block>;

    const add = (read: (l: api.Live) => number) => live.reduce((total, l) => total + read(l), 0);
    const tables = live.filter(l => l.tables), clocked = live.filter(l => l.onClock);

    return <Block title="Ahora mismo" className="now" meta={names.length === 1 ? names[0] : plural(names.length, 'sucursal', 'sucursales')}>

        <Facts items={[
            ['Cuentas abiertas', whole(add(l => l.openAccounts))],
            ['Por cobrar', money(add(l => l.openAmount))],
            ['Mesas ocupadas', tables.length ? <>{whole(add(l => l.occupiedTables))}<small>de {whole(sum(tables, l => l.tables!.total))}</small></> : whole(add(l => l.occupiedTables))],
            clocked.length ? ['En turno', <>{whole(sum(clocked, l => l.onClock!.people))}<small>{money(sum(clocked, l => l.onClock!.hourlyCost))} por hora</small></>] : ['Cajas abiertas', whole(live.filter(l => l.cashOpen).length)]
        ]} />
        {off.length > 0 && <p className="note">{branchNames(rows, off.map(r => r.licenseId))} no {off.length === 1 ? 'aparece' : 'aparecen'}: sin señal reciente.</p>}

    </Block>;
}
