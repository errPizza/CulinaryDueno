import { expect, test, type Page } from '@playwright/test';

const seen = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const live = { at: seen(1), openAccounts: 4, occupiedTables: 3, openAmount: 124050, pendingRequests: 0, cashOpen: true, lowStock: [{ ingredientId: 'i1', name: 'Tortilla de maíz', unit: 'pz', available: 40, min: 100 }], tables: { total: 12, free: 8, occupied: 3, cleaning: 1, reserved: 0 }, partial: { count: 1, paid: 20000 }, onClock: { people: 5, hourlyCost: 30000 } };
const local = new Date(Date.now() - 4 * 3_600_000).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
const branch = (licenseId: string, name: string, minutes: number | null) => ({ licenseId, name, tier: 'pro', licenseStatus: 'active', lastSeenAt: minutes === null ? null : seen(minutes), stale: minutes === null || minutes > 15, timeZone: minutes === null ? null : 'America/Mexico_City', businessDate: minutes === null ? null : local, businessDayCutoffMinutes: minutes === null ? null : 240, lastZ: 12, appVersion: '0.3.3', live: minutes === null ? null : live });
const centro = branch('c', 'Centro', 1), norte = branch('n', 'Polanco Norte con nombre largo', 90), nueva = branch('z', 'Coyoacán', null);
const totals = (net: number, tickets: number) => ({ tickets, people: tickets * 2, gross: net, discounts: 0, net, tax: 0, deliveryFees: 0, voidedCount: 0, voidedAmount: 0, comps: 0, staffMeals: 0, averageTicket: tickets ? Math.trunc(net / tickets) : 0, averagePerson: tickets ? Math.trunc(net / (tickets * 2)) : 0 });
const back = (days: number) => new Date(Date.parse(local) - days * 86_400_000).toISOString().slice(0, 10);
const hours = [[13, 4, 182500], [14, 11, 512000], [15, 9, 421050], [19, 6, 267900], [1, 2, 66025]].map(([hour, tickets, net]) => ({ hour, tickets, net }));

let saved: any[] = [], posted: { path: string; body: any }[] = [];
const ticket = { id: 't1', licenseId: 'c', subject: 'Factura de octubre', status: 'answered', createdAt: seen(120), updatedAt: seen(30), messages: [{ id: 'm1', author: 'owner', body: '¿Cuándo llega?', createdAt: seen(120) }, { id: 'm2', author: 'admin', body: 'Hoy en la tarde.', createdAt: seen(30) }] };
const inbox = { branches: [{ licenseId: 'c', unread: 2, last: { id: 'b2', licenseId: 'c', author: 'branch', name: 'Ana López', body: 'Ya llegó el gas', toAll: false, createdAt: seen(5) } }, { licenseId: 'n', unread: 0, last: null }, { licenseId: 'z', unread: 0, last: null }], support: [ticket] };
const thread = [{ id: 'o1', licenseId: 'c', author: 'owner', name: 'Dueño · dueno@ejemplo.mx', body: 'Junta el lunes', toAll: true, createdAt: seen(60) }, { id: 'b2', licenseId: 'c', author: 'branch', name: 'Ana López', body: 'Ya llegó el gas', toAll: false, createdAt: seen(5) }];

/** On the phone the other sections hide under «Más»; on the desk each one has its own line in the sidebar. */
async function openMore(page: Page, name: string) {

    const toggle = page.locator('.sections > button[aria-haspopup="menu"]');

    if (await toggle.isVisible()) { await toggle.click(); await page.getByRole('menuitem', { name }).click(); }
    else await page.locator('.sections > .side-item').filter({ hasText: name }).click();
}

