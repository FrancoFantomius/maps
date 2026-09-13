import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Default fallback set of known icons in maps and @francofantomius/material-components to guarantee safety
// Including dynamic icons used in GPSController, app.js, and RoutingController maneuver icons
const DEFAULT_ICONS = [
  'trip_origin', 'flag', 'rotate_right', 'rotate_left', 'merge', 'fork_left', 'fork_right',
  'straight', 'turn_left', 'turn_right', 'turn_slight_left', 'turn_slight_right',
  'turn_sharp_left', 'turn_sharp_right', 'u_turn_left', 'ramp_left', 'ramp_right',
  'my_location', 'location_searching', 'gps_fixed', 'home',
  'keyboard_double_arrow_down', 'keyboard_double_arrow_up'
];

function getAllFiles(dir, extensions = ['.html', '.js', '.css', '.handlebars']) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (
      entry.name === 'node_modules' ||
      entry.name === '.git' ||
      entry.name === 'dist' ||
      entry.name === 'scripts' ||
      entry.name === 'public' ||
      entry.name === 'tests' ||
      entry.name === '.gemini' ||
      entry.name === 'maps_db'
    ) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, extensions));
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }

  return results;
}

function getMaterialComponentsFiles(rootDir) {
  const mcDir = path.join(rootDir, 'node_modules/@francofantomius/material-components');
  if (!fs.existsSync(mcDir)) return [];
  const results = [];

  const scanDir = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.name.endsWith('.js') || entry.name.endsWith('.d.ts')) {
        results.push(fullPath);
      }
    }
  };

  scanDir(mcDir);
  return results;
}

export function scanIcons() {
  const iconSet = new Set(DEFAULT_ICONS);
  const files = [...getAllFiles(rootDir), ...getMaterialComponentsFiles(rootDir)];

  const patterns = [
    /\b(?:icon|leading-icon|trailing-icon|active-leading-icon|selected-icon|open-icon)=["']([a-zA-Z0-9_-]+)["']/g,
    /<md-icon[^>]*\bname=["']([a-zA-Z0-9_-]+)["']/g,
    /<md-icon[^>]*\bname=\${[^}]*["']([a-zA-Z0-9_-]+)["']\}/g,
    /<md-icon[^>]*>([a-zA-Z0-9_-]+)<\/md-icon>/g,
    /<(?:span|i)\b[^>]*class=["'][^"']*\b(?:material-symbols-outlined|material-icons-outlined)\b[^"']*["'][^>]*>\s*([a-zA-Z0-9_-]+)\s*<\/(?:span|i)>/g,
    /\.setAttribute\(\s*["'](?:icon|leading-icon|trailing-icon|selected-icon|active-leading-icon)["']\s*,\s*["']([a-zA-Z0-9_-]+)["']\s*\)/g,
    /\.setAttribute\(\s*["'](?:icon|leading-icon|trailing-icon|selected-icon|active-leading-icon)["']\s*,\s*[^?]+\?\s*["']([a-zA-Z0-9_-]+)["']\s*:\s*["']([a-zA-Z0-9_-]+)["']/g,
    /icon:\s*[^?]+\?\s*["']([a-zA-Z0-9_-]+)["']\s*:\s*(?:\([^?]+\?\s*["']([a-zA-Z0-9_-]+)["']\s*:\s*["']([a-zA-Z0-9_-]+)["']\)|["']([a-zA-Z0-9_-]+)["'])/g,
    /\bicon:\s*["']([a-zA-Z0-9_-]+)["']/g,
    /\b(?:trailingIcon|leadingIcon|activeLeadingIcon|openIcon|selectedIcon)\s*=\s*["']([a-zA-Z0-9_-]+)["']/g,
    /\b(?:trailingIcon|leadingIcon|activeLeadingIcon|openIcon|selectedIcon)\s*:\s*["']([a-zA-Z0-9_-]+)["']/g,
    /\bicon\s*=\s*["']([a-zA-Z0-9_-]+)["']/g,
    /md-icon\[name=["']([a-zA-Z0-9_-]+)["']\]/g
  ];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        for (let i = 1; i < match.length; i++) {
          if (match[i] && /^[a-z0-9_]+$/.test(match[i])) {
            iconSet.add(match[i]);
          }
        }
      }
    }
  }

  return Array.from(iconSet).sort();
}

export async function generateIconSubset() {
  let subsetFont;
  try {
    const mod = await import('subset-font');
    subsetFont = mod.default || mod;
  } catch {
    console.warn('[Icon Subsetting] "subset-font" package is not installed.');
    console.warn('[Icon Subsetting] Run "npm install -D subset-font" to enable icon font subsetting. Skipping for now...');
    return;
  }

  const icons = scanIcons();
  console.log(`[Icon Subsetting] Detected ${icons.length} icons across pages and code:`);
  console.log(`  ${icons.join(', ')}`);

  const possibleSourceFonts = [
    path.join(rootDir, 'node_modules/@fontsource-variable/material-symbols-outlined/files/material-symbols-outlined-latin-wght-normal.woff2'),
    path.join(rootDir, 'node_modules/@fontsource-variable/material-symbols-outlined/files/material-symbols-outlined-latin-fill-normal.woff2'),
    path.join(rootDir, 'node_modules/@fontsource-variable/material-symbols-outlined/files/material-symbols-outlined-latin-full-normal.woff2')
  ];

  const sourceFontPath = possibleSourceFonts.find(p => fs.existsSync(p));
  if (!sourceFontPath) {
    throw new Error('Could not find source Material Symbols font in @fontsource-variable/material-symbols-outlined.');
  }

  const fontBuffer = fs.readFileSync(sourceFontPath);
  const subsetText = icons.join(' ') + ' ' + Array.from(new Set(icons.join(''))).join('');

  const subsetBuffer = await subsetFont(fontBuffer, subsetText, {
    targetFormat: 'woff2'
  });

  const outputDir = path.join(rootDir, 'fonts');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'material-symbols-outlined-subset.woff2');
  fs.writeFileSync(outputPath, subsetBuffer);

  const origSizeKB = (fontBuffer.length / 1024).toFixed(1);
  const subsetSizeKB = (subsetBuffer.length / 1024).toFixed(1);
  const savedPercent = (((fontBuffer.length - subsetBuffer.length) / fontBuffer.length) * 100).toFixed(1);

  console.log(`[Icon Subsetting] Generated subset at: ${path.relative(rootDir, outputPath)}`);
  console.log(`[Icon Subsetting] Original: ${origSizeKB} KB -> Subset: ${subsetSizeKB} KB (${savedPercent}% reduction)`);

  // Update css/fonts.css to declare local subset font for both variable and non-variable font families
  const fontsCssPath = path.join(rootDir, 'css/fonts.css');
  const fontsCssContent = `/* Auto-generated by scripts/subset-icons.js */
@font-face {
  font-family: 'Material Symbols Outlined Variable';
  font-style: normal;
  font-display: swap;
  font-weight: 100 700;
  src: url('../fonts/material-symbols-outlined-subset.woff2') format('woff2-variations');
}

@font-face {
  font-family: 'Material Symbols Outlined';
  font-style: normal;
  font-display: swap;
  font-weight: 100 700;
  src: url('../fonts/material-symbols-outlined-subset.woff2') format('woff2-variations');
}
`;
  fs.writeFileSync(fontsCssPath, fontsCssContent, 'utf-8');
  console.log(`[Icon Subsetting] Updated css/fonts.css to reference subset font.`);
}

// Run standalone if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateIconSubset().catch(err => {
    console.error('[Icon Subsetting] Error generating icon subset:', err);
    process.exit(1);
  });
}
