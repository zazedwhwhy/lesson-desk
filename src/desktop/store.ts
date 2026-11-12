import fs from 'node:fs/promises';
import path from 'node:path';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { projectSchema, type Project } from '../core/model';
import { validateBundlePath } from '../core/logic';
export class Store {
    constructor(public root: string) { }
    dir(id: string) { if (!/^[a-zA-Z0-9_-]+$/.test(id))
        throw Error('课件ID无效'); return path.join(this.root, id); }
    async trash(id:string,trashItem:(directory:string)=>Promise<void>){
        const directory=path.resolve(this.dir(id)),entry=await fs.lstat(directory);
        if(!entry.isDirectory()||entry.isSymbolicLink())throw Error('课件目录无效，无法删除');
        await trashItem(directory);
    }
    async save(p: Project) { p = projectSchema.parse(p); await fs.mkdir(this.dir(p.id), { recursive: true }); const file = path.join(this.dir(p.id), 'project.json'); const tmp = file + '.' + crypto.randomUUID() + '.tmp'; await fs.writeFile(tmp, JSON.stringify(p, null, 2)); await fs.rename(tmp, file); return p; }
    async load(id: string,recover=true) { const p = projectSchema.parse(JSON.parse(await fs.readFile(path.join(this.dir(id), 'project.json'), 'utf8'))); if(recover&&p.chemistry?.tasks.some(t=>t.state==='running')){for(const t of p.chemistry.tasks)if(t.state==='running'){t.state='pending';t.error='上次生成中断，可重试未完成项';}await this.save(p);} if(recover&&p.chinese?.tasks.some(t=>t.state==='running')){for(const t of p.chinese.tasks)if(t.state==='running'){t.state='pending';t.error='上次生成中断，可继续';}await this.save(p);} if (recover&&p.job.state === 'running') {
        p.job.state = 'interrupted';
        p.job.current = undefined;
        await this.save(p);
    } return p; }
    async list() { await fs.mkdir(this.root, { recursive: true }); const items = []; for (const entry of await fs.readdir(this.root, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            try {
                const p = await this.load(entry.name,false);
                items.push({ id: p.id, title: p.title, updatedAt: p.updatedAt, example: p.example, subject:p.subject });
            }
            catch (e) {
                items.push({ id: entry.name, title: '无法读取的课件：' + entry.name, updatedAt: '', example: false, error: String(e) });
            }
        }
    } return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
    async asset(id: string, name: string, bytes: Uint8Array) { validateBundlePath(name); const dest = path.join(this.dir(id), name); await fs.mkdir(path.dirname(dest), { recursive: true }); await fs.writeFile(dest, bytes); }
    async pack(id: string) { const p = await this.load(id); const files: Record<string, Uint8Array> = { 'project.json': strToU8(JSON.stringify(p)) }; for (const s of p.sources)
        if (s.asset) {
            validateBundlePath(s.asset);
            files[s.asset] = new Uint8Array(await fs.readFile(path.join(this.dir(id), s.asset)));
        } return zipSync(files); }
    async unpack(bytes: Uint8Array) { if (bytes.length > 200 * 1024 * 1024)
        throw Error('课件包超过200 MB'); let size = 0, count = 0; const files = unzipSync(bytes, { filter: file => { validateBundlePath(file.name); size += file.originalSize; if (++count > 1000 || size > 200 * 1024 * 1024)
            throw Error('课件包解压体积或文件数量超限'); return true; } }); if (!files['project.json'])
        throw Error('课件包缺少project.json'); const p = projectSchema.parse(JSON.parse(strFromU8(files['project.json']))); p.id = crypto.randomUUID(); if (p.job.state === 'running')
        p.job.state = 'interrupted'; for (const s of p.sources)
        if (s.asset) {
            validateBundlePath(s.asset);
            if (!files[s.asset])
                throw Error('课件包缺少原材料 ' + s.name);
        } const staging = path.join(this.root, '_import_' + crypto.randomUUID()); await fs.mkdir(staging, { recursive: true }); try {
        for (const s of p.sources)
            if (s.asset) {
                const dest = path.join(staging, s.asset);
                await fs.mkdir(path.dirname(dest), { recursive: true });
                await fs.writeFile(dest, files[s.asset]);
            }
        await fs.writeFile(path.join(staging, 'project.json'), JSON.stringify(p));
        await fs.rename(staging, this.dir(p.id));
    }
    catch (error) {
        await fs.rm(staging, { recursive: true, force: true });
        throw error;
    } return p; }
}
