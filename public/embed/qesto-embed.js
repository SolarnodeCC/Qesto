/**
 * Qesto Embed SDK loader — v1.
 * Drop this on any page to embed a live Qesto session widget.
 *
 * Usage:
 *   <script src="https://qesto.cc/embed/qesto-embed.js"
 *           data-qesto-embed
 *           data-session="SESSION_ID_OR_CODE"
 *           data-token="WIDGET_TOKEN"
 *           data-origin="https://yoursite.com"
 *           data-theme="light"
 *           data-height="480"></script>
 *
 * Or imperatively after the script loads:
 *   window.qesto = { session: '...', token: '...', origin: '...', theme: 'dark' }
 *
 * postMessage protocol (ADR-0050 §3c):
 *   widget → host: { source:'qesto-embed', v:1, type:'ready' }
 *                  { source:'qesto-embed', v:1, type:'resize', height:number }
 *                  { source:'qesto-embed', v:1, type:'event', event:'...', payload?:{...} }
 *   host → widget: { source:'qesto-embed', v:1, type:'host_ready' }
 *                  { source:'qesto-embed', v:1, type:'config', theme?:'light'|'dark' }
 *
 * Security model (ADR-0050 §3b, §3c):
 *   - iframe sandboxed WITHOUT allow-same-origin — widget has no host DOM/cookie access
 *   - Every inbound postMessage validated: source==='qesto-embed', v===1,
 *     event.origin === QESTO_ORIGIN (computed from the script src).
 *   - Only height (integer) ever mutates host layout; all other reactions are data events.
 *   - resize height clamped to [100, 4000] to prevent layout abuse.
 */
