import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const palettePath = path.join(rootDir, 'public/assets/data/palette.json');
const palette = JSON.parse(fs.readFileSync(palettePath, 'utf8'));
const validColorIds = new Set(palette.map((p) => p.colorId));

function pullOriginY(grid, H, W, cid) {
  let bestX = -1;
  let bestY = -1;
  let bestOriginY = -1;
  for (let x = 0; x < W; x++) {
    let y = -1;
    for (let yy = H - 1; yy >= 0; yy--) {
      if (grid[yy][x] !== null) {
        y = yy;
        break;
      }
    }
    if (y >= 0 && grid[y][x].cid === cid) {
      if (grid[y][x].originY > bestOriginY) {
        bestOriginY = grid[y][x].originY;
        bestX = x;
        bestY = y;
      }
    }
  }
  if (bestX < 0) return false;
  for (let yy = bestY; yy > 0; yy--) {
    grid[yy][bestX] = grid[yy - 1][bestX];
  }
  grid[0][bestX] = null;
  return true;
}

function stressTestRandomUnlockOrder(levelData, slots, trials = 200) {
  const H = levelData.sandBoard.height;
  const W = levelData.sandBoard.width;
  let failures = 0;

  for (let t = 0; t < trials; t++) {
    const g = levelData.sandBoard.grid.map((r, y) =>
      r.map((cid) => (cid > 0 ? { cid, originY: y } : null))
    );
    const q = levelData.bucketQueue.map((b, idx) => ({
      ...b,
      seq: idx + 1,
      collected: 0,
      isOpen: false
    }));
    const active = [];

    let steps = 0;
    while (steps++ < 500) {
      let drained = true;
      while (drained) {
        drained = false;
        while (active.length < slots && q.length > 0) {
          active.push(q.shift());
        }
        active.sort((a, b) => b.collected - a.collected || a.seq - b.seq);
        for (let i = 0; i < active.length; i++) {
          const b = active[i];
          if (!b.isOpen) continue;
          while (b.collected < b.capacity && pullOriginY(g, H, W, b.colorId)) {
            b.collected++;
            drained = true;
          }
          if (b.collected >= b.capacity) {
            active.splice(i, 1);
            drained = true;
            break;
          }
        }
      }
      if (active.length === 0 && q.length === 0) break;
      const locked = active.filter((b) => !b.isOpen);
      if (locked.length > 0) {
        const pick = locked[Math.floor(Math.random() * locked.length)];
        pick.isOpen = true;
      } else {
        failures++;
        break;
      }
    }
  }
  return failures;
}

function simulateFullGame(levelData) {
  const H = levelData.sandBoard.height;
  const W = levelData.sandBoard.width;
  const grid = levelData.sandBoard.grid.map((r, y) =>
    r.map((cid) => (cid > 0 ? { cid, originY: y } : null))
  );
  const bucketQueue = levelData.bucketQueue.map((b, idx) => ({
    ...b,
    seq: idx + 1,
    holes: 0,
    isOpen: false,
    collected: 0
  }));
  const maxActive = levelData.conveyorConfig.initialActiveSlots || 2;
  const maxBuffer = levelData.conveyorConfig.bufferSlots || 5;
  const activeBuckets = [];
  const buffer = [];
  const cols = levelData.queueColumns.map((c) => c.items.map((it) => ({ ...it })));

  function settle() {
    let changed = true;
    while (changed) {
      changed = false;
      while (activeBuckets.length < maxActive && bucketQueue.length > 0) {
        activeBuckets.push(bucketQueue.shift());
        changed = true;
      }
      for (let i = buffer.length - 1; i >= 0; i--) {
        const cid = buffer[i];
        const target = activeBuckets.find(
          (b) => !b.isOpen && b.colorId === cid && b.holes < b.requiredScrews
        );
        if (target) {
          buffer.splice(i, 1);
          target.holes++;
          if (target.holes >= target.requiredScrews) target.isOpen = true;
          changed = true;
        }
      }
      activeBuckets.sort((a, b) => b.collected - a.collected || a.seq - b.seq);
      for (let i = activeBuckets.length - 1; i >= 0; i--) {
        const b = activeBuckets[i];
        if (b.isOpen) {
          while (b.collected < b.capacity && pullOriginY(grid, H, W, b.colorId)) {
            b.collected++;
            changed = true;
          }
          if (b.collected >= b.capacity) {
            activeBuckets.splice(i, 1);
            changed = true;
          }
        }
      }
    }
  }

  settle();
  let steps = 0;
  while (steps < 300) {
    steps++;
    settle();
    const totalLeftScrews = cols.reduce((acc, c) => acc + c.length, 0);
    if (totalLeftScrews === 0 && activeBuckets.length === 0 && bucketQueue.length === 0) {
      const remSand = grid.flat().filter((c) => c !== null).length;
      return { won: remSand === 0, steps, remSand };
    }
    let pickedCol = -1;
    for (let c = 0; c < cols.length; c++) {
      if (cols[c].length > 0) {
        const topColor = cols[c][0].colorId;
        if (
          activeBuckets.some(
            (b) => !b.isOpen && b.colorId === topColor && b.holes < b.requiredScrews
          )
        ) {
          pickedCol = c;
          break;
        }
      }
    }
    if (pickedCol < 0 && buffer.length < maxBuffer) {
      let bestDist = 999;
      for (let c = 0; c < cols.length; c++) {
        for (let d = 1; d < cols[c].length; d++) {
          const cid = cols[c][d].colorId;
          if (
            activeBuckets.some(
              (b) => !b.isOpen && b.colorId === cid && b.holes < b.requiredScrews
            )
          ) {
            if (d < bestDist) {
              bestDist = d;
              pickedCol = c;
            }
            break;
          }
        }
      }
    }
    if (pickedCol < 0) {
      return { won: false, reason: 'Stuck', activeBuckets, bufferLen: buffer.length };
    }
    const screw = cols[pickedCol].shift();
    const target = activeBuckets.find(
      (b) => !b.isOpen && b.colorId === screw.colorId && b.holes < b.requiredScrews
    );
    if (target) {
      target.holes++;
      if (target.holes >= target.requiredScrews) target.isOpen = true;
    } else {
      if (buffer.length >= maxBuffer) {
        return { won: false, reason: 'Buffer Full' };
      }
      buffer.push(screw.colorId);
    }
  }
  return { won: false, reason: 'Max Steps' };
}

