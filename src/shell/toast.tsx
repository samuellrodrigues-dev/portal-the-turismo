import { useEffect, useState } from "react";

type Aviso = { msg: string; erro: boolean; t: number };

/** Aviso rápido no rodapé. Funciona de qualquer lugar, inclusive dos módulos sem React. */
export function toast(msg: string, erro = false) {
  window.dispatchEvent(new CustomEvent<Aviso>("tt-aviso", { detail: { msg, erro, t: Date.now() } }));
}

export function Avisos() {
  const [av, setAv] = useState<Aviso | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const f = (e: Event) => {
      const d = (e as CustomEvent<Aviso>).detail;
      setAv(d); clearTimeout(t);
      t = setTimeout(() => setAv(null), d.erro ? 6500 : 3400);
    };
    window.addEventListener("tt-aviso", f);
    return () => { window.removeEventListener("tt-aviso", f); clearTimeout(t); };
  }, []);
  return (
    <div className="tt-toasts" role="status" aria-live="polite">
      {av && <div key={av.t} className={`tt-toast${av.erro ? " erro" : ""}`}>{av.msg}</div>}
    </div>
  );
}
