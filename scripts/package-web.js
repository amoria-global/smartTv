// Packages the TV web app for the server (tv.connekyt.com): run after `npx rnv build -p web -s release --ci`.
// Produces platformBuilds/app_web/tv-web.tgz, a self-contained Next server (standalone output plus the static files and
// public assets), with the Windows-style build path in the server config turned into a Linux one.
// On the server: extract into /var/www/front/tv, run `node server.js` with PORT and HOSTNAME set (systemd unit connekyt-tv).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const out = path.join(__dirname, '..', 'platformBuilds', 'app_web', 'output');
const standalone = path.join(out, 'standalone');
if (!fs.existsSync(path.join(standalone, 'server.js'))) {
    console.error('No standalone build found. Run: npx rnv build -p web -s release --ci');
    process.exit(1);
}
const dist = path.join(standalone, 'platformBuilds', 'app_web', 'output');
fs.cpSync(path.join(out, 'static'), path.join(dist, 'static'), { recursive: true });
fs.cpSync(path.join(__dirname, '..', 'public'), path.join(standalone, 'public'), { recursive: true });

const fix = (file) => {
    let s = fs.readFileSync(file, 'utf8');
    s = s.replace(/"distDir":"([^"]*)"/g, (m, p) => `"distDir":"${p.replace(/\+/g, '/').replace(/\/+/g, '/')}"`);
    s = s.replace(/"outputFileTracingRoot":"[^"]*"/g, '"outputFileTracingRoot":"/var/www/front/tv"');
    s = s.replace(/"appDir":"[^"]*"/g, '"appDir":"/var/www/front/tv"');
    fs.writeFileSync(file, s);
};
fix(path.join(standalone, 'server.js'));
fix(path.join(dist, 'required-server-files.json'));

const tgz = path.join(__dirname, '..', 'platformBuilds', 'app_web', 'tv-web.tgz');
execFileSync('tar', ['-czf', tgz, '-C', standalone, '.'], { stdio: 'inherit' });
console.log('Wrote', tgz);
