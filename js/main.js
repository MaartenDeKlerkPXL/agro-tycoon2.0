// Agro Tycoon 2.0 — opstarten en game loop
(function () {
  AT.state = AT.game.load();
  if (!AT.state.log.length) {
    AT.state.log.push({ day: 1, hour: 6, text: 'Welkom bij Agro Tycoon 2.0! Klik op Veld 1 om te beginnen met ploegen.', type: 'goal' });
  }

  AT.render.init(document.getElementById('map'));
  AT.ui.init();

  let last = performance.now();
  let liveTimer = 0;
  function frame(now) {
    // max 0,25 s per frame zodat een inactief tabblad geen enorme sprong maakt
    const dt = Math.min((now - last) / 1000, 0.25);
    last = now;
    AT.game.tick(dt);
    AT.render.draw(AT.state);
    liveTimer += dt;
    if (liveTimer > 0.1) { liveTimer = 0; AT.ui.updateLive(); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.addEventListener('beforeunload', AT.game.save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) AT.game.save(); });
})();
