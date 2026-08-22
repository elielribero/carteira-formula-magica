// Service worker do app "Carteira — Fórmula Mágica".
// Estratégia: network-first para a página principal (para pegar atualizações
// quando online), com fallback ao cache quando offline. Cache-first para os
// demais arquivos do app shell (ícones, manifest), que raramente mudam.
//
// Subir uma nova versão do app: mude CACHE_NAME (ex.: 'carteira-fm-v2').
// Isso invalida o cache antigo automaticamente no próximo carregamento online.

const CACHE_NAME = 'carteira-fm-v18';
const ARQUIVOS_ESSENCIAIS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ARQUIVOS_ESSENCIAIS))
      .catch((err) => console.warn('Falha ao pré-cachear:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(nomes.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const mesmaOrigem = url.origin === self.location.origin;

  // NUNCA cachear chamadas de origem cruzada (a API do Apps Script). São
  // dado vivo e mutável — a sincronização com a planilha. Bug real corrigido
  // em 07/08/2026: sem esta checagem, o cache-first abaixo respondia com uma
  // cópia velha da sincronização em vez de buscar de novo na rede, então um
  // reset feito na planilha não aparecia depois de atualizar a página — o
  // app mostrava dados de antes do reset, indefinidamente, até o cache
  // expirar ou ser limpo manualmente. Só o app shell (arquivos deste próprio
  // domínio) deve passar pela lógica de cache abaixo.
  if (!mesmaOrigem) {
    return; // deixa o navegador buscar na rede normalmente, sem passar pelo SW
  }

  const isNavegacao = req.mode === 'navigate';

  if (isNavegacao) {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copia = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copia));
          return resp;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((resp) => {
          const copia = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copia));
          return resp;
        })
        .catch(() => cached);
    })
  );
});
