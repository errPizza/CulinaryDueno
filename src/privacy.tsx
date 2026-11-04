import { ArrowLeft } from 'lucide-react';

// Fixed per provider when the installer is built, like the server address. The text is docs/AVISO-PRIVACIDAD-PANEL.md of the branch repository.
const PROVIDER = (import.meta.env.VITE_PROVIDER_NAME as string | undefined) || 'El proveedor que te dio acceso a Culinary Dueño';
const EMAIL = (import.meta.env.VITE_PRIVACY_EMAIL as string | undefined) || '';

export function Privacy({ close }: { close: () => void }) {

    const write = EMAIL ? <a href={`mailto:${EMAIL}`}>{EMAIL}</a> : 'el correo de privacidad de tu proveedor';

    return <main className="privacy">

        <button className="link back" onClick={close}><ArrowLeft size={18} aria-hidden="true" />Volver</button>
        <h1>Aviso de privacidad</h1>

        <h2>Responsable</h2>
        <p>{PROVIDER} es responsable de los datos de tu cuenta. Para cualquier asunto de privacidad escribe a {write}.</p>

        <h2>Qué datos usamos</h2>
        <ul>
            <li>De tu cuenta: tu correo, tu contraseña guardada sólo como huella cifrada, la clave de tu autenticador, las sesiones abiertas y los intentos fallidos de entrada.</li>
            <li>De las sucursales a las que tienes acceso: resúmenes por día de ventas, cobros, caja, productos, inventario, tiempos de cocina, devoluciones, calificaciones y gastos. De los clientes, sólo cifras: cuántos regresan, cada cuánto y cuánto gastan en promedio. No incluyen nombres ni teléfonos de clientes, tickets individuales ni datos de pago.</li>
            <li>Del personal: el identificador interno, el nombre visible y el rol de cada persona, con sus cuentas, ventas, propinas, mesas y comensales atendidos, minutos trabajados y su costo según el reloj checador, y el número de cancelaciones, descuentos, reaperturas y aperturas de cajón que pidió. Del equipo de cada sucursal, altas y bajas por mes, sin nombres.</li>
        </ul>

        <h2>Para qué</h2>
        <p>Para darte acceso, comprobar que eres tú, mostrarte las cifras de tus sucursales y avisarte si una deja de reportar. No usamos estos datos para publicidad ni los vendemos.</p>

        <h2>Con quién se comparten</h2>
        <p>Con nadie fuera del proveedor, salvo con el servicio de nube donde se guardan (Cloudflare), con Open-Meteo, que recibe sólo las coordenadas de la ciudad que elijas para el pronóstico del clima, y cuando una autoridad lo exija conforme a la ley. Un gerente sólo ve las sucursales que el negocio le asignó.</p>

        <h2>Cuánto tiempo</h2>
        <p>Los resúmenes por día se guardan 25 meses y el detalle de productos 13 meses; después se borran. Tu cuenta existe hasta que el negocio o el proveedor la eliminan, y al eliminarla se cierran sus sesiones.</p>

        <h2>Tus derechos</h2>
        <p>Puedes pedir acceso, rectificación, cancelación u oposición sobre tus datos, o revocar tu consentimiento, escribiendo a {write} desde el correo de tu cuenta. Si eres parte del personal de un negocio, dirígete primero a ese negocio, que es responsable de los datos de sus ventas.</p>

    </main>;
}