async function mock(page: Page, { branches = [centro, norte, nueva], signedIn = true }: { branches?: any[]; signedIn?: boolean } = {}) {

    const calls: string[] = [];

    saved = []; posted = [];

    await page.route('https://servidor.test/**', async route => {

        const url = new URL(route.request().url());
        const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });

        calls.push(url.pathname + url.search);

        const reply = (json: unknown, status = 200) => route.fulfill({ status, headers: cors, json });

        if (url.pathname === '/owner/v1/me') return reply({ account: { id: '1', email: 'dueno@ejemplo.mx', role: 'owner' }, branches });
        if (url.pathname === '/owner/v1/login') return route.request().postDataJSON().totp === '123456' ? reply({ token: 't', expiresAt: seen(-600) }) : reply({ error: { code: 'unauthorized', message: 'Correo, contraseña o código inválidos' } }, 401);
        if (url.pathname === '/owner/v1/logout') return reply({ ok: true });
        if (url.pathname === '/owner/v1/enroll') return reply({ email: 'nuevo@ejemplo.mx', totp: { secret: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://totp/x?secret=JBSWY3DPEHPK3PXP' } }, 201);
        if (url.pathname === '/owner/v1/enroll/confirm') return reply({ email: 'nuevo@ejemplo.mx' });

        if (url.pathname === '/owner/v1/messages') return reply(inbox);
        if (url.pathname.startsWith('/owner/v1/messages/branches/')) return reply({ messages: thread });
        if (route.request().method() === 'POST' && (url.pathname.startsWith('/owner/v1/messages') || url.pathname.startsWith('/owner/v1/support'))) {

            const body = route.request().postDataJSON();

            posted.push({ path: url.pathname, body });
            if (url.pathname === '/owner/v1/messages/branches') return reply({ sent: body.licenseIds.length || branches.length, at: seen(0) }, 201);
            if (url.pathname === '/owner/v1/support') return reply({ ticket: { ...ticket, id: 't2', subject: body.subject, status: 'open', messages: [{ id: 'm3', author: 'owner', body: body.message, createdAt: seen(0) }] } }, 201);

            return reply({ ticket }, 201);

        }

        const chosen = url.searchParams.get('branch');
        const from = url.searchParams.get('from')!, to = url.searchParams.get('to')!;
        // Like the server: Lite reads its month or its last seven days, and never enters a Pro figure.
        const inScope = branches.filter(b => !chosen || b.licenseId === chosen);
        const old = from < [back(6), local.slice(0, 8) + '01'].sort()[0]!;
        const marks = { lite: inScope.filter(b => b.tier === 'lite').map(b => b.licenseId), outOfRange: inScope.filter(b => b.tier === 'lite' && old).map(b => b.licenseId) };
        const rows = inScope.filter(b => !marks.outOfRange.includes(b.licenseId));
        const figures = (b: any) => b.licenseId === 'z' ? totals(0, 0) : b.licenseId === 'n' ? totals(321075, 9) : totals(1449475, 32);
        const net = rows.reduce((t, b) => t + figures(b).net, 0), tickets = rows.reduce((t, b) => t + figures(b).tickets, 0);

        if (url.pathname === '/owner/v1/settings') {

            if (route.request().method() === 'PUT') { saved.push(route.request().postDataJSON()); return reply({ settings: route.request().postDataJSON(), canEdit: true }); }

            return reply({ settings: { shifts: [{ name: 'Mañana', start: 7 }, { name: 'Comida', start: 12 }, { name: 'Noche', start: 18 }], goals: [{ licenseId: '', period: 'month', amount: 50_000_000 }], fixedCosts: [{ licenseId: 'c', name: 'Renta', monthly: 3_000_000 }], foodCostTargetBps: 3000, laborTargetBps: 3000, countClockLabor: true, locations: [] }, canEdit: true });

        }
        if (url.pathname === '/owner/v1/geocode') return reply({ places: [{ label: 'Monterrey, Nuevo León, México', lat: 25.67, lon: -100.31 }] });
        if (url.pathname === '/owner/v1/stats/alerts') return reply({ today: local, alerts: [
            { level: 'high', area: 'Inventario', title: 'Leche caduca hoy', detail: '$25.00 en existencia. Promociona Licuado.', licenseId: 'c', branchName: 'Centro' },
            { level: 'medium', area: 'Costos', title: 'Aguacate subió 25 %', detail: 'Afecta a Guacamole.', licenseId: 'c', branchName: 'Centro' },
            { level: 'info', area: 'Metas', title: 'Meta del mes atrasada', detail: 'Llevas $1,000.00 de $500,000.00.', licenseId: null, branchName: null }
        ] });
        if (url.pathname === '/owner/v1/stats/goals') return reply({ today: local, goals: [{ licenseId: '', branchName: null, period: 'month', from: local.slice(0, 8) + '01', to: local, target: 50_000_000, actual: 17_705_50, tickets: 41, progressBps: 354, expected: 5_000_000, projected: 5_000_000, pace: 'behind', outOfRange: [] }] });
        if (url.pathname === '/owner/v1/stats/trend') return reply({ from, to, ...marks, by: url.searchParams.get('by'), total: 900000, lastYearTotal: 750000, hasLastYear: true, periods: [
            { key: url.searchParams.get('by') === 'year' ? local.slice(0, 4) : local.slice(0, 7), from, to, tickets: 30, people: 60, net: 900000, days: 3, lastYearNet: 750000, lastYearTickets: 25, averageTicket: 30000, growthBps: 2000 }
        ] });
        if (url.pathname === '/owner/v1/stats/menu') return reply({ from, to, ...marks, foodCostTargetBps: 3000, kinds: [{ kind: 'food', quantity: 120, revenue: 360000 }, { kind: 'drink', quantity: 40, revenue: 100000 }], thresholds: { popularShareBps: 1750, averageMargin: 2850 }, uncosted: [{ name: 'Agua de horchata', category: 'Bebidas', revenue: 100000 }], totals: { revenue: 460000, costedRevenue: 360000, cost: 120000, foodCostBps: 3333 },
            items: [
                { name: 'Tacos al pastor', category: 'Tacos', quantity: 120, revenue: 360000, cost: 120000, unitMargin: 2000, shareBps: 6000, foodCostBps: 3333, price: 3000, suggestedPrice: 3400, class: 'plowhorse', advice: 'Se vende mucho y deja poco: sube el precio poco a poco o baja el costo de la receta.' },
                { name: 'Langosta', category: 'Mar', quantity: 5, revenue: 100000, cost: 30000, unitMargin: 14000, shareBps: 400, foodCostBps: 3000, price: 20000, suggestedPrice: null, class: 'puzzle', advice: 'Deja buen margen pero se pide poco: recomiéndalo, muévelo a un lugar visible o renómbralo.' }
            ],
            weekdays: [], slowDays: [{ weekday: 2, days: 4, average: 50000, belowBps: 3500 }], peakHours: [{ hour: 14, net: 512000, aboveBps: 9000 }],
            costAlerts: [{ licenseId: 'c', branchName: 'Centro', ingredientId: 'a', name: 'Aguacate', unit: 'g', before: 4_000_000, after: 5_000_000, changeBps: 2500, at: seen(60), products: [{ name: 'Guacamole', price: 9000, cost: 3500 }] }],
            expiring: [{ licenseId: 'c', branchName: 'Centro', ingredientId: 'l', name: 'Leche', unit: 'ml', quantity: 1000, cost: 2500, expiresOn: local, days: 0, products: ['Licuado'] }] });
        if (url.pathname === '/owner/v1/stats/team') return reply({ from, to, ...marks, laborTargetBps: 3000, averageWage: 6000,
            staff: [{ licenseId: 'c', branchName: 'Centro', staffId: 's1', name: 'Ana López', role: 'mesero', tickets: 20, net: 900000, tips: 50000, people: 44, tables: 12, voids: 9, voidAmount: 27000, discounts: 0, discountAmount: 0, rejected: 0, reopens: 0, drawerOpens: 0, minutes: 480, laborCost: 48000, averageTicket: 45000, salesPerHour: 112500 }],
            couriers: [{ licenseId: 'c', branchName: 'Centro', courierId: 'r1', name: 'Rafa', deliveries: 6, net: 200000 }],
            labor: { minutes: 480, cost: 48000, net: 900000, laborBps: 533, byHour: [{ hour: 1, net: 1000, minutes: 60, cost: 6000, laborBps: 60000 }], now: { people: 2, hourlyCost: 12000 } },
            tips: { total: 50000, minutes: 480, shares: [{ licenseId: 'c', staffId: 's1', name: 'Ana López', branchName: 'Centro', minutes: 480, share: 50000 }] },
            anomalies: [{ licenseId: 'c', branchName: 'Centro', staffId: 's1', name: 'Ana López', metric: 'voids', label: 'cancelaciones', value: 9, usual: 1, amount: 27000 }],
            schedule: [{ weekday: 1, hour: 14, expectedNet: 300000, currentPeople: 3, suggestedPeople: 2 }],
            roster: { active: 12, months: [], hires: 4, exits: 3, turnoverBps: 2500 } });
        if (url.pathname === '/owner/v1/stats/profit') return reply({ from, to, ...marks, net: 1160000, tax: 160000, sales: 1000000, cogs: 300000, revenueWithoutCost: 100000, waste: 5000, expenses: [{ account: 'Limpieza', amount: 20000, count: 2 }], expensesTotal: 20000, labor: { minutes: 1200, cost: 120000, counted: true }, fixed: [{ licenseId: 'c', name: 'Renta', monthly: 3_000_000, amount: 100000 }], fixedTotal: 100000, profit: 455000, marginBps: 4550, foodCostBps: 3000, laborBps: 1200 });
        if (url.pathname === '/owner/v1/stats/kitchen') return reply({ from, to, ...marks, totals: { dishes: 160, averageSeconds: 540, returns: 2, returnBps: 125 },
            dishes: [{ name: 'Tacos al pastor', station: 'Plancha', count: 120, averageSeconds: 600, averagePrep: 480, averageWait: 120, averagePass: 90, maxSeconds: 1500 }],
            stations: [{ station: 'Plancha', count: 120, averageSeconds: 600, maxSeconds: 1500 }, { station: 'Barra', count: 40, averageSeconds: 180, maxSeconds: 300 }],
            returns: [{ name: 'Tacos al pastor', count: 2, sold: 120, rateBps: 167, reasons: [{ reason: 'cold', label: 'Llegó frío', count: 2 }] }], reasons: [{ reason: 'cold', label: 'Llegó frío', count: 2 }],
            promises: [{ mode: 'delivery', count: 10, late: 2, onTimeBps: 8000, averagePromised: 2700, averageActual: 2900 }] });
        if (url.pathname === '/owner/v1/stats/customers') return reply({ from, to, ...marks,
            period: { tickets: 41, net: 1770550, identifiedTickets: 10, identifiedNet: 400000, first: 3, repeat: 7, identifiedBps: 2439, averageIdentified: 40000 },
            known: { identified: 320, active90: 120, repeat90: 45, averageGapDays: 18, lifetimeAverage: 185000, visitsAverageTenths: 42, vip: 32, vipLapsed: 5, lapsedDays: 21 },
            reviews: { count: 12, foodTenths: 44, serviceTenths: 38, overallTenths: 41, low: 1 },
            best: [{ name: 'Tacos al pastor', count: 8, averageTenths: 46 }], worst: [{ name: 'Sopa del día', count: 3, averageTenths: 28 }] });
        if (url.pathname === '/owner/v1/stats/forecast') return reply({ ...marks, today: local, trend: 1.02, errorBps: 850, historyDays: 56, weather: null,
            days: Array.from({ length: 7 }, (_, i) => ({ date: back(-1 - i), weekday: 1, weeks: 8, base: 1000000, net: 1020000, tickets: 34, low: 930000, high: 1110000, trend: 1.02, holiday: i === 2 ? { name: 'Revolución Mexicana', factor: 1.05, learned: false } : null, weather: null, factor: 1.02 })),
            products: [{ name: 'Tacos al pastor', days: Array.from({ length: 7 }, (_, i) => ({ date: back(-1 - i), units: 41 })) }] });
        if (url.pathname === '/owner/v1/stats/products') return reply({ from, to, ...marks, products: [
            { name: 'Tacos al pastor', category: 'Tacos', quantity: 120, revenue: 360000, cost: 120000, revenueWithoutCost: 0, estimatedMargin: 240000 },
            { name: 'Agua de horchata de temporada con nombre muy largo', category: 'Bebidas', quantity: 40, revenue: 100000, cost: 0, revenueWithoutCost: 100000, estimatedMargin: 0 }
        ] });
        if (url.pathname === '/owner/v1/stats/cash') return reply({ from, to, ...marks, cash: { income: 50000, expense: 12000, withdrawal: 200000 }, inventory: { waste: 3500, shortage: 1200, surplus: 0 }, closes: [
            { licenseId: 'c', businessDate: local, cashId: 'k1', closedAt: seen(30), blind: true, cashDifference: -5000, cardDifference: 0, transferDifference: 1000, adjustments: 0 }
        ] });
        if (url.pathname === '/owner/v1/stats/closings') return reply({ from, to, ...marks, closings: [
            { licenseId: 'c', branchName: 'Centro', businessDate: local, number: 12, from: seen(600), to: seen(30), tickets: 33, net: 1500000, panelTickets: 32, panelNet: 1449475, reopenedTickets: 1, reopenedNet: 50525 }
        ] });
        if (url.pathname === '/owner/v1/stats/staff') return reply({ from, to, ...marks, staff: [
            { licenseId: 'c', branchName: 'Centro', staffId: 's1', name: 'Ana López', tickets: 20, net: 900000, tips: 50000 },
            { licenseId: 'n', branchName: 'Polanco Norte con nombre largo', staffId: 's2', name: 'Beto', tickets: 0, net: 0, tips: 2000 }
        ] });

        return reply({ from, to, ...marks, totals: totals(net, tickets), partial: rows.filter(b => b.stale).map(b => b.licenseId), branches: rows.map(b => ({ ...b, ...figures(b), hasData: b.licenseId !== 'z', openDays: 0 })).sort((a, b) => Number(b.hasData) - Number(a.hasData) || b.net - a.net), days: tickets && from !== to ? [{ businessDate: to, tickets, net }] : [], hours: tickets ? hours : [], channels: tickets ? [{ channel: 'table', tickets: tickets - 5, net: net - 200000 }, { channel: 'delivery', tickets: 5, net: 200000 }] : [], payments: [{ method: 'card', amount: 1000000, tips: 50000, count: 20 }, { method: 'cash', amount: 770550, tips: 0, count: 21 }], refunds: [], shifts: tickets ? [{ name: 'Mañana', start: 7, end: 12, tickets: 0, people: 0, net: 0, averageTicket: 0 }, { name: 'Comida', start: 12, end: 18, tickets: tickets - 8, people: 0, net: net - 333925, averageTicket: 0 }, { name: 'Noche', start: 18, end: 7, tickets: 8, people: 0, net: 333925, averageTicket: 0 }] : [], areas: tickets ? [{ area: 'Terraza', tickets: 10, people: 20, net: 400000 }, { area: '', tickets: tickets - 10, people: 0, net: net - 400000 }] : [] });

    });

    if (signedIn) await page.addInitScript(expires => localStorage.setItem('culinary-dueno-session', JSON.stringify({ token: 't', expiresAt: expires })), seen(-600));

    return calls;
}

test('consolidado con todas las sucursales, y aviso de la que va atrasada', async ({ page }) => {

    await mock(page);
    await page.goto('/');
    await expect(page.locator('.figure')).toHaveText('$17,705.50');
    await expect(page.getByText('Cuentas', { exact: true }).first()).toBeVisible();
    await expect(page.locator('.behind')).toHaveCount(2);
    await expect(page.locator('.behind').first()).toContainText('Polanco Norte con nombre largo');
    await expect(page.locator('.branches .ranking li').first()).toContainText('$14,494.75');
    await expect(page.locator('.branches .ranking li').nth(2)).toContainText('Nunca se ha conectado');
    await expect(page.locator('.branches .ranking li').nth(1)).not.toContainText('abierta');
    await expect(page.locator('.versus')).toContainText('Lo mismo que ayer');

});

test('una sucursal se elige en el selector o en la lista, y se vuelve a todas', async ({ page }) => {

    const calls = await mock(page);

    await page.goto('/');
    await page.locator('.ranking button').first().click();
    await expect(page.locator('.figure')).toHaveText('$14,494.75');
    await expect(page.locator('.picker select')).toHaveValue('c');
    expect(calls.filter(c => c.startsWith('/owner/v1/stats/')).at(-1)).toContain('branch=c');
    await page.getByRole('button', { name: 'Ver todas las sucursales' }).click();
    await expect(page.locator('.figure')).toHaveText('$17,705.50');

});

test('el periodo pide las fechas de negocio de la sucursal, no las del teléfono', async ({ page }) => {

    const calls = await mock(page);

    await page.goto('/');
    await page.getByRole('button', { name: '7 días' }).click();
    await expect(page.locator('h1')).toHaveText('Ventas de los últimos 7 días');
    await expect.poll(() => calls.some(c => c.startsWith(`/owner/v1/stats/summary?from=${back(6)}&to=${local}`))).toBe(true);
    await expect(page.getByText('Ahora mismo')).toHaveCount(0);

});

test('cada periodo se compara con su tramo anterior y los de varios días van por día', async ({ page }) => {

    const calls = await mock(page);

    await page.goto('/');
    await page.getByRole('button', { name: '7 días' }).click();
    await expect(page.locator('.versus')).toContainText('que los 7 días anteriores');
    await expect.poll(() => calls).toContain(`/owner/v1/stats/summary?from=${back(13)}&to=${back(7)}`);
    await expect(page.getByRole('heading', { name: 'Por día' })).toBeVisible();
    await expect(page.locator('.hours-plot').first().locator('button')).toHaveCount(7);
    await expect(page.getByRole('heading', { name: 'Horas pico' })).toBeVisible();
    await page.getByRole('button', { name: 'Ayer' }).click();
    await expect(page.locator('.versus')).toContainText('el mismo día de la semana pasada');
    await expect.poll(() => calls).toContain(`/owner/v1/stats/summary?from=${back(8)}&to=${back(8)}`);
    await expect(page.getByRole('heading', { name: 'Por canal' })).toBeVisible();
    await expect(page.getByText('Domicilio')).toBeVisible();

});

test('el rango libre pide dos fechas válidas y explica el error', async ({ page }) => {

    const calls = await mock(page);

    await page.goto('/');
    await page.getByRole('button', { name: 'Fechas' }).click();
    await expect.poll(() => calls).toContain(`/owner/v1/stats/summary?from=${back(29)}&to=${local}`);
    await page.getByLabel('Desde').fill(local);
    await page.getByLabel('Hasta').fill(back(3));
    await expect(page.getByRole('alert')).toContainText('antes que la final');
    await page.getByLabel('Desde').fill(back(10));
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect.poll(() => calls.some(c => c.startsWith(`/owner/v1/stats/summary?from=${back(10)}&to=${back(3)}`))).toBe(true);
    await expect(page.locator('h1')).toContainText('Ventas del');

});

test('productos: margen sólo con receta, menos vendidos e inventario bajo', async ({ page }) => {

    const calls = await mock(page);

    await page.goto('/');
    await page.getByRole('button', { name: 'Productos' }).click();
    await expect(page.locator('.figure')).toHaveText('$4,600.00');
    await expect.poll(() => calls.some(c => c.startsWith('/owner/v1/stats/products?'))).toBe(true);
    await expect(page.locator('.facts').first()).toContainText('$2,400.00');
    await expect(page.locator('.facts').first()).toContainText('66.7 %');
    await expect(page.getByText(/No incluye 1 producto sin receta, que suman \$1,000.00/)).toBeVisible();
    await expect(page.getByText('Tortilla de maíz')).toBeVisible();
    await expect(page.getByText(/quedan 40 pz, mínimo 100/)).toContainText('Centro');
    await page.getByText('Ver los 2 productos').click();
    await expect(page.locator('.all tbody tr')).toHaveCount(2);

});

test('caja: cobros por método, arqueo con faltante y corte Z con reapertura', async ({ page }) => {

    await mock(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Caja' }).click();
    await expect(page.locator('.figure')).toHaveText('$17,705.50');
    await expect(page.getByText('Tarjeta', { exact: true }).first()).toBeVisible();
    await expect(page.locator('.closes')).toContainText('Faltan $50.00');
    await expect(page.locator('.closes')).toContainText('Sobran $10.00');
    await expect(page.locator('.closes')).toContainText('Arqueo ciego');
    await expect(page.getByText(/1 cuenta se reabrió después de este corte/)).toContainText('$14,494.75');

});

test('personal: ventas y propinas por mesero, con su sucursal en el consolidado', async ({ page }) => {

    await mock(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Personal' }).click();
    await expect(page.locator('.figure')).toHaveText('$9,000.00');
    await expect(page.locator('.ranking').first()).toContainText('Centro · 20 cuentas · ticket $450.00');
    await expect(page.locator('.ranking').first()).toContainText('sólo propinas');
    await page.locator('.picker select').selectOption('c');
    await expect(page.locator('.ranking').first()).not.toContainText('Centro ·');

});

const lite = (b: any) => ({ ...b, tier: 'lite' });

test('con planes mixtos, cada cifra Pro dice qué sucursal Lite no incluye', async ({ page }) => {

    await mock(page, { branches: [centro, lite(norte), nueva] });
    await page.goto('/');
    await page.getByRole('button', { name: 'Este mes' }).click();
    await expect(page.locator('.versus')).toContainText('sin Polanco Norte con nombre largo');
    await expect(page.locator('.versus')).toContainText('$14,494.75 contra $14,494.75');
    await expect(page.getByText('Sólo sucursales Pro: no incluye Polanco Norte con nombre largo').first()).toBeVisible();
    await page.getByRole('button', { name: 'Caja' }).click();
    await expect(page.locator('.facts').first()).toContainText('$14,494.75');
    await expect(page.getByText(/Sólo sucursales Pro/)).toBeVisible();

});

test('sólo con sucursales Lite, las áreas Pro lo dicen en vez de mostrar ceros', async ({ page }) => {

    await mock(page, { branches: [lite(centro)] });
    await page.goto('/');
    await expect(page.locator('.figure')).toHaveText('$14,494.75');
    await expect(page.getByRole('button', { name: /Fechas/ })).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('heading', { name: 'Descuentos y cancelaciones' })).toHaveCount(0);
    await page.getByRole('button', { name: '7 días' }).click();
    await expect(page.getByText('Las horas pico de varios días son del plan Pro.')).toBeVisible();
    await page.getByRole('button', { name: 'Productos' }).click();
    await expect(page.getByText('Tacos al pastor').first()).toBeVisible();
    await expect(page.getByText('Margen estimado')).toHaveCount(0);
    await expect(page.getByText('El costo y el margen son del plan Pro.')).toBeVisible();
    await page.getByRole('button', { name: 'Caja' }).click();
    await expect(page.getByRole('heading', { name: 'Caja es del plan Pro' })).toBeVisible();
    await page.getByRole('button', { name: 'Personal' }).click();
    await expect(page.getByRole('heading', { name: 'Personal es del plan Pro' })).toBeVisible();

});

test('las horas siguen el orden del servicio y cada barra dice su cifra', async ({ page }) => {

    await mock(page);
    await page.goto('/');
    // The skeleton comes first; the chart replaces it once the summary arrives.
    await expect(page.locator('.loading')).toHaveCount(0);
    await page.locator('.hours-plot button').first().waitFor();
    const labels = await page.locator('.hours-plot button').evaluateAll(all => all.map(b => b.getAttribute('aria-label')!.slice(0, 5)));
    expect(labels.indexOf('01:00')).toBeGreaterThan(labels.indexOf('19:00'));
    await page.getByRole('button', { name: /^14:00/ }).hover();
    await expect(page.locator('figcaption')).toContainText('$5,120.00');
    await page.getByText('Ver como tabla').click();
    await expect(page.locator('.hours tbody tr')).toHaveCount(5);

});

test('con una sola sucursal no estorban ni el selector ni el ranking', async ({ page }) => {

    await mock(page, { branches: [centro] });
    await page.goto('/');
    await expect(page.locator('.figure')).toHaveText('$14,494.75');
    await expect(page.locator('.picker')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /^Sucursal/ })).toHaveCount(0);

});

