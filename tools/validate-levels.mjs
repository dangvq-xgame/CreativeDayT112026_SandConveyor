// Level data validator + solvability check.
//
// Runs the REAL TypeScript game rules (LevelValidator, GameState, ScrewMatchRule, SandSuctionRule...)
// through Vite's SSR module loader, so this tool can never drift from the game logic.
//
// Checks per level file:
//   1. public/assets/data/levels/*.json and its mirror _Docs/levels/*.json are identical
//      (palette.json too);
//   2. LevelValidator (shape, palette membership, per-color sand/capacity and screw conservation);
//   3. greedy bot (no boosters) wins with the level's initial slots;
//   4. sand-deadlock stress test: random bucket unlock order with 2/3/4 active slots (seeded RNG).
//
// Usage: node tools/validate-levels.mjs [--trials=200] [--seed=20261114]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function readArg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  const value = hit ? Number(hit.split('=')[1]) : NaN;
  return Number.isFinite(value) ? value : fallback;
}

const TRIALS = readArg('trials', 200);
const SEED = readArg('seed', 20261114);
const STRESS_SLOTS = [2, 3, 4];

function readNormalized(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

async function loadGameModules() {
  const server = await createServer({
    root: rootDir,
    configFile: false,
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] }
  });
  try {
    const [validator, simulator, random] = await Promise.all([
      server.ssrLoadModule('/src/game/level/LevelValidator.ts'),
      server.ssrLoadModule('/src/game/level/LevelSimulator.ts'),
      server.ssrLoadModule('/src/utils/random.ts')
    ]);
    return { server, validator, simulator, random };
  } catch (err) {
    await server.close();
    throw err;
  }
}

async function main() {
  const { server, validator, simulator, random } = await loadGameModules();
  const { LevelValidator } = validator;
  const { simulateGreedyBot, stressTestRandomUnlockOrder } = simulator;
  const { createSeededRandom } = random;

  const levelsDir = path.join(rootDir, 'public/assets/data/levels');
  const docsLevelsDir = path.join(rootDir, '_Docs/levels');
  const palettePath = path.join(rootDir, 'public/assets/data/palette.json');
  const docsPalettePath = path.join(docsLevelsDir, 'palette.json');

  let allPassed = true;
  const fail = (msg, ...extra) => {
    console.error(`[FAIL] ${msg}`, ...extra);
    allPassed = false;
  };

  const paletteRaw = readNormalized(palettePath);
  if (fs.existsSync(docsPalettePath) && readNormalized(docsPalettePath) !== paletteRaw) {
    fail('_Docs/levels/palette.json is out of sync with public/assets/data/palette.json');
  }
  const palette = JSON.parse(paletteRaw);
  const knownColorIds = palette.map((p) => p.colorId);

  const files = fs.readdirSync(levelsDir).filter((f) => f.endsWith('.json')).sort();
  if (files.length === 0) fail(`no level files found in ${levelsDir}`);

  for (const file of files) {
    let filePassed = true;
    const failLevel = (msg, ...extra) => {
      fail(`${file}: ${msg}`, ...extra);
      filePassed = false;
    };

    const runtimeRaw = readNormalized(path.join(levelsDir, file));
    const docsPath = path.join(docsLevelsDir, file);
    if (!fs.existsSync(docsPath)) {
      failLevel(`missing mirror _Docs/levels/${file}`);
    } else if (readNormalized(docsPath) !== runtimeRaw) {
      failLevel(`_Docs/levels/${file} is out of sync with public/assets/data/levels/${file}`);
    }

    let data;
    try {
      data = JSON.parse(runtimeRaw);
    } catch (err) {
      failLevel(`invalid JSON (${err.message})`);
      continue;
    }

    const check = LevelValidator.validate(data, { knownColorIds });
    for (const e of check.errors) failLevel(e);

    const bot = simulateGreedyBot(data);
    if (!bot.won) failLevel('bot solver failed:', bot);

    const stress = [];
    STRESS_SLOTS.forEach((slots, i) => {
      const failures = stressTestRandomUnlockOrder(data, slots, TRIALS, createSeededRandom(SEED + i));
      stress.push(`${slots}:${TRIALS - failures}/${TRIALS}`);
      if (failures > 0) failLevel(`random unlock stress test failed ${failures}/${TRIALS} times for slots=${slots}`);
    });

    if (filePassed) {
      const colors = [...new Set(data.sandBoard.grid.flat().filter((c) => c > 0))].sort((a, b) => a - b);
      const screws = data.queueColumns.reduce((acc, c) => acc + c.items.length, 0);
      console.log(
        `[PASS] ${file} (${data.title}) — Grid ${data.sandBoard.width}x${data.sandBoard.height}, Colors: [${colors.join(', ')}], ` +
          `Buckets: ${data.bucketQueue.length}, Screws: ${screws}, Bot solved in ${bot.steps} taps, ` +
          `StressTest(slots ${stress.join(' ')}) PASS`
      );
    }
  }

  await server.close();
  console.log(allPassed ? `\nAll ${files.length} level(s) PASS (seed=${SEED}, trials=${TRIALS})` : '\nLevel validation FAILED');
  if (!allPassed) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[validate-levels] crashed:', err);
  process.exitCode = 1;
});
