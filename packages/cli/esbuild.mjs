//@ts-check
import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');
const minify = process.argv.includes('--minify');

const success = watch ? 'Watch build succeeded' : 'Build succeeded';

function getTime() {
    const date = new Date();
    return `[${`${padZeroes(date.getHours())}:${padZeroes(date.getMinutes())}:${padZeroes(date.getSeconds())}`}] `;
}

function padZeroes(i) {
    return i.toString().padStart(2, '0');
}

const plugins = [{
    name: 'watch-plugin',
    setup(build) {
        build.onEnd(result => {
            if (result.errors.length === 0) {
                console.log(getTime() + success);
            }
        });
    },
}]

const ctx = await esbuild.context({
    entryPoints: ['src/main.ts'],
    outdir: 'out',
    bundle: true,
    target: 'ES2022',
    format: 'esm',
    platform: 'node',
    banner: {
        // For compatibility with CJS dependencies
        js: [
            "import { createRequire } from 'node:module';",
            // Renaming to avoid possible conflicts
            "import { dirname as dirname2 } from 'node:path';",
            "import { fileURLToPath as fileUrlToPath2 } from 'node:url';",

            "const require = createRequire(import.meta.url);",
            "const __filename = fileURLToPath2(import.meta.url);",
            "const __dirname = dirname2(__filename);",
        ].join('\n'),
    },
    sourcemap: !minify,
    minify,
    plugins
});

if (watch) {
    await ctx.watch();
} else {
    await ctx.rebuild();
    ctx.dispose();
}
