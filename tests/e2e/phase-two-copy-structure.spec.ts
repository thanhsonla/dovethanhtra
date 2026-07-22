import { expect, test } from '@playwright/test'

test.setTimeout(60_000)

test('creates a case from selected work-item structure without copying results', async ({
  page,
}, testInfo) => {
  await page.goto('/#dashboard')
  await page.getByLabel('Email').fill('owner@example.local')
  await page.getByLabel('Mật khẩu').fill('local-demo-password')
  await page
    .getByRole('button', { name: 'Đăng nhập' })
    .evaluate((element: HTMLButtonElement) => element.click())

  const suffix = `${testInfo.project.name.replace(/\W/g, '')}-${Date.now()}`
  const sourceCode = `COPY-E2E-SRC-${suffix}`
  const sourceName = `Hồ sơ mẫu sao chép ${suffix}`
  await page
    .getByRole('button', { name: 'Tạo hồ sơ', exact: true })
    .evaluate((element: HTMLButtonElement) => element.click())
  const sourceForm = page.locator('.create-form')
  await sourceForm.getByLabel('Mã hồ sơ').fill(sourceCode)
  await sourceForm.getByLabel('Tên hồ sơ').fill(sourceName)
  await sourceForm.getByLabel('Từ ngày').fill('2026-07-01')
  await sourceForm.getByLabel('Đến ngày').fill('2026-07-31')
  await expect(sourceForm.getByLabel('Địa bàn')).toBeEnabled({ timeout: 15_000 })
  await sourceForm.getByLabel('Địa bàn').selectOption({ index: 1 })
  await Promise.all([
    page.waitForResponse(
      (response) => response.request().method() === 'GET' && response.url().endsWith('/work-items'),
    ),
    sourceForm
      .getByRole('button', { name: 'Lưu hồ sơ' })
      .evaluate((element: HTMLButtonElement) => element.click()),
  ])

  const sourceWorkName = `Công tác mẫu ${suffix}`
  await page.getByLabel('Loại công tác').selectOption({ index: 1 })
  await page.getByLabel('Tên công tác').fill(sourceWorkName)
  await page.getByLabel('Tên công tác').press('Enter')
  await expect(page.locator('.work-list').getByText(sourceWorkName, { exact: true })).toBeVisible()

  await page
    .getByRole('button', { name: 'Tạo hồ sơ', exact: true })
    .evaluate((element: HTMLButtonElement) => element.click())
  const targetForm = page.locator('.create-form')
  await expect(targetForm).toBeVisible()
  const targetName = `Hồ sơ sao chép ${suffix}`
  await targetForm.getByLabel('Mã hồ sơ').fill(`COPY-E2E-DST-${suffix}`)
  await targetForm.getByLabel('Tên hồ sơ').fill(targetName)
  await targetForm.getByLabel('Từ ngày').fill('2026-08-01')
  await targetForm.getByLabel('Đến ngày').fill('2026-08-31')
  await expect(targetForm.getByLabel('Địa bàn')).toBeEnabled({ timeout: 15_000 })
  await targetForm.getByLabel('Địa bàn').selectOption({ index: 1 })
  await targetForm
    .getByLabel('Sao chép cấu trúc từ hồ sơ (không bắt buộc)')
    .selectOption({ label: `${sourceCode} · ${sourceName}` })
  await expect(targetForm.getByRole('checkbox', { name: new RegExp(sourceWorkName) })).toBeChecked()
  await expect(targetForm.getByText(/không sao chép kỳ, phép đo, tuyến, ảnh/)).toBeVisible()
  await targetForm
    .getByRole('button', { name: 'Lưu hồ sơ' })
    .evaluate((element: HTMLButtonElement) => element.click())

  await expect(page.getByRole('heading', { name: targetName })).toBeVisible()
  await expect(page.locator('.work-list').getByText(sourceWorkName, { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: new RegExp(targetName) })).toContainText(
    '1 công tác',
  )
})
