import {execFileSync} from 'node:child_process';

// Report file and line only; never echo a suspected credential into a CI log.
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const forbidden=/^(?:node_modules|\.tools|\.impeccable|\.superpowers|dist|dist-desktop|release|test-results|data|projects|sources)\/|(?:^|\/)(?:settings|auth|project|prompts)\.json$|(?:^|\/)\.env(?:\..*)?$|\.(?:pem|key|p12|pfx|pdf|docx|pptx|potx|lesson\.zip)$/i;
const token=/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})\b/;
const personalPath=/(?:[A-Za-z]:[/\\]Users[/\\]|xwechat_files[/\\]|wxid_[A-Za-z0-9]{6,})/;
const privateKey=/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
const errors=[];
for(const file of files){
 if(forbidden.test(file)&&file!=='.env.example')errors.push(`${file}: local data or private configuration must not be tracked`);
 if(!/\.(?:[cm]?js|tsx?|json|ya?ml|md|css|html|txt)$/.test(file))continue;
 const lines=execFileSync('git',['show',`:${file}`],{encoding:'utf8'}).split('\n');
 lines.forEach((line,i)=>{
  if(token.test(line)||privateKey.test(line))errors.push(`${file}:${i+1}: possible credential`);
  if(personalPath.test(line))errors.push(`${file}:${i+1}: personal filesystem path`);
 });
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
else console.log(`Public content check passed (${files.length} tracked files).`);