test('sin sucursales ni ventas lo dice, y una caída de red conserva lo último', async ({ page }) => {

    await mock(page, { branches: [] });
    await page.goto('/');
    await expect(page.getByText('Aún no hay sucursales en tu cuenta')).toBeVisible();

});

test('sin internet avisa y conserva la última cifra', async ({ page }) => {

    await mock(page);
    await page.goto('/');
    await expect(page.locator('.figure')).toHaveText('$17,705.50');
    await page.route('https://servidor.test/**', route => route.abort());
    await page.getByRole('button', { name: 'Actualizar' }).click();
    await expect(page.getByRole('alert')).toContainText('Lo que ves es de la última actualización');
    await expect(page.locator('.figure')).toHaveText('$17,705.50');

});

test('entra con código, recuerda la sesión, y cerrar sesión vuelve al acceso', async ({ page }) => {

    await mock(page, { signedIn: false });
    await page.goto('/');
    await page.getByLabel('Correo').fill('dueno@ejemplo.mx');
    await page.getByLabel('Contraseña').fill('una contraseña larga');
    await page.getByLabel('Código del autenticador').fill('000000');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('alert')).toContainText('inválidos');
    await page.getByLabel('Código del autenticador').fill('123456');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.locator('.figure')).toBeVisible();
    await page.reload();
    await expect(page.locator('.figure')).toBeVisible();
    await page.getByRole('button', { name: /Cerrar sesión/ }).click();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();

});

