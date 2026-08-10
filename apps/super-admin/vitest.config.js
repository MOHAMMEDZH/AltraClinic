import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({
    test: {
        environment: 'jsdom',
        exclude: ['**/node_modules/**', '**/dist/**'],
        // Auth and page suites stub global `fetch`. Parallel file workers race those
        // stubs and leave routes stuck on loading (e.g. Platform user detail).
        fileParallelism: false,
        maxWorkers: 1,
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
});