const levelsDir = path.join(rootDir, 'public/assets/data/levels');
const docsLevelsDir = path.join(rootDir, '_Docs/levels');
const files = fs.readdirSync(levelsDir).filter((f) => f.endsWith('.json')).sort();

let allPassed = true;
for (const file of files) {
  const runtimeRaw = fs.readFileSync(path.join(levelsDir, file), 'utf8').replace(/\r\n/g, '\n');
  const docsRaw = fs.readFileSync(path.join(docsLevelsDir, file), 'utf8').replace(/\r\n/g, '\n');
  if (runtimeRaw !== docsRaw) {
    console.error(`[FAIL] ${file}: _Docs/levels/${file} is out of sync with public/assets/data/levels/${file}`);
    allPassed = false;
  }

  const data = JSON.parse(runtimeRaw);
  const grid = data.sandBoard.grid;
  if (grid.length !== data.sandBoard.height) {
    console.error(`[FAIL] ${file}: grid height mismatch`);
    allPassed = false;
  }
  const sandCounts = {};
  for (const row of grid) {
    if (row.length !== data.sandBoard.width) {
      console.error(`[FAIL] ${file}: grid width mismatch`);
      allPassed = false;
    }
    for (const cid of row) {
      if (!Number.isInteger(cid) || (cid !== 0 && !validColorIds.has(cid))) {
        console.error(`[FAIL] ${file}: invalid integer colorId ${cid} in grid`);
        allPassed = false;
      }
      if (cid > 0) sandCounts[cid] = (sandCounts[cid] || 0) + 1;
    }
  }

  const bucketCaps = {};
  const bucketCounts = {};
  for (const b of data.bucketQueue) {
    if (!Number.isInteger(b.colorId) || !validColorIds.has(b.colorId)) {
      console.error(`[FAIL] ${file}: invalid bucket colorId ${b.colorId}`);
      allPassed = false;
    }
    bucketCaps[b.colorId] = (bucketCaps[b.colorId] || 0) + b.capacity;
    bucketCounts[b.colorId] = (bucketCounts[b.colorId] || 0) + 1;
  }

  const screwCounts = {};
  for (const col of data.queueColumns) {
    for (const s of col.items) {
      if (!Number.isInteger(s.colorId) || !validColorIds.has(s.colorId)) {
        console.error(`[FAIL] ${file}: invalid screw colorId ${s.colorId}`);
        allPassed = false;
      }
      screwCounts[s.colorId] = (screwCounts[s.colorId] || 0) + 1;
    }
  }

  for (const cid of Object.keys(sandCounts)) {
    if (sandCounts[cid] !== bucketCaps[cid]) {
      console.error(
        `[FAIL] ${file}: colorId ${cid} sand=${sandCounts[cid]} != bucketCap=${bucketCaps[cid]}`
      );
      allPassed = false;
    }
    if (screwCounts[cid] !== bucketCounts[cid] * 3) {
      console.error(
        `[FAIL] ${file}: colorId ${cid} screws=${screwCounts[cid]} != 3*buckets=${bucketCounts[cid] * 3}`
      );
      allPassed = false;
    }
  }

  for (const slots of [2, 3, 4]) {
    const failCount = stressTestRandomUnlockOrder(data, slots, 200);
    if (failCount > 0) {
      console.error(`[FAIL] ${file}: Random unlock stress test failed ${failCount}/200 times for slots=${slots}`);
      allPassed = false;
    }
  }

  const sim = simulateFullGame(data);
  if (!sim.won) {
    console.error(`[FAIL] ${file}: Bot solver failed:`, sim);
    allPassed = false;
  } else {
    console.log(
      `[PASS] ${file} (${data.title}) — Grid ${data.sandBoard.width}x${data.sandBoard.height}, Colors: [${Object.keys(sandCounts).join(', ')}], Buckets: ${data.bucketQueue.length}, Screws: ${Object.values(screwCounts).reduce((a, b) => a + b, 0)}, Bot solved in ${sim.steps} steps, StressTest(2,3,4 slots)=600/600 PASS`
    );
  }
}

if (!allPassed) process.exit(1);
