import type { ReactNode } from 'react';
import type * as api from './api';
import type { Data, View } from './app';
import { clockTime, methodLabel, money, percent, plural, rangeLabel, whole } from './format';
import { allLite, Behind, Block, Facts, OutOfRange, ProNote, Rows } from './parts';
import { MenuBlocks, TeamBlocks } from './insights';

const TOP = 10, BOTTOM = 5;

export type Of<S extends Data['section']> = { view: View; data: Extract<Data, { section: S }> };

export const sum = <T,>(rows: readonly T[], read: (row: T) => number) => rows.reduce((total, row) => total + read(row), 0);

export function Headline({ view, title, figure, outOfRange, children }: { view: View; title: string; figure: string; outOfRange: string[]; children: ReactNode }) {

    return <section className="headline" aria-label={title}>

        <h1>{title} · {rangeLabel(view.span)}</h1>
        <p className="figure">{figure}</p>
        {children}
        <Behind rows={view.scope.filter(b => b.stale)} loadedAt={view.loadedAt} />
        <OutOfRange branches={view.me.branches} ids={outOfRange} />

    </section>;
}

/** A whole Pro area seen with only Lite branches: said once, instead of a page of zeros. */
export function Locked({ title, what }: { title: string; what: string }) {

    return <main className="empty"><h2>{title} es del plan Pro</h2><p>{what} Pide a tu proveedor el cambio de plan.</p></main>;
}

export const branchOf = (view: View) => { const names = new Map(view.me.branches.map(b => [b.licenseId, b.name])); return (licenseId: string) => view.scope.length > 1 ? `${names.get(licenseId) ?? 'Sucursal'} · ` : ''; };

