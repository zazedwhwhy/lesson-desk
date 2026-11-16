import {it,expect,vi,afterEach} from 'vitest';
import {rename} from 'node:fs/promises';
import {atomicRename} from '../src/desktop/atomic-rename';
vi.mock('node:fs/promises',()=>({rename:vi.fn()}));
vi.mock('node:timers/promises',()=>({setTimeout:vi.fn().mockResolvedValue(undefined)}));
const move=vi.mocked(rename);
afterEach(()=>{vi.resetAllMocks();vi.unstubAllGlobals();});
it('文件占用后重试同一原子操作，成功后立即停止',async()=>{
 vi.stubGlobal('process',{platform:'win32'});
 move.mockRejectedValueOnce(Object.assign(Error('locked'),{code:'EPERM'})).mockResolvedValueOnce(undefined);
 await atomicRename('stage','final');expect(move.mock.calls).toEqual([['stage','final'],['stage','final']]);
});
it('持续权限错误保留原始异常，不能无限重试或假装成功',async()=>{
 vi.stubGlobal('process',{platform:'win32'});const error=Object.assign(Error('denied'),{code:'EACCES'});move.mockRejectedValue(error);
 await expect(atomicRename('stage','final')).rejects.toBe(error);expect(move).toHaveBeenCalledTimes(6);
});
it('非占用错误以及其他平台的错误不重试',async()=>{
 vi.stubGlobal('process',{platform:'win32'});const error=Object.assign(Error('missing'),{code:'ENOENT'});move.mockRejectedValue(error);
 await expect(atomicRename('stage','final')).rejects.toBe(error);expect(move).toHaveBeenCalledTimes(1);
 move.mockClear();vi.stubGlobal('process',{platform:'linux'});const locked=Object.assign(Error('locked'),{code:'EPERM'});move.mockRejectedValue(locked);
 await expect(atomicRename('stage','final')).rejects.toBe(locked);expect(move).toHaveBeenCalledTimes(1);
});
