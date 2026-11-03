import { useCallback, useEffect, useRef, useState } from 'react';
import { ChartColumn, CircleAlert, LogOut, RefreshCw, Users, UtensilsCrossed, Wallet } from 'lucide-react';
import * as api from './api';
import { CashView, ProductsView, StaffView } from './detail';
import { channelLabel, clockHour, cutoffHour, daysIn, hourLabel, MAX_DAYS, message, money, percent, PERIODS, plural, previous, range, rangeLabel, seenAt, shiftDay, soFar, todayOf, whole, type Period, type Range } from './format';
import { Gate } from './gate';
import { Privacy } from './privacy';
import { Days, Hours } from './hours';
import { allLite, Behind, Block, branchNames, Facts, OutOfRange, ProNote, Rows, Versus } from './parts';

const REFRESH_MS = 60_000;

const sum = <T,>(rows: readonly T[], read: (row: T) => number) => rows.reduce((total, row) => total + read(row), 0);

export type Section = 'summary' | 'products' | 'cash' | 'staff';

const SECTIONS: { id: Section; label: string; Icon: typeof ChartColumn }[] = [
    { id: 'summary', label: 'Resumen', Icon: ChartColumn },
    { id: 'products', label: 'Productos', Icon: UtensilsCrossed },
    { id: 'cash', label: 'Caja', Icon: Wallet },
    { id: 'staff', label: 'Personal', Icon: Users }
];

export type Data =
    | { section: 'summary'; summary: api.Summary; before: api.Summary }
    | { section: 'products'; products: api.Products; cash: api.Cash }
    | { section: 'cash'; summary: api.Summary; cash: api.Cash; closings: api.Closings }
    | { section: 'staff'; staff: api.Staff };

export type View = { me: api.Me; scope: api.Branch[]; today: string; span: Range; loadedAt: number; data: Data };

/** Each section asks only for what it shows. The summary brings the stretch it is compared with. */
async function fetchSection(section: Section, period: Period, span: Range, branch?: string): Promise<Data> {

    if (section === 'products') { const [products, cash] = await Promise.all([api.products(span.from, span.to, branch), api.cash(span.from, span.to, branch)]); return { section, products, cash }; }
    if (section === 'cash') { const [summary, cash, closings] = await Promise.all([api.summary(span.from, span.to, branch), api.cash(span.from, span.to, branch), api.closings(span.from, span.to, branch)]); return { section, summary, cash, closings }; }
    if (section === 'staff') return { section, staff: await api.staff(span.from, span.to, branch) };

    const before = previous(period, span);
    const [summary, earlier] = await Promise.all([api.summary(span.from, span.to, branch), api.summary(before.from, before.to, branch)]);

    return { section, summary, before: earlier };
}

export function App() {

    const [signedIn, setSignedIn] = useState(() => api.session() !== null);

    useEffect(() => api.onSignedOut(() => setSignedIn(false)), []);

    return signedIn ? <Dashboard /> : <Gate onSignedIn={() => setSignedIn(true)} />;
}

