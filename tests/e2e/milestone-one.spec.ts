import { expect, test } from '@playwright/test'

test.setTimeout(90_000)

test('creates a case and adds a catalog work item', async ({ page }, testInfo) => {
  await page.context().grantPermissions(['geolocation'])
  await page.context().setGeolocation({ latitude: 20.8, longitude: 104.65 })
  let failConfiguredStyle = false
  if (testInfo.project.name === 'chromium') {
    await page.route('**/basemaps/e2e-style.json', (route) => {
      return failConfiguredStyle ? route.abort() : route.continue()
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
  await page.getByLabel('Từ ngày').fill('2026-07-01')
  await page.getByLabel('Đến ngày').fill('2026-07-31')
  await page.getByLabel('Địa bàn').selectOption({ index: 1 })
  const initialWorkItemsResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' && /\/cases\/[^/]+\/work-items$/.test(response.url()),
  )
  await page
    .getByRole('button', { name: 'Lưu hồ sơ' })
    .evaluate((element: HTMLButtonElement) => element.click())
  expect((await initialWorkItemsResponse).status()).toBe(200)

  await expect(page.getByRole('heading', { name: caseName })).toBeVisible()
  await expect(page.getByText(/Có thể mở bản đồ để xem ranh giới ngay/)).toBeVisible()
  expect(mapModuleResponses).toHaveLength(0)
  await page
    .getByRole('button', { name: 'Mở bản đồ hiện trường' })
    .evaluate((element: HTMLButtonElement) => element.click())
  await expect(page.getByLabel('Bản đồ phép đo')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByLabel('Bản đồ nền')).toHaveValue('google-hybrid-direct')
  await expect(page.getByLabel('Công cụ đo nhanh')).toBeVisible()
  await expect(page.getByLabel('Bảng điều khiển bản đồ')).toBeVisible()
  await expect(page.locator('.map-drawer')).toHaveCount(0)
  const toolSizes = await page.locator('.map-primary-toolbar button').evaluateAll((buttons) =>
    buttons.map((button) => {
      const box = button.getBoundingClientRect()
      return { height: box.height, width: box.width }
    }),
  )
  expect(toolSizes.every((size) => size.height >= 44 && size.width >= 44)).toBe(true)
  const toolbarDisplay = await page
    .locator('.map-primary-toolbar')
    .evaluate((element) => getComputedStyle(element).display)
  expect(toolbarDisplay).toBe(testInfo.project.name === 'webkit-ipad' ? 'flex' : 'grid')

  await page.getByRole('button', { name: 'Chiều dài', exact: true }).click()
  const map = page.getByLabel('Bản đồ phép đo')
  await map.click({ position: { x: 330, y: 320 } })
  await map.click({ position: { x: 390, y: 320 } })
  await expect(page.getByRole('button', { name: 'Kết thúc phép đo' })).toBeEnabled()
  await page.waitForTimeout(500)
  await map.click({ position: { x: 390, y: 320 } })
  await expect(page.getByRole('button', { name: 'Xóa phần đang chọn' })).toBeEnabled()
  await page.getByRole('button', { name: 'Xóa phần đang chọn' }).click()
  await expect(page.getByRole('button', { name: 'Kết thúc phép đo' })).toBeDisabled()
  await page.getByRole('button', { name: 'Lùi điểm' }).click()
  await expect(page.getByRole('button', { name: 'Kết thúc phép đo' })).toBeEnabled()
  await page.getByRole('button', { name: 'Khôi phục điểm' }).click()
  await page.getByRole('button', { name: 'Lùi điểm' }).click()
  await page.getByRole('button', { name: 'Kết thúc phép đo' }).click()
  await expect(page.getByText('Nháp chưa phân loại', { exact: true })).toBeVisible()
  const onlineCaptureResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().includes('/capture-drafts'),
  )
  await page.getByRole('button', { name: 'Lưu nháp' }).click()
  expect((await onlineCaptureResponse).status()).toBeLessThan(300)
  await expect(page.getByText('Nháp chưa phân loại · Đã đồng bộ')).toBeVisible()

  const classifiedWorkName = `Chiều dài hiện trường ${suffix}`
  await page.getByText('Nháp chưa phân loại · Đã đồng bộ').click()
  await expect(page.getByLabel('Khu vực quản lý khi phân loại')).not.toHaveValue('')
  await expect(page.getByLabel('Lĩnh vực dịch vụ khi phân loại')).not.toHaveValue('')
  await page.getByLabel('Tên công tác khi phân loại').fill(classifiedWorkName)
  await page.getByLabel('Mục con khi phân loại').selectOption('new')
  await page.getByLabel('Tên mục con khi phân loại').fill('Đường kiểm tra E2E')
  const classificationResponse = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().endsWith('/classify'),
  )
  await page.getByRole('button', { name: 'Lưu', exact: true }).click()
  expect((await classificationResponse).status()).toBeLessThan(300)
  const warningClose = page.getByRole('button', { name: 'Đóng', exact: true })
  if (await warningClose.count()) await warningClose.click()
  await expect(page.getByRole('dialog', { name: 'Phân loại kết quả đo' })).toHaveCount(0)
  await expect(page.getByText('Nháp chưa phân loại · Đã đồng bộ')).toHaveCount(0)

  await page.getByRole('button', { name: 'Điểm', exact: true }).click()
  await map.click({ position: { x: 360, y: 350 } })
  await page.context().setOffline(true)
  await page.getByRole('button', { name: 'Lưu nháp' }).click()
  await expect(page.getByText('Nháp chưa phân loại · Chờ mạng')).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<number>((resolve, reject) => {
            const openRequest = indexedDB.open('dove-field-v4', 2)
            openRequest.onerror = () =>
              reject(openRequest.error ?? new Error('Không thể mở IndexedDB kiểm thử.'))
            openRequest.onsuccess = () => {
              const database = openRequest.result
              const request = database
                .transaction('captureDrafts')
                .objectStore('captureDrafts')
                .count()
              request.onerror = () => reject(request.error ?? new Error('Không thể đếm nháp.'))
              request.onsuccess = () => {
                database.close()
                resolve(request.result)
              }
            }
          }),
      ),
    )
    .toBeGreaterThanOrEqual(2)
  const queuedCaptureResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().includes('/capture-drafts'),
  )
  await page.context().setOffline(false)
  expect((await queuedCaptureResponse).status()).toBeLessThan(300)
  await expect(page.getByText('Nháp chưa phân loại · Đã đồng bộ')).toBeVisible()

  await page.getByRole('button', { name: 'Mở bộ lọc' }).click()
  await expect(page.getByRole('button', { name: classifiedWorkName, exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.map-drawer')).toHaveCount(0)
  await expect(page.locator('.measurement-panel')).toHaveCount(0)
  await expect(page.locator('.map-status')).toHaveCount(0)
  await page.getByRole('button', { name: 'Mở dữ liệu' }).click()
  await expect(page.getByRole('region', { name: 'Công tác đang đo', exact: true })).toBeVisible()
  await expect(page.getByLabel('Tiến độ hồ sơ')).toBeVisible()
  await page
    .getByRole('button', { name: 'Tạo công tác nhanh', exact: true })
    .evaluate((element: HTMLButtonElement) => element.click())
  await page
    .getByLabel('Loại công tác tạo nhanh')
    .selectOption({ label: 'Kiểm tra cột chiếu sáng' })
  await page.getByLabel('Tên công tác tạo nhanh').fill('Công tác điểm tạo nhanh E2E')
  await page
    .getByRole('button', { name: 'Tạo và bắt đầu', exact: true })
    .evaluate((element: HTMLButtonElement) => element.click())
  await expect(page.getByRole('button', { name: 'Hủy thao tác', exact: true })).toBeVisible()
  await page
    .getByRole('button', { name: 'Hủy thao tác', exact: true })
    .evaluate((element: HTMLButtonElement) => element.click())
  await page
    .getByRole('button', { name: 'Quay lại hồ sơ' })
    .evaluate((element: HTMLButtonElement) => element.click())
  await expect(
    page.locator('.work-list').getByText('Công tác điểm tạo nhanh E2E', { exact: true }),
  ).toBeVisible()
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

  await page.getByRole('button', { name: 'Mở bản đồ hiện trường' }).click()
  await expect(page.getByLabel('Bản đồ phép đo')).toBeVisible()
  await page.getByRole('button', { name: 'Mở dữ liệu' }).click()
  await expect(page.getByLabel('Tiến độ hồ sơ')).toBeVisible()
  await page.getByRole('button', { name: 'Đóng dữ liệu hồ sơ' }).click()
  await expect.poll(() => mapModuleResponses.length).toBeGreaterThan(0)
  await expect(page.getByLabel('Bản đồ nền')).toHaveValue('google-hybrid-direct')
  await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText('Google Maps')
  await page.getByLabel('Bản đồ nền').selectOption('configured-remote')
  await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText('Nền E2E được cấp phép')
  await page.getByLabel('Bản đồ nền').selectOption('google-hybrid-direct')
  await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText('Google Maps')
  await page.getByRole('button', { name: 'Mở bộ lọc' }).click()
  await page
    .getByRole('button', { name: 'Công tác E2E', exact: true })
    .evaluate((element: HTMLButtonElement) => element.click())
  await page.getByRole('button', { name: 'Mở nâng cao' }).click()
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
  const previewImportButton = page.getByRole('button', { name: 'Preview và kiểm schema' })
  await expect(previewImportButton).toBeEnabled()
  await previewImportButton.evaluate((element: HTMLButtonElement) => element.click())
  await expect(page.getByText('1 feature · line')).toBeVisible()
  await page
    .getByRole('button', { name: 'Import chính thức' })
    .evaluate((element: HTMLButtonElement) => element.click())
  await expect(page.getByText(/Tuyến import E2E/)).toBeVisible()
  await page
    .getByRole('button', { name: 'Mở dữ liệu' })
    .evaluate((element: HTMLButtonElement) => element.click())
  await page
    .getByRole('button', { name: 'Thêm đoạn', exact: true })
    .evaluate((element: HTMLButtonElement) => element.click())
  await page.getByLabel('Bản đồ phép đo').click({ position: { x: 330, y: 320 } })
  await page.getByLabel('Bản đồ phép đo').click({ position: { x: 390, y: 320 } })
  await expect(page.getByLabel('Kết quả đo trực tiếp')).toContainText('Tổng tuyến bổ sung')
  await expect(page.getByLabel('Kết quả đo trực tiếp')).toContainText(/[1-9]\d*\.\d{2} m/)
  await page
    .getByRole('button', { name: 'Lùi điểm' })
    .evaluate((element: HTMLButtonElement) => element.click())
  await page
    .getByRole('button', { name: 'Khôi phục điểm' })
    .evaluate((element: HTMLButtonElement) => element.click())
  await page
    .getByRole('button', { name: 'Kết thúc phép đo' })
    .evaluate((element: HTMLButtonElement) => element.click())
  const firstSuggestedName = await page.getByLabel('Tên phép đo').inputValue()
  expect(firstSuggestedName).toMatch(/^Đoạn \d{2}$/)
  await page
    .getByRole('button', { name: 'Lưu và tiếp tục' })
    .evaluate((element: HTMLButtonElement) => element.click())
  await expect(page.getByRole('button', { name: 'Hủy thao tác', exact: true })).toBeVisible()
  await page.getByLabel('Bản đồ phép đo').click({ position: { x: 350, y: 340 } })
  await page.getByLabel('Bản đồ phép đo').click({ position: { x: 410, y: 340 } })
  await page
    .getByRole('button', { name: 'Kết thúc phép đo' })
    .evaluate((element: HTMLButtonElement) => element.click())
  const reviewMeasurementName = await page.getByLabel('Tên phép đo').inputValue()
  expect(reviewMeasurementName).toMatch(/^Đoạn \d{2}$/)
  expect(reviewMeasurementName).not.toBe(firstSuggestedName)
  await page
    .getByRole('button', { name: 'Lưu và xác nhận' })
    .evaluate((element: HTMLButtonElement) => element.click())
  await expect(page.getByRole('alert')).toContainText('Đã lưu nháp')
  await page.getByRole('button', { name: 'Mở dữ liệu' }).click()
  await expect(page.getByLabel('Rà soát phép đo')).toBeVisible()
  await page
    .getByRole('button', { name: 'Mở danh sách' })
    .evaluate((element: HTMLButtonElement) => element.click())
  await expect(
    page.getByLabel('Rà soát phép đo').getByText(reviewMeasurementName, { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Mở bộ lọc' }).click()
  await expect(page.getByRole('button', { name: new RegExp(reviewMeasurementName) })).toBeVisible()
  await expect(page.getByLabel('Tổng Công tác E2E')).toContainText('0/3 bộ phận được cộng tổng')

  await page.getByRole('button', { name: 'Mở nâng cao' }).click()
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
            const openRequest = indexedDB.open('dove-field-v4', 2)
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
  await page.getByRole('button', { name: 'Mở bản đồ hiện trường' }).click()
  await page.getByRole('button', { name: 'Mở bộ lọc' }).click()
  await page
    .getByRole('button', { name: 'Công tác E2E', exact: true })
    .evaluate((element: HTMLButtonElement) => element.click())
  await page.getByRole('button', { name: 'Mở nâng cao' }).click()
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

  await page.getByRole('button', { name: 'Mở bộ lọc' }).click()
  await page
    .getByRole('button', { name: 'GPS point E2E', exact: true })
    .evaluate((element: HTMLButtonElement) => element.click())
  await page.getByRole('button', { name: 'Mở nâng cao' }).click()
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

  await page.getByRole('button', { name: 'Mở bộ lọc' }).click()
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
  await expect(page.getByLabel('Tên route')).toHaveValue('Lộ trình đến cơ sở xử lý')
  await page.getByLabel('Lý do tính lại').fill('Đối chứng route E2E')
  await page
    .getByRole('button', { name: 'Tính lại thành phiên bản mới' })
    .evaluate((element: HTMLButtonElement) => element.click())
  await page.getByRole('button', { name: 'Mở bộ lọc' }).click()
  await expect(page.getByText(/v2 · Đã xác nhận/)).toBeVisible()
  await page.getByLabel('Bản đồ nền').selectOption('technical-dark')
  await expect(page.getByLabel('Bản đồ nền')).toHaveValue('technical-dark')
  await expect(page.getByText(/Nền kỹ thuật chỉ là màu nền local/)).toBeVisible()
  await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText(
    'Nền kỹ thuật local · Không phải bản đồ địa chính',
  )
  await expect(page.getByRole('button', { name: new RegExp(reviewMeasurementName) })).toBeVisible()

  // Remount the map and explicitly fail the configured remote style without
  // depending on request counts or HTTP cache behavior.
  if (testInfo.project.name === 'chromium') {
    failConfiguredStyle = true
    await page.reload()
    await page
      .getByRole('button', { name: new RegExp(caseName) })
      .evaluate((element: HTMLButtonElement) => element.click())
    await page.getByRole('button', { name: 'Mở bản đồ hiện trường' }).click()
    await page.getByLabel('Bản đồ nền').selectOption('configured-remote')
    await expect(page.getByRole('alert')).toContainText('đã chuyển sang nền kỹ thuật local')
    await expect(page.getByLabel('Bản đồ nền')).toHaveValue('technical-light')
    await page.getByRole('button', { name: 'Mở bộ lọc' }).click()
    await expect(
      page.getByRole('button', { name: new RegExp(reviewMeasurementName) }),
    ).toBeVisible()
  }

  await page
    .getByRole('button', { name: 'Quay lại hồ sơ' })
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
