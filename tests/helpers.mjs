// Laadt de spellogica (zonder tekenen of DOM) in een afgeschermde Node-omgeving.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));

// kleine nep-browser: genoeg voor data/game/weather/farm/staff
export function makeStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    clear: () => m.clear(),
    keys: () => [...m.keys()],
  };
}

export function loadGame({ storage = makeStorage(), seed = 1 } = {}) {
  let s = seed;
  const random = () => (s = (s * 16807) % 2147483647) / 2147483647;   // voorspelbaar toeval
  const noop = () => {};
  const ctx = {
    console, Date, JSON, Map, Set, Uint8Array, Uint16Array, Uint32Array, Float32Array, ArrayBuffer,
    Math: Object.assign(Object.create(Math), { random }),
    localStorage: storage,
    document: { addEventListener: noop, querySelector: () => null, createElement: () => ({ style: {}, getContext: () => null }) },
    location: { reload: noop },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ['data', 'game', 'weather', 'farm', 'staff']) {
    vm.runInContext(readFileSync(`${root}js/${f}.js`, 'utf8'), ctx, { filename: `${f}.js` });
  }
  const AT = ctx.AT;
  AT.state = AT.game.load();
  AT.weather.init();
  AT.staff.ensure();
  AT.state.tutorial.done = true;
  return { AT, ctx, storage };
}

// zet een veld volledig in een toestand (handig voor tests)
export function fillField(AT, id, state, cropKey) {
  const f = AT.game.field(id), c = f.cells, G = AT.game;
  const crop = cropKey ? G.CROP_KEYS.indexOf(cropKey) + 1 : 0;
  for (let i = 0; i < c.state.length; i++) {
    c.state[i] = state; c.crop[i] = crop;
    if (cropKey) c.planted[i] = AT.state.growClock[cropKey] - 1e4;   // lang geleden gezaaid = rijp
  }
  return f;
}
