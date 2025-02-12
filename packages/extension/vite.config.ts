import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import webExtension from 'vite-plugin-web-extension';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, copyFileSync, readdirSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure dist directory exists
if (!existsSync('dist')) {
    mkdirSync('dist');
}

// Copy icon file to dist if it exists
if (existsSync('icon.svg')) {
    copyFileSync('icon.svg', 'dist/icon.svg');
}

// Copy assets directory if it exists
if (existsSync('assets')) {
    if (!existsSync('dist/assets')) {
        mkdirSync('dist/assets');
    }
    const assetFiles = readdirSync('assets');
    for (const file of assetFiles) {
        if (file.endsWith('.png')) {
            copyFileSync(`assets/${file}`, `dist/assets/${file}`);
        }
    }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    // Load env file based on `mode` in the current working directory.
    // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
    const env = loadEnv(mode, process.cwd(), '');

    console.log('Loaded environment variables:', {
        NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
        // Log just the existence of the key, not the value for security
        NEXT_PUBLIC_SUPABASE_ANON_KEY: !!env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    });

    return {
        plugins: [
            react(),
            webExtension({
                manifest: path.resolve(__dirname, 'manifest.json'),
                assets: 'assets',
                watchFilePaths: ['manifest.json', 'icon.svg', 'assets/*'],
                browser: 'chrome',
                webExtConfig: {
                    port: 5173,
                    reloadOnChange: true,
                }
            })
        ],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            }
        },
        define: {
            'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(env.NEXT_PUBLIC_SUPABASE_URL),
            'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
        },
        build: {
            outDir: 'dist',
            emptyOutDir: true,
            sourcemap: true,
            rollupOptions: {
                output: {
                    entryFileNames: '[name]/[name].js',
                    chunkFileNames: 'assets/[name].[hash].js',
                    assetFileNames: 'assets/[name].[ext]'
                }
            },
        },
        server: {
            port: 5173,
            hmr: true
        }
    };
});