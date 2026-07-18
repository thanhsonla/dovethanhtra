import { expect, test } from '@playwright/test'

test('creates a case and adds a catalog work item', async ({ page }, testInfo) => {
  await page.goto('/')

  await page.getByLabel('Email').fill('owner@example.local')
  await page.getByLabel('Mật khẩu').fill('local-demo-password')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()

  await expect(page.getByRole('heading', { name: 'Hồ sơ kiểm tra' })).toBeVisible()
  await expect(page.getByText('Nhóm dịch vụ')).toBeVisible()

  const suffix = `${testInfo.project.name.replace(/\W/g, '')}-${Date.now()}`
  const customTypeName = `Loại công tác E2E ${suffix}`
  await page.getByRole('button', { name: 'Thêm loại' }).click()
  await page.getByLabel('Nhóm dịch vụ').selectOption({ index: 1 })
  await page
    .getByLabel('Mã loại công tác')
    .fill(`E2E_CUSTOM_${suffix.replace(/\W/g, '_').toUpperCase()}`)
  await page.getByLabel('Tên loại công tác').fill(customTypeName)
  await page.getByLabel('Kiểu đo').selectOption('line')
  await page.getByLabel('Đơn vị cơ sở').fill('m')
  await page.getByLabel('Mã quy tắc').fill('RULE-E2E-1')
  await page.getByLabel('Biểu thức').fill('length_m')
  await page.getByRole('button', { name: 'Lưu loại công tác' }).click()

  await page.getByRole('button', { name: 'Tạo hồ sơ' }).click()
  const caseName = `Hồ sơ E2E ${suffix}`
  await page.getByLabel('Mã hồ sơ').fill(`E2E-${suffix}`)
  await page.getByLabel('Tên hồ sơ').fill(caseName)
  await page.getByLabel('Địa bàn').selectOption({ index: 1 })
  await page.getByLabel('Từ ngày').fill('2026-07-01')
  await page.getByLabel('Đến ngày').fill('2026-07-31')
  await page.getByRole('button', { name: 'Lưu hồ sơ' }).click()

  await expect(page.getByRole('heading', { name: caseName })).toBeVisible()
  await page.getByLabel('Loại công tác').selectOption({ label: customTypeName })
  await page.getByLabel('Tên công tác').fill('Công tác E2E')
  await page.getByRole('button', { name: 'Thêm', exact: true }).click()

  await expect(page.getByText('Công tác E2E', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Mở bản đồ hiện trường' }).click()
  await expect(page.getByLabel('Bản đồ phép đo')).toBeVisible()
  await page.getByRole('button', { name: 'Tuyến' }).click()
  await page.getByLabel('Bản đồ phép đo').click({ position: { x: 330, y: 320 } })
  await page.getByLabel('Bản đồ phép đo').click({ position: { x: 390, y: 320 } })
  await page.getByRole('button', { name: 'Hoàn tác' }).click()
  await page.getByRole('button', { name: 'Làm lại' }).click()
  await page.getByRole('button', { name: 'Kết thúc' }).click()
  await page.getByLabel('Tên phép đo').fill('Tuyến đo E2E')
  await page.getByRole('button', { name: 'Lưu và tính máy chủ' }).click()
  await expect(page.getByText('Tuyến đo E2E', { exact: true }).first()).toBeVisible()
  await page.getByLabel('Bản đồ nền').selectOption('technical-dark')
  await expect(page.getByText('Nền: Kỹ thuật tối')).toBeVisible()
  await expect(page.getByText('Tuyến đo E2E', { exact: true }).first()).toBeVisible()
})
