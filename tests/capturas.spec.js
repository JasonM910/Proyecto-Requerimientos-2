import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { expect, test } from '@playwright/test'

test('capturas de los recorridos principales', async ({ page }) => {
  const directory = resolve('test-results', 'capturas')
  await mkdir(directory, { recursive: true })

  async function capture(name) {
    await page.screenshot({ path: join(directory, name), animations: 'disabled' })
  }

  async function login(account, heading) {
    await page.getByRole('button', { name: account, exact: true }).click()
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
  }

  async function logout() {
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
    await expect(page.getByRole('heading', { name: /^Iniciar sesión/ })).toBeVisible()
  }

  await page.goto('/')
  await expect(page.getByRole('heading', { name: /^Iniciar sesión/ })).toBeVisible()
  await capture('01-inicio-sesion.png')

  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByText('Escribe tu correo o nombre de usuario.')).toBeVisible()
  await expect(page.getByText('Escribe tu contraseña.')).toBeVisible()
  await capture('02-validacion-inicio-sesion.png')

  await login('Proveedor', 'Mis servicios')
  await capture('03-servicios-proveedor.png')
  await page.getByRole('navigation', { name: 'Navegación del proveedor' }).getByRole('button', { name: 'Seguridad y confianza' }).click()
  await expect(page.getByRole('heading', { name: 'Seguridad y confianza', level: 1 })).toBeVisible()
  await expect(page.getByText('Verificación de proveedor', { exact: true })).toBeVisible()
  await capture('04-seguridad-proveedor.png')
  await logout()

  await login('Cliente', 'Mis solicitudes')
  await capture('05-solicitudes-cliente.png')
  await page.getByRole('navigation', { name: 'Navegación del cliente' }).getByRole('button', { name: 'Buscar servicios' }).click()
  await expect(page.getByRole('heading', { name: 'Buscar servicios', level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ver detalles' }).first()).toBeVisible()
  await capture('06-busqueda-servicios.png')
  await page.getByRole('button', { name: 'Ver detalles' }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await capture('07-detalle-servicio.png')
  await page.keyboard.press('Escape')
  await logout()

  await login('Equipo Hogar+', 'Reportes recibidos')
  await expect(page.getByRole('button', { name: 'Iniciar revisión' }).first()).toBeVisible()
  await capture('08-reportes-equipo.png')
  await page.getByRole('navigation', { name: 'Navegación del equipo' }).getByRole('button', { name: 'Verificar proveedores' }).click()
  await expect(page.getByRole('heading', { name: 'Verificar proveedores', level: 1 })).toBeVisible()
  await capture('09-verificaciones-equipo.png')
  await logout()

  await page.setViewportSize({ width: 390, height: 844 })
  await capture('10-inicio-sesion-movil.png')
})
