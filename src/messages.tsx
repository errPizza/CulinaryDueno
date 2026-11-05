import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, LifeBuoy, Megaphone, SendHorizontal, Store } from 'lucide-react';
import * as api from './api';
import type { View } from './app';
import { message, plural, seenAt } from './format';
import { Block } from './parts';

// The owner's thread with each branch, a message to all of them at once, and questions to Culinary's support.
// Messages to a branch reach its managers in the point of sale within a few minutes; they answer from there.

const STATUS: Record<api.SupportTicket['status'], string> = { open: 'Esperando respuesta', answered: 'Respondido', closed: 'Cerrado' };
const when = (at: string) => new Date(at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });

export function MessagesView({ view, data, refresh }: { view: View; data: { inbox: api.Inbox }; refresh: () => void }) {

    const [inbox, setInbox] = useState(data.inbox), [open, setOpen] = useState<string | null>(null), [ticket, setTicket] = useState<string | null>(null), [asking, setAsking] = useState(false);
    const branches = view.me.branches;
    const reload = async () => { try { setInbox(await api.inbox()); } catch { /* the next refresh brings it */ } refresh(); };

    useEffect(() => setInbox(data.inbox), [data.inbox]);

    const chosen = branches.find(b => b.licenseId === open);
    const chosenTicket = inbox.support.find(t => t.id === ticket);

    return <main className="report messages">

        <section className="headline" aria-label="Mensajes">

            <h1>Mensajes</h1>
            <p className="lead">Escribe a tus sucursales o al soporte de Culinary. Las sucursales lo leen en el punto de venta y contestan desde ahí.</p>

        </section>
        <div className="col">

            {chosen
                ? <BranchThread key={chosen.licenseId} branch={chosen} inbox={inbox} back={() => { setOpen(null); void reload(); }} sent={reload} />
                : <Block title={branches.length > 1 ? 'Sucursales' : 'Tu sucursal'}>

                    {branches.length > 1 && <Composer label="Mensaje a todas las sucursales" placeholder="Por ejemplo: el lunes hay junta de gerentes a las 9" action={`Enviar a las ${branches.length}`} Icon={Megaphone} send={async text => { const { sent } = await api.sendToBranches([], text); await reload(); return `Enviado a ${plural(sent, 'sucursal', 'sucursales')}.`; }} />}
                    {!branches.length ? <p className="quiet">Aún no hay sucursales en tu cuenta.</p> : <ol className="threads" aria-label="Conversaciones con sucursales">{branches.map(b => {

                        const line = inbox.branches.find(x => x.licenseId === b.licenseId);

                        return <li key={b.licenseId}><button onClick={() => setOpen(b.licenseId)}>

                            <span className="thread-icon" aria-hidden="true"><Store size={18} /></span>
                            <span className="thread-text"><b>{b.name}</b><small>{line?.last ? `${line.last.author === 'owner' ? 'Tú: ' : ''}${line.last.body}` : 'Sin mensajes todavía'}</small></span>
                            <span className="thread-side">{line?.last && <time>{seenAt(line.last.createdAt)}</time>}{(line?.unread ?? 0) > 0 && <span className="count" aria-label={plural(line!.unread, 'mensaje sin leer', 'mensajes sin leer')}>{line!.unread}</span>}</span>

                        </button></li>;

                    })}</ol>}

                </Block>}

        </div>
        <div className="col">

            {chosenTicket
                ? <SupportThread ticket={chosenTicket} branches={branches} back={() => setTicket(null)} changed={reload} />
                : <Block title="Soporte de Culinary">

                    <p className="note first">Dudas de tu cuenta, de tu licencia, de facturación o de cómo usar Culinary. Te contesta el equipo de soporte y la respuesta aparece aquí.</p>
                    {asking
                        ? <NewTicket branches={branches} cancel={() => setAsking(false)} created={async id => { setAsking(false); await reload(); setTicket(id); }} />
                        : <button className="ghost" onClick={() => setAsking(true)}><LifeBuoy size={18} />Escribir al soporte</button>}
                    {inbox.support.length > 0 && <ol className="threads" aria-label="Tus solicitudes al soporte">{inbox.support.map(t => <li key={t.id}><button onClick={() => setTicket(t.id)}>

                        <span className="thread-text"><b>{t.subject}</b><small>{branchName(branches, t.licenseId)} · {seenAt(t.updatedAt)}</small></span>
                        <span className={`status ${t.status}`}>{STATUS[t.status]}</span>

                    </button></li>)}</ol>}

                </Block>}

        </div>

    </main>;
}

const branchName = (branches: api.Branch[], licenseId: string) => branches.find(b => b.licenseId === licenseId)?.name ?? 'Sucursal';

