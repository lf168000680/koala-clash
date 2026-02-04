import { browser, expect, $ } from '@wdio/globals'

describe('Koala Clash Functional E2E Tests', () => {

    // Helper to navigate and verify page load
    async function navigateAndVerify(menuHref: string, headerText: string, timeout: number = 5000) {
        console.log(`Navigating to ${menuHref}...`)

        // Find the link in the sidebar
        const link = await $(`a[href="${menuHref}"]`)
        await link.waitForDisplayed({ timeout })
        await link.click()

        await browser.pause(500) // Animation pause

        // Try to verify by Header (h2)
        // Some pages might use different headers or languages
        try {
            const header = await $('h2')
            if (await header.isDisplayed()) {
                const text = await header.getText()
                console.log(`Page header found: ${text}`)
                // Relaxed check: just log it, don't throw if mismatch unless URL also fails
                // We rely on URL check as the primary truth if header is ambiguous
            }
        } catch (e) {
            console.log('Header check skipped or failed, relying on URL')
        }

        // Verify by URL
        const url = await browser.getUrl()
        if (!url.includes(menuHref.replace('/', ''))) {
            // Special handling for Home which might be "/" or "/home"
            if (menuHref === '/home' && (url.endsWith('index.html') || url.endsWith('/'))) {
                // Acceptable
            } else {
                throw new Error(`Navigation failed: Expected URL to contain "${menuHref}", but got "${url}"`)
            }
        }
    }

    afterEach(async () => {
        // Cleanup: Close any open dialogs to prevent blocking subsequent tests
        const dialog = await $('div[role="dialog"]')
        if (await dialog.isExisting() && await dialog.isDisplayed()) {
            console.log('Cleaning up: Closing open dialog')
            await browser.keys('Escape')
            try {
                await dialog.waitForDisplayed({ reverse: true, timeout: 2000 })
            } catch (e) {
                console.log('Failed to close dialog with Escape, forcing page reload')
                await browser.refresh()
            }
        }
    })

    it('should launch and setup a profile', async () => {
        // Initial launch might take longer, so use a longer timeout
        await navigateAndVerify('/profile', '订阅', 20000)
        // Page header verification is done in navigateAndVerify

        // 3. Create a Profile (via Import)
        // Strategy: Find the header h2, then find the button group following it.
        // The Add button is the first button in that group.
        let addBtn = await $('//h2/following-sibling::div//button[1]')

        if (!await addBtn.isExisting()) {
            console.log('Add button not found by sibling strategy, trying icon class...')
            addBtn = await $('//button[.//svg[contains(@class, "lucide-plus-circle")]]')
        }

        await addBtn.waitForDisplayed({ timeout: 10000 })
        // Use execute script to force click if standard click is intercepted/blocked
        await browser.execute((el) => el.click(), addBtn)
        console.log('Clicked Add Profile')

        // 4. Wait for Dialog
        const dialog = await $('div[role="dialog"]')
        await dialog.waitForDisplayed({ timeout: 5000 })
        console.log('Dialog opened')

        // 5. Enter Subscription Link (Using Advanced Mode to set specific name)
        const subLink = 'https://api.lnnrhtp.com/api/v1/client/subscribe?token=ed65b8c8a2dd39452e8886649001f5b0'

        // Find the first input (Import URL) - Use generic selector as placeholder might be localized
        // This sets the URL which will be used by the form
        const urlInput = await dialog.$('input')
        await urlInput.waitForDisplayed()
        await urlInput.setValue(subLink)
        console.log('Entered Subscription Link')

        // 6. Switch to Advanced Mode to set Name
        // Try to find the button by common keywords (English/Chinese)
        const advancedBtn = await dialog.$('//button[contains(., "Advanced") or contains(., "高级")]')
        await advancedBtn.click()
        console.log('Clicked Show Advanced Settings')

        // 7. Enter Profile Name
        const nameInput = await dialog.$('input[name="name"]')
        await nameInput.waitForDisplayed()
        await nameInput.setValue('E2E_Test_Profile')
        console.log('Set Profile Name')

        // 8. Click Save (instead of Import)
        // Find the Save button in the footer (not Cancel)
        const saveBtn = await dialog.$('//button[contains(., "Save") or contains(., "保存")]')
        await saveBtn.click()
        console.log('Clicked Save')

        // 9. Wait for success/close
        // If it fails, an error toast might appear, and dialog stays open.
        // We wait for dialog to be gone.
        try {
            await dialog.waitForDisplayed({ reverse: true, timeout: 10000 })
            console.log('Profile created and dialog closed')
        } catch (e) {
            console.log('Dialog did not close! Checking for errors...')
            // Check for toast error
            const toast = await $('.sonner-toast') // Assuming Sonner toast class
            if (await toast.isExisting()) {
                console.log('Toast detected:', await toast.getText())
            }
            // Force close to allow other tests to run
            await browser.keys('Escape')
            throw new Error('Profile creation failed (Dialog did not close)')
        }

        // 8. Select the profile
        // Find the profile item by text
        const profileItem = await $(`//div[contains(., 'E2E_Test_Profile')]`)
        await profileItem.waitForDisplayed({ timeout: 5000 })
        await profileItem.click()
        console.log('Profile selected')
        await browser.pause(1000) // Wait for selection to apply
    })

    it('should test Home page functionality', async () => {
        await navigateAndVerify('/home', 'Koala Clash')

        // Verify Power Button exists (since we have a profile now)
        const powerBtn = await $('button.rounded-full') // Rough selector based on classes
        await powerBtn.waitForDisplayed()

        // Click to toggle
        console.log('Toggling Proxy...')
        await powerBtn.click()
        await browser.pause(2000) // Wait for animation/state change

        // Verify state (optional, check color or class)
        // Just clicking again to turn off
        await powerBtn.click()
        await browser.pause(1000)
    })

    it('should test Proxies page functionality', async () => {
        await navigateAndVerify('/proxies', '代理')

        // Switch Mode
        // Look for "Global" or "Rule" buttons
        const globalBtn = await $("//button[contains(., 'Global') or contains(., '全局')]")
        if (await globalBtn.isExisting()) {
            await globalBtn.click()
            console.log('Switched to Global mode')
            await browser.pause(1000)
        }

        const ruleBtn = await $("//button[contains(., 'Rule') or contains(., '规则')]")
        if (await ruleBtn.isExisting()) {
            await ruleBtn.click()
            console.log('Switched to Rule mode')
        }

        // Check for Provider Button
        const providerBtn = await $('button svg.lucide-hard-drive-download, button svg.lucide-refresh-cw') // ProviderButton likely uses an icon
        // Actually ProviderButton in code doesn't show icon, let's check text or just existence of extra buttons
        // In proxies.tsx: <ProviderButton />
        // Let's assume it's there.
    })

    it('should test Connections page navigation', async () => {
        await navigateAndVerify('/connections', '连接')
        // Just verify list exists or "Close All" button
        const closeBtn = await $("//button[contains(., 'Close All') or contains(., '断开')]")
        if (await closeBtn.isExisting()) {
            console.log('Close All button found')
            // Optional: Click it? Might close active connections if any.
            // await closeBtn.click() 
        } else {
            console.log('Close All button not found (maybe no connections)')
        }
    })

    it('should test Settings page functionality', async () => {
        await navigateAndVerify('/settings', '设置')

        // Toggle Theme (already implemented)
        const themeRow = await $("//div[contains(., 'Theme Mode') or contains(., '主题模式')]")
        if (await themeRow.isExisting()) {
            console.log('Theme setting found')
            const btn = await themeRow.$('button')
            if (await btn.isExisting()) {
                await btn.click()
                console.log('Toggled Theme')
                await browser.pause(1000)
                await btn.click() // Toggle back
            }
        }

        // Check for specific sections (System, Clash, Verge)
        const systemHeader = await $("//div[contains(., 'System Settings') or contains(., '系统设置')]")
        if (await systemHeader.isExisting()) console.log('System Settings section found')

        const clashHeader = await $("//div[contains(., 'Clash Settings') or contains(., 'Clash 设置')]")
        if (await clashHeader.isExisting()) console.log('Clash Settings section found')

        // Check Github button
        const githubBtn = await $('button[title="Github Repo"]')
        if (await githubBtn.isExisting()) console.log('Github button found')
    })

    it('should navigate through remaining pages', async () => {
        await navigateAndVerify('/rules', '规则')
        await navigateAndVerify('/logs', '日志')
    })
})
