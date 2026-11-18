import {defineConfig} from 'vite';
const channel=process.env.LESSON_DESK_CHANNEL??'stable';
if(!['stable','beta'].includes(channel))throw Error('Unknown build channel: '+channel);
const beta=channel==='beta';
export default defineConfig({base:'./',server:{host:'127.0.0.1'},define:{__NOTEBOOK_BETA__:JSON.stringify(beta)},build:{outDir:beta?'dist-beta':'dist'}});
