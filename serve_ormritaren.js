/* Lokal tenar for Ormritaren.
 *
 * serve.ps1 held fram som den vanlege tenaren, men Ormritaren treng tre ting
 * han ikkje gjev:
 *   1. COOP/COEP. Det er desse to headerane som gjer SharedArrayBuffer
 *      tilgjengeleg, og utan SAB kan input() ikkje blokkere Python-workeren.
 *      Appen seier frå i eit gult felt når dei manglar.
 *   2. MIME-typar for .wasm og .mjs. Utan application/wasm nektar nettlesaren
 *      å instansiere modulen; ein .mjs servert som octet-stream blir avvist
 *      av module-workeren.
 *   3. Fleire samtidige tilkoplingar. Pyodide hentar wasm, stdlib og lock-fila
 *      parallelt, og ein enkelttråda tenar (som HttpListener i PowerShell)
 *      stoppar opp på det.
 *
 * Ingen avhengnader — berre Node sitt eige http-modul, i tråd med at
 * prosjektet ikkje har noko byggesteg.
 *
 *   node serve_ormritaren.js    →  http://localhost:8082/ormritaren/
 */

const http = require('http');

/* Same Content-Security-Policy som produksjon.
 *
 * Vi les han frå staticwebapp.config.json i staden for å skrive han av, så
 * dei to ikkje kan gli frå kvarandre. Utan dette har den lokale tenaren
 * lausare reglar enn den ekte sida, og ein CSP-feil viser seg fyrst etter
 * utrulling — det var nettopp slik `frame-ancestors 'none'` fekk stå og
 * blokkere førehandsvisinga i redigeringsverktøyet. */
const CSP = (() => {
    try {
        const konf = JSON.parse(
            require('fs').readFileSync(
                require('path').join(__dirname, 'staticwebapp.config.json'), 'utf8'));
        return konf.globalHeaders?.['Content-Security-Policy'] || '';
    } catch (feil) {
        console.warn('Fann ingen CSP i staticwebapp.config.json:', feil.message);
        return '';
    }
})();
const fs = require('fs');
const path = require('path');

const ROT = __dirname;
const PORT = Number(process.env.PORT) || 8082;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.wasm': 'application/wasm',
    '.zip': 'application/zip',
    '.whl': 'application/zip',
    '.py': 'text/plain; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.xml': 'application/xml'
};

http.createServer((req, res) => {
    // Cross-origin isolation. Same-origin-ressursar treng ingen CORP-header,
    // og Ormritaren lastar ikkje noko frå andre domene.
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cache-Control', 'no-store');
    if (CSP) res.setHeader('Content-Security-Policy', CSP);

    let rel;
    try {
        rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
        res.writeHead(400).end('Bad request');
        return;
    }

    let full = path.join(ROT, rel);

    // Hindre at ein sti med .. slepp ut av rota.
    if (!path.resolve(full).startsWith(path.resolve(ROT))) {
        res.writeHead(403).end('Forbidden');
        return;
    }

    // Katalog → index.html, slik at /ormritaren/ verkar som på Azure.
    if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
        full = path.join(full, 'index.html');
    }

    fs.readFile(full, (feil, data) => {
        if (feil) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not found: ' + rel);
            return;
        }
        const ext = path.extname(full).toLowerCase();
        res.writeHead(200, {
            'Content-Type': MIME[ext] || 'application/octet-stream',
            'Content-Length': data.length
        });
        res.end(data);
    });
}).listen(PORT, () => {
    console.log(`Ormritaren: http://localhost:${PORT}/ormritaren/`);
    console.log(`Rot: ${ROT}`);
    console.log('COOP/COEP er på — crossOriginIsolated skal vere true i konsollen.');
});
