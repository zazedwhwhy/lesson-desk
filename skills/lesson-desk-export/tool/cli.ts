import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {promptCatalog} from '../../../src/core/prompt-catalog';
import {buildSkillLesson} from './build-lesson';
import {manifestSchema} from './lesson-project';

async function main() {
  const [manifest, output, ...flags] = process.argv.slice(2);
  if (manifest === '--reference' && !flags.length && (output === 'manifest' || output === 'prompts')) {
    const reference = output === 'manifest' ? z.toJSONSchema(manifestSchema, {io: 'input', override: ({jsonSchema}) => {
      if (jsonSchema.type === 'object' && jsonSchema.properties) jsonSchema.additionalProperties = false;
    }}) : promptCatalog();
    process.stdout.write(JSON.stringify(reference, null, 2) + '\n');
    return;
  }
  if (!manifest || manifest.startsWith('--') || !output || output.startsWith('--') || new Set(flags).size !== flags.length
      || flags.some(flag => flag !== '--teacher-reviewed' && flag !== '--bundle-only')) {
    throw Error('用法 node build-lesson.cjs manifest.json 输出目录 [--teacher-reviewed] [--bundle-only]\n或 node build-lesson.cjs --reference manifest|prompts');
  }
  const input = JSON.parse((await readFile(manifest, 'utf8')).replace(/^\uFEFF/, ''));
  const result = await buildSkillLesson(input, path.dirname(path.resolve(manifest)), output, flags.includes('--teacher-reviewed'), flags.includes('--bundle-only'));
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main().catch(error => {
  process.stderr.write((error instanceof Error ? error.message : String(error)) + '\n');
  process.exitCode = 1;
});
