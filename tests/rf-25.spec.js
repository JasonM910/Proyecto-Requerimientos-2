import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { expect, test } from '@playwright/test'

async function openAssistant(page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Cliente', exact: true }).click()
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.getByRole('button', { name: 'Buscar servicios', exact: true }).click()
  await page.getByRole('button', { name: 'Ayúdame a elegir' }).click()
  return page.getByRole('dialog', { name: 'Te ayudamos a encontrar el servicio' })
}

test('RF-25: el asistente recomienda categoría y prepara una solicitud editable', async ({ page }) => {
  const assistant = await openAssistant(page)
  await assistant.getByRole('button', { name: 'Cocina o baño' }).click()
  await assistant.getByRole('button', { name: /Tuberías o grifos/ }).click()
  await assistant.getByLabel('Describe el problema').fill('Hay una fuga bajo el fregadero para la prueba guiada RF25.')
  await assistant.getByLabel('¿Qué resultado esperas?').fill('Reparar la fuga y revisar las conexiones')
  await assistant.getByRole('combobox', { name: '¿Qué tan pronto necesitas ayuda?' }).click()
  await page.getByRole('option', { name: 'Urgente' }).click()
  await assistant.getByRole('button', { name: 'Preparar sugerencia' }).click()
  await expect(assistant).toContainText('Categoría recomendada')
  await expect(assistant).toContainText('Plomería')
  await expect(assistant.getByLabel('Descripción para tu solicitud')).toHaveValue(/prueba guiada RF25/)

  const captures = resolve('test-results', 'capturas')
  await mkdir(captures, { recursive: true })
  await page.screenshot({ path: join(captures, '14-asistente-guiado.png'), animations: 'disabled' })

  await assistant.getByRole('button', { name: 'Ver servicios recomendados' }).click()
  await expect(assistant).toBeHidden()
  await expect(page.getByRole('group', { name: 'Filtrar por categoría' }).getByRole('button', { name: 'Plomería' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Ver detalles' }).first().click()
  const detail = page.getByRole('dialog')
  await detail.getByRole('button', { name: 'Solicitar servicio' }).click()
  const form = page.getByRole('dialog', { name: 'Solicitar servicio' })
  await expect(form.getByLabel('¿Qué trabajo necesitas?', { exact: false })).toHaveValue(/prueba guiada RF25/)
  await expect(form.getByRole('combobox', { name: /Urgencia/ })).toContainText('Urgente')
  await form.getByRole('button', { name: 'Enviar solicitud' }).click()
  await expect(page.getByRole('heading', { name: 'Mis solicitudes', level: 1 })).toBeVisible()
  const requests = await (await page.request.get('/api/client/requests')).json()
  expect(requests.requests.some((item) => item.need.includes('prueba guiada RF25') && item.urgency === 'Urgente')).toBe(true)
})

test('RF-25: permite volver, valida detalles y se reinicia al cerrar en móvil', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const assistant = await openAssistant(page)
  await assistant.getByRole('button', { name: 'Jardín o exteriores' }).click()
  await expect(assistant).toContainText('Plantas o césped')
  await assistant.getByRole('button', { name: 'Volver' }).click()
  await assistant.getByRole('button', { name: 'Habitaciones' }).click()
  await assistant.getByRole('button', { name: /Puertas o muebles/ }).click()
  await assistant.getByLabel('Describe el problema').fill('          ')
  await assistant.getByRole('button', { name: 'Preparar sugerencia' }).click()
  await expect(assistant.getByRole('alert')).toContainText('al menos 10 caracteres')
  await page.keyboard.press('Escape')
  await expect(assistant).toBeHidden()
  await page.getByRole('button', { name: 'Ayúdame a elegir' }).click()
  await expect(assistant).toContainText('Paso 1 de 4')
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
})
