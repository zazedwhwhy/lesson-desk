import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
const dir=path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const input=`import React from 'react'; import * as ReactDOM from 'react-dom'; import {createRoot} from 'react-dom/client';\n${fs.readFileSync(path.join(dir,'animations-v3.jsx'),'utf8')}\n${fs.readFileSync(path.join(dir,'tweaks-panel.jsx'),'utf8')}\n${fs.readFileSync(path.join(dir,'film.jsx'),'utf8')}`;
await build({stdin:{contents:input,loader:'jsx',resolveDir:dir},bundle:true,minify:true,define:{'process.env.NODE_ENV':'"production"'},outfile:path.join(dir,'bundle.js')});
console.log('Film bundle built');
