import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import { sair } from "./auth/sessao";
import { lerPublico, normalizarAbas, type Eu, type PessoaPublica } from "./equipe/dados";
import { Entrar, PrimeiroAcesso, Aviso } from "./auth/Entrar";
import { Portal } from "./shell/Portal";
import { Avisos } from "./shell/toast";
import { sinal } from "./auth/sinal";

type Estado =
  | { tipo: "carregando" }
  | { tipo: "entrar"; pessoas: PessoaPublica[] }
  | { tipo: "configurar" }
  | { tipo: "sem-acesso" }
  | { tipo: "erro"; msg: string }
  | { tipo: "pronto"; eu: Eu };


export function App() {
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });

  useEffect(() => {
    let pararEu: (() => void) | null = null;
    const off = onAuthStateChanged(auth, async (u) => {
      pararEu?.(); pararEu = null;
      if (sinal.saindo) { setEstado({ tipo: "carregando" }); return; }
      if (!u) {
        try {
          const p = await lerPublico();
          setEstado(p ? { tipo: "entrar", pessoas: p } : { tipo: "configurar" });
        } catch (e) {
          setEstado({ tipo: "erro", msg: (e as { code?: string })?.code === "unavailable" ? "Sem conexão com a internet." : "Não consegui carregar a lista da equipe." });
        }
        return;
      }
      setEstado({ tipo: "carregando" });
      pararEu = onSnapshot(doc(db, "uids", u.uid), (s) => {
        if (!s.exists()) { if (!sinal.configurando) setEstado({ tipo: "sem-acesso" }); return; }
        const x = s.data();
        if (x.ativo === false) { setEstado({ tipo: "sem-acesso" }); return; }
        sinal.configurando = false;
        setEstado({ tipo: "pronto", eu: { uid: u.uid, pid: x.pid, nome: x.nome || "", admin: !!x.admin, ativo: true, abas: normalizarAbas(x.abas) } });
      }, () => { if (!sinal.saindo) setEstado({ tipo: "sem-acesso" }); });
    });
    return () => { off(); pararEu?.(); };
  }, []);

  return (
    <>
      {estado.tipo === "carregando" && (
        <div className="tt-carregando">
          <div className="tt-carregando-voo" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M21.5 12c0-.8-.7-1.3-1.7-1.4l-5.1-.2L10 3.2H8.2l2.4 7.2-4.4-.2L4.4 7.8H3l1 4.2-1 4.2h1.4l1.8-2.4 4.4-.2-2.4 7.2H10l4.7-7.2 5.1-.2c1-.1 1.7-.6 1.7-1.4z" /></svg>
          </div>
          Carregando…
        </div>
      )}
      {estado.tipo === "entrar" && <Entrar pessoas={estado.pessoas} />}
      {estado.tipo === "configurar" && <PrimeiroAcesso />}
      {estado.tipo === "sem-acesso" && (
        <Aviso titulo="Acesso desligado" texto="Este acesso não está mais ativo ou foi trocado por um PIN novo. Peça ao administrador e entre de novo." botao="Voltar para a entrada" acao={sair} />
      )}
      {estado.tipo === "erro" && <Aviso titulo="Não deu para abrir" texto={estado.msg} botao="Tentar de novo" acao={() => location.reload()} />}
      {estado.tipo === "pronto" && <Portal eu={estado.eu} />}
      <Avisos />
    </>
  );
}