test('el alta pide código y contraseña, muestra la clave y la confirma', async ({ page }) => {

    await mock(page, { signedIn: false });
    await page.goto('/');
    await page.getByRole('button', { name: 'Tengo un código de alta' }).click();
    await page.getByLabel('Código de alta').fill('ABCDE-FGHIJ-KLMNO-PQRST');
    await page.getByLabel('Contraseña nueva').fill('una contraseña larga');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('JBSWY3DPEHPK3PXP')).toBeVisible();
    await expect(page.getByAltText('Código QR de la clave')).toBeVisible();
    await page.getByLabel('Código de 6 dígitos').fill('123456');
    await page.getByRole('button', { name: 'Confirmar cuenta' }).click();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();

});

for (const [name, width, height] of [['telefono', 360, 760], ['escritorio', 1280, 800]] as const) for (const colorScheme of ['light', 'dark'] as const) test(`sin desbordes a ${width} px en tema ${colorScheme}`, async ({ page }) => {

    await page.setViewportSize({ width, height });
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mock(page);
    await page.goto('/');

    for (const section of ['Resumen', 'Productos', 'Caja', 'Personal', 'Tendencia', 'Pronóstico', 'Rentabilidad', 'Cocina', 'Clientes', 'Alertas', 'Ajustes']) {

        if (['Resumen', 'Productos', 'Caja', 'Personal'].includes(section)) await page.locator('.sections > button').filter({ hasText: section }).click();
        else await openMore(page, section);
        await expect(page.locator('main h1')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), section).toBe(true);
        for (const target of await page.locator('main button, .controls button, .controls select, .top button').all()) { const box = await target.boundingBox(); if (box && !(await target.evaluate(e => e.closest('.hours-plot')))) expect(box.height, await target.innerText()).toBeGreaterThanOrEqual(40); }
        await page.screenshot({ path: `test-results/${name}-${colorScheme}-${section.toLowerCase()}.png`, fullPage: true });

    }

});