function Dashboard() {

    const [branch, setBranch] = useState(''), [period, setPeriod] = useState<Period>('today'), [section, setSection] = useState<Section>('summary'), [custom, setCustom] = useState<Range | null>(null);
    const [view, setView] = useState<View | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [reading, setReading] = useState(false);
    const ask = useRef(0);
    const load = useCallback(async () => {

        const mine = ++ask.current;

        setLoading(true);

        try {

            const me = await api.me();
            const scope = me.branches.filter(b => !branch || b.licenseId === branch);
            const today = todayOf(scope);
            const span = range(period, today, custom ?? { from: shiftDay(today, -29), to: today });
            const data = await fetchSection(section, period, span, branch || undefined);

            if (mine === ask.current) { setView({ me, scope, today, span, loadedAt: Date.now(), data }); setError(''); }

        } catch (e) { if (mine === ask.current) setError(message(e)); } finally { if (mine === ask.current) setLoading(false); }

    }, [branch, period, section, custom]);

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
            <nav className="sections" aria-label="Secciones">{SECTIONS.map(({ id, label, Icon }) => <button key={id} aria-current={section === id ? 'page' : undefined} onClick={() => setSection(id)}><Icon size={20} aria-hidden="true" /><span>{label}</span></button>)}</nav>
            <button className="icon" onClick={() => void load()} disabled={loading} aria-label="Actualizar"><RefreshCw size={18} className={loading ? 'spin' : ''} /></button>
            <button className="icon" onClick={() => void api.logout()} aria-label={`Cerrar sesión de ${view?.me.account.email ?? 'tu cuenta'}`}><LogOut size={18} /></button>

        </header>
        <div className="controls">

            {branches.length > 1 && <label className="picker"><span className="sr">Sucursal</span>

                <select value={branch} onChange={e => setBranch(e.target.value)}>

                    <option value="">Todas las sucursales</option>
                    {branches.map(b => <option key={b.licenseId} value={b.licenseId}>{b.name}</option>)}

                </select>

            </label>}
            <div className="periods" role="group" aria-label="Periodo">{periods.map(p => <button key={p.id} aria-pressed={period === p.id} onClick={() => pick(p.id)}>{p.label}</button>)}</div>
            {period === 'custom' && custom && view && <Dates key={`${custom.from}|${custom.to}`} span={custom} today={view.today} choose={setCustom} />}

        </div>
        {error && <div className="banner" role="alert"><CircleAlert size={18} /><span>{error}{view && ' Lo que ves es de la última actualización.'}</span></div>}
        {!reading && (!view || view.data.section !== section) && !error && <main className="waiting" aria-busy="true">{view ? 'Cargando…' : 'Cargando tus sucursales…'}</main>}
        {reading ? <Privacy close={() => setReading(false)} /> : view && view.data.section === section && <Content view={view} period={period} choose={setBranch} chosen={branch} />}
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

function Content({ view, period, choose, chosen }: { view: View; period: Period; choose: (licenseId: string) => void; chosen: string }) {

    if (!view.me.branches.length) return <main className="empty"><h2>Aún no hay sucursales en tu cuenta</h2><p>Pide a tu proveedor que revise el acceso de tu cuenta.</p></main>;

    const { data } = view;

    if (data.section === 'products') return <ProductsView view={view} data={data} />;
    if (data.section === 'cash') return <CashView view={view} data={data} />;
    if (data.section === 'staff') return <StaffView view={view} data={data} />;

    return <SummaryView view={view} data={data} period={period} choose={choose} chosen={chosen} />;
}

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

    return <main className="report">

        <section className="headline" aria-label={headline}>

            <h1>{headline}</h1>
            <p className="figure">{money(totals.net)}</p>
            {today
                ? <Versus now={soFar(summary.hours, clock, cutoff)} before={soFar(before.hours, clock, cutoff)} against={`ayer antes de las ${hourLabel(clock)}`} />
                : <Versus now={comparable} before={before.totals.net} against={against} />}
            <Facts items={[['Cuentas', whole(totals.tickets)], ['Ticket promedio', money(totals.averageTicket)], ['Comensales', whole(totals.people)]]} />
            <Behind rows={scope.filter(b => summary.partial.includes(b.licenseId))} loadedAt={loadedAt} />
            <OutOfRange branches={view.me.branches} ids={summary.outOfRange} />

        </section>
        <div className="col">

            {!oneDay && <Block title="Por día" className="hours-block">{summary.days.length ? <Days days={summary.days} span={span} /> : <p className="quiet">Sin ventas cerradas en este periodo.</p>}</Block>}
            <Block title={oneDay ? 'Por hora' : 'Horas pico'} className="hours-block">

                {oneDay || !onlyLite ? summary.hours.length ? <Hours hours={summary.hours} cutoff={cutoff} now={today ? clock : null} /> : <p className="quiet">Sin ventas cerradas en este periodo.</p> : null}
                {!oneDay && <ProNote branches={view.scope} lite={summary.lite} locked="Las horas pico de varios días son del plan Pro." />}

            </Block>

        </div>
        <div className="col">

            {(scope.length > 1 || chosen) && <Branches rows={scope} all={!chosen} today={today} choose={choose} loadedAt={loadedAt} />}
            {today && <Now rows={scope} />}
            {channels.length > 1 && <Block title="Por canal"><Rows label="Ventas por canal" rows={channels.map(c => ({ key: c.channel, name: channelLabel(c.channel), value: c.net, note: `${plural(c.tickets, 'cuenta', 'cuentas')} · ${percent(c.net, sum(channels, x => x.net))}` }))} /><ProNote branches={view.scope} lite={summary.lite} locked="" /></Block>}
            {totals.tickets > 0 && !onlyLite && <Block title="Descuentos y cancelaciones">

                <Facts items={[['Descuentos', money(totals.discounts)], ['Cancelaciones', `${whole(totals.voidedCount)} · ${money(totals.voidedAmount)}`], ['Cortesías', whole(totals.comps)], ['Comidas de empleados', whole(totals.staffMeals)]]} />
                <ProNote branches={view.scope} lite={summary.lite} locked="" />

            </Block>}

        </div>

    </main>;
}

function Branches({ rows, all, today, choose, loadedAt }: { rows: api.Summary['branches']; all: boolean; today: boolean; choose: (licenseId: string) => void; loadedAt: number }) {

    const top = Math.max(...rows.map(r => r.net), 1);

    return <section className="block">

        <h2>{all ? 'Sucursales' : 'Sucursal'}</h2>
        <ol className="ranking">{rows.map(b => {

            const body = <>

                <span className="rank-name">{b.name}</span>
                <span className="rank-net">{b.hasData ? money(b.net) : 'Sin datos'}</span>
                <span className="rank-bar">{b.net > 0 && <span style={{ width: `${b.net / top * 100}%` }} />}</span>
                <span className={b.stale ? 'rank-state late' : 'rank-state'}>{b.stale ? <CircleAlert size={14} aria-hidden="true" /> : <i aria-hidden="true" />}{b.stale ? 'Sin contacto' : 'En línea'} · {seenAt(b.lastSeenAt, loadedAt)}{today && b.live && !b.stale ? ` · ${plural(b.live.openAccounts, 'cuenta abierta', 'cuentas abiertas')}` : ''}</span>

            </>;

            return <li key={b.licenseId}>{all ? <button onClick={() => choose(b.licenseId)}>{body}</button> : <div>{body}</div>}</li>;

        })}</ol>
        {!all && <button className="link" onClick={() => choose('')}>Ver todas las sucursales</button>}

    </section>;
}

function Now({ rows }: { rows: api.Summary['branches'] }) {

    const live = rows.filter(r => r.live && !r.stale).map(r => r.live!);

    if (!live.length) return null;

    const add = (read: (l: api.Live) => number) => live.reduce((total, l) => total + read(l), 0);

    return <Block title="Ahora mismo" className="now">

        <Facts items={[['Cuentas abiertas', whole(add(l => l.openAccounts))], ['Mesas ocupadas', whole(add(l => l.occupiedTables))], ['Por cobrar', money(add(l => l.openAmount))], ['Cajas abiertas', whole(live.filter(l => l.cashOpen).length)]]} />

    </Block>;
}
