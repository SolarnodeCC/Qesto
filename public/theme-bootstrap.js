// Appearance bootstrap: apply stored theme / density / high-contrast to <html>
// before first paint to avoid a flash. Mirrors useColorScheme + useDensity +
// HighContrastToggle, which re-assert these once React mounts.
//
// Loaded as an external, same-origin, render-blocking <script> in index.html's
// <head> (NOT inline) so the Content-Security-Policy can drop
// `script-src 'unsafe-inline'` (see public/_headers). Keep this file dependency-
// free and synchronous so it still runs before the first paint.
(function () {
  try {
    var el = document.documentElement
    var pref = localStorage.getItem('qesto:color-scheme')
    var resolved =
      pref === 'light' || pref === 'dark'
        ? pref
        : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
    el.dataset.theme = resolved
    el.dataset.themePreference =
      pref === 'light' || pref === 'dark' || pref === 'system' ? pref : 'system'
    var den = localStorage.getItem('qesto-density')
    el.dataset.density =
      den === 'compact' || den === 'comfortable' || den === 'spacious' ? den : 'comfortable'
    el.dataset.highContrast =
      localStorage.getItem('qesto:high-contrast') === '1' ? 'true' : 'false'
  } catch (e) {
    /* localStorage unavailable — hooks will set these on mount */
  }
})()