test('sin dirección fija, la pide una vez y la conserva', async ({ page }) => {

    await mock(page, { signedIn: false });
    await page.goto('http://127.0.0.1:5191/');
    await page.getByLabel('Dirección del servidor').fill('https://servidor.test/ruta');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('alert')).toContainText('sin ruta');
    await page.getByLabel('Dirección del servidor').fill('https://servidor.test');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByLabel('Correo').fill('dueno@ejemplo.mx');
    await page.getByLabel('Contraseña').fill('una contraseña larga');
    await page.getByLabel('Código del autenticador').fill('123456');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.locator('.figure')).toBeVisible();
    await page.reload();
    await expect(page.locator('.figure')).toBeVisible();

});

test('el aviso de privacidad se lee antes de entrar y desde el panel', async ({ page }) => {

    await mock(page, { signedIn: false });
    await page.goto('/');
    await page.getByRole('button', { name: 'Aviso de privacidad' }).click();
    await expect(page.getByRole('heading', { name: 'Aviso de privacidad' })).toBeVisible();
    await expect(page.getByText(/nombre visible de cada persona/)).toBeVisible();
    await page.getByRole('button', { name: 'Volver' }).click();
    await page.getByLabel('Correo').fill('dueno@ejemplo.mx');
    await page.getByLabel('Contraseña').fill('una contraseña larga');
    await page.getByLabel('Código del autenticador').fill('123456');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.getByRole('button', { name: 'Aviso de privacidad' }).click();
    await expect(page.getByRole('heading', { name: 'Tus derechos' })).toBeVisible();
    await page.getByRole('button', { name: 'Volver' }).click();
    await expect(page.locator('.figure')).toBeVisible();

});

