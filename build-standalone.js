/* Bundles the whole game into ONE self-contained .html file for publishing
   as a claude.ai Artifact (a permanent link that outlives your machine).

   Artifacts have no backend and a strict CSP, so online co-op can't run
   there — this build hides the CO-OP button and ships single-player, which
   is fully self-contained (every pixel and sound is generated at runtime).

     node build-standalone.js   ->   dist/dukedefense.html
*/
'use strict';
const fs = require('fs');
const path = require('path');

const root = __dirname;
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

const css = read('css/game.css');
const html = read('index.html');

/* the body content, minus the <script src> and <link> tags we inline instead */
let body = html
  .replace(/^[\s\S]*?<body>/i, '')
  .replace(/<\/body>[\s\S]*$/i, '')
  .replace(/<link\b[^>]*>/gi, '')
  .replace(/<script\b[^>]*src=[^>]*><\/script>/gi, '')
  .trim();

/* load order matters: net.js before ui.js so `Net` exists */
const jsFiles = ['js/core.js', 'js/art.js', 'js/data.js', 'js/render.js', 'js/game.js', 'js/net.js', 'js/ui.js'];
const js = jsFiles.map(read).join('\n;\n');

const out = `<style>
${css}

/* --- standalone build: no backend here, so co-op is off --- */
#t-coop{ display:none !important; }
.credit::after{ content:''; }
</style>

${body}

<script>
/* mark this as the hosted single-player build */
window.DUKE_SOLO = true;
</script>
<script>
${js}
</script>
`;

const dist = path.join(root, 'dist');
if (!fs.existsSync(dist)) fs.mkdirSync(dist);
const outPath = path.join(dist, 'dukedefense.html');
fs.writeFileSync(outPath, out);

const kb = (Buffer.byteLength(out) / 1024).toFixed(0);
console.log('wrote ' + outPath + '  (' + kb + ' KB)');
