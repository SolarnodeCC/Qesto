/**
 * qr.js — tiny QR renderer for Qesto join panels.
 * Loads the davidshimjs/qrcodejs lib from CDN and exposes window.QestoQR.render(el, text, size).
 * Renders in Qesto ink (#0A0F1E) on transparent so it sits on white panels.
 */
(function () {
  var CDN = 'https://unpkg.com/qrcodejs@1.0.0/qrcode.min.js'
  var ready = null
  function load() {
    if (ready) return ready
    ready = new Promise(function (resolve) {
      if (window.QRCode) return resolve()
      var s = document.createElement('script')
      s.src = CDN
      s.onload = resolve
      s.onerror = resolve
      document.head.appendChild(s)
    })
    return ready
  }
  window.QestoQR = {
    render: function (el, text, size) {
      if (!el) return
      size = size || 160
      load().then(function () {
        el.innerHTML = ''
        if (!window.QRCode) return
        new window.QRCode(el, {
          text: text,
          width: size,
          height: size,
          colorDark: '#0A0F1E',
          colorLight: '#ffffff',
          correctLevel: window.QRCode.CorrectLevel.M,
        })
      })
    },
  }
})()
