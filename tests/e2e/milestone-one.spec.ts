import { expect, test } from '@playwright/test'

test.setTimeout(60_000)

test('creates a case and adds a catalog work item', async ({ page }, testInfo) => {
  await page.context().grantPermissions(['geolocation'])
  await page.context().setGeolocation({ latitude: 20.8, longitude: 104.65 })
  let configuredStyleRequests = 0
  if (testInfo.project.name === 'chromium') {
    await page.route('**/basemaps/e2e-style.json', (route) => {
      configuredStyleRequests += 1
      return configuredStyleRequests <= 2 ? route.continue() : route.abort()
    })
  }
  const mapModuleResponses: string[] = []
  page.on('response', (response) => {
    if (/\/src\/map\/map-workspace\.tsx|\/assets\/map-workspace-[\w-]+\.js/.test(response.url())) {
      mapModuleResponses.push(response.url())
    }
  })
  await page.goto('/')

  await page.getByLabel('Email').fill('owner@example.local')
  await page.getByLabel('Mật khẩu').fill('local-demo-password')
  await page
    .getByRole('button', { name: 'Đăng nhập' })
    .evaluate((element: HTMLButtonElement) => element.click())

  await expect(page.getByRole('heading', { name: 'Hồ sơ kiểm tra' })).toBeVisible()
  await expect(page.getByText('Dịch vụ vệ sinh môi trường')).toBeVisible()

  const suffix = `${testInfo.project.name.replace(/\W/g, '')}-${Date.now()}`
  const customTypeName = `Loại công tác E2E ${suffix}`
  await page
    .getByRole('button', { name: 'Thêm loại' })
    .evaluate((element: HTMLButtonElement) => element.click())
  await page.getByLabel('Nhóm dịch vụ').selectOption({ index: 1 })
  await page
    .getByLabel('Mã loại công tác')
    .fill(`E2E_CUSTOM_${suffix.replace(/\W/g, '_').toUpperCase()}`)
  await page.getByLabel('Tên loại công tác').fill(customTypeName)
  await page.getByLabel('Kiểu đo').selectOption('line')
  await page.getByLabel('Đơn vị cơ sở').fill('m')
  await page.getByLabel('Mã quy tắc').fill('RULE-E2E-1')
  await page.getByLabel('Biểu thức').fill('length_m')
  await page
    .getByRole('button', { name: 'Lưu loại công tác' })
    .evaluate((element: HTMLButtonElement) => element.click())

  await page
    .getByRole('button', { name: 'Tạo hồ sơ' })
    .evaluate((element: HTMLButtonElement) => element.click())
  const caseName = `Hồ sơ E2E ${suffix}`
  await page.getByLabel('Mã hồ sơ').fill(`E2E-${suffix}`)
  await page.getByLabel('Tên hồ sơ').fill(caseName)
  await page.getByLabel('Địa bàn').selectOption({ index: 1 })
  await page.getByLabel('Từ ngày').fill('2026-07-01')
  await page.getByLabel('Đến ngày').fill('2026-07-31')
  await page
    .getByRole('button', { name: 'Lưu hồ sơ' })
    .evaluate((element: HTMLButtonElement) => element.click())

  await expect(page.getByRole('heading', { name: caseName })).toBeVisible()
  await page.getByLabel('Loại công tác').selectOption({ label: customTypeName })
  await page.getByLabel('Tên công tác').fill('Công tác E2E')
  await page
    .getByRole('button', { name: 'Thêm', exact: true })
    .evaluate((element: HTMLButtonElement) => element.click())

  await expect(page.locator('.work-list').getByText('Công tác E2E', { exact: true })).toBeVisible()
  await page.getByLabel('Loại công tác').selectOption({ label: 'Vận chuyển rác đến khu xử lý' })
  await page.getByLabel('Tên công tác').fill('Route vận chuyển E2E')
  await page
    .getByRole('button', { name: 'Thêm', exact: true })
    .evaluate((element: HTMLButtonElement) => element.click())
  await expect(
    page.locator('.work-list').getByText('Route vận chuyển E2E', { exact: true }),
  ).toBeVisible()
  await page.getByLabel('Loại công tác').selectOption({ label: 'Kiểm tra cột chiếu sáng' })
  await page.getByLabel('Tên công tác').fill('GPS point E2E')
  await page
    .getByRole('button', { name: 'Thêm', exact: true })
    .evaluate((element: HTMLButtonElement) => element.click())
  await expect(page.locator('.work-list').getByText('GPS point E2E', { exact: true })).toBeVisible()
  expect(mapModuleResponses).toHaveLength(0)

  await page
    .getByRole('button', { name: 'Mở bản đồ hiện trường' })
    .evaluate((element: HTMLButtonElement) => element.click())
  await expect(page.getByLabel('Bản đồ phép đo')).toBeVisible()
  await expect.poll(() => mapModuleResponses.length).toBeGreaterThan(0)
  await expect(page.getByLabel('Bản đồ nền')).toHaveValue('configured-remote')
  await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText('Nền E2E được cấp phép')
  await page.getByText('Import GeoJSON', { exact: true }).press('Enter')
  await page.getByLabel('Tệp GeoJSON').setInputFiles({
    name: 'import-e2e.geojson',
    mimeType: 'application/geo+json',
    buffer: Buffer.from(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { name: 'Tuyến import E2E' },
            geometry: {
              type: 'LineString',
              coordinates: [
                [104.65, 20.8],
                [104.651, 20.8],
              ],
            },
          },
        ],
      }),
    ),
  })
  await page
    .getByRole('button', { name: 'Preview và kiểm schema' })
    .evaluate((element: HTMLButtonElement) => element.click())
  await expect(page.getByText('1 feature · line')).toBeVisible()
  await page
    .getByRole('button', { name: 'Import chính thức' })
    .evaluate((element: HTMLButtonElement) => element.click())
  await expect(page.getByText('Tuyến import E2E', { exact: true })).toBeVisible()
  await page
    .getByRole('button', { name: 'Tuyến', exact: true })
    .evaluate((element: HTMLButtonElement) => element.click())
  await page.getByLabel('Bản đồ phép đo').click({ position: { x: 330, y: 320 } })
  await page.getByLabel('Bản đồ phép đo').click({ position: { x: 390, y: 320 } })
  await page
    .getByRole('button', { name: 'Hoàn tác' })
    .evaluate((element: HTMLButtonElement) => element.click())
  await page
    .getByRole('button', { name: 'Làm lại' })
    .evaluate((element: HTMLButtonElement) => element.click())
  await page
    .getByRole('button', { name: 'Kết thúc' })
    .evaluate((element: HTMLButtonElement) => element.click())
  await page.getByLabel('Tên phép đo').fill('Tuyến đo E2E')
  await page
    .getByRole('button', { name: 'Lưu và tính máy chủ' })
    .evaluate((element: HTMLButtonElement) => element.click())
  await expect(page.getByText('Tuyến đo E2E', { exact: true }).first()).toBeVisible()

  await page
    .getByRole('button', { name: 'Bắt đầu GPS' })
    .evaluate((element: HTMLButtonElement) => element.click())
  await expect(page.getByText('GPS track: 1 điểm')).toBeVisible()
  await page.context().setGeolocation({ latitude: 20.8, longitude: 104.651 })
  await expect(page.getByText('GPS track: 2 điểm')).toBeVisible({ timeout: 15_000 })
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<number>((resolve, reject) => {
            const openRequest = indexedDB.open('dove-field-v4', 1)
            openRequest.onerror = () =>
              reject(openRequest.error ?? new Error('Không thể mở IndexedDB kiểm thử.'))
            openRequest.onsuccess = () => {
              const database = openRequest.result
              const request = database.transaction('gpsDrafts').objectStore('gpsDrafts').count()
              request.onerror = () =>
                reject(request.error ?? new Error('Không thể đếm GPS draft kiểm thử.'))
              request.onsuccess = () => {
                database.close()
                resolve(request.result)
              }
            }
          }),
      ),
    )
    .toBeGreaterThan(0)
  await page.reload()
  await page
    .getByRole('button', { name: new RegExp(caseName) })
    .evaluate((element: HTMLButtonElement) => element.click())
  await page
    .getByRole('button', { name: 'Mở bản đồ hiện trường' })
    .evaluate((element: HTMLButtonElement) => element.click())
  await expect(page.getByText('GPS track: 2 điểm')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Đồng bộ: local_only')).toBeVisible()
  await page
    .getByRole('button', { name: 'Bắt đầu GPS' })
    .evaluate((element: HTMLButtonElement) => element.click())
  await expect(page.getByText('GPS track: 3 điểm')).toBeVisible()
  await page
    .getByRole('button', { name: 'Tạm dừng' })
    .evaluate((element: HTMLButtonElement) => element.click())
  await page.context().setGeolocation({ latitude: 20.8, longitude: 104.652 })
  await expect(page.getByText('GPS track: 3 điểm')).toBeVisible()
  await page
    .getByRole('button', { name: 'Tiếp tục' })
    .evaluate((element: HTMLButtonElement) => element.click())
  await page.context().setGeolocation({ latitude: 20.8, longitude: 104.653 })
  await expect(page.getByText('GPS track: 4 điểm')).toBeVisible()
  await page.context().setGeolocation({ latitude: 20.8, longitude: 104.654 })
  await expect(page.getByText('GPS track: 5 điểm')).toBeVisible()
  await page.context().setOffline(true)
  await page
    .getByRole('button', { name: 'Kết thúc và lưu' })
    .evaluate((element: HTMLButtonElement) => element.click())
  await expect(page.getByText('Đồng bộ: queued')).toBeVisible()
  const gpsResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/gps-tracks'),
  )
  await page.context().setOffline(false)
  const gpsResponse = await gpsResponsePromise
  expect(gpsResponse.status(), await gpsResponse.text()).toBeLessThan(300)
  await expect(page.getByText('Đồng bộ: synced')).toBeVisible()
  await expect(page.getByText(/GPS \d/).first()).toBeVisible()

  await page
    .getByRole('button', { name: 'GPS point E2E', exact: true })
    .evaluate((element: HTMLButtonElement) => element.click())
  const pointResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/gps-points'),
  )
  await page
    .getByRole('button', { name: 'Ghi vị trí GPS' })
    .evaluate((element: HTMLButtonElement) => element.click())
  const pointResponse = await pointResponsePromise
  expect(pointResponse.status(), await pointResponse.text()).toBeLessThan(300)
  await expect(page.getByText('Đồng bộ: synced')).toBeVisible()
  await expect(page.getByText(/Vị trí GPS \d/).first()).toBeVisible()

  await page
    .getByRole('button', { name: 'Route vận chuyển E2E', exact: true })
    .evaluate((element: HTMLButtonElement) => element.click())
  await page.getByLabel('Cơ sở xử lý').selectOption({ index: 1 })
  await page
    .getByRole('button', { name: 'Tính phương án' })
    .evaluate((element: HTMLButtonElement) => element.click())
  await expect(page.getByText('Nguồn cự ly:')).toContainText('local-deterministic')
  await expect(page.getByText(/Phương án 1:/)).toBeVisible()
  await page
    .getByRole('button', { name: 'Lưu route chính thức' })
    .evaluate((element: HTMLButtonElement) => element.click())
  await expect(page.getByText('Lộ trình đến cơ sở xử lý', { exact: true }).first()).toBeVisible()
  await page.getByLabel('Lý do tính lại').fill('Đối chứng route E2E')
  await page
    .getByRole('button', { name: 'Tính lại thành phiên bản mới' })
    .evaluate((element: HTMLButtonElement) => element.click())
  await expect(page.getByText(/v2 · Đã xác nhận/)).toBeVisible()
  await page.getByLabel('Bản đồ nền').selectOption('technical-dark')
  await expect(page.getByText('Nền: Kỹ thuật tối')).toBeVisible()
  await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText(
    'Nền kỹ thuật local · Không phải bản đồ địa chính',
  )
  await expect(page.getByText('Tuyến đo E2E', { exact: true }).first()).toBeVisible()

  // Remount the map so Chromium requests the remote style again; the route above
  // deterministically fails that second request instead of depending on HTTP cache behavior.
  if (testInfo.project.name === 'chromium') {
    await page.reload()
    await page
      .getByRole('button', { name: new RegExp(caseName) })
      .evaluate((element: HTMLButtonElement) => element.click())
    await page
      .getByRole('button', { name: 'Mở bản đồ hiện trường' })
      .evaluate((element: HTMLButtonElement) => element.click())
    await expect(page.getByRole('alert')).toContainText('đã chuyển sang nền kỹ thuật local')
    await expect(page.getByLabel('Bản đồ nền')).toHaveValue('technical-light')
    await expect(page.getByText('Tuyến đo E2E', { exact: true }).first()).toBeVisible()
  }

  await page
    .getByRole('button', { name: '← Hồ sơ' })
    .evaluate((element: HTMLButtonElement) => element.click())
  await expect(page.getByRole('heading', { name: 'Khối lượng nguồn' })).toBeVisible()
  await page
    .locator('.comparison-form select')
    .first()
    .selectOption({ label: 'Route vận chuyển E2E' })
  await page.getByLabel('Khối lượng nguồn', { exact: true }).fill('20')
  await page.getByLabel('Số tài liệu').fill('NT-E2E-M5')
  await page
    .getByRole('button', { name: 'Lưu nguồn' })
    .evaluate((element: HTMLButtonElement) => element.click())
  await expect(page.getByText('Nghiệm thu: 20')).toBeVisible()
  await page.getByLabel('Ngưỡng tỷ lệ (%)').fill('1')
  await page
    .getByRole('button', { name: 'Lưu ngưỡng hồ sơ' })
    .evaluate((element: HTMLButtonElement) => element.click())
  const explanation = page.getByLabel(/Giải trình · Route vận chuyển E2E/)
  await explanation.fill('Giải trình chênh lệch E2E Mốc 5')
  await page
    .getByRole('button', { name: 'Lưu giải trình' })
    .evaluate((element: HTMLButtonElement) => element.click())

  await page.getByLabel('Lý do khóa').fill('Chốt hồ sơ E2E Mốc 5')
  await page
    .getByRole('button', { name: 'Khóa hồ sơ và tạo snapshot' })
    .evaluate((element: HTMLButtonElement) => element.click())
  await expect(page.locator('.detail-panel').getByText('Đã khóa', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mở khóa hồ sơ' })).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page
    .getByRole('button', { name: 'Xuất Excel' })
    .evaluate((element: HTMLButtonElement) => element.click())
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/)
  await expect(page.getByText(/Đã xuất .*\.xlsx/)).toBeVisible()

  await page.getByLabel('Lý do mở khóa').fill('Mở khóa để tiếp tục kiểm thử')
  await page
    .getByRole('button', { name: 'Mở khóa hồ sơ' })
    .evaluate((element: HTMLButtonElement) => element.click())
  await expect(
    page.locator('.detail-panel').getByText('Đang thực hiện', { exact: true }),
  ).toBeVisible()
})
