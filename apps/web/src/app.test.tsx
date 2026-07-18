import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { App } from './app.js'

describe('App', () => {
  it('shows the milestone one loading shell', () => {
    const html = renderToString(<App />)

    expect(html).toContain('Đang mở không gian làm việc')
  })
})
