// Vaste speltest in een echte browser: npm run test:browser
// Bouwt het spel, start een server en speelt een stukje: lopen, instappen, ploegen,
// personeel laten oogsten, snel vooruit, opslaan en herladen. Faalt bij elke JavaScript-fout.
// Chromium: zet CHROMIUM_PATH als hij niet op de standaardplek staat.
import { build, preview } from 'vite';
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const exe = process.env.CHROMIUM_PATH || ['/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome']
  .find(p => existsSync(p));
if (!exe) { console.log('Geen Chromium gevonden: zet CHROMIUM_PATH. Test overgeslagen.'); process.exit(0); }

await build({ logLevel: 'warn' });
const server = await preview({ preview: { port: 4321, strictPort: false } });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const ok = (cond, msg) => { if (!cond) { errors.push('MISLUKT: ' + msg); } console.log((cond ? '✓ ' : '✗ ') + msg); };

try {
  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(500);
  ok(await page.evaluate(() => !!AT.state && AT.state.fields.length > 0), 'spel start');
  ok(await page.evaluate(() => !document.getElementById('tutorial').hidden), 'uitleg zichtbaar bij een nieuw spel');

  // naar de tractor lopen en instappen
  await page.evaluate(() => { const t = AT.state.machines[0]; AT.state.player.x = t.x + 8; AT.state.player.y = t.y; });
  await page.keyboard.press('KeyE');
  ok(await page.evaluate(() => AT.state.player.mode === 'drive'), 'instappen met E');

  // op veld 1 ploegen
  await page.evaluate(() => { const f = AT.game.fieldDef(1), p = AT.state.player; p.x = f.x + 10; p.y = f.y + f.h - 8; p.angle = -Math.PI / 2; AT.state.weather.moisture = 0.5; });
  await page.keyboard.press('Space');
  await page.keyboard.down('KeyW'); await page.waitForTimeout(2500); await page.keyboard.up('KeyW');
  ok(await page.evaluate(() => AT.game.summary(AT.game.field(1)).plowed > 0), 'ploegen werkt');

  // personeel laten oogsten
  await page.evaluate(() => {
    const G = AT.game, s = AT.state; s.money = 1e6;
    AT.staff.refreshCandidates(true); AT.staff.hire(s.staff.candidates[0].id);
    const f = G.field(2);
    for (let i = 0; i < f.cells.state.length; i++) { f.cells.state[i] = 2; f.cells.crop[i] = 1; f.cells.planted[i] = s.growClock.wheat - 1e4; }
    s.weather.type = 'sun'; s.weather.left = 999; s.weather.queue.forEach(q => { q.type = 'sun'; });
    G.exitVehicle();
    G.startJob(2, 'harvest', null, {});
    s.speed = 60;
  });
  for (let i = 0; i < 40; i++) { await page.waitForTimeout(500); if (await page.evaluate(() => !AT.game.field(2).job && !AT.state.chasers.length && !AT.state.trips.length)) break; }
  ok(await page.evaluate(() => AT.state.silo.wheat > 1), 'werknemer oogst en lost in de silo');

  // fps
  const fps = await page.evaluate(() => new Promise(r => { let n = 0; const t = performance.now(); const f = () => { n++; if (performance.now() - t < 1000) requestAnimationFrame(f); else r(n); }; requestAnimationFrame(f); }));
  ok(fps > 20, `vloeiend genoeg (${fps} fps)`);

  // opslaan en herladen
  const money = await page.evaluate(() => { AT.state.speed = 1; AT.game.save(); return Math.round(AT.state.money); });
  await page.reload(); await page.waitForTimeout(600);
  ok(await page.evaluate(m => Math.abs(Math.round(AT.state.money) - m) < 50, money), 'opslaan en herladen');
} finally {
  await browser.close();
  await new Promise(r => server.httpServer.close(r));
}
if (errors.length) { console.error('Fouten:', errors); process.exit(1); }
console.log('Alles in orde.');