/** Margin only counts what has a recipe: the rest is named, so a high margin is not read as the whole menu. */
export function ProductsView({ view, data }: Of<'products'>) {

    const { products, lite, outOfRange } = data.products, { inventory } = data.cash;
    const onlyLite = allLite(view.scope, lite), mixed = lite.length > 0 && !onlyLite;
    const revenue = sum(products, p => p.revenue), costed = revenue - sum(products, p => p.revenueWithoutCost), margin = sum(products, p => p.estimatedMargin), left = revenue - costed;
    const unpriced = products.filter(p => p.revenueWithoutCost === p.revenue);
    const least = [...products].filter(p => p.quantity > 0).sort((a, b) => a.quantity - b.quantity || a.revenue - b.revenue).slice(0, BOTTOM);
    const categories = [...products.reduce((all, p) => all.set(p.category, (all.get(p.category) ?? 0) + p.revenue), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
    const low = view.scope.filter(b => b.live && !b.stale).flatMap(b => b.live!.lowStock.map(i => ({ ...i, branch: b })));
    const line = (p: api.Products['products'][number]) => ({ key: `${p.category}|${p.name}`, name: p.name, value: p.revenue, note: onlyLite ? plural(p.quantity, 'vendido', 'vendidos') : `${plural(p.quantity, 'vendido', 'vendidos')} · ${p.revenueWithoutCost === p.revenue ? mixed ? 'sin margen' : 'sin receta' : `margen ${money(p.estimatedMargin)} (${percent(p.estimatedMargin, p.revenue - p.revenueWithoutCost)})`}` });
    const facts: [string, ReactNode][] = [['Unidades', whole(sum(products, p => p.quantity))]];

    if (onlyLite) facts.push(['Productos', whole(products.length)]);
    else facts.push(['Margen estimado', money(margin)], ['Margen sobre lo costeado', percent(margin, costed)]);
    if (!lite.length) facts.push(['Sin receta', whole(unpriced.length)]);

    return <main className="report">

        <Headline view={view} title="Venta de productos" figure={money(revenue)} outOfRange={outOfRange}>

            <Facts items={facts} />
            {!onlyLite && <p className="note">Margen estimado con el costo de las recetas, sin descuentos ni envíos.{left > 0 && (mixed ? ` No incluye ${money(left)} vendidos sin receta o en sucursales Lite.` : ` No incluye ${plural(unpriced.length, 'producto', 'productos')} sin receta, que suman ${money(left)}.`)}</p>}
            <ProNote branches={view.scope} lite={lite} locked="El costo y el margen son del plan Pro." />

        </Headline>
        <div className="col">

            <Block title="Más vendidos">{products.length ? <Rows label="Más vendidos" rows={products.slice(0, TOP).map(line)} /> : <p className="quiet">Sin productos vendidos en este periodo.</p>}</Block>
            {products.length > TOP && <Block title="Menos vendidos"><Rows label="Menos vendidos" rows={least.map(line)} /></Block>}
            {products.length > 0 && <details className="all">

                <summary>Ver los {whole(products.length)} productos</summary>
                <div className="scroll"><table>

                    <thead><tr><th scope="col">Producto</th><th scope="col">Unidades</th><th scope="col">Ingreso</th>{!onlyLite && <th scope="col">Margen</th>}</tr></thead>
                    <tbody>{products.map(p => <tr key={`${p.category}|${p.name}`}><td>{p.name}<small>{p.category}</small></td><td>{whole(p.quantity)}</td><td>{money(p.revenue)}</td>{!onlyLite && <td>{p.revenueWithoutCost === p.revenue ? 'Sin receta' : money(p.estimatedMargin)}</td>}</tr>)}</tbody>

                </table></div>

            </details>}

        </div>
        <div className="col">

            {categories.length > 1 && <Block title="Por categoría"><Rows label="Ventas por categoría" rows={categories.map(([name, value]) => ({ key: name, name: name || 'Sin categoría', value, note: percent(value, revenue) }))} /></Block>}
            <Block title="Mermas e inventario">

                {!onlyLite && <Facts items={[['Merma', money(inventory.waste)], ['Faltante', money(inventory.shortage)], ['Sobrante', money(inventory.surplus)]]} />}
                {!onlyLite && <p className="note">A costo de existencias, de los conteos y mermas registrados en el periodo.</p>}
                <ProNote branches={view.scope} lite={lite} locked="Las mermas y el inventario son del plan Pro." />

            </Block>
            {!onlyLite && <Block title="Inventario bajo ahora">

                {low.length
                    ? <ul className="plain">{low.map(i => <li key={`${i.branch.licenseId}|${i.ingredientId}`}><b>{i.name}</b><span>{view.scope.length > 1 && `${i.branch.name} · `}quedan {whole(i.available)} {i.unit}, mínimo {whole(i.min)}</span></li>)}</ul>
                    : <p className="quiet">Ningún ingrediente está por debajo de su mínimo.</p>}
                <ProNote branches={view.scope} lite={lite} locked="" />

            </Block>}

        </div>
        {!onlyLite && <MenuBlocks view={view} menu={data.menu} />}

    </main>;
}

const difference = (cents: number) => cents === 0 ? 'Cuadró' : cents > 0 ? `Sobran ${money(cents)}` : `Faltan ${money(-cents)}`;

export function CashView({ view, data }: Of<'cash'>) {

    const { summary, cash: { cash, closes, lite, outOfRange }, closings: { closings } } = data;

    if (allLite(view.scope, lite)) return <Locked title="Caja" what="Cobros por método, propinas, arqueos, retiros y cortes Z." />;

    // Payments only come from Pro branches, so the sales beside them do too.
    const pro = summary.branches.filter(b => !lite.includes(b.licenseId));
    const collected = sum(summary.payments, p => p.amount), tips = sum(summary.payments, p => p.tips), refunds = sum(summary.refunds, r => r.amount);
    const payments = [...summary.payments].sort((a, b) => b.amount - a.amount);
    const branch = branchOf(view);
    const zone = (licenseId: string) => view.me.branches.find(b => b.licenseId === licenseId)?.timeZone;

    return <main className="report">

        <Headline view={view} title="Cobrado" figure={money(collected)} outOfRange={outOfRange}>

            <Facts items={[['Ventas', money(sum(pro, b => b.net))], ['Propinas', money(tips)], ['Devoluciones', money(refunds)], ['Cuentas', whole(sum(pro, b => b.tickets))]]} />
            <ProNote branches={view.scope} lite={lite} locked="" />

        </Headline>
        <div className="col">

            <Block title="Por método de pago">{payments.length ? <Rows label="Cobrado por método" rows={payments.map(p => ({ key: p.method, name: methodLabel(p.method), value: p.amount, note: `${plural(p.count, 'pago', 'pagos')} · ${percent(p.amount, collected)}${p.tips ? ` · propinas ${money(p.tips)}` : ''}` }))} /> : <p className="quiet">Sin cobros en este periodo.</p>}</Block>
            <Block title="Cierres de caja">

                {closes.length ? <ul className="plain closes">{closes.map(c => <li key={`${c.licenseId}|${c.cashId}`}>

                    <b>{branch(c.licenseId)}{clockTime(c.closedAt, zone(c.licenseId))}{c.blind && <span className="tag">Arqueo ciego</span>}</b>
                    <dl>

                        <div><dt>Efectivo</dt><dd>{difference(c.cashDifference)}</dd></div>
                        <div><dt>Tarjeta</dt><dd>{difference(c.cardDifference)}</dd></div>
                        <div><dt>Transferencia</dt><dd>{difference(c.transferDifference)}</dd></div>
                        {c.adjustments !== 0 && <div><dt>Ajustes</dt><dd>{money(c.adjustments)}</dd></div>}

                    </dl>

                </li>)}</ul> : <p className="quiet">Sin cierres de caja en este periodo.</p>}

            </Block>

        </div>
        <div className="col">

            <Block title="Movimientos de caja">

                <Facts items={[['Ingresos', money(cash.income)], ['Gastos', money(cash.expense)], ['Retiros', money(cash.withdrawal)]]} />
                <p className="note">Los gastos no incluyen devoluciones en efectivo, que aparecen en Devoluciones.</p>

            </Block>
            {summary.refunds.length > 0 && <Block title="Devoluciones"><Rows label="Devoluciones por método" rows={summary.refunds.map(r => ({ key: r.method, name: methodLabel(r.method), value: r.amount, note: plural(r.count, 'devolución', 'devoluciones') }))} /></Block>}
            <Block title="Cortes Z">

                {closings.length ? <ul className="plain">{closings.map(z => <li key={`${z.licenseId}|${z.number}`}>

                    <b>{branch(z.licenseId)}Corte Z {whole(z.number)}</b>
                    <span>{clockTime(z.from, zone(z.licenseId))} a {clockTime(z.to, zone(z.licenseId))} · {plural(z.tickets, 'cuenta', 'cuentas')} · {money(z.net)}</span>
                    {(z.reopenedTickets !== 0 || z.reopenedNet !== 0) && <span className="note">{z.reopenedTickets > 0
                        ? `${plural(z.reopenedTickets, 'cuenta se reabrió', 'cuentas se reabrieron')} después de este corte y el panel ${z.reopenedTickets === 1 ? 'la cuenta' : 'las cuenta'} en el corte en que se volvió a cerrar: aquí suma ${money(z.panelNet)}.`
                        : `El panel suma ${money(z.panelNet)} en este corte, ${money(Math.abs(z.reopenedNet))} ${z.reopenedNet < 0 ? 'más' : 'menos'} que el corte. Avisa a tu proveedor.`}</span>}

                </li>)}</ul> : <p className="quiet">Sin cortes Z en este periodo.</p>}

            </Block>

        </div>

    </main>;
}

/** Tips count the day they were paid, so a waiter can have tips in a period without closing an account in it. */
export function StaffView({ view, data }: Of<'staff'>) {

    const { staff, lite, outOfRange } = data.staff;

    if (allLite(view.scope, lite)) return <Locked title="Personal" what="Ventas, cuentas y propinas de cada mesero." />;

    const net = sum(staff, s => s.net), tickets = sum(staff, s => s.tickets), tips = sum(staff, s => s.tips);
    const branch = branchOf(view);
    const byTips = [...staff].filter(s => s.tips > 0).sort((a, b) => b.tips - a.tips).slice(0, TOP);

    return <main className="report">

        <Headline view={view} title="Ventas por mesero" figure={money(net)} outOfRange={outOfRange}>

            <Facts items={[['Personas', whole(staff.length)], ['Cuentas', whole(tickets)], ['Ticket promedio', money(tickets ? Math.trunc(net / tickets) : 0)], ['Propinas', money(tips)]]} />
            <ProNote branches={view.scope} lite={lite} locked="" />

        </Headline>
        <div className="col">

            <Block title="Ventas">{staff.length ? <Rows label="Ventas por mesero" rows={staff.map(s => ({ key: `${s.licenseId}|${s.staffId}`, name: s.name, value: s.net, note: s.tickets ? `${branch(s.licenseId)}${plural(s.tickets, 'cuenta', 'cuentas')} · ticket ${money(Math.trunc(s.net / s.tickets))} · ${percent(s.net, net)}` : `${branch(s.licenseId)}sin cuentas cerradas, sólo propinas` }))} /> : <p className="quiet">Sin ventas por mesero en este periodo.</p>}</Block>

        </div>
        <div className="col">

            {byTips.length > 0 && <Block title="Propinas"><Rows label="Propinas por mesero" rows={byTips.map(s => ({ key: `${s.licenseId}|${s.staffId}`, name: s.name, value: s.tips, note: `${branch(s.licenseId)}${percent(s.tips, tips)}` }))} /></Block>}

        </div>
        <TeamBlocks view={view} team={data.team} />

    </main>;
}
