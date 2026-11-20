import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {buildSkillLesson} from './build-lesson';

async function main() {
  const [manifest, output, flag, ...extra] = process.argv.slice(2);
  if (!manifest || !output || extra.length || (flag && flag !== '--teacher-reviewed')) {
    throw Error('用法 node build-lesson.cjs manifest.json 输出目录 [--teacher-reviewed]');
  }
  const input = JSON.parse((await readFile(manifest, 'utf8')).replace(/^\uFEFF/, ''));
  const result = await buildSkillLesson(input, path.dirname(path.resolve(manifest)), output, flag === '--teacher-reviewed');
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main().catch(error => {
  process.stderr.write((error instanceof Error ? error.message : String(error)) + '\n');
  process.exitCode = 1;
});
