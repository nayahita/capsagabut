// Audio Director: routing, cooldown fallback, exclusive comedy bus, legacy keys.
const H = require('./harness')({ files: ['events.js', 'comedy/config.js', 'audio/director.js'] });
const A = global.CapsaAudio, ok = H.ok;
let view = { online: false, authority: true };
global.CapsaFX.view = () => view; H.sound = true;
(async () => {
  ok('legacy key maps to a cue', A.play('notify', { perf: 'p1' }) === true && A.log().pop() === 'play sys.chime notify');
  ok('same performance may repeat a cue', A.play('stamp', { perf: 'p1' }) !== false);
  await H.wait(450);
  ok('same cue from another performance within 20 s is skipped (common → none)', A.play('notify', { perf: 'p2' }) === false && /cooldown sys.chime/.test(A.log().slice(-1)[0]));
  A.play('glitch', { perf: 'p3' }); await H.wait(1600);
  ok('rare cue repeated soon steps down to a smaller cue', A.play('error', { perf: 'p4' }) === true && /cooldown glitch → sting.tiny/.test(A.log().slice(-2).join(' ')));
  A.drop(3000, 'p5');
  ok('engineered silence holds the comedy bus for other performances', A.play('heartbeat', { perf: 'p6' }) === false && /bus busy/.test(A.log().slice(-1)[0]));
  ok('…but not for its own performance', A.play('heartbeat', { perf: 'p5' }) === true);
  view = { online: true, authority: false, sameRoom: true };
  ok('same room: non-host phones stay quiet', A.tableMuted() === true && A.play('tapeStop', { perf: 'p7' }) === false);
  view = { online: true, authority: true, sameRoom: true };
  ok('same room: the host phone plays', A.tableMuted() === false);
  view = { online: true, authority: false, sameRoom: false };
  ok('remote play: every phone plays', A.tableMuted() === false);
  ok('late performance: visuals only', A.play('kazoo', { perf: 'p8', late: true }) === false);
  H.sound = false; ok('muted phone plays nothing', A.play('memorial', { perf: 'p9' }) === false);
  H.done();
})();
