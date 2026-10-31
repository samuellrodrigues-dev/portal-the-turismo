import { useState, type FormEvent } from "react";
import { pinFraco, trocarMeuPin, traduzirErroAuth, type Eu } from "./dados";
import { toast } from "../shell/toast";

export default function MeuPin({ eu }: { eu: Eu }) {
  const [atual, setAtual] = useState("");
  const [novo, setNovo] = useState("");
  const [conf, setConf] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; erro?: string }>({});
  const [ocupado, setOcupado] = useState(false);
  const n = atual.length || 4;

  async function enviar(e: FormEvent) {
    e.preventDefault(); setMsg({});
    if (!/^\d{4,8}$/.test(atual)) return setMsg({ erro: "Digite o seu PIN atual." });
    if (novo.length !== atual.length) return setMsg({ erro: `O PIN novo precisa ter ${atual.length} números, igual ao atual.` });
    if (!/^\d+$/.test(novo) || pinFraco(novo)) return setMsg({ erro: "Escolha um PIN menos óbvio (sem números repetidos ou em sequência)." });
    if (novo !== conf) return setMsg({ erro: "Os dois PINs novos não são iguais." });
    setOcupado(true);
    try {
      await trocarMeuPin(atual, novo);
      setAtual(""); setNovo(""); setConf("");
      setMsg({ ok: "PIN trocado. Use o novo da próxima vez que entrar." });
      toast("PIN trocado.");
    } catch (x) {
      const c = (x as { code?: string })?.code;
      setMsg({ erro: c === "auth/invalid-credential" || c === "auth/wrong-password" || c === "auth/invalid-login-credentials" ? "O PIN atual não confere." : traduzirErroAuth(x) });
    } finally { setOcupado(false); }
  }
  const campo = (rotulo: string, v: string, set: (s: string) => void, ac: string) => (
    <label className="tt-campo"><span>{rotulo}</span>
      <input value={v} onChange={(e) => set(e.target.value.replace(/\D/g, "").slice(0, 8))} type="password" inputMode="numeric" maxLength={8} autoComplete={ac} className="pin" />
    </label>
  );
  return (
    <div className="tt-pag estreita">
      <div className="tt-pag-topo"><div><h1>Trocar meu PIN</h1><p>{eu.nome}, o PIN novo tem a mesma quantidade de números do atual ({n}), sem sequências como 1234.</p></div></div>
      <form className="tt-bloco eq-form" onSubmit={enviar}>
        {campo("PIN atual", atual, setAtual, "current-password")}
        {campo("PIN novo", novo, setNovo, "new-password")}
        {campo("Repita o PIN novo", conf, setConf, "new-password")}
        <div className="eq-botoes"><button type="submit" className="tt-btn pri" disabled={ocupado}>{ocupado ? "Trocando…" : "Trocar PIN"}</button></div>
        {msg.erro && <p className="tt-msg erro" role="alert">{msg.erro}</p>}
        {msg.ok && <p className="tt-msg ok" role="status">{msg.ok}</p>}
      </form>
    </div>
  );
}
