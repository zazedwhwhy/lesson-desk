import {it,expect,vi,afterEach} from 'vitest';
const {expose,invoke}=vi.hoisted(()=>({expose:vi.fn(),invoke:vi.fn().mockResolvedValue([])}));
vi.mock('electron',()=>({contextBridge:{exposeInMainWorld:expose},ipcRenderer:{invoke,on:vi.fn(),removeListener:vi.fn()}}));
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();vi.resetModules();});
it('正式版允许普通课件接口，拒绝全部错题本接口',async()=>{
 vi.stubGlobal('__NOTEBOOK_BETA__',false);await import('../src/desktop/preload');const desk=expose.mock.calls[0][1];
 await desk.invoke('list');expect(invoke).toHaveBeenCalledWith('desk:list');
 for(const name of ['notebook-list','notebook-add','notebook-remove','notebook-update','notebook-source','notebook-output'])await expect(desk.invoke(name)).rejects.toThrow('不允许');
 expect(invoke).toHaveBeenCalledTimes(1);
});
it('Beta开放错题本接口，仍拒绝未注册操作',async()=>{
 vi.stubGlobal('__NOTEBOOK_BETA__',true);await import('../src/desktop/preload');const desk=expose.mock.calls[0][1];
 await desk.invoke('notebook-list',true);expect(invoke).toHaveBeenCalledWith('desk:notebook-list',true);
 await expect(desk.invoke('delete-everything')).rejects.toThrow('不允许');
});
