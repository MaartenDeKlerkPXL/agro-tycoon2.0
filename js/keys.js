// Agro Tycoon 2.0 — toetsen (zelf in te stellen via ⚙️ Instellingen)
// Pijltjestoetsen werken altijd voor lopen en rijden, naast de ingestelde toetsen.
window.AT = window.AT || {};

(function () {
  const KEY = 'agro-tycoon-2-keys';
  const ACTIONS = [
    ['up', 'Vooruit / omhoog', 'KeyW'],
    ['down', 'Achteruit / omlaag', 'KeyS'],
    ['left', 'Links', 'KeyA'],
    ['right', 'Rechts', 'KeyD'],
    ['sprint', 'Sneller (voertuig 50 km/u)', 'ShiftLeft'],
    ['enter', 'In-/uitstappen', 'KeyE'],
    ['hitch', 'Werktuig koppelen', 'KeyF'],
    ['tool', 'Werktuig omlaag/omhoog', 'Space'],
    ['crop', 'Zaaigoed wisselen', 'KeyC'],
    ['unload', 'Lossen / laden', 'KeyU'],
    ['action', 'Boom kappen / plukken', 'KeyH'],
    ['refuel', 'Tanken', 'KeyT'],
    ['gps', 'GPS aan/uit', 'KeyG'],
    ['cruise', 'Cruise control aan/uit', 'KeyR'],
    ['chaser', 'Chauffeur met kipper', 'KeyK'],
    ['pause', 'Pauze', 'KeyP'],
    ['mute', 'Geluid dempen', 'KeyM'],
  ];
  const DEFAULTS = Object.fromEntries(ACTIONS.map(([a, , c]) => [a, c]));
  let map = Object.assign({}, DEFAULTS);
  try { Object.assign(map, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* standaard */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(map)); } catch (e) { /* ok */ } };

  // vaste extra's: pijltjes voor bewegen, rechter Shift voor sneller
  const EXTRA = { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], sprint: ['ShiftRight'] };
  const codes = action => [map[action], ...(EXTRA[action] || [])];
  const is = (e, action) => codes(action).includes(e.code);

  // een toets een andere actie geven; zat hij al ergens op, dan ruilen die twee
  function bind(action, code) {
    const other = Object.keys(map).find(a => a !== action && map[a] === code);
    if (other) map[other] = map[action];
    map[action] = code;
    save();
    AT.emit && AT.emit('keys');
  }
  function reset() { map = Object.assign({}, DEFAULTS); save(); AT.emit && AT.emit('keys'); }

  // leesbare naam van een toets
  function label(code) {
    if (!code) return '—';
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    return { Space: 'Spatie', ShiftLeft: 'Shift', ShiftRight: 'Shift rechts', ControlLeft: 'Ctrl', AltLeft: 'Alt', Tab: 'Tab', Enter: 'Enter',
      ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backspace: 'Backspace' }[code] || code;
  }
  const name = action => label(map[action]);

  AT.keys = { ACTIONS, codes, is, bind, reset, label, name, get: a => map[a] };
})();
