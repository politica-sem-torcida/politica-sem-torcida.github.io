// Publica as páginas do projeto no GitHub Pages.
//
//   node publicar.mjs            copia as páginas do Drive, ajusta, faz commit e envia (publica)
//   node publicar.mjs --montar   só copia e ajusta, sem enviar (para conferir antes)
//
// A fonte de verdade das páginas é o Drive. Este script nunca edita o Drive:
// lê de lá e escreve em docs/, que é a pasta que o GitHub Pages serve.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const RAIZ = dirname(fileURLToPath(import.meta.url));
const DRIVE = "G:/Meu Drive/POLITICA";
const SAIDA = join(RAIZ, "docs");

// Cada página: de onde vem, para onde vai e qual era o link dela como Artifact do Claude
// (os links claude.ai entre as páginas viram links relativos).
const PAGINAS = [
  {
    origem: "levantamentos/2026-10_segundo-turno-presidente/ficha-segundo-turno.html",
    destino: "index.html",
    artifact: "N1P2SgUaN5mFge4Yg8kFaB",
  },
  {
    origem: "casos/lula-e-flavio.html",
    destino: "casos/index.html",
    artifact: "4ZfKT9Wpq7vcgCDcugNfzs",
  },
];

function textoPuro(html) {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function escaparAtributo(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function montar(pagina) {
  let html = readFileSync(join(DRIVE, pagina.origem), "utf8");

  // Links entre as páginas: claude.ai/artifact/ID -> caminho relativo, abrindo na mesma aba.
  for (const outra of PAGINAS) {
    const de = dirname(join(SAIDA, pagina.destino));
    const para = dirname(join(SAIDA, outra.destino));
    const rel = (relative(de, para).replace(/\\/g, "/") || ".") + "/";
    const link = new RegExp(`href="https://claude\\.ai/artifact/${outra.artifact}"(\\s+target="_blank")?(\\s+rel="noopener")?`, "g");
    html = html.replace(link, `href="${rel}"`);
  }
  const sobra = html.match(/https:\/\/claude\.ai\/[^"'\s<]*/);
  if (sobra) {
    throw new Error(`${pagina.origem} ainda tem um link do Claude sem correspondente: ${sobra[0]}\n` +
      "Acrescente a página dele em PAGINAS ou troque o link no arquivo do Drive.");
  }

  // Cabeçalho que a publicação de Artifact acrescentava e o arquivo local não tem.
  const titulo = textoPuro(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
  const resumo = textoPuro(html.match(/<p class="lede">([\s\S]*?)<\/p>/)?.[1] ?? "");
  const curto = resumo.length > 200 ? resumo.slice(0, 197).replace(/\s+\S*$/, "") + "…" : resumo;
  const cabecalho = [
    "<!doctype html>",
    '<html lang="pt-BR">',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    // Fora dos buscadores até o projeto decidir ir a público; quem tem o link abre normalmente.
    '<meta name="robots" content="noindex, nofollow">',
    `<meta name="description" content="${escaparAtributo(curto)}">`,
    `<meta property="og:title" content="${escaparAtributo(titulo)}">`,
    `<meta property="og:description" content="${escaparAtributo(curto)}">`,
    '<meta property="og:type" content="article">',
    "",
  ].join("\n");

  const destino = join(SAIDA, pagina.destino);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, cabecalho + html.replace(/^\uFEFF/, ""));
  console.log(`montada: ${pagina.origem} -> docs/${pagina.destino}`);
}

function git(...args) {
  return execFileSync("git", args, { cwd: RAIZ, encoding: "utf8" }).trim();
}

mkdirSync(SAIDA, { recursive: true });
writeFileSync(join(SAIDA, ".nojekyll"), ""); // serve os arquivos como estão, sem o processador Jekyll
for (const p of PAGINAS) montar(p);

if (process.argv.includes("--montar")) {
  console.log("Só montado, nada enviado.");
  process.exit(0);
}

git("add", "-A", "docs");
if (!git("status", "--porcelain", "docs")) {
  console.log("Nada mudou nas páginas; nada a publicar.");
  process.exit(0);
}
const hoje = new Date().toISOString().slice(0, 10);
git("commit", "-m", `Atualiza páginas (${hoje})`, "-m", "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>");
git("push");
console.log("Enviado. O GitHub Pages atualiza o site em cerca de 1 minuto.");
