import { afterEach } from 'vitest'

// Custom elements persist across tests (customElements has no unregister),
// but each test should start from a clean document.
afterEach(() => {
  document.body.innerHTML = ''
})
