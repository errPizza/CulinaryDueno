import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: 'tests',
    timeout: 30_000,
    use: { baseURL: 'http://127.0.0.1:5190', channel: 'msedge' },
    // One build with the address fixed, as the provider ships it, and one that has to ask for it.
    webServer: [
        { command: 'npm run dev', url: 'http://127.0.0.1:5190', reuseExistingServer: true, timeout: 60_000, env: { VITE_SERVER_URL: 'https://servidor.test' } },
        { command: 'npx vite --host 127.0.0.1 --port 5191 --strictPort', url: 'http://127.0.0.1:5191', reuseExistingServer: true, timeout: 60_000, env: { VITE_SERVER_URL: '' } }
    ],
});
