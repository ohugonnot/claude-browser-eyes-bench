// Minimal TCP relay: tcprelay.js <local-port> <target-host> <target-port> [all]
// Listens on 127.0.0.1 and ::1 (or on 0.0.0.0 with "all") and relays to the target. It makes the browser of a
// container on an internal network (no route to the Internet) believe that http://localhost:8099 exists.
const net = require('net');
const [lport, thost, tport] = [Number(process.argv[2]), process.argv[3], Number(process.argv[4])];
function serve(addr) {
  const s = net.createServer((c) => {
    const u = net.connect(tport, thost);
    c.pipe(u); u.pipe(c);
    const end = () => { c.destroy(); u.destroy(); };
    c.on('error', end); u.on('error', end); c.on('close', end); u.on('close', end);
  });
  s.on('error', () => {});
  s.listen(lport, addr);
}
if (process.argv[5] === 'all') { serve('0.0.0.0'); } else { serve('127.0.0.1'); serve('::1'); }
