import type { ReactNode } from 'react';
import type { Data, Section, View } from './app';
import { bps, clockHour, cutoffHour, duration, hourLabel, money, plural, rangeLabel, soFar, whole, type Period } from './format';

// The heading of each screen: its name, and one sentence with what matters in it right now.

const NAMES: Record<Section, string> = {
    summary: 'Resumen', products: 'Productos', cash: 'Caja y cortes', staff: 'Personal', trend: 'Tendencia', forecast: 'Pronóstico',
    profit: 'Rentabilidad', kitchen: 'Cocina', customers: 'Clientes', alerts: 'Alertas', settings: 'Ajustes del panel', messages: 'Mensajes', fiscal: 'Facturación'
};
const OF: Record<Period, string> = { today: ' de hoy', yesterday: ' de ayer', week: ' de 7 días', month: ' del mes', custom: '' };
const OWN = new Set<Section>(['trend', 'forecast', 'alerts', 'settings', 'messages', 'fiscal']);

export const pageTitle = (section: Section, period: Period) => NAMES[section] + (OWN.has(section) ? '' : OF[period]);

const sum = <T,>(rows: readonly T[], read: (row: T) => number) => rows.reduce((total, row) => total + read(row), 0);

/** Who is out of touch, said at the end of the sentence, because their figure may be short. */
function silent(view: View): ReactNode {

    const quiet = view.scope.filter(b => b.stale && b.lastSeenAt);

    if (!quiet.length) return null;

    const first = quiet[0]!;

    return <> <b>{first.name}</b> no reporta desde las {new Date(first.lastSeenAt!).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: first.timeZone ?? undefined })}.{quiet.length > 1 ? ` Hay ${plural(quiet.length - 1, 'otra', 'otras')} sin señal.` : ''}</>;
}

export function pageLead(view: View | null, period: Period, data?: Data): ReactNode {

    if (!view || !data) return null;

    switch (data.section) {

        case 'summary': {

            const { summary, before } = data;

            if (period === 'today') {

                const clock = clockHour(summary.branches, view.loadedAt), cutoff = cutoffHour(summary.branches);
                const gap = soFar(summary.hours, clock, cutoff) - soFar(before.hours, clock, cutoff);

                return <>{gap === 0 ? 'Vas igual que ayer a esta hora.' : <>Vas <b>{money(Math.abs(gap))} {gap > 0 ? 'arriba' : 'abajo'}</b> de ayer antes de las {hourLabel(clock)}.</>}{silent(view)}</>;

            }

            const gap = summary.totals.net - before.totals.net;

            return <>{summary.totals.tickets ? <>Vendiste <b>{money(summary.totals.net)}</b> en {plural(summary.totals.tickets, 'cuenta', 'cuentas')}{before.totals.net ? <>, {money(Math.abs(gap))} {gap >= 0 ? 'más' : 'menos'} que el tramo anterior</> : ''}.</> : `Sin ventas cerradas del ${rangeLabel(view.span)}.`}{silent(view)}</>;

        }
        case 'products': {

            const { products } = data.products, units = sum(products, p => p.quantity), total = sum(products, p => p.revenue), top = products[0];

            return units ? <>Se vendieron <b>{plural(units, 'platillo', 'platillos')}</b>.{top && total ? <> <b>{top.name}</b> lleva el {bps(Math.round(top.revenue * 10_000 / total))} de la venta.</> : ''}</> : 'Sin productos vendidos en este periodo.';

        }
        case 'cash': {

            const { summary, cash } = data, collected = sum(summary.payments, p => p.amount), short = cash.closes.filter(c => c.cashDifference < 0);

            return <>Cobrado <b>{money(collected)}</b> en {plural(summary.payments.length, 'método', 'métodos')}.{short.length ? <> {plural(short.length, 'cierre salió', 'cierres salieron')} con faltante de efectivo.</> : cash.closes.length ? ' Los cierres de caja cuadran.' : ''}</>;

        }
        case 'staff': {

            const { labor, laborTargetBps } = data.team;

            return <><b>{plural(labor.now.people, 'persona', 'personas')}</b> en turno ahora.{labor.net && labor.minutes ? <> El costo laboral va en <b>{bps(labor.laborBps)}</b> de la venta, {labor.laborBps <= laborTargetBps ? 'abajo' : 'arriba'} de tu meta de {bps(laborTargetBps)}.</> : ''}</>;

        }
        case 'trend': {

            const { total, lastYearTotal } = data.trend;

            if (!lastYearTotal) return 'Todavía no hay ventas del año pasado para comparar.';

            const growth = Math.round((total - lastYearTotal) * 10_000 / lastYearTotal);

            return <>Llevas <b>{bps(Math.abs(growth))} {growth >= 0 ? 'más' : 'menos'}</b> que el mismo tramo del año pasado.</>;

        }
        case 'forecast': {

            const { days } = data.forecast, wet = days.find(d => d.weather?.wet);

            return days.length ? <>Los próximos {plural(days.length, 'día', 'días')} esperas <b>{money(sum(days, d => d.net))}</b>.{wet ? ` Se espera lluvia el ${new Date(wet.date + 'T12:00:00Z').toLocaleDateString('es-MX', { weekday: 'long', timeZone: 'UTC' })}.` : ''}</> : 'Sin historia suficiente para pronosticar.';

        }
        case 'profit': return <>Llevas <b>{money(data.profit.profit)} de ganancia estimada</b>, un margen de {bps(data.profit.marginBps)}.</>;
        case 'kitchen': {

            const { totals, stations } = data.kitchen, slow = [...stations].sort((a, b) => b.averageSeconds - a.averageSeconds)[0];

            return totals.dishes ? <>Un platillo tarda <b>{duration(totals.averageSeconds)}</b> en salir.{slow?.station ? <> La estación más lenta es <b>{slow.station}</b>.</> : ''}</> : 'Sin platillos marcados como listos en este periodo.';

        }
        case 'customers': {

            const { period: p, known } = data.customers;

            return <>Identificaste al <b>{bps(p.identifiedBps)} de las cuentas</b>.{known.active90 ? ` ${whole(known.repeat90)} de ${whole(known.active90)} clientes activos regresaron en 90 días.` : ''}</>;

        }
        case 'alerts': {

            const { alerts } = data.alerts, urgent = alerts.filter(a => a.level !== 'info').length;

            return alerts.length ? <><b>{whole(urgent)} por atender</b> y {whole(alerts.length - urgent)} para tu información.</> : 'Nada pide tu atención en este momento.';

        }
        case 'settings': return data.canEdit ? 'Cambian cómo se leen las cifras, no la sucursal.' : 'Cambian cómo se leen las cifras. Sólo el dueño puede cambiarlos.';
        case 'messages': return 'Escribe a tus sucursales o al soporte de Culinary. Las sucursales lo leen en el punto de venta.';
        default: return null;

    }
}
