// Link the Tapedeck design-system stylesheets at runtime (not via index.html)
// so Vite's HTML plugin doesn't inline/rewrite them and strip the
// `melodic-styles` attribute that gets the rules adopted into each component's
// shadow root. Same approach Envy and Coax use.

const stylesheets = [
  './tokens.css', // design tokens: --td-* palette mapped onto --ml-* semantics
  './app.css', // shared primitives: buttons, inputs, modal shell
]

for (const href of stylesheets) {
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.setAttribute('melodic-styles', '')
  link.href = href
  document.head.appendChild(link)
}
