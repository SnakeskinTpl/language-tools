import { defineConfig, UserConfig } from 'vite';
import * as path from 'path';

export default defineConfig(() => {
    const config: UserConfig = {
        build: {
            target: 'esnext',
            rollupOptions: {
                input: {
                    index: path.resolve(__dirname, 'index.html'),
                    monacoClassic: path.resolve(__dirname, 'static/monacoClassic.html'),
                    monacoExtended: path.resolve(__dirname, 'static/monacoExtended.html'),
                }
            }
        },
        resolve: {
            dedupe: ['vscode']
        },
        server: {
            port: 5173
        }
    };
    return config;
});
