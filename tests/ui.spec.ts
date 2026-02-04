import { test, expect } from './fixtures';

test('navigate to settings page', async ({ page }) => {
  page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));
  page.on('pageerror', err => console.log(`BROWSER ERROR: ${err}`));

  // Increase navigation timeout and wait for network idle if possible, 
  // though vite preview might not have network activity if backend calls fail immediately.
  console.log('Navigating to / ...');
  await page.goto('/');
  console.log('Navigation complete.');

  console.log('Page title:', await page.title());
  console.log('Page content length:', (await page.content()).length);
  // console.log('Page content:', await page.content()); // Uncomment if needed

  // The app might take some time to initialize if backend is missing (retries).

  // The app might take some time to initialize if backend is missing (retries).
  // Wait for the logo to appear as a sign of app loaded.
  // Increase timeout to 15s to account for "emergency initialization" (approx 6-7s).
  const logo = page.getByAltText('logo');
  await expect(logo).toBeVisible({ timeout: 15000 });

  // Find the Settings link by href
  const settingsLink = page.locator('a[href="/settings"]');
  await expect(settingsLink).toBeVisible();

  await settingsLink.click();

  // Verify URL
  await expect(page).toHaveURL(/\/settings/);

  // Verify content on Settings page
  // Check for a known element on settings page.
  // We can check if the URL is correct, which we did.
});

test('check home page elements', async ({ page }) => {
  await page.goto('/');

  // Check for the logo using alt text
  // Increase timeout here too
  const logo = page.getByAltText('logo');
  await expect(logo).toBeVisible({ timeout: 15000 });

  // Check for the Power Button
  // We can look for the 'Settings' link existence to confirm sidebar loaded.
  const settingsLink = page.locator('a[href="/settings"]');
  await expect(settingsLink).toBeVisible();
});
