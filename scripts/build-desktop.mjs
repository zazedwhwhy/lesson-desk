import {build} from 'esbuild';
const channel=process.env.LESSON_DESK_CHANNEL??'stable';
if(!['stable','beta'].includes(channel))throw Error('Unknown build channel: '+channel);
const beta=channel==='beta',directory=beta?'dist-desktop-beta':'dist-desktop';
const define={__NOTEBOOK_BETA__:JSON.stringify(beta)};
await build({entryPoints:['src/desktop/main.ts'],outfile:directory+'/main.cjs',bundle:true,platform:'node',format:'cjs',external:['electron','pdfjs-dist/*','@napi-rs/canvas'],target:'node22',define,minifySyntax:true});
await build({entryPoints:['src/desktop/preload.ts'],outfile:directory+'/preload.cjs',bundle:true,platform:'node',format:'cjs',external:['electron'],target:'node22',define,minifySyntax:true});
