import { createRoot } from "react-dom/client";
import { iniciarFirebase } from "./firebase";
import { App } from "./App"; // junto com o resto: evita esperar mais uma ida ao servidor
// fontes guardadas no próprio site (não dependem do Google Fonts)
import "@fontsource/barlow/latin-400.css";
import "@fontsource/barlow/latin-500.css";
import "@fontsource/barlow/latin-600.css";
import "@fontsource/barlow/latin-700.css";
import "@fontsource/barlow-condensed/latin-500.css";
import "@fontsource/barlow-condensed/latin-600.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "@fontsource/nunito/latin-500.css";
import "@fontsource/nunito/latin-600.css";
import "@fontsource/nunito/latin-700.css";
import "@fontsource/nunito/latin-800.css";
import "./shell/shell.css";

const raiz = document.getElementById("raiz")!;

iniciarFirebase()
  .then(() => {
    createRoot(raiz).render(<App />);
  })
  .catch((e) => {
    console.error(e);
    raiz.innerHTML = `<div class="tt-carregando"><p style="max-width:420px;text-align:center">Não foi possível iniciar o sistema. Abra pelo endereço publicado no Firebase (termina em <b>.web.app</b>).</p></div>`;
  });