function BranchThread({ branch, inbox, back, sent }: { branch: api.Branch; inbox: api.Inbox; back: () => void; sent: () => Promise<void> }) {

    const [messages, setMessages] = useState<api.Message[] | null>(null), [error, setError] = useState('');
    const end = useRef<HTMLDivElement>(null);
    const last = inbox.branches.find(x => x.licenseId === branch.licenseId)?.last?.id;
    const load = async () => { try { setMessages((await api.branchThread(branch.licenseId)).messages); setError(''); } catch (e) { setError(message(e)); } };

    // Opening reads the thread; a new message seen by the regular refresh reads it again.
    useEffect(() => { void load(); }, [branch.licenseId, last]);
    useEffect(() => { end.current?.scrollIntoView?.({ block: 'nearest' }); }, [messages?.length]);

    return <section className="block conversation" aria-label={`Conversación con ${branch.name}`}>

        <button className="link back" onClick={back}><ArrowLeft size={18} aria-hidden="true" />Todas las conversaciones</button>
        <h2>{branch.name}</h2>
        {branch.stale && <p className="plan-note">Esta sucursal no reporta desde {seenAt(branch.lastSeenAt).toLowerCase()}. Recibirá el mensaje cuando vuelva a conectarse.</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="bubbles" aria-live="polite">

            {messages === null && !error && <p className="quiet">Cargando la conversación…</p>}
            {messages?.length === 0 && <p className="quiet">Todavía no hay mensajes. Lo que escribas le llega a los gerentes de la sucursal en el punto de venta.</p>}
            {messages?.map(m => <div key={m.id} className={`bubble ${m.author === 'owner' ? 'mine' : 'theirs'}`}><p>{m.body}</p><small>{m.author === 'owner' ? `Tú (${m.name.split(' · ').pop()})` : m.name} · {when(m.createdAt)}{m.toAll ? ' · A todas las sucursales' : ''}</small></div>)}
            <div ref={end} />

        </div>
        <Composer label={`Mensaje a ${branch.name}`} placeholder="Escribe tu mensaje" action="Enviar" Icon={SendHorizontal} send={async text => { await api.sendToBranches([branch.licenseId], text); await load(); await sent(); return ''; }} />

    </section>;
}

function SupportThread({ ticket, branches, back, changed }: { ticket: api.SupportTicket; branches: api.Branch[]; back: () => void; changed: () => Promise<void> }) {

    return <section className="block conversation" aria-label={`Solicitud: ${ticket.subject}`}>

        <button className="link back" onClick={back}><ArrowLeft size={18} aria-hidden="true" />Todas las solicitudes</button>
        <h2>{ticket.subject}</h2>
        <p className="note first">{branchName(branches, ticket.licenseId)} · <span className={`status ${ticket.status}`}>{STATUS[ticket.status]}</span></p>
        <div className="bubbles" aria-live="polite">{ticket.messages.map(m => <div key={m.id} className={`bubble ${m.author === 'admin' ? 'theirs' : 'mine'}`}><p>{m.body}</p><small>{m.author === 'admin' ? 'Soporte de Culinary' : 'Tú'} · {when(m.createdAt)}</small></div>)}</div>
        {ticket.status === 'closed'
            ? <p className="quiet">El soporte cerró esta solicitud. Si necesitas algo más, abre una nueva.</p>
            : <Composer label="Responder al soporte" placeholder="Agrega lo que necesites" action="Responder" Icon={SendHorizontal} max={4000} send={async text => { await api.replySupport(ticket.id, text); await changed(); return ''; }} />}

    </section>;
}

function NewTicket({ branches, cancel, created }: { branches: api.Branch[]; cancel: () => void; created: (id: string) => Promise<void> }) {

    const [subject, setSubject] = useState(''), [body, setBody] = useState(''), [about, setAbout] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const submit = async () => {

        setBusy(true); setError('');

        try { const { ticket } = await api.askSupport(subject.trim(), body.trim(), about || undefined); await created(ticket.id); } catch (e) { setError(message(e)); setBusy(false); }

    };

    return <form className="ticket-form" onSubmit={e => { e.preventDefault(); void submit(); }}>

        <label className="field">Asunto<input value={subject} maxLength={150} required onChange={e => setSubject(e.target.value)} /></label>
        {branches.length > 1 && <label className="field">Sucursal<select value={about} onChange={e => setAbout(e.target.value)}><option value="">Todo el negocio</option>{branches.map(b => <option key={b.licenseId} value={b.licenseId}>{b.name}</option>)}</select></label>}
        <label className="field">Mensaje<textarea value={body} maxLength={4000} rows={5} required onChange={e => setBody(e.target.value)} /><small>No escribas contraseñas ni códigos de tu autenticador.</small></label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="form-actions"><button type="button" className="ghost" onClick={cancel}>Cancelar</button><button className="primary" disabled={busy || !subject.trim() || !body.trim()}>{busy ? 'Enviando…' : 'Enviar al soporte'}</button></div>

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

        <label className="field"><span>{label}</span><textarea value={text} rows={3} maxLength={max} placeholder={placeholder} onChange={e => { setText(e.target.value); setDone(''); }} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void submit(); } }} /></label>
        {error && <p className="error" role="alert">{error}</p>}
        {done && <p className="sent" role="status">{done}</p>}
        <button className="primary" disabled={busy || !text.trim()}><Icon size={18} aria-hidden="true" />{busy ? 'Enviando…' : action}</button>

    </form>;
}
