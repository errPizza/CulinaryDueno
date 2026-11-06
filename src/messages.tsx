import { useEffect, useRef, useState } from 'react';
import { LifeBuoy, Megaphone, SendHorizontal, Store } from 'lucide-react';
import * as api from './api';
import type { View } from './app';
import { message, plural, seenAt } from './format';
import { Block } from './parts';

// The owner's thread with each branch, a message to all of them at once, and questions to Culinary's support.
// Messages to a branch reach its managers in the point of sale within a few minutes; they answer from there.

const STATUS: Record<api.SupportTicket['status'], string> = { open: 'Esperando respuesta', answered: 'Respondido', closed: 'Cerrado' };
const when = (at: string) => new Date(at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
type Open = { kind: 'branch' | 'ticket'; id: string };

export function MessagesView({ view, data, refresh }: { view: View; data: { inbox: api.Inbox }; refresh: () => void }) {

    const branches = view.me.branches;
    const [inbox, setInbox] = useState(data.inbox);
    // The thread that waits for the owner opens first; otherwise the first branch.
    const [open, setOpen] = useState<Open | null>(() => { const waiting = data.inbox.branches.find(b => b.unread > 0)?.licenseId ?? branches[0]?.licenseId; return waiting ? { kind: 'branch', id: waiting } : null; });
    const reload = async () => { try { setInbox(await api.inbox()); } catch { /* the next refresh brings it */ } refresh(); };

    useEffect(() => setInbox(data.inbox), [data.inbox]);

    const unread = inbox.branches.reduce((t, b) => t + b.unread, 0);
    const chosen = open?.kind === 'branch' ? branches.find(b => b.licenseId === open.id) : undefined;
    const ticket = open?.kind === 'ticket' ? inbox.support.find(t => t.id === open.id) : undefined;

    return <main className="report messages">

        <div className="row msgs">

            <section className="block threads-card" aria-label="Conversaciones">

                <div className="block-head"><h2>{branches.length > 1 ? 'Sucursales' : 'Tu sucursal'}</h2>{unread > 0 && <small>{plural(unread, 'sin leer', 'sin leer')}</small>}</div>
                {!branches.length ? <p className="quiet">Aún no hay sucursales en tu cuenta.</p> : <ol className="threads" aria-label="Conversaciones con sucursales">{branches.map(b => {

                    const line = inbox.branches.find(x => x.licenseId === b.licenseId);

                    return <li key={b.licenseId}><button aria-current={open?.kind === 'branch' && open.id === b.licenseId} onClick={() => setOpen({ kind: 'branch', id: b.licenseId })}>

                        <span className="thread-icon" aria-hidden="true"><Store size={16} /></span>
                        <span className="thread-text"><b>{b.name}</b><small>{line?.last ? `${line.last.author === 'owner' ? 'Tú: ' : `${line.last.name}: `}${line.last.body}` : 'Sin mensajes todavía'}</small></span>
                        <span className="thread-side">{line?.last && <time>{seenAt(line.last.createdAt)}</time>}{(line?.unread ?? 0) > 0 && <span className="count" aria-label={plural(line!.unread, 'mensaje sin leer', 'mensajes sin leer')}>{line!.unread}</span>}</span>

                    </button></li>;

                })}</ol>}
                <h2 className="threads-title">Soporte de Culinary</h2>
                {inbox.support.length ? <ol className="threads" aria-label="Tus solicitudes al soporte">{inbox.support.map(t => <li key={t.id}><button aria-current={open?.kind === 'ticket' && open.id === t.id} onClick={() => setOpen({ kind: 'ticket', id: t.id })}>

                    <span className="thread-icon" aria-hidden="true"><LifeBuoy size={16} /></span>
                    <span className="thread-text"><b>{t.subject}</b><small>{t.messages.at(-1)?.author === 'admin' ? `Soporte: ${t.messages.at(-1)!.body}` : `${branchName(branches, t.licenseId)} · ${seenAt(t.updatedAt)}`}</small></span>
                    <span className={`status ${t.status}`}>{STATUS[t.status]}</span>

                </button></li>)}</ol> : <p className="note first" style={{ margin: '0 10px' }}>Dudas de tu cuenta, licencia, facturación o de cómo usar Culinary.</p>}

            </section>
            {ticket ? <SupportThread ticket={ticket} branches={branches} changed={reload} />
                : chosen ? <BranchThread key={chosen.licenseId} branch={chosen} inbox={inbox} sent={reload} />
                : <Block title="Conversación"><p className="quiet">Elige una sucursal o una solicitud.</p></Block>}
            <div className="col">

                {branches.length > 1 && <Block title="Mensaje a todas" meta={plural(branches.length, 'sucursal', 'sucursales')}>

                    <Composer label="Mensaje a todas las sucursales" placeholder="Por ejemplo: el lunes hay junta de gerentes a las 9" action={`Enviar a las ${branches.length}`} Icon={Megaphone} send={async text => { const { sent } = await api.sendToBranches([], text); await reload(); return `Enviado a ${plural(sent, 'sucursal', 'sucursales')}.`; }} />
                    <p className="note">Cada sucursal lo ve marcado como «A todas las sucursales».</p>

                </Block>}
                <Block title="Escribir al soporte">

                    <NewTicket branches={branches} created={async id => { await reload(); setOpen({ kind: 'ticket', id }); }} />

                </Block>

            </div>

        </div>

    </main>;
}

const branchName = (branches: api.Branch[], licenseId: string) => branches.find(b => b.licenseId === licenseId)?.name ?? 'Sucursal';

function BranchThread({ branch, inbox, sent }: { branch: api.Branch; inbox: api.Inbox; sent: () => Promise<void> }) {

    const [messages, setMessages] = useState<api.Message[] | null>(null), [error, setError] = useState('');
    const end = useRef<HTMLDivElement>(null);
    const last = inbox.branches.find(x => x.licenseId === branch.licenseId)?.last?.id;
    const load = async () => { try { setMessages((await api.branchThread(branch.licenseId)).messages); setError(''); } catch (e) { setError(message(e)); } };

    // Opening reads the thread; a new message seen by the regular refresh reads it again.
    useEffect(() => { void load(); }, [branch.licenseId, last]);
    useEffect(() => { end.current?.scrollIntoView?.({ block: 'nearest' }); }, [messages?.length]);

    return <section className="block conversation" aria-label={`Conversación con ${branch.name}`}>

        <div className="conv-head"><span className="thread-icon" aria-hidden="true"><Store size={16} /></span><div><h2>{branch.name}</h2><small>{branch.stale ? `Sin señal ${seenAt(branch.lastSeenAt).toLowerCase()}: lo recibirá al volver a conectarse` : 'Lo leen los gerentes en el punto de venta'}</small></div></div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="bubbles" aria-live="polite">

            {messages === null && !error && <p className="quiet">Cargando la conversación…</p>}
            {messages?.length === 0 && <p className="quiet">Todavía no hay mensajes. Lo que escribas le llega a los gerentes de la sucursal en el punto de venta.</p>}
            {messages?.map(m => <div key={m.id} className={`bubble ${m.author === 'owner' ? 'mine' : 'theirs'}`}><p>{m.body}</p><small>{m.author === 'owner' ? `Tú (${m.name.split(' · ').pop()})` : m.name} · {when(m.createdAt)}{m.toAll ? ' · A todas las sucursales' : ''}</small></div>)}
            <div ref={end} />

        </div>
        <Composer label={`Mensaje a ${branch.name}`} placeholder={`Escribe a ${branch.name}…`} action="Enviar" Icon={SendHorizontal} send={async text => { await api.sendToBranches([branch.licenseId], text); await load(); await sent(); return ''; }} />

    </section>;
}

function SupportThread({ ticket, branches, changed }: { ticket: api.SupportTicket; branches: api.Branch[]; changed: () => Promise<void> }) {

    return <section className="block conversation" aria-label={`Solicitud: ${ticket.subject}`}>

        <div className="conv-head"><span className="thread-icon" aria-hidden="true"><LifeBuoy size={16} /></span><div><h2>{ticket.subject}</h2><small>{branchName(branches, ticket.licenseId)} · <span className={`status ${ticket.status}`}>{STATUS[ticket.status]}</span></small></div></div>
        <div className="bubbles" aria-live="polite">{ticket.messages.map(m => <div key={m.id} className={`bubble ${m.author === 'admin' ? 'theirs' : 'mine'}`}><p>{m.body}</p><small>{m.author === 'admin' ? 'Soporte de Culinary' : 'Tú'} · {when(m.createdAt)}</small></div>)}</div>
        {ticket.status === 'closed'
            ? <p className="quiet">El soporte cerró esta solicitud. Si necesitas algo más, abre una nueva.</p>
            : <Composer label="Responder al soporte" placeholder="Agrega lo que necesites" action="Responder" Icon={SendHorizontal} max={4000} send={async text => { await api.replySupport(ticket.id, text); await changed(); return ''; }} />}

    </section>;
}

function NewTicket({ branches, created }: { branches: api.Branch[]; created: (id: string) => Promise<void> }) {

    const [subject, setSubject] = useState(''), [body, setBody] = useState(''), [about, setAbout] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const submit = async () => {

        setBusy(true); setError('');

        try { const { ticket } = await api.askSupport(subject.trim(), body.trim(), about || undefined); setSubject(''); setBody(''); await created(ticket.id); } catch (e) { setError(message(e)); } finally { setBusy(false); }

    };

    return <form className="ticket-form" onSubmit={e => { e.preventDefault(); void submit(); }}>

        <label className="field">Asunto<input value={subject} maxLength={150} required placeholder="Por ejemplo: cambio de plan" onChange={e => setSubject(e.target.value)} /></label>
        {branches.length > 1 && <label className="field">Sucursal<select value={about} onChange={e => setAbout(e.target.value)}><option value="">Todo el negocio</option>{branches.map(b => <option key={b.licenseId} value={b.licenseId}>{b.name}</option>)}</select></label>}
        <label className="field">Mensaje<textarea value={body} maxLength={4000} rows={4} required onChange={e => setBody(e.target.value)} /><small>No escribas contraseñas ni códigos de tu autenticador.</small></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="ghost" disabled={busy || !subject.trim() || !body.trim()}><LifeBuoy size={16} aria-hidden="true" />{busy ? 'Enviando…' : 'Enviar al soporte'}</button>

    </form>;
}

/** A text box and its button. `send` answers with what to say once it went, or an empty text to say nothing. */
function Composer({ label, placeholder, action, Icon, send, max = 2000 }: { label: string; placeholder: string; action: string; Icon: typeof SendHorizontal; send: (text: string) => Promise<string>; max?: number }) {

    const [text, setText] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState('');
    const submit = async () => {

        if (!text.trim() || busy) return;

        setBusy(true); setError(''); setDone('');

        try { setDone(await send(text.trim())); setText(''); } catch (e) { setError(message(e)); } finally { setBusy(false); }

    };

    return <form className="composer" onSubmit={e => { e.preventDefault(); void submit(); }}>

        <label className="field"><span className="sr">{label}</span><textarea aria-label={label} value={text} rows={3} maxLength={max} placeholder={placeholder} onChange={e => { setText(e.target.value); setDone(''); }} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void submit(); } }} /></label>
        {error && <p className="error" role="alert">{error}</p>}
        {done && <p className="sent" role="status">{done}</p>}
        <button className="primary" disabled={busy || !text.trim()}><Icon size={16} aria-hidden="true" />{busy ? 'Enviando…' : action}</button>

    </form>;
}
