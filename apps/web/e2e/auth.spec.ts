import { test, expect } from '@playwright/test';

// Smoke del flujo de acceso del club. Aserciones DOM estables
// (roles y textos propios en voseo), sin sleeps: Playwright
// reintenta los expects hasta el timeout por defecto.
test.describe('Acceso a Tenis Ranch Club', () => {
  test('la home muestra la marca del club', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Tenis Ranch Club' }),
    ).toBeVisible();
  });

  test('/ingresar muestra el login en español', async ({ page }) => {
    await page.goto('/ingresar');
    // La bienvenida larga se oculta en mobile por diseño (foco en entrar).
    const bienvenida = page.getByRole('heading', {
      name: 'Bienvenido a Tenis Ranch Club',
    });
    if ((page.viewportSize()?.width ?? 1280) < 880) {
      await expect(bienvenida).toBeHidden();
    } else {
      await expect(bienvenida).toBeVisible();
    }
    // Título del widget de Clerk, ya localizado al rioplatense.
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  });

  test('/registro muestra el registro en español', async ({ page }) => {
    await page.goto('/registro');
    await expect(
      page.getByRole('heading', { name: 'Creá tu cuenta' }).first(),
    ).toBeVisible();
    await expect(
      page.getByText('¿Ya tenés una cuenta?').first(),
    ).toBeVisible();
  });
});
