import { test, expect } from './fixtures';

test.describe('Visual Regression Tests', () => {
  test('home page visual check', async ({ page }) => {
    await page.goto('/');
    
    // Wait for the logo to be visible to ensure page is loaded
    const logo = page.getByAltText('logo');
    await expect(logo).toBeVisible({ timeout: 15000 });

    // Compare the full page screenshot
    await expect(page).toHaveScreenshot('home-page.png', {
      fullPage: true,
      // Masking dynamic elements if any (example)
      // mask: [page.locator('.dynamic-content')] 
    });
  });

  test('logo visual check', async ({ page }) => {
    await page.goto('/');
    const logo = page.getByAltText('logo');
    await expect(logo).toBeVisible({ timeout: 15000 });
    
    // Compare element screenshot
    await expect(logo).toHaveScreenshot('logo.png');
  });
});
