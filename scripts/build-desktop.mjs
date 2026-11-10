import {build} from 'esbuild';
await build({entryPoints:['src/desktop/main.ts'],outfile:'dist-desktop/main.cjs',bundle:true,platform:'node',format:'cjs',external:['electron','pdfjs-dist/*','@napi-rs/canvas'],target:'node22'});
await build({entryPoints:['src/desktop/preload.ts'],outfile:'dist-desktop/preload.cjs',bundle:true,platform:'node',format:'cjs',external:['electron'],target:'node22'});
