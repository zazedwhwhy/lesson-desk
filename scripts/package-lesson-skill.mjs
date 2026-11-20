import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {strToU8, zipSync} from 'fflate';

const root = fileURLToPath(new URL('../', import.meta.url));
const name = 'lesson-desk-export';
const skill = path.join(root, 'skills', name);
const out = path.resolve(process.argv[2] ?? path.join(root, 'release', 'skills'));
const runtime = await build({
  absWorkingDir: root,
  entryPoints: [path.join(skill, 'tool', 'cli.ts')],
  platform: 'node', target: 'node22', format: 'cjs', bundle: true, write: false, metafile: true,
  plugins: [{name: 'lazy-canvas', setup(context) {
    context.onResolve({filter: /^@napi-rs\/canvas$/}, () => ({path: 'canvas', namespace: 'optional-native'}));
    context.onLoad({filter: /^canvas$/, namespace: 'optional-native'}, () => ({contents: `
      import {createRequire} from 'node:module';
      import path from 'node:path';
      const requireFromWorkdir = createRequire(path.join(process.cwd(), 'lesson-desk-runtime.cjs'));
      let canvas;
      function loadCanvas() {
        if (canvas) return canvas;
        try { canvas = requireFromWorkdir('@napi-rs/canvas'); }
        catch (error) { throw new Error('公式 PNG 预览需要 @napi-rs/canvas@1.1.0，请在当前工作目录安装后重试', {cause:error}); }
        return canvas;
      }
      export const createCanvas = (...args) => loadCanvas().createCanvas(...args);
      export const loadImage = (...args) => loadCanvas().loadImage(...args);
    `}));
  }}],
});

const files = {[`${name}/scripts/build-lesson.cjs`]: runtime.outputFiles[0].contents};
for (const relative of ['SKILL.md', 'references/manifest.md', 'references/teaching.md']) {
  files[`${name}/${relative}`] = await readFile(path.join(skill, relative));
}
files[`${name}/licenses/lesson-desk.txt`] = await readFile(path.join(root, 'LICENSE'));
for (const file of ['MathJax-LICENSE.txt', 'mhchemparser-LICENSE.txt']) {
  files[`${name}/licenses/${file}`] = await readFile(path.join(root, 'assets', 'licenses', file));
}

const dependencyRoots = new Set(Object.keys(runtime.metafile.inputs).flatMap(file => {
  const match = file.match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//);
  return match ? [match[1]] : [];
}));
for (const directory of dependencyRoots) {
  const location = path.join(root, directory);
  const info = JSON.parse(await readFile(path.join(location, 'package.json'), 'utf8'));
  const prefix = `${name}/licenses/${info.name.replace(/[^a-z0-9-]/gi, '_')}-${info.version}`;
  const notices = (await readdir(location, {withFileTypes:true})).filter(entry => entry.isFile() && /^(licen[cs]e|notice|copying)([.-]|$)/i.test(entry.name));
  for (const notice of notices) files[`${prefix}/${notice.name}`] = await readFile(path.join(location, notice.name));
  files[`${prefix}/package.txt`] = strToU8(`${info.name} ${info.version}\n${info.license || ''}\n`);
}

await mkdir(out, {recursive: true});
const target = path.join(out, `${name}-v0.1.0.zip`);
await writeFile(target, zipSync(files, {level: 6}));
process.stdout.write(target + '\n');
