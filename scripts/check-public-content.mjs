import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

// Report file and line only; never echo a suspected credential into a CI log.
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const forbidden=/^(?:node_modules|\.tools|\.impeccable|\.superpowers|dist|dist-desktop|release|test-results|data|projects|sources)\/|(?:^|\/)(?:settings|auth|project|prompts)\.json$|(?:^|\/)\.env(?:\..*)?$|\.(?:pem|key|p12|pfx|pdf|docx|pptx|potx|lesson\.zip)$/i;
const token=/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})\b/;
const personalPath=/(?:[A-Za-z]:[/\\]Users[/\\]|xwechat_files[/\\]|wxid_[A-Za-z0-9]{6,})/;
const privateKey=/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
const errors=[];
// Only these authored, reviewed fixtures may be tracked as documents. Pin their
// bytes so replacing one with a real exam cannot pass as the same fixture.
const syntheticFixtures={
 'tests/fixtures/chemistry-figures/paper.pdf':'d424701e44b6a4fde5700a876ae66fceed2b534e35d35048a7739b66e56783f9',
 'tests/fixtures/chemistry-figures/paper.docx':'3f7dd15b3dcf7f9f408cc42ccc96de89990aa776c2b8c8c82cbf386b06e1ca05'
};
for(const file of files){
 if(file in syntheticFixtures){
  const hash=createHash('sha256').update(execFileSync('git',['show',`:${file}`])).digest('hex');
  if(hash!==syntheticFixtures[file])errors.push(`${file}: synthetic fixture bytes changed; review provenance before updating its hash`);
 }else if(forbidden.test(file)&&file!=='.env.example')errors.push(`${file}: local data or private configuration must not be tracked`);
 if(!/\.(?:[cm]?js|tsx?|json|ya?ml|md|css|html|txt)$/.test(file))continue;
 const lines=execFileSync('git',['show',`:${file}`],{encoding:'utf8'}).split('\n');
 lines.forEach((line,i)=>{
  if(token.test(line)||privateKey.test(line))errors.push(`${file}:${i+1}: possible credential`);
  if(personalPath.test(line))errors.push(`${file}:${i+1}: personal filesystem path`);
 });
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
else console.log(`Public content check passed (${files.length} tracked files).`);
