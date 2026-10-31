import "./operacao.css";

const URL_OPERACAO = "https://claude.ai/artifact/847Nq2q5CGZBQhNX8Mn9wx";

/** O Operação continua no Claude (lá ele lê as emissões com IA sem custo); aqui fica só o atalho. */
export default function Operacao() {
  return (
    <div className="tt-pag op-pag">
      <section className="op-cartao">
        <div className="op-selo" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M3 7h18M3 12h18M3 17h11" /><circle cx="18.5" cy="17" r="2.5" /></svg>
        </div>
        <div className="op-texto">
          <h1>THE TURISMO Operação</h1>
          <p>Emissões, contratos, balanço do dia, comissões, despesas e gestão de milhas.</p>
          <ul>
            <li>Abre numa aba nova, dentro do Claude.</li>
            <li>Use a sua conta do Claude. Os dados ficam lá, como sempre.</li>
          </ul>
          <a className="tt-btn ouro op-btn" href={URL_OPERACAO} target="_blank" rel="noopener noreferrer">
            Abrir o Operação
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" /></svg>
          </a>
        </div>
      </section>
    </div>
  );
}
