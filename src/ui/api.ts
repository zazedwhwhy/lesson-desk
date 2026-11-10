declare global {
    interface Window {
        desk?: {
            invoke: (name: string, ...args: any[]) => Promise<any>;
            onProgress: (fn: (data: any) => void) => () => void;
        };
    }
}
export function invoke(name: string, ...args: any[]): Promise<any> { if (!window.desk)
    return Promise.reject(Error('请在桌面软件中使用文件、保存与AI功能；浏览器仅用于界面预览')); return window.desk.invoke(name, ...args); }
