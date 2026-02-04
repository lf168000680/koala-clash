import os from 'os'
import path from 'path'
import { spawn, spawnSync, ChildProcess } from 'child_process'

// keep track of the `tauri-driver` process
let tauriDriver: ChildProcess | undefined

export const config = {
    //
    // ====================
    // Runner Configuration
    // ====================
    //
    // WebdriverIO allows it to run your tests in arbitrary locations (e.g. locally or
    // on a remote machine).
    runner: 'local',
    hostname: '127.0.0.1',
    port: 4444,
    path: '/',

    //
    // ==================
    // Specify Test Files
    // ==================
    // Define which test specs should run. The pattern is relative to the directory
    // from which `wdio` was called.
    //
    specs: [
        './tests/e2e/**/*.test.ts'
    ],
    // Patterns to exclude.
    exclude: [
        // 'path/to/excluded/files'
    ],

    //
    // ============
    // Capabilities
    // ============
    // Define your capabilities here. WebdriverIO can run multiple capabilities at the same
    // time. Depending on the number of capabilities, WebdriverIO launches several test
    // sessions. Within your capabilities you can overwrite the spec and exclude options in
    // order to group specific specs to a specific capability.
    //
    maxInstances: 1,
    capabilities: [{
        maxInstances: 1,
        'tauri:options': {
            application: 'src-tauri/target/debug/koala-clash.exe',
        },
    }],

    //
    // ===================
    // Test Configurations
    // ===================
    // Define all options that are relevant for the WebdriverIO instance here
    //
    outputDir: './wdio-logs',
    logLevel: 'debug',
    bail: 0,
    waitforTimeout: 10000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,
    framework: 'mocha',
    reporters: ['spec'],
    mochaOpts: {
        ui: 'bdd',
        timeout: 60000
    },

    //
    // =====
    // Hooks
    // =====
    // WebdriverIO provides several hooks you can use to interfere with the test process in order to enhance
    // it and to build services around it. You can either apply a single function or an array of
    // methods to it. If one of them returns with a promise, WebdriverIO will wait until that promise got
    // resolved to continue.

    onPrepare: async function () {
        // Start tauri-driver
        console.log('Starting tauri-driver...')
        tauriDriver = spawn(
            path.resolve(os.homedir(), '.cargo', 'bin', 'tauri-driver'),
            ['--native-driver', 'C:\\Users\\Administrator\\.cache\\selenium\\msedgedriver\\win64\\143.0.3650.139\\msedgedriver.exe'],
            { stdio: [null, process.stdout, process.stderr] }
        )
        await new Promise(resolve => setTimeout(resolve, 3000))
    },

    onComplete: function () {
        // Kill tauri-driver
        if (tauriDriver) {
            console.log('Stopping tauri-driver...')
            tauriDriver.kill()
        }
    }
}
