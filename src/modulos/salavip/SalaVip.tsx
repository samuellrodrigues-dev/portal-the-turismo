import { useEffect, useRef } from "react";
import { db } from "../../firebase";
import { nivel, type Eu } from "../../equipe/dados";
// módulo em JavaScript puro (o mesmo código do sistema antigo)
import { montarSalaVip } from "./salavip.js";

export default function SalaVip({ eu }: { eu: Eu }) {
  const ref = useRef<HTMLDivElement>(null);
  const papel = nivel(eu, "salavip") === "admin" ? "admin" : "operador";
  useEffect(() => {
    if (!ref.current) return;
    const desmontar = montarSalaVip(ref.current, { db, nome: eu.nome, nivel: papel });
    return () => desmontar();
  }, [eu.nome, papel]);
  return <div ref={ref} className="tt-salavip" />;
}
