import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';

const movie = new URL('out/对焦-加长版-1080p60.mp4', import.meta.url);
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--autoplay-policy=no-user-gesture-required'],
});
try {
  const page = await browser.newPage();
  await page.goto(movie.href, {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
  const report = await page.evaluate(async () => {
    const video = document.querySelector('video');
    video.pause();
    video.muted = true;
    const positions = [];
    async function seek(second) {
      if (Math.abs(video.currentTime - second) < .001) return;
      const arrived = new Promise(resolve => video.addEventListener('seeked', resolve, {once: true}));
      video.currentTime = second;
      await arrived;
      positions.push(video.currentTime);
    }
    for (const time of [16.8, 26.4, 67.5, 148, 257, 283, 0]) await seek(time);
    video.playbackRate = 3;
    const end = new Promise(resolve => video.addEventListener('ended', resolve, {once: true}));
    await video.play();
    await end;
    const ended = video.ended;
    await seek(0);
    video.playbackRate = 1;
    await video.play();
    await new Promise(resolve => video.addEventListener('timeupdate', resolve, {once: true}));
    video.pause();
    return {duration:video.duration, ended, positions, replay:video.currentTime,
            error:video.error?.message ?? null, playbackTestRate:3};
  });
  if (report.error || !report.ended || report.replay <= 0 || Math.abs(report.duration - 285) > .06) {
    throw new Error(JSON.stringify(report));
  }
  await writeFile(new URL('work/player-check.json', import.meta.url), JSON.stringify(report, null, 2));
  console.log(report);
} finally {
  await browser.close();
}
