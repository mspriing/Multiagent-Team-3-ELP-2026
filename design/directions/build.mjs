// Inlines the shader and shared engine into each direction so every file opens on its own.
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const shared = fs.readFileSync(`${here}/src/lightstudio.inline.js`, 'utf8') + '\n' + fs.readFileSync(`${here}/src/shared.js`, 'utf8') + '\n' + fs.readFileSync(`${here}/src/logos.js`, 'utf8');
const hairline = fs.readFileSync(`${here}/../node_modules/@lucasmarkes/hairline/dist/index.js`, 'utf8').replace(/^export \{/m, 'window.Hairline = {').replace(/\/\/# sourceMappingURL.*$/m, '');
const bcss = fs.readFileSync(`${here}/src/b-base.css`, 'utf8'), bjs = fs.readFileSync(`${here}/src/b-base.js`, 'utf8');
const hairlineScoped = `(() => {\n${hairline}\n})();`;
// The conversation screens (app.html) share the approved home styles and heat shader from home.html, one source of truth
const homeSrc = fs.readFileSync(`${here}/src/home.html`, 'utf8');
const homeCss = homeSrc.slice(homeSrc.indexOf('/*__BCSS__*/') + 12, homeSrc.indexOf('</style>'));
const heat = homeSrc.slice(homeSrc.indexOf('const HEAT = (() => {'), homeSrc.indexOf('/* Where a rect sits'));
for (const f of fs.readdirSync(`${here}/src`).filter(f => f.endsWith('.html'))) {
  const out = fs.readFileSync(`${here}/src/${f}`, 'utf8').replace('/*__SHARED__*/', () => shared).replace('/*__HAIRLINE__*/', () => hairlineScoped).replace('/*__BCSS__*/', () => bcss).replace('/*__BJS__*/', () => bjs).replace('/*__HOMECSS__*/', () => homeCss).replace('/*__HEAT__*/', () => heat);
  fs.writeFileSync(`${here}/${f}`, out); console.log('built', f);
}
