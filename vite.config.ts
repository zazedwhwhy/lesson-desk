import {defineConfig} from 'vite';
const beta=process.env.LESSON_DESK_CHANNEL==='beta';
export default defineConfig({base:'./',server:{host:'127.0.0.1'},define:{__NOTEBOOK_BETA__:JSON.stringify(beta)},build:{outDir:beta?'dist-beta':'dist'}});
