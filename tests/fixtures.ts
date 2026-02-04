import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    // Mock Tauri IPC
    await page.addInitScript(() => {
      // Mock for Tauri v2
      (window as any).__TAURI_INTERNALS__ = {
        invoke: async (cmd: string, args: any) => {
          console.log(`[MockTauri] Invoke: ${cmd}`, args);
          
          if (cmd === 'get_clash_info') {
            return { server: '127.0.0.1:9090', secret: 'test-secret' };
          }
          if (cmd === 'get_profiles') {
            return { items: [] };
          }
          if (cmd === 'get_verge_config') {
            return { language: 'en', theme: 'light' };
          }
          if (cmd === 'get_runtime_config') {
             return {};
          }
          if (cmd === 'get_runtime_exists') {
            return [];
          }
          
          return null;
        },
        metadata: {}
      };
      
      // Mock for Tauri v1 compatibility or direct usage
      (window as any).__TAURI__ = {
        invoke: (window as any).__TAURI_INTERNALS__.invoke
      };
    });

    // Mock Clash API Network Requests
    await page.route('http://127.0.0.1:9090/**', async route => {
      const url = route.request().url();
      console.log(`[MockNetwork] ${url}`);
      
      const headers = { 'Access-Control-Allow-Origin': '*' };

      if (url.includes('/version')) {
        return route.fulfill({
          status: 200,
          headers,
          contentType: 'application/json',
          body: JSON.stringify({ version: 'v1.18.0', premium: true, meta: true })
        });
      }
      
      if (url.includes('/proxies')) {
        return route.fulfill({
          status: 200,
          headers,
          contentType: 'application/json',
          body: JSON.stringify({ proxies: {
            'GLOBAL': { name: 'GLOBAL', type: 'Selector', now: 'DIRECT', all: ['DIRECT', 'Proxy'] },
            'DIRECT': { name: 'DIRECT', type: 'Direct', udp: true, xudp: true },
          }})
        });
      }
      
      if (url.includes('/configs')) {
        return route.fulfill({
          status: 200,
          headers,
          contentType: 'application/json',
          body: JSON.stringify({ port: 7890, 'socks-port': 7891, mode: 'rule' })
        });
      }

      if (url.includes('/rules')) {
        return route.fulfill({
          status: 200,
          headers,
          contentType: 'application/json',
          body: JSON.stringify({ rules: [] })
        });
      }

      // Default fallback
      return route.fulfill({
        status: 200,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({})
      });
    });

    await use(page);
  },
});

export { expect };