;(function () {
  'use strict'

  // ── Derive the Qesto origin from the script's own src ──────────────────────
  // Ensures that even when self-hosted, the origin validation is correct.
  var QESTO_ORIGIN = (function () {
    try {
      var scripts = document.querySelectorAll('script[data-qesto-embed]')
      var thisScript = scripts[scripts.length - 1]
      if (thisScript && thisScript.src) {
        var u = new URL(thisScript.src)
        return u.origin
      }
    } catch (_) {
      // Fallback: assume same origin (for inline/test usage)
    }
    return window.location.origin
  })()

  var WIDGET_PAGE_PATH = '/embed/widget'

  // ── Read config from script data-attributes or window.qesto ───────────────
  function getConfig() {
    var cfg = {
      session: '',
      token: '',
      origin: window.location.origin,
      theme: 'light',
      height: 480,
      container: null,
    }
    try {
      var scripts = document.querySelectorAll('script[data-qesto-embed]')
      var el = scripts[scripts.length - 1]
      if (el) {
        cfg.session = el.getAttribute('data-session') || el.getAttribute('data-session-id') || ''
        cfg.token = el.getAttribute('data-token') || ''
        cfg.origin = el.getAttribute('data-origin') || el.getAttribute('data-host-origin') || window.location.origin
        cfg.theme = el.getAttribute('data-theme') || 'light'
        var rawH = parseInt(el.getAttribute('data-height') || '0', 10)
        cfg.height = rawH > 0 ? rawH : 480
        cfg.container = el.getAttribute('data-container') || null
      }
    } catch (_) {}
    // window.qesto overrides data-attributes
    if (window.qesto && typeof window.qesto === 'object') {
      var w = window.qesto
      if (w.session) cfg.session = w.session
      if (w.token) cfg.token = w.token
      if (w.origin) cfg.origin = w.origin
      if (w.theme) cfg.theme = w.theme
      if (w.height) cfg.height = w.height
      if (w.container) cfg.container = w.container
    }
    return cfg
  }

  // ── Build the widget iframe URL ────────────────────────────────────────────
  function buildWidgetUrl(cfg) {
    var u = new URL(WIDGET_PAGE_PATH, QESTO_ORIGIN)
    u.searchParams.set('session', cfg.session)
    u.searchParams.set('token', cfg.token)
    u.searchParams.set('origin', cfg.origin)
    u.searchParams.set('theme', cfg.theme)
    return u.toString()
  }

  // ── Create the sandboxed iframe ────────────────────────────────────────────
  function createFrame(cfg) {
    var frame = document.createElement('iframe')
    frame.src = buildWidgetUrl(cfg)
    // ADR-0050 §3b: NO allow-same-origin → widget runs in opaque origin
    // cannot read host DOM, cookies, or storage and vice versa.
    frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups')
    frame.setAttribute('allow', '')
    frame.setAttribute('loading', 'lazy')
    frame.setAttribute('title', 'Qesto live session widget')
    frame.setAttribute('aria-label', 'Qesto live session widget')
    frame.style.cssText = [
      'width:100%',
      'height:' + cfg.height + 'px',
      'border:none',
      'display:block',
      'border-radius:8px',
      'overflow:hidden',
    ].join(';')
    return frame
  }

  // ── Inject frame into DOM ──────────────────────────────────────────────────
  function mount(cfg, frame) {
    if (cfg.container) {
      var el = document.querySelector(cfg.container)
      if (el) { el.appendChild(frame); return }
    }
    // Default: insert after the script tag
    try {
      var scripts = document.querySelectorAll('script[data-qesto-embed]')
      var scriptEl = scripts[scripts.length - 1]
      if (scriptEl && scriptEl.parentNode) {
        scriptEl.parentNode.insertBefore(frame, scriptEl.nextSibling)
        return
      }
    } catch (_) {}
    document.body.appendChild(frame)
  }

  // ── postMessage handler ────────────────────────────────────────────────────
  // ADR-0050 §3c: validates event.origin against QESTO_ORIGIN before acting.
  // Drops any message not matching the protocol envelope.
  function attachMessageHandler(frame, cfg) {
    window.addEventListener('message', function (event) {
      // SECURITY: validate the message came from the Qesto embed origin only.
      if (event.origin !== QESTO_ORIGIN) return

      var msg = event.data
      // Drop messages that don't match the protocol envelope.
      if (
        !msg ||
        typeof msg !== 'object' ||
        msg.source !== 'qesto-embed' ||
        msg.v !== 1 ||
        typeof msg.type !== 'string'
      ) return

      switch (msg.type) {
        case 'ready':
          // Widget mounted and handshake done — send host_ready then config.
          sendToWidget(frame, { source: 'qesto-embed', v: 1, type: 'host_ready' })
          sendToWidget(frame, { source: 'qesto-embed', v: 1, type: 'config', theme: cfg.theme })
          fireCallback('onReady', {})
          break

        case 'resize':
          // Only accept integer height values; clamp to prevent layout abuse.
          if (typeof msg.height === 'number' && Number.isFinite(msg.height)) {
            var h = Math.ceil(msg.height)
            if (h >= 100 && h <= 4000) {
              frame.style.height = h + 'px'
            }
          }
          break

        case 'event':
          // Aggregate-safe lifecycle event — no participant identity.
          // Payload is only: { code?, questionId? } — no PII.
          if (typeof msg.event === 'string') {
            fireCallback('onEvent', { event: msg.event, payload: msg.payload || {} })
          }
          break
      }
    })
  }

  function sendToWidget(frame, msg) {
    try {
      if (frame.contentWindow) {
        frame.contentWindow.postMessage(msg, QESTO_ORIGIN)
      }
    } catch (_) {}
  }

  function fireCallback(name, data) {
    try {
      if (window.qesto && typeof window.qesto[name] === 'function') {
        window.qesto[name](data)
      }
    } catch (_) {}
  }

  // ── Boot ───────────────────────────────────────────────────────────────────
  function boot() {
    var cfg = getConfig()
    if (!cfg.session || !cfg.token) {
      console.warn('[qesto-embed] Missing data-session or data-token — widget not mounted.')
      return
    }
    var frame = createFrame(cfg)
    mount(cfg, frame)
    attachMessageHandler(frame, cfg)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot)
  } else {
    boot()
  }
})()
