/* eslint-disable */
/**
 * CiliaMiner chunk recovery — runs before any framework code.
 *
 * Next.js's content-hashed chunk filenames change on every deploy. When a
 * browser has cached old HTML, it requests chunk filenames that no longer
 * exist on the server. The server returns its 404 HTML page, the browser
 * tries to parse that HTML as JavaScript, and the page dies with a
 * SyntaxError ("Unexpected token '<'") followed by Turbopack's
 * "module factory not available" cascade.
 *
 * This script listens for those failures, force-reloads the page once
 * (which fetches fresh HTML, which references the current chunks), and
 * uses sessionStorage to avoid infinite reload loops.
 *
 * Served from /chunk-recovery.js so it loads as a normal cacheable file,
 * but we keep it tiny and pure so even cached versions stay correct.
 */
(function () {
  if (typeof window === 'undefined') return;

  var STORE_KEY = '__cm_chunk_recovery_attempts';
  var MAX_ATTEMPTS = 2;
  var WINDOW_MS = 30000; // attempts within 30s count as the same incident
  var GRACE_MS = 5000;   // after this much successful runtime, reset counter

  function getAttempts() {
    try {
      var raw = sessionStorage.getItem(STORE_KEY);
      if (!raw) return { n: 0, t: 0 };
      var parsed = JSON.parse(raw);
      return {
        n: parseInt(parsed.n, 10) || 0,
        t: parseInt(parsed.t, 10) || 0,
      };
    } catch (e) {
      return { n: 0, t: 0 };
    }
  }

  function setAttempts(n) {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({ n: n, t: Date.now() }));
    } catch (e) {}
  }

  function clearAttempts() {
    try { sessionStorage.removeItem(STORE_KEY); } catch (e) {}
  }

  function looksLikeChunkFailure(target) {
    if (!target) return false;
    var src = target.src || target.href || '';
    if (typeof src !== 'string') return false;
    return src.indexOf('/_next/static/') !== -1 ||
           src.indexOf('/_next/data/')   !== -1;
  }

  function recover(reason) {
    var state = getAttempts();
    // Reset the counter if the last attempt was long ago
    if (Date.now() - state.t > WINDOW_MS) state.n = 0;

    if (state.n >= MAX_ATTEMPTS) {
      // We've already reloaded and it didn't help — something else is wrong.
      // Don't loop. Log and let the error boundary handle it.
      try {
        console.error('[CiliaMiner] Chunk recovery exhausted (' + reason + ').' +
                      ' Please hard-refresh: Cmd-Shift-R / Ctrl-Shift-R.');
      } catch (e) {}
      return;
    }
    setAttempts(state.n + 1);
    try {
      console.warn('[CiliaMiner] Stale chunk detected (' + reason +
                   '). Reloading to fetch fresh build…');
    } catch (e) {}
    // Force-reload. Modern browsers no longer honour reload(true), but
    // simply reloading triggers a fresh HTML fetch, which references the
    // current build's chunk filenames.
    window.location.reload();
  }

  // Catch script/link tag load failures (404, SyntaxError on stale chunks)
  window.addEventListener(
    'error',
    function (e) {
      if (!e) return;
      var target = e.target || e.srcElement;
      if (looksLikeChunkFailure(target)) {
        recover('asset-load-failed');
        return;
      }
      // Also catch the SyntaxError thrown by parsing HTML-as-JS
      var msg = (e && e.message) ? String(e.message) : '';
      if (/Unexpected token '?<'?/.test(msg)) {
        recover('html-as-js');
      }
    },
    true /* capture phase — script load errors don't bubble */
  );

  // Turbopack chain-reaction: module factory not available
  window.addEventListener('error', function (e) {
    var msg = (e && e.message) ? String(e.message) : '';
    if (/module factory is not available/i.test(msg) ||
        /ChunkLoadError/i.test(msg)) {
      recover('module-factory');
    }
  });

  // Promise rejections for dynamic imports
  window.addEventListener('unhandledrejection', function (e) {
    var reason = e && e.reason;
    var msg = reason && (reason.message || String(reason));
    if (!msg) return;
    if (/Loading chunk/i.test(msg) ||
        /Failed to fetch dynamically imported module/i.test(msg) ||
        /ChunkLoadError/i.test(msg)) {
      recover('dynamic-import');
    }
  });

  // If the page survives the grace window, clear our counter so future
  // genuine recoveries can fire again.
  window.addEventListener('load', function () {
    setTimeout(function () {
      var state = getAttempts();
      if (state.n > 0) {
        clearAttempts();
        try { console.info('[CiliaMiner] Chunk recovery: clean session.'); } catch (e) {}
      }
    }, GRACE_MS);
  });
})();
