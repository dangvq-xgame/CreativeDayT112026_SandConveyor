import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const palettePath = path.join(rootDir, 'public/assets/data/palette.json');
const palette = JSON.parse(fs.readFileSync(palettePath, 'utf8'));
const validColorIds = new Set(palette.map((p) => p.colorId));

function simulateFullGame(levelData) {
  const H = levelData.sandBoard.height;
  const W = levelData.sandBoard.width;
  const grid = levelData.sandBoard.grid.map((r) => r.slice());
  const bucketQueue = levelData.bucketQueue.map((b) => ({
    ...b,
    holes: 0,
    isOpen: false,
    collected: 0
  }));
  const maxActive = levelData.conveyorConfig.initialActiveSlots || 2;
  const maxBuffer = levelData.conveyorConfig.bufferSlots || 5;
  const activeBuckets = [];
  const buffer = [];
  const cols = levelData.queueColumns.map((c) => c.items.map((it) => ({ ...it })));

  function lowest(x) {
    for (let y = H - 1; y >= 0; y--) if (grid[y][x] > 0) return y;
    return -1;
  }
  function pull(cid) {
    for (let x = 0; x < W; x++) {
      const y = lowest(x);
      if (y >= 0 && grid[y][x] === cid) {
        for (let yy = y; yy > 0; yy--) grid[yy][x] = grid[yy - 1][x];
        grid[0][x] = 0;
        return true;
      }
    }
    return false;
  }

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
      for (let i = activeBuckets.length - 1; i >= 0; i--) {
        const b = activeBuckets[i];
        if (b.isOpen) {
          while (b.collected < b.capacity && pull(b.colorId)) {
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
      const remSand = grid.flat().filter((c) => c > 0).length;
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
const files = fs.readdirSync(levelsDir).filter((f) => f.endsWith('.json')).sort();

let allPassed = true;
for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(levelsDir, file), 'utf8'));
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

  const sim = simulateFullGame(data);
  if (!sim.won) {
    console.error(`[FAIL] ${file}: Bot solver failed:`, sim);
    allPassed = false;
  } else {
    console.log(
      `[PASS] ${file} (${data.title}) — Grid ${data.sandBoard.width}x${data.sandBoard.height}, Colors: [${Object.keys(sandCounts).join(', ')}], Buckets: ${data.bucketQueue.length}, Screws: ${Object.values(screwCounts).reduce((a, b) => a + b, 0)}, Solved in ${sim.steps} steps (2 slots)`
    );
  }
}

if (!allPassed) process.exit(1);