test('resumen: metas, turnos, áreas y lo que pasa ahora en el piso', async ({ page }) => {

    await mock(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Metas' })).toBeVisible();
    await expect(page.getByText(/Vas atrasado: a este ritmo cerrarías en \$50,000\.00/)).toBeVisible();
    await expect(page.getByRole('list', { name: 'Ventas por turno' })).toContainText('Comida · 12:00 a 18:00');
    await expect(page.getByRole('list', { name: 'Ventas por área' })).toContainText('Terraza');
    await expect(page.locator('.block.now')).toContainText('Mesas libres');
    await expect(page.locator('.block.now')).toContainText('En turno');

});

test('productos: ingeniería de menú, precio sugerido, mix, costos que suben y lotes por caducar', async ({ page }) => {

    await mock(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Productos' }).click();
    await expect(page.getByRole('heading', { name: /Caballos de batalla/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Enigmas/ })).toBeVisible();
    await expect(page.getByText('Tacos al pastor: de $30.00 a $34.00')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Ventas por tipo' })).toContainText('Bebidas sin alcohol');
    await expect(page.getByText('Los martes venden 35 % menos que el promedio')).toBeVisible();
    await expect(page.getByText('Centro · Aguacate subió 25 %')).toBeVisible();
    await expect(page.getByText('Centro · Leche: caduca hoy')).toBeVisible();

});

test('personal: eficiencia, costo laboral, propinas por horas, horario sugerido y patrones para el dueño', async ({ page }) => {

    await mock(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Personal' }).click();
    await expect(page.getByRole('list', { name: 'Eficiencia por persona' })).toContainText('$1,125.00 por hora');
    await expect(page.getByText('Horas sobre tu meta de 30 %: 01:00 (600 %)')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Reparto de propinas' })).toContainText('8 h 00 min');
    await expect(page.getByRole('list', { name: 'Ventas por repartidor' })).toContainText('Rafa');
    await expect(page.getByText('Ana López: 9 cancelaciones')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Personal sugerido para la próxima semana' })).toBeVisible();

});

test('«Más» abre tendencia, pronóstico, rentabilidad, cocina, clientes y alertas', async ({ page }) => {

    const calls = await mock(page);
    await page.goto('/');
    const more = (name: string) => openMore(page, name);

    await more('Tendencia');
    await expect(page.locator('.figure')).toHaveText('$9,000.00');
    await expect(page.getByText('20 % más que el mismo tramo del año pasado')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Periodo' })).toBeHidden();
    await page.getByRole('button', { name: 'Años' }).click();
    await expect.poll(() => calls.some(c => c.includes('/stats/trend') && c.includes('by=year'))).toBe(true);

    await more('Pronóstico');
    await expect(page.locator('.figure')).toHaveText('$10,200.00');
    await expect(page.getByText('Revolución Mexicana').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Qué preparar' })).toBeVisible();

    await more('Rentabilidad');
    await expect(page.locator('.figure')).toHaveText('$4,550.00');
    await expect(page.locator('.statement')).toContainText('Fijo · Renta');
    await expect(page.getByText(/\$1,000\.00 vendidos sin receta/)).toBeVisible();

    await more('Cocina');
    await expect(page.locator('.figure')).toHaveText('9 min');
    await expect(page.getByText('Tacos al pastor', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('A domicilio: 80 % a tiempo')).toBeVisible();

    await more('Clientes');
    await expect(page.locator('.figure')).toHaveText('320');
    await expect(page.getByText('4.1 de 5').first()).toBeVisible();

    await more('Alertas');
    await expect(page.locator('.alert.high')).toContainText('Leche caduca hoy');
    await expect(page.locator('.bell .count')).toHaveText('2');

});

test('ajustes: el dueño cambia turnos, metas y gastos fijos y busca la ciudad', async ({ page }) => {

    await mock(page);
    await page.goto('/');
    await openMore(page, 'Ajustes');
    await page.getByRole('button', { name: 'Agregar turno' }).click();
    await page.getByLabel('Meta en pesos').fill('600000');
    await page.getByLabel('Ciudad').first().fill('Monterrey');
    await page.getByRole('button', { name: 'Buscar' }).first().click();
    await page.getByRole('button', { name: 'Monterrey, Nuevo León, México' }).click();
    await page.getByRole('button', { name: 'Guardar ajustes' }).click();
    await expect(page.getByRole('status')).toContainText('Ajustes guardados');
    expect(saved.at(-1).shifts).toHaveLength(4);
    expect(saved.at(-1).goals[0].amount).toBe(60_000_000);
    expect(saved.at(-1).locations[0]).toMatchObject({ licenseId: 'c', label: 'Monterrey, Nuevo León, México' });

});

test('sólo con sucursales Lite, las áreas nuevas también lo dicen', async ({ page }) => {

    await mock(page, { branches: [{ ...centro, tier: 'lite' }] });
    await page.goto('/');
    await openMore(page, 'Cocina');
    await expect(page.getByRole('heading', { name: 'Cocina es del plan Pro' })).toBeVisible();

});

test('mientras carga hay esqueletos, y sin ventas las gráficas se ven vacías', async ({ page }) => {

    await mock(page, { branches: [centro] });
    let release = () => {};
    const held = new Promise<void>(go => { release = go; });
    const zero = { tickets: 0, people: 0, gross: 0, discounts: 0, net: 0, tax: 0, deliveryFees: 0, voidedCount: 0, voidedAmount: 0, comps: 0, staffMeals: 0, averageTicket: 0, averagePerson: 0 };
    await page.route('https://servidor.test/owner/v1/stats/summary**', async route => {

        if (route.request().method() === 'OPTIONS') return route.fallback();
        await held;
        const url = new URL(route.request().url());
        await route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { from: url.searchParams.get('from'), to: url.searchParams.get('to'), lite: [], outOfRange: [], totals: zero, partial: [], branches: [{ ...centro, ...zero, hasData: false, openDays: 0 }], days: [], hours: [], channels: [], payments: [], refunds: [], areas: [], shifts: [] } });

    });
    await page.goto('/');
    await expect(page.locator('.loading .sk-hero')).toBeVisible();
    await expect(page.getByText('Cargando')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/cargando.png', fullPage: true });
    release();
    await expect(page.locator('.figure')).toHaveText('$0.00');
    await expect(page.locator('.hours-plot button').first()).toBeVisible();
    await expect(page.locator('.hours figcaption')).toContainText('Sin ventas cerradas');
    await expect(page.getByRole('heading', { name: 'Por canal' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Por turno' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Descuentos y cancelaciones' })).toBeVisible();
    await page.screenshot({ path: 'test-results/sin-ventas.png', fullPage: true });

});

test('sólo con Lite, las áreas Pro salen bloqueadas al instante, sin cargar ni pedir sus cifras', async ({ page }) => {

    const calls = await mock(page, { branches: [lite(centro)] });

    await page.goto('/');
    await expect(page.locator('.figure')).toHaveText('$14,494.75');
    await expect(page.getByRole('button', { name: 'Caja' })).toContainClass('is-locked');
    await expect(page.getByRole('button', { name: 'Productos' })).not.toContainClass('is-locked');
    await page.route('https://servidor.test/owner/v1/stats/cash**', route => new Promise(() => { void route; }));
    await page.getByRole('button', { name: 'Caja' }).click();
    await expect(page.getByRole('heading', { name: 'Caja es del plan Pro' })).toBeVisible();
    await expect(page.locator('.loading')).toHaveCount(0);
    await expect(page.locator('.periods')).toHaveCount(0);
    await openMore(page, 'Tendencia');
    await expect(page.getByRole('heading', { name: 'Tendencia es del plan Pro' })).toBeVisible();
    expect(calls.some(c => /stats\/(cash|staff|closings|trend)/.test(c))).toBe(false);
    await openMore(page, 'Mensajes');
    await expect(page.getByRole('heading', { name: 'Mensajes', exact: true })).toBeVisible();

});

test('con planes mixtos nada se bloquea, salvo al elegir la sucursal Lite', async ({ page }) => {

    await mock(page, { branches: [centro, lite(norte)] });
    await page.goto('/');
    await expect(page.locator('.figure')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Caja' })).not.toContainClass('is-locked');
    await page.locator('.picker select').selectOption('n');
    await expect(page.getByRole('button', { name: 'Caja' })).toContainClass('is-locked');
    await page.getByRole('button', { name: 'Caja' }).click();
    await expect(page.getByRole('heading', { name: 'Caja es del plan Pro' })).toBeVisible();

});

test('mensajes: lista de sucursales con no leídos, conversación y respuesta', async ({ page }) => {

    await mock(page);
    await page.goto('/');
    await expect(page.locator('.figure')).toBeVisible();
    await openMore(page, 'Mensajes');
    const list = page.getByRole('list', { name: 'Conversaciones con sucursales' });
    await expect(list.locator('li')).toHaveCount(3);
    await expect(list.locator('li').first()).toContainText('Ya llegó el gas');
    await expect(list.getByLabel('2 mensajes sin leer')).toBeVisible();
    await list.getByRole('button', { name: /Centro/ }).click();
    await expect(page.getByRole('heading', { name: 'Centro' })).toBeVisible();
    await expect(page.locator('.bubble.mine')).toContainText('Junta el lunes');
    await expect(page.locator('.bubble.mine small')).toContainText('A todas las sucursales');
    await expect(page.locator('.bubble.theirs small')).toContainText('Ana López');
    await page.getByLabel('Mensaje a Centro').fill('Gracias, Ana');
    await page.getByRole('button', { name: 'Enviar', exact: true }).click();
    await expect.poll(() => posted).toContainEqual({ path: '/owner/v1/messages/branches', body: { licenseIds: ['c'], message: 'Gracias, Ana' } });
    await expect(page.getByLabel('Mensaje a Centro')).toHaveValue('');
    await page.getByRole('button', { name: 'Todas las conversaciones' }).click();
    await page.screenshot({ path: 'test-results/mensajes.png', fullPage: true });

});

test('mensajes: uno a todas las sucursales a la vez', async ({ page }) => {

    await mock(page);
    await page.goto('/');
    await openMore(page, 'Mensajes');
    await page.getByLabel('Mensaje a todas las sucursales').fill('El lunes hay junta');
    await page.getByRole('button', { name: 'Enviar a las 3' }).click();
    await expect(page.getByRole('status')).toHaveText('Enviado a 3 sucursales.');
    expect(posted).toContainEqual({ path: '/owner/v1/messages/branches', body: { licenseIds: [], message: 'El lunes hay junta' } });

});

test('mensajes: escribir al soporte de Culinary y ver su respuesta', async ({ page }) => {

    await mock(page);
    await page.goto('/');
    await openMore(page, 'Mensajes');
    await page.getByRole('button', { name: /Factura de octubre/ }).click();
    await expect(page.locator('.bubble.theirs')).toContainText('Hoy en la tarde.');
    await expect(page.locator('.bubble.theirs small')).toContainText('Soporte de Culinary');
    await page.getByLabel('Responder al soporte').fill('Gracias');
    await page.getByRole('button', { name: 'Responder' }).click();
    await expect.poll(() => posted).toContainEqual({ path: '/owner/v1/support/t1/messages', body: { message: 'Gracias' } });
    await page.getByRole('button', { name: 'Todas las solicitudes' }).click();
    await page.getByRole('button', { name: 'Escribir al soporte' }).click();
    await page.getByLabel('Asunto').fill('Cambio de plan');
    await page.locator('.ticket-form select').selectOption('n');
    await page.locator('.ticket-form textarea').fill('Quiero pasar Norte a Pro');
    await page.getByRole('button', { name: 'Enviar al soporte' }).click();
    await expect.poll(() => posted).toContainEqual({ path: '/owner/v1/support', body: { subject: 'Cambio de plan', message: 'Quiero pasar Norte a Pro', licenseId: 'n' } });

});
