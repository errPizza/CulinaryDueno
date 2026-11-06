import { Lock, Package, PiggyBank, ReceiptText, Tag, Undo2, Users, UtensilsCrossed, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import type * as api from './api';
import type { Data, View } from './app';
import { bps, clockTime, methodLabel, money, percent, plural, rangeLabel, whole } from './format';
import { allLite, Amount, Behind, Block, Facts, HeroRow, OutOfRange, ProNote, Rows, StatCard } from './parts';
import { CostsBlock, ExpiringBlock, LaborChart, MenuQuad, MixBlock, PriceBlock, PromoBlock, TeamBlocks } from './insights';

const TOP = 10, BOTTOM = 5, HERO_BARS = 7;

export type Of<S extends Data['section']> = { view: View; data: Extract<Data, { section: S }> };

export const sum = <T,>(rows: readonly T[], read: (row: T) => number) => rows.reduce((total, row) => total + read(row), 0);

/** The graphite card: what the figure is, the figure, and below it what explains it. `children` go under the figure. */
export function Headline({ view, title, figure, outOfRange, children, label }: { view: View; title: string; figure: string; outOfRange: string[]; children: ReactNode; label?: string }) {

    return <section className="headline" aria-label={title}>

        <h1>{label ?? `${title} · ${rangeLabel(view.span)}`}</h1>
        <p className="figure"><Amount text={figure} /></p>
        <Behind rows={view.scope.filter(b => b.stale)} loadedAt={view.loadedAt} />
        <OutOfRange branches={view.me.branches} ids={outOfRange} />
        {children}

    </section>;
}

/** A whole Pro area seen with only Lite branches: said once, instead of a page of zeros. */
export function Locked({ title, what }: { title: string; what: string }) {

    return <main className="empty locked"><span className="lock-mark" aria-hidden="true"><Lock size={22} /></span><h2>{title} es del plan Pro</h2><p>{what} Pide a tu proveedor el cambio de plan.</p></main>;
}

export const branchOf = (view: View) => { const names = new Map(view.me.branches.map(b => [b.licenseId, b.name])); return (licenseId: string) => view.scope.length > 1 ? `${names.get(licenseId) ?? 'Sucursal'} · ` : ''; };

/** Horizontal bars inside the graphite card; the first one carries the amber. An optional mark draws a second value. */
export function HeroBars({ rows, label }: { rows: { key: string; name: string; value: number; shown: string; note?: string; mark?: number }[]; label: string }) {

    const top = Math.max(...rows.map(r => Math.max(r.value, r.mark ?? 0)), 1);

    return <ol className="hbars push" aria-label={label}>{rows.map(r => <li key={r.key}>

        <span className="n">{r.name}</span>
        <span className="t" aria-hidden="true"><span style={{ width: `${r.value / top * 100}%` }} />{r.mark !== undefined && <i style={{ left: `${r.mark / top * 100}%` }} />}</span>
        <span className="v">{r.shown}{r.note && <small> · {r.note}</small>}</span>

    </li>)}</ol>;
}

/** Margin only counts what has a recipe: the rest is named, so a high margin is not read as the whole menu. */
export function ProductsView({ view, data }: Of<'products'>) {

    const { products, lite, outOfRange } = data.products, { inventory } = data.cash, { menu } = data;
    const onlyLite = allLite(view.scope, lite), mixed = lite.length > 0 && !onlyLite;
    const revenue = sum(products, p => p.revenue), costed = revenue - sum(products, p => p.revenueWithoutCost), margin = sum(products, p => p.estimatedMargin), left = revenue - costed;
    const units = sum(products, p => p.quantity);
    const unpriced = products.filter(p => p.revenueWithoutCost === p.revenue);
    const least = [...products].filter(p => p.quantity > 0).sort((a, b) => a.quantity - b.quantity || a.revenue - b.revenue).slice(0, BOTTOM);
    const categories = [...products.reduce((all, p) => all.set(p.category, (all.get(p.category) ?? 0) + p.revenue), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
    const low = view.scope.filter(b => b.live && !b.stale).flatMap(b => b.live!.lowStock.map(i => ({ ...i, branch: b })));
    const line = (p: api.Products['products'][number]) => ({ key: `${p.category}|${p.name}`, name: p.name, value: p.revenue, note: onlyLite ? plural(p.quantity, 'vendido', 'vendidos') : `${plural(p.quantity, 'vendido', 'vendidos')} · ${p.revenueWithoutCost === p.revenue ? mixed ? 'sin margen' : 'sin receta' : `margen ${money(p.estimatedMargin)} (${percent(p.estimatedMargin, p.revenue - p.revenueWithoutCost)})`}` });

    return <main className="report">

        <HeroRow hero={<Headline view={view} title="Venta de productos" figure={money(revenue)} outOfRange={outOfRange}>

            {!onlyLite && costed > 0 && <p className="versus"><span className="pill flat">Margen estimado {money(margin)} · {percent(margin, costed)}</span></p>}
            {!onlyLite && <p className="hero-sub">{left > 0 ? (mixed ? `No incluye ${money(left)} vendidos sin receta o en sucursales Lite.` : `Sin contar ${plural(unpriced.length, 'producto', 'productos')} sin receta, que suman ${money(left)}.`) : 'Margen con el costo de las recetas, sin descuentos ni envíos.'}</p>}
            <ProNote branches={view.scope} lite={lite} locked="El costo y el margen son del plan Pro." />
            {products.length > 0 ? <HeroBars label="Más vendidos" rows={products.slice(0, HERO_BARS).map(p => ({ key: `${p.category}|${p.name}`, name: p.name, value: p.revenue, shown: money(p.revenue), note: whole(p.quantity) }))} /> : <div className="chart-empty push"><span /><span /><span /><p>Sin productos vendidos en este periodo.</p></div>}

        </Headline>} stats={<>

            <StatCard label="Platillos vendidos" value={whole(units)} Icon={UtensilsCrossed}><span>{plural(products.length, 'producto distinto', 'productos distintos')}</span></StatCard>
            {onlyLite
                ? <StatCard label="Categorías" value={whole(categories.length)} Icon={Tag}><span>con ventas en el periodo</span></StatCard>
                : <StatCard label="Costo de lo vendido" value={menu.totals.costedRevenue ? bps(menu.totals.foodCostBps) : '—'} Icon={Tag}><span>meta {bps(menu.foodCostTargetBps)}</span></StatCard>}
            {onlyLite
                ? <StatCard label="Ticket por platillo" value={units ? money(Math.round(revenue / units)) : '—'} Icon={ReceiptText} />
                : <StatCard label="Mermas" value={money(inventory.waste)} Icon={Package}><span>faltante {money(inventory.shortage)}</span></StatCard>}

        </>} />
        {!onlyLite && <div className="row r2"><MenuQuad menu={menu} /><PriceBlock menu={menu} /></div>}
        {!onlyLite && <div className="row r3">

            <CostsBlock view={view} menu={menu} />
            <ExpiringBlock view={view} menu={menu} />
            <Block title="Inventario bajo ahora" meta="bajo el mínimo">

                {low.length
                    ? <Rows label="Inventario bajo" shown={v => `${whole(v)}`} rows={low.map(i => ({ key: `${i.branch.licenseId}|${i.ingredientId}`, name: i.name, value: i.available, note: `${view.scope.length > 1 ? `${i.branch.name} · ` : ''}quedan ${whole(i.available)} ${i.unit}, mínimo ${whole(i.min)}` }))} />
                    : <p className="quiet">Ningún ingrediente está por debajo de su mínimo.</p>}
                <ProNote branches={view.scope} lite={lite} locked="" />

            </Block>

        </div>}
        <div className="row r2">

            <Block title="Más vendidos">

                <Rows label="Más vendidos" rows={products.slice(0, TOP).map(line)} empty="Sin productos vendidos en este periodo." />
                {products.length > 0 && <details className="all">

                    <summary>Ver los {whole(products.length)} productos</summary>
                    <div className="scroll"><table>

                        <thead><tr><th scope="col">Producto</th><th scope="col">Unidades</th><th scope="col">Ingreso</th>{!onlyLite && <th scope="col">Margen</th>}</tr></thead>
                        <tbody>{products.map(p => <tr key={`${p.category}|${p.name}`}><td>{p.name}<small>{p.category}</small></td><td>{whole(p.quantity)}</td><td>{money(p.revenue)}</td>{!onlyLite && <td>{p.revenueWithoutCost === p.revenue ? 'Sin receta' : money(p.estimatedMargin)}</td>}</tr>)}</tbody>

                    </table></div>

                </details>}

            </Block>
            <div className="col">

                <Block title="Por categoría"><Rows label="Ventas por categoría" empty="Sin ventas por categoría en este periodo." rows={categories.map(([name, value]) => ({ key: name, name: name || 'Sin categoría', value, note: percent(value, revenue) }))} /></Block>
                {products.length > TOP && <Block title="Menos vendidos"><Rows label="Menos vendidos" rows={least.map(line)} /></Block>}
                <Block title="Mermas e inventario">

                    {!onlyLite && <Facts items={[['Merma', money(inventory.waste)], ['Faltante', money(inventory.shortage)], ['Sobrante', money(inventory.surplus)]]} />}
                    {!onlyLite && <p className="note">A costo de existencias, de los conteos y mermas registrados en el periodo.</p>}
                    <ProNote branches={view.scope} lite={lite} locked="Las mermas y el inventario son del plan Pro." />

                </Block>

            </div>

        </div>
        {!onlyLite && <div className="row r2"><MixBlock menu={menu} /><PromoBlock menu={menu} /></div>}

    </main>;
}

const difference = (cents: number) => cents === 0 ? 'Cuadró' : cents > 0 ? `Sobran ${money(cents)}` : `Faltan ${money(-cents)}`;
const METHOD_COLORS = ['var(--amber)', '#8d96a3', '#4c5563', '#c2c9d2'];

export function CashView({ view, data }: Of<'cash'>) {

    const { summary, cash: { cash, closes, lite, outOfRange }, closings: { closings } } = data;

    if (allLite(view.scope, lite)) return <Locked title="Caja" what="Cobros por método, propinas, arqueos, retiros y cortes Z." />;

    // Payments only come from Pro branches, so the sales beside them do too.
    const pro = summary.branches.filter(b => !lite.includes(b.licenseId));
    const collected = sum(summary.payments, p => p.amount), tips = sum(summary.payments, p => p.tips), refunds = sum(summary.refunds, r => r.amount);
    const payments = [...summary.payments].sort((a, b) => b.amount - a.amount);
    const branch = branchOf(view);
    const zone = (licenseId: string) => view.me.branches.find(b => b.licenseId === licenseId)?.timeZone;
    const short = closes.filter(c => c.cashDifference < 0);

    return <main className="report">

        <HeroRow hero={<Headline view={view} title="Cobrado" figure={money(collected)} outOfRange={outOfRange}>

            <p className="versus"><span className="pill flat">+ {money(tips)} en propinas</span></p>
            <p className="hero-sub">{plural(sum(payments, p => p.count), 'cobro', 'cobros')} · {plural(sum(summary.refunds, r => r.count), 'devolución', 'devoluciones')} por {money(refunds)}</p>
            <ProNote branches={view.scope} lite={lite} locked="" />
            <div className="push">

                {payments.length > 0 && <div className="stackbar" aria-hidden="true">{payments.map((p, i) => <span key={p.method} style={{ width: `${p.amount / Math.max(1, collected) * 100}%`, background: METHOD_COLORS[i % METHOD_COLORS.length] }} />)}</div>}
                <div className="kpis">{payments.slice(0, 3).map((p, i) => <div key={p.method}><small><i className="dot" style={{ background: METHOD_COLORS[i] }} />{methodLabel(p.method)}</small><b>{money(p.amount)}</b><span>{plural(p.count, 'cobro', 'cobros')} · {percent(p.amount, collected)}</span></div>)}<div><small>Propinas</small><b>{money(tips)}</b><span>{percent(tips, collected)} de lo cobrado</span></div></div>

            </div>

        </Headline>} stats={<>

            <StatCard label="Ventas" value={money(sum(pro, b => b.net))} Icon={ReceiptText}><span>{plural(sum(pro, b => b.tickets), 'cuenta', 'cuentas')}</span></StatCard>
            <StatCard label="Retiros de caja" value={money(cash.withdrawal)} Icon={PiggyBank}><span>ingresos {money(cash.income)}</span></StatCard>
            <StatCard label="Gastos pagados de caja" value={money(cash.expense)} Icon={Wallet}><span>devoluciones aparte</span></StatCard>

        </>} />
        <div className="row r21">

            <Block title="Cortes Z" meta="lo que dice el corte contra lo que vio el panel">

                {closings.length ? <div className="scroll"><table className="table">

                    <thead><tr><th scope="col">Corte</th>{view.scope.length > 1 && <th scope="col" className="left">Sucursal</th>}<th scope="col">Cuentas</th><th scope="col">Corte Z</th><th scope="col">Panel</th><th scope="col">Diferencia</th></tr></thead>
                    <tbody>{closings.map(z => <tr key={`${z.licenseId}|${z.number}`}>

                        <td><b>Z {whole(z.number)}</b><small>{clockTime(z.from, zone(z.licenseId))} a {clockTime(z.to, zone(z.licenseId))}</small></td>
                        {view.scope.length > 1 && <td className="left">{branch(z.licenseId).replace(' · ', '')}</td>}
                        <td>{whole(z.tickets)}</td>
                        <td><b>{money(z.net)}</b></td>
                        <td>{money(z.panelNet)}</td>
                        <td>{z.reopenedTickets === 0 && z.reopenedNet === 0 ? <span className="pill good">Cuadra</span> : z.reopenedTickets > 0 ? <span className="pill amber" title="La cuenta reabierta se suma en el corte en que se volvió a cerrar.">{plural(z.reopenedTickets, 'reapertura', 'reaperturas')} · {money(Math.abs(z.reopenedNet))}</span> : <span className="pill bad" title="Avisa a tu proveedor.">{money(Math.abs(z.reopenedNet))} de diferencia</span>}</td>

                    </tr>)}</tbody>

                </table></div> : <p className="quiet">Sin cortes Z en este periodo.</p>}
                {closings.some(z => z.reopenedTickets > 0) && <p className="note">Una cuenta reabierta después del corte se suma en el corte en que se volvió a cerrar.</p>}

            </Block>
            <Block title="Cierres de caja" meta="contado contra esperado">

                {closes.length ? <ul className="plain">{closes.map(c => <li key={`${c.licenseId}|${c.cashId}`}>

                    <b><i className={c.cashDifference < 0 ? 'dot r' : 'dot ok'} aria-hidden="true" />{branch(c.licenseId)}{clockTime(c.closedAt, zone(c.licenseId))}{c.blind && <span className="tag">A ciegas</span>}</b>
                    <span>Efectivo: {difference(c.cashDifference)} · Tarjeta: {difference(c.cardDifference)} · Transferencia: {difference(c.transferDifference)}{c.adjustments !== 0 ? ` · Ajustes ${money(c.adjustments)}` : ''}</span>

                </li>)}</ul> : <p className="quiet">Sin cierres de caja en este periodo.</p>}
                {short.length > 0 && <p className="callout amber"><Undo2 size={15} aria-hidden="true" /><span>{plural(short.length, 'cierre salió', 'cierres salieron')} con faltante de efectivo por {money(-sum(short, c => c.cashDifference))}.</span></p>}

            </Block>

        </div>
        <div className="row r3">

            <Block title="Movimientos de caja">

                <Rows label="Movimientos de caja" rows={[{ key: 'in', name: 'Ingresos', value: cash.income, note: 'Fondo y otros' }, { key: 'out', name: 'Gastos', value: cash.expense, note: 'Pagados con efectivo de la caja' }, { key: 'w', name: 'Retiros', value: cash.withdrawal, note: 'A caja fuerte' }]} />
                <p className="note">Los gastos no incluyen devoluciones en efectivo, que aparecen en Devoluciones.</p>

            </Block>
            <Block title="Devoluciones" meta="por método"><Rows label="Devoluciones por método" empty="Sin devoluciones en este periodo." rows={summary.refunds.map(r => ({ key: r.method, name: methodLabel(r.method), value: r.amount, note: plural(r.count, 'devolución', 'devoluciones') }))} /></Block>
            <Block title="Propinas por método"><Rows label="Propinas por método" empty="Sin propinas en este periodo." rows={payments.filter(p => p.tips).map(p => ({ key: p.method, name: methodLabel(p.method), value: p.tips, note: percent(p.tips, tips) }))} /></Block>

        </div>

    </main>;
}

/** Tips count the day they were paid, so a waiter can have tips in a period without closing an account in it. */
export function StaffView({ view, data }: Of<'staff'>) {

    const { staff, lite, outOfRange } = data.staff, { team } = data;

    if (allLite(view.scope, lite)) return <Locked title="Personal" what="Ventas, cuentas y propinas de cada mesero." />;

    const net = sum(staff, s => s.net), tickets = sum(staff, s => s.tickets), tips = sum(staff, s => s.tips);
    const { labor } = team, measured = labor.minutes > 0 && labor.net > 0;
    const branch = branchOf(view);
    const owner = view.me.account.role === 'owner';
    const rows = staff.map(s => ({ ...s, team: team.staff.find(t => t.licenseId === s.licenseId && t.staffId === s.staffId) })).sort((a, b) => b.net - a.net);

    return <main className="report">

        <HeroRow hero={<Headline view={view} title={measured ? 'Costo laboral' : 'Ventas por mesero'} figure={measured ? bps(labor.laborBps) : money(net)} outOfRange={outOfRange}>

            {measured ? <>

                <p className="versus"><span className={labor.laborBps <= team.laborTargetBps ? 'pill good' : 'pill bad'}>{money(labor.cost)} de {money(labor.net)} vendidos</span><span>meta {bps(team.laborTargetBps)}</span></p>
                <p className="hero-sub">{plural(Math.round(labor.minutes / 60), 'hora trabajada', 'horas trabajadas')} · venta por hora trabajada <b>{money(Math.round(labor.net / (labor.minutes / 60)))}</b></p>

            </> : <p className="hero-sub">{plural(staff.length, 'persona', 'personas')} · {plural(tickets, 'cuenta', 'cuentas')}. El costo laboral aparece cuando la sucursal usa el reloj checador.</p>}
            <ProNote branches={view.scope} lite={lite} locked="" />
            <LaborChart team={team} />

        </Headline>} stats={<>

            <StatCard label="En turno ahora" value={whole(labor.now.people)} Icon={Users}><span>{money(labor.now.hourlyCost)} por hora</span></StatCard>
            <StatCard label="Propinas" value={money(tips)} Icon={PiggyBank}><span>{tickets ? `${percent(tips, net)} de la venta` : ''}</span></StatCard>
            <StatCard label="Venta por mesero" value={staff.length ? money(Math.round(net / Math.max(1, staff.filter(s => s.tickets).length))) : '—'} Icon={ReceiptText}><span>ticket {money(tickets ? Math.trunc(net / tickets) : 0)}</span></StatCard>

        </>} />
        <div className={owner ? 'row r21' : 'row'}>

            <Block title="Meseros" meta="ventas, cuentas y propinas">

                {rows.length ? <div className="scroll"><table className="table">

                    <thead><tr><th scope="col">Persona</th><th scope="col">Ventas</th><th scope="col">Cuentas</th><th scope="col">Ticket</th><th scope="col">Por hora</th><th scope="col">Propinas</th><th scope="col">Cancelaciones</th></tr></thead>
                    <tbody>{rows.map(s => <tr key={`${s.licenseId}|${s.staffId}`}>

                        <td><b>{s.name}</b><small>{branch(s.licenseId)}{s.team?.minutes ? `${Math.round(s.team.minutes / 60)} h` : s.tickets ? 'sin reloj checador' : 'sólo propinas'}</small></td>
                        <td><b>{money(s.net)}</b></td>
                        <td>{whole(s.tickets)}</td>
                        <td>{money(s.tickets ? Math.trunc(s.net / s.tickets) : 0)}</td>
                        <td>{s.team?.salesPerHour ? money(s.team.salesPerHour) : '—'}</td>
                        <td>{money(s.tips)}</td>
                        <td>{s.team && team.anomalies.some(a => a.licenseId === s.licenseId && a.staffId === s.staffId && a.metric === 'voids') ? <span className="pill bad">{whole(s.team.voids)}</span> : whole(s.team?.voids ?? 0)}</td>

                    </tr>)}</tbody>

                </table></div> : <p className="quiet">Sin ventas por mesero en este periodo.</p>}

            </Block>
            {owner && <Block title="Para revisar" meta="sólo lo ve el dueño">

                {team.anomalies.length ? team.anomalies.map(a => <p className="callout amber" key={`${a.licenseId}|${a.staffId}|${a.metric}`}><Undo2 size={15} aria-hidden="true" /><span><b>{a.name}</b> {whole(a.value)} {a.label}{a.amount ? ` por ${money(a.amount)}` : ''}. Lo usual en su sucursal es {a.usual.toLocaleString('es-MX')}.</span></p>) : <p className="quiet">Nadie se aparta de lo usual en cancelaciones, descuentos, reaperturas ni aperturas de cajón.</p>}
                <p className="note">Al menos 3 y el doble de lo usual entre sus compañeros. Son patrones, no faltas: platícalo con el gerente antes de sacar conclusiones.</p>

            </Block>}

        </div>
        <TeamBlocks view={view} team={team} />

    </main>;
}
