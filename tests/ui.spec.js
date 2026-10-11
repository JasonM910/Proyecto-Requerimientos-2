import { expect, test } from '@playwright/test'

const runtimeErrors = new WeakMap()

test.beforeEach(({ page }) => {
  const errors = []
  runtimeErrors.set(page, errors)
  page.on('pageerror', (error) => errors.push(error.message))
})

test.afterEach(({ page }) => {
  expect(runtimeErrors.get(page), 'La página no debe producir errores de JavaScript').toEqual([])
})

async function loginAs(page, role) {
  await page.goto('/')
  await page.getByRole('button', { name: role, exact: true }).click()
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: role === 'Proveedor' ? /^Mis servicios/ : /^Mis solicitudes/, level: 1 })).toBeVisible()
}

async function logout(page) {
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await expect(page.getByRole('heading', { name: /^Iniciar sesión/ })).toBeVisible()
  const session = await page.request.get('/api/auth/session')
  expect((await session.json()).user).toBeNull()
}

async function expectNoHorizontalOverflow(page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), {
    message: 'El contenido debe caber dentro del ancho de la pantalla',
  }).toBe(true)
}

test('proveedor: publicar, editar y eliminar; guardar perfil y proteger contactos', async ({ page }) => {
  await loginAs(page, 'Proveedor')
  await page.getByRole('button', { name: 'Nuevo servicio', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'Nuevo servicio', exact: true })
  await expect(form).toBeVisible()
  await form.getByLabel('Título del servicio', { exact: false }).fill('Servicio de prueba E2E')
  await form.getByRole('combobox', { name: /Categoría/ }).click()
  await page.getByRole('option', { name: 'Plomería', exact: true }).click()
  await form.getByLabel('Descripción detallada', { exact: false }).fill('Revisión y reparación de tuberías para verificar el flujo completo de publicación.')
  await form.getByRole('button', { name: 'Publicar servicio', exact: true }).click()
  await expect(form).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Servicio de prueba E2E', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Editar Servicio de prueba E2E', exact: true }).click()
  const edit = page.getByRole('dialog', { name: 'Editar servicio', exact: true })
  await edit.getByLabel('Título del servicio', { exact: false }).fill('Servicio actualizado E2E')
  await edit.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
  await expect(edit).toBeHidden()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Servicio actualizado E2E', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Eliminar Servicio actualizado E2E', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Eliminar servicio', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Servicio actualizado E2E', exact: true })).toBeHidden()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Nuevo servicio', exact: true })).toBeEnabled()
  await expect(page.getByRole('heading', { name: 'Servicio actualizado E2E', exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: 'Mi perfil', exact: true }).click()
  await page.getByLabel('Especialidad', { exact: true }).fill('Especialidad verificada E2E')
  await page.getByLabel('Cuenta bancaria', { exact: true }).fill('Cuenta privada E2E')
  await expect(page.getByLabel('Vista pública del perfil')).not.toContainText('Cuenta privada E2E')
  await page.getByRole('button', { name: 'Guardar perfil', exact: true }).click()
  await expect(page.getByText('Perfil actualizado correctamente', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Mis servicios', exact: true }).click()
  await page.getByRole('button', { name: 'Mi perfil', exact: true }).click()
  await expect(page.getByLabel('Especialidad', { exact: true })).toHaveValue('Especialidad verificada E2E')
  await expect(page.getByLabel('Cuenta bancaria', { exact: true })).toHaveValue('Cuenta privada E2E')

  await page.getByRole('button', { name: 'Solicitudes recibidas', exact: true }).click()
  const pending = page.locator('[data-slot="card"]').filter({ has: page.getByRole('heading', { name: 'Reparación e instalación de tuberías', exact: true }) })
  const accepted = page.locator('[data-slot="card"]').filter({ has: page.getByRole('heading', { name: 'Limpieza profunda del hogar', exact: true }) })
  await expect(pending).toContainText('Datos de contacto protegidos')
  await expect(pending).not.toContainText('Correo:')
  await expect(accepted).toContainText('Datos de contacto disponibles')
  await expect(accepted).toContainText('Correo:')
  await logout(page)
})

test('cliente: historial, búsqueda y detalle accesible; validar y guardar perfil', async ({ page }) => {
  await loginAs(page, 'Cliente')
  await expect(page.getByRole('heading', { level: 2 })).toHaveText([
    'Reparación e instalación de tuberías',
    'Limpieza profunda del hogar',
    'Mantenimiento de jardines',
  ])
  await expect(page.getByText('Pendiente', { exact: true })).toBeVisible()
  await expect(page.getByText('Aceptado', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Nuevo servicio', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Buscar servicios', exact: true }).click()
  await page.getByRole('button', { name: 'Carpintería', exact: true }).click()
  await expect(page.getByText('2 servicios encontrados', { exact: true })).toBeVisible()
  await page.getByRole('combobox', { name: 'Filtrar por zona de atención', exact: true }).click()
  await page.getByRole('option', { name: 'Florencia', exact: true }).click()
  await page.getByRole('searchbox', { name: 'Buscar servicios', exact: true }).fill('closets')
  await expect(page.getByText('1 servicio encontrado', { exact: true })).toBeVisible()
  const detailButton = page.getByRole('button', { name: 'Ver detalles', exact: true })
  await detailButton.click()
  const detail = page.getByRole('dialog', { name: 'Instalación de puertas y closets', exact: true })
  await expect(detail).toBeVisible()
  await expect(detail).toContainText('Andrés Solís')
  await expect(detail).toContainText('15 años de experiencia')
  await expect(detail).not.toContainText('andres@ejemplo.com')
  await expect(detail).not.toContainText('Cuenta privada E2E')
  await page.keyboard.press('Escape')
  await expect(detail).toBeHidden()
  await expect(detailButton).toBeFocused()
  await page.getByRole('button', { name: 'Limpiar', exact: true }).click()
  await expect(page.getByRole('searchbox', { name: 'Buscar servicios', exact: true })).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Todas', exact: true })).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: 'Mi perfil', exact: true }).click()
  const phone = page.getByLabel('Teléfono de contacto', { exact: false })
  await phone.fill('12')
  await phone.blur()
  await expect(phone).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Escribe al menos 8 dígitos.', { exact: true })).toBeVisible()
  await phone.fill('8888 5678')
  await expect(phone).toHaveAttribute('aria-invalid', 'false')
  const email = page.getByLabel('Correo de contacto', { exact: false })
  await email.fill('sin-correo')
  await email.blur()
  await expect(page.getByText('Escribe un correo válido.', { exact: true })).toBeVisible()
  await email.fill('cliente.e2e@ejemplo.com')
  await page.getByLabel('Dirección o punto de referencia', { exact: false }).fill('Quesada, casa de prueba E2E')
  await page.getByRole('button', { name: 'Guardar perfil', exact: true }).click()
  await expect(page.getByText('Perfil actualizado correctamente', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Mis solicitudes', exact: true }).click()
  await page.getByRole('button', { name: 'Mi perfil', exact: true }).click()
  await expect(page.getByLabel('Correo de contacto', { exact: false })).toHaveValue('cliente.e2e@ejemplo.com')
  await expect(page.getByLabel('Teléfono de contacto', { exact: false })).toHaveValue('8888 5678')
  await logout(page)
})

test('móvil: acceso, navegación de ambos roles y diálogos sin desborde horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /^Iniciar sesión/ })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await loginAs(page, 'Proveedor')
  await expectNoHorizontalOverflow(page)
  await page.getByRole('button', { name: 'Nuevo servicio', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Nuevo servicio', exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Mi perfil', exact: true }).click()
  await expect(page.getByLabel('Nombre o negocio', { exact: false })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await logout(page)

  await loginAs(page, 'Cliente')
  await expectNoHorizontalOverflow(page)
  await page.getByRole('button', { name: 'Buscar servicios', exact: true }).click()
  await page.getByRole('button', { name: 'Ver detalles', exact: true }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await expectNoHorizontalOverflow(page)
  await logout(page)
})
