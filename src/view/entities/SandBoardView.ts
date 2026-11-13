import { ColorManager } from '../../core/ColorManager';
import { SandBoardModel } from '../../game/models/SandBoardModel';
import { ColorId } from '../../types/level.types';
import { drawRoundedRect } from '../../utils/canvas.utils';
import { createLayer, getRenderScale, hash01, Layer } from '../SpriteCache';
import { Theme } from '../theme';

const SUB = 3; // 3x3 fine sand beads per logical cell
const SUB_COUNT = SUB * SUB;
const SHADES = 4;
const ATLAS_ROWS = 16; // colorIds 0..15

interface FineSandState {
  boardRef: SandBoardModel;
  fineW: number;
  fineH: number;
  /** colorId per fine grain (0 = empty) */
  colors: Uint8Array;
  /** organic shade variation (0..3) per fine grain (DrawableChunk.cs GetValueVariation) */
  shades: Uint8Array;
  /** per-cell bead jitter in grain units (x, y interleaved) — position based, computed once */
  jitter: Float32Array;
  syncedDrainedCells: number;
  lastSuctionFineX: number;
  stepParity: number;
  /** true when the last CA pass moved nothing → skip simulation until the next carve */
  settled: boolean;
  /** per-row dirty fine-column range [rowMinX, rowMaxX] (min > max = clean) for partial repaint */
  rowMinX: Int32Array;
  rowMaxX: Int32Array;
  anyDirty: boolean;
  /** scratch ranges for the clear / repaint regions (no per-frame allocation) */
  clrMin: Int32Array;
  clrMax: Int32Array;
  targetCounts: Int32Array;
  currentCounts: Int32Array;
}

interface BoardLayers {
  fw: number;
  fh: number;
  cellSize: number;
  dpr: number;
  bezel: number;
  /** drop shadow + bezel body + empty tray (drawn under the sand) */
  back: Layer;
  /** bezel rim with a transparent rounded window + inner shadow (drawn over the sand) */
  front: Layer;
  /** device-pixel bead layer, repainted only on dirty rows */
  sand: Layer;
  pad: number;
  boardRef: SandBoardModel | null;
}

export class SandBoardView {
  private static state: FineSandState | null = null;
  private static layers: BoardLayers | null = null;
  /** bead atlas in device pixels: column = shade, row = colorId (rebuilt when grain size changes) */
  private static beadAtlas: Layer | null = null;
  private static beadAtlasCell = 0;
  private static beadAtlasReady = new Uint8Array(ATLAS_ROWS * SHADES);
  private static gapColors = new Map<number, string>();

  /**
   * Notifies the cellular automaton where the latest suction occurred so the circular scoop
   * happens right above the open bucket on the Linear Conveyor (matching DrawableChunk.Suction).
   */
  static notifySuctionColumn(logicalCol: number): void {
    if (SandBoardView.state) {
      SandBoardView.state.lastSuctionFineX = Math.round((logicalCol + 0.5) * SUB);
    }
  }

  private static ensureState(board: SandBoardModel): FineSandState {
    if (SandBoardView.state && SandBoardView.state.boardRef === board) {
      return SandBoardView.state;
    }

    const fineW = board.width * SUB;
    const fineH = board.height * SUB;
    const colors = new Uint8Array(fineW * fineH);
    const shades = new Uint8Array(fineW * fineH);
    const jitter = new Float32Array(fineW * fineH * 2);

    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const cell = board.cells[y][x];
        const cid = cell ? cell.colorId : 0;
        for (let sy = 0; sy < SUB; sy++) {
          for (let sx = 0; sx < SUB; sx++) {
            const fx = x * SUB + sx;
            const fy = y * SUB + sy;
            const idx = fy * fineW + fx;
            colors[idx] = cid;
            shades[idx] = Math.floor(hash01(fx + 17, fy + 101) * SHADES) % SHADES;
          }
        }
      }
    }
    for (let fy = 0; fy < fineH; fy++) {
      for (let fx = 0; fx < fineW; fx++) {
        const idx = (fy * fineW + fx) * 2;
        jitter[idx] = (hash01(fx, fy) - 0.5) * 0.3;
        jitter[idx + 1] = (hash01(fx + 911, fy + 37) - 0.5) * 0.26;
      }
    }

    const nextState: FineSandState = {
      boardRef: board,
      fineW,
      fineH,
      colors,
      shades,
      jitter,
      syncedDrainedCells: board.getDrainedCells(),
      lastSuctionFineX: Math.floor(fineW / 2),
      stepParity: 0,
      settled: false,
      rowMinX: new Int32Array(fineH).fill(fineW),
      rowMaxX: new Int32Array(fineH).fill(-1),
      anyDirty: false,
      clrMin: new Int32Array(fineH),
      clrMax: new Int32Array(fineH),
      targetCounts: new Int32Array(16),
      currentCounts: new Int32Array(16)
    };
    SandBoardView.state = nextState;
    if (SandBoardView.layers) SandBoardView.layers.boardRef = null; // force full repaint
    return nextState;
  }

  private static markDirty(st: FineSandState, row: number, col: number): void {
    if (col < st.rowMinX[row]) st.rowMinX[row] = col;
    if (col > st.rowMaxX[row]) st.rowMaxX[row] = col;
    st.anyDirty = true;
  }

  /**
   * Carves excess fine grains (vs. the logical SandBoardModel) near the suction point and runs the
   * gravity/avalanche cellular automaton. Work is skipped entirely while the sand is settled.
   */
  private static syncSuctionAndStepPhysics(st: FineSandState, board: SandBoardModel): void {
    const drained = board.getDrainedCells();
    if (drained !== st.syncedDrainedCells) {
      st.syncedDrainedCells = drained;
      SandBoardView.carveToMatch(st, board);
      st.settled = false;
    }
    if (st.settled) return;

    const { fineW, fineH, colors, shades } = st;
    const prefX = st.lastSuctionFineX;
    let movedAny = false;

    // 2 substeps of SimulateAllSubstepsJob (gravity ↓ + diagonal avalanche ↙ ↘)
    for (let step = 0; step < 2; step++) {
      st.stepParity ^= 1;
      const leftToRight = st.stepParity === 0;

      for (let fy = fineH - 2; fy >= 0; fy--) {
        const row = fy * fineW;
        const below = row + fineW;
        for (let k = 0; k < fineW; k++) {
          const fx = leftToRight ? k : fineW - 1 - k;
          const idx = row + fx;
          const cid = colors[idx];
          if (cid === 0) continue;

          const belowIdx = below + fx;
          if (colors[belowIdx] === 0) {
            colors[belowIdx] = cid;
            shades[belowIdx] = shades[idx];
            colors[idx] = 0;
            movedAny = true;
            SandBoardView.markDirty(st, fy, fx);
            SandBoardView.markDirty(st, fy + 1, fx);
            continue;
          }

          const canLeft = fx > 0 && colors[belowIdx - 1] === 0 && colors[idx - 1] === 0;
          const canRight = fx < fineW - 1 && colors[belowIdx + 1] === 0 && colors[idx + 1] === 0;
          if (!canLeft && !canRight) continue;

          let dir: number;
          if (canLeft && canRight) {
            dir = fx < prefX ? 1 : fx > prefX ? -1 : leftToRight ? 1 : -1;
          } else {
            dir = canLeft ? -1 : 1;
          }
          const dstIdx = belowIdx + dir;
          colors[dstIdx] = cid;
          shades[dstIdx] = shades[idx];
          colors[idx] = 0;
          movedAny = true;
          SandBoardView.markDirty(st, fy, fx);
          SandBoardView.markDirty(st, fy + 1, fx + dir);
        }
      }
    }
    if (!movedAny) st.settled = true;
  }

  private static carveToMatch(st: FineSandState, board: SandBoardModel): void {
    const targetCounts = st.targetCounts;
    const currentCounts = st.currentCounts;
    targetCounts.fill(0);
    currentCounts.fill(0);
    for (let y = 0; y < board.height; y++) {
      const rowCells = board.cells[y];
      for (let x = 0; x < board.width; x++) {
        const c = rowCells[x];
        if (c && c.colorId > 0 && c.colorId < 16) targetCounts[c.colorId] += SUB_COUNT;
      }
    }
    const { fineW, fineH, colors } = st;
    const total = fineW * fineH;
    for (let i = 0; i < total; i++) {
      const cid = colors[i];
      if (cid > 0 && cid < 16) currentCounts[cid]++;
    }

    const prefX = st.lastSuctionFineX;
    for (let cid = 1; cid < 16; cid++) {
      let excess = currentCounts[cid] - targetCounts[cid];
      if (excess <= 0) continue;
      while (excess > 0) {
        let removedAny = false;
        for (let fy = fineH - 1; fy >= 0 && excess > 0; fy--) {
          for (let d = 0; d < fineW && excess > 0; d++) {
            const x1 = prefX + d;
            if (x1 >= 0 && x1 < fineW) {
              const idx1 = fy * fineW + x1;
              if (colors[idx1] === cid) {
                colors[idx1] = 0;
                excess--;
                removedAny = true;
                SandBoardView.markDirty(st, fy, x1);
                if (excess <= 0) break;
              }
            }
            if (d > 0) {
              const x2 = prefX - d;
              if (x2 >= 0 && x2 < fineW) {
                const idx2 = fy * fineW + x2;
                if (colors[idx2] === cid) {
                  colors[idx2] = 0;
                  excess--;
                  removedAny = true;
                  SandBoardView.markDirty(st, fy, x2);
                  if (excess <= 0) break;
                }
              }
            }
          }
        }
        if (!removedAny) break;
      }
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Bead sprites (device pixels)
  // ---------------------------------------------------------------------------------------------

  /**
   * Ensures the bead for (colorId, shade) is painted into the shared atlas and returns the atlas
   * cell size in device px (0 when canvases are unavailable). One atlas texture for every bead keeps
   * the partial repaints batched (dozens of tiny source canvases caused raster stalls on mobile GPUs).
   */
  private static ensureBead(colorId: ColorId, shade: number, beadPx: number): number {
    const cell = Math.max(3, Math.ceil(beadPx) + 2);
    if (!SandBoardView.beadAtlas || cell !== SandBoardView.beadAtlasCell) {
      SandBoardView.beadAtlas = createLayer(cell * SHADES, cell * ATLAS_ROWS, 1);
      SandBoardView.beadAtlasCell = cell;
      SandBoardView.beadAtlasReady.fill(0);
    }
    const atlas = SandBoardView.beadAtlas;
    if (!atlas) return 0;
    const k = (colorId & (ATLAS_ROWS - 1)) * SHADES + shade;
    if (SandBoardView.beadAtlasReady[k]) return cell;
    SandBoardView.beadAtlasReady[k] = 1;

    const c = atlas.ctx;
    const ox = shade * cell;
    const oy = (colorId & (ATLAS_ROWS - 1)) * cell;
    const pal = ColorManager.getColor(colorId);
    const shadeShift = (shade - (SHADES - 1) / 2) * 0.07;
    const base =
      shadeShift >= 0
        ? ColorManager.mixHex(pal.sandHex, '#ffffff', shadeShift)
        : ColorManager.mixHex(pal.sandHex, pal.shadowHex, -shadeShift * 1.3);
    const light = ColorManager.mixHex(base, '#ffffff', 0.5);
    const dark = ColorManager.mixHex(base, pal.shadowHex, 0.55);
    const cx = ox + cell / 2;
    const cy = oy + cell / 2;
    const r = beadPx / 2;

    c.clearRect(ox, oy, cell, cell);
    const g = c.createRadialGradient(cx - r * 0.32, cy - r * 0.36, r * 0.05, cx, cy, r);
    g.addColorStop(0, light);
    g.addColorStop(0.5, base);
    g.addColorStop(1, dark);
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
    if (r >= 2.2) {
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.beginPath();
      c.arc(cx - r * 0.34, cy - r * 0.38, Math.max(0.6, r * 0.22), 0, Math.PI * 2);
      c.fill();
    }
    return cell;
  }

  private static gapColor(colorId: ColorId): string {
    let s = SandBoardView.gapColors.get(colorId);
    if (!s) {
      const pal = ColorManager.getColor(colorId);
      s = ColorManager.mixHex(pal.sandHex, pal.shadowHex, 0.55);
      SandBoardView.gapColors.set(colorId, s);
    }
    return s;
  }

  // ---------------------------------------------------------------------------------------------
  // Static bezel layers (rebuilt only on resize / DPR change)
  // ---------------------------------------------------------------------------------------------

  private static ensureLayers(fw: number, fh: number, cellSize: number, dpr: number): BoardLayers | null {
    const L = SandBoardView.layers;
    if (L && L.fw === fw && L.fh === fh && L.cellSize === cellSize && L.dpr === dpr) return L;

    const bezel = Math.round(Math.max(7, Math.min(14, cellSize * 0.95)));
    const innerR = Math.max(6, Math.min(16, cellSize * 1.0));
    const pad = bezel + 10;
    const totalW = fw + pad * 2;
    const totalH = fh + pad * 2 + 4;

    const back = createLayer(totalW, totalH, dpr);
    const front = createLayer(totalW, totalH, dpr);
    const sand = createLayer(Math.round(fw * dpr), Math.round(fh * dpr), 1);
    if (!back || !front || !sand) return null;

    // Local coordinates: picture window at (pad, pad, fw, fh)
    const ox = pad;
    const oy = pad;
    const outerR = innerR + bezel;

    // --- BACK: soft drop shadow + empty tray ---------------------------------------------------
    {
      const c = back.ctx;
      c.save();
      c.shadowColor = Theme.frameShadow;
      c.shadowBlur = 10 * dpr;
      c.shadowOffsetY = 4 * dpr;
      c.fillStyle = Theme.frameOuterBottom;
      drawRoundedRect(c, ox - bezel, oy - bezel, fw + bezel * 2, fh + bezel * 2, outerR);
      c.fill();
      c.restore();

      const tray = c.createLinearGradient(0, oy, 0, oy + fh);
      tray.addColorStop(0, Theme.trayEmptyTop);
      tray.addColorStop(1, Theme.trayEmptyBottom);
      c.fillStyle = tray;
      drawRoundedRect(c, ox - 1, oy - 1, fw + 2, fh + 2, innerR);
      c.fill();
      // faint dotted "socket" texture so drained areas still read as a bead tray
      c.fillStyle = 'rgba(120, 150, 210, 0.16)';
      const gs = cellSize / SUB;
      for (let y = oy + gs * 0.5; y < oy + fh; y += gs * 2) {
        for (let x = ox + gs * 0.5; x < ox + fw; x += gs * 2) {
          c.beginPath();
          c.arc(x, y, gs * 0.35, 0, Math.PI * 2);
          c.fill();
        }
      }
    }

    // --- FRONT: bezel body with transparent window ---------------------------------------------
    {
      const c = front.ctx;
      // Outer body (white → periwinkle)
      const body = c.createLinearGradient(0, oy - bezel, 0, oy + fh + bezel);
      body.addColorStop(0, Theme.frameOuterTop);
      body.addColorStop(0.45, Theme.frameOuterMid);
      body.addColorStop(1, Theme.frameOuterBottom);
      c.fillStyle = body;
      drawRoundedRect(c, ox - bezel, oy - bezel, fw + bezel * 2, fh + bezel * 2, outerR);
      c.fill();
      c.strokeStyle = Theme.frameOutline;
      c.lineWidth = 1.5;
      drawRoundedRect(c, ox - bezel + 0.75, oy - bezel + 0.75, fw + bezel * 2 - 1.5, fh + bezel * 2 - 1.5, outerR - 0.75);
      c.stroke();

      // Top specular line on the bezel
      c.strokeStyle = 'rgba(255,255,255,0.95)';
      c.lineWidth = 1.5;
      drawRoundedRect(c, ox - bezel + 2.5, oy - bezel + 2.5, fw + bezel * 2 - 5, fh + bezel * 2 - 5, outerR - 2.5);
      c.stroke();

      // Inner lip (recessed light-blue ring around the window)
      const lip = Math.max(2.5, bezel * 0.36);
      const lipGrad = c.createLinearGradient(0, oy - lip, 0, oy + fh + lip);
      lipGrad.addColorStop(0, Theme.frameLipTop);
      lipGrad.addColorStop(1, Theme.frameLipBottom);
      c.fillStyle = lipGrad;
      drawRoundedRect(c, ox - lip, oy - lip, fw + lip * 2, fh + lip * 2, innerR + lip);
      c.fill();

      // Punch the picture window
      c.globalCompositeOperation = 'destination-out';
      c.fillStyle = '#000';
      drawRoundedRect(c, ox, oy, fw, fh, innerR);
      c.fill();
      c.globalCompositeOperation = 'source-over';

      // Inner shadow inside the window (top + sides), clipped to the window
      c.save();
      drawRoundedRect(c, ox, oy, fw, fh, innerR);
      c.clip();
      const topShadowH = Math.max(6, cellSize * 0.9);
      const ts = c.createLinearGradient(0, oy, 0, oy + topShadowH);
      ts.addColorStop(0, 'rgba(20, 44, 110, 0.32)');
      ts.addColorStop(1, 'rgba(20, 44, 110, 0)');
      c.fillStyle = ts;
      c.fillRect(ox, oy, fw, topShadowH);
      const sideW = Math.max(3, cellSize * 0.4);
      const ls = c.createLinearGradient(ox, 0, ox + sideW, 0);
      ls.addColorStop(0, 'rgba(20, 44, 110, 0.18)');
      ls.addColorStop(1, 'rgba(20, 44, 110, 0)');
      c.fillStyle = ls;
      c.fillRect(ox, oy, sideW, fh);
      const rs = c.createLinearGradient(ox + fw, 0, ox + fw - sideW, 0);
      rs.addColorStop(0, 'rgba(20, 44, 110, 0.18)');
      rs.addColorStop(1, 'rgba(20, 44, 110, 0)');
      c.fillStyle = rs;
      c.fillRect(ox + fw - sideW, oy, sideW, fh);
      c.strokeStyle = 'rgba(30, 60, 130, 0.35)';
      c.lineWidth = 1;
      drawRoundedRect(c, ox + 0.5, oy + 0.5, fw - 1, fh - 1, innerR);
      c.stroke();
      c.restore();
    }

    const next: BoardLayers = { fw, fh, cellSize, dpr, bezel, back, front, sand, pad, boardRef: null };
    SandBoardView.layers = next;
    return next;
  }

  /**
   * Repaints only the cells that changed since the last frame (or everything after a resize / new
   * level) into the cached bead layer. Dirty cells are tracked per row as [minX, maxX]; the cleared
   * region is widened by one cell (beads overlap their neighbours) and repainted under a clip.
   */
  private static repaintSand(L: BoardLayers, st: FineSandState): void {
    const full = L.boardRef !== st.boardRef;
    if (!full && !st.anyDirty) return;
    L.boardRef = st.boardRef;

    const c = L.sand.ctx;
    const cw = L.sand.canvas.width;
    const ch = L.sand.canvas.height;
    const { fineW, fineH, colors, shades, jitter, rowMinX, rowMaxX, clrMin, clrMax } = st;
    const gx = cw / fineW;
    const gy = ch / fineH;
    const g = Math.min(gx, gy);
    const beadPx = g * 1.2;

    // 1. Clear ranges per row: union of dirty ranges of rows r-1..r+1, widened by one column.
    let rowLo = fineH;
    let rowHi = -1;
    for (let r = 0; r < fineH; r++) {
      let mn = fineW;
      let mx = -1;
      if (full) {
        mn = 0;
        mx = fineW - 1;
      } else {
        for (let rr = r - 1; rr <= r + 1; rr++) {
          if (rr < 0 || rr >= fineH) continue;
          if (rowMinX[rr] < mn) mn = rowMinX[rr];
          if (rowMaxX[rr] > mx) mx = rowMaxX[rr];
        }
      }
      if (mx >= mn) {
        clrMin[r] = Math.max(0, mn - 1);
        clrMax[r] = Math.min(fineW - 1, mx + 1);
        if (r < rowLo) rowLo = r;
        rowHi = r;
      } else {
        clrMin[r] = fineW;
        clrMax[r] = -1;
      }
    }
    rowMinX.fill(fineW);
    rowMaxX.fill(-1);
    st.anyDirty = false;
    if (rowHi < 0) return;

    c.save();
    c.beginPath();
    for (let r = rowLo; r <= rowHi; r++) {
      if (clrMax[r] < clrMin[r]) continue;
      const x0 = Math.round(clrMin[r] * gx);
      const x1 = Math.round((clrMax[r] + 1) * gx);
      const y0 = Math.round(r * gy);
      const y1 = Math.round((r + 1) * gy);
      c.rect(x0, y0, x1 - x0, y1 - y0);
    }
    c.clip();
    const cy0 = Math.round(rowLo * gy);
    c.clearRect(0, cy0, cw, Math.round((rowHi + 1) * gy) - cy0);

    // 2. Repaint ranges: rows rowLo-1..rowHi+1, x-range = union of clear ranges of r-1..r+1 widened
    //    by one (stored in rowMinX/rowMaxX as scratch, reset afterwards).
    const p0 = Math.max(0, rowLo - 1);
    const p1 = Math.min(fineH - 1, rowHi + 1);
    for (let r = p0; r <= p1; r++) {
      let mn = fineW;
      let mx = -1;
      for (let rr = r - 1; rr <= r + 1; rr++) {
        if (rr < 0 || rr >= fineH) continue;
        if (clrMin[rr] < mn) mn = clrMin[rr];
        if (clrMax[rr] > mx) mx = clrMax[rr];
      }
      rowMinX[r] = mx >= mn ? Math.max(0, mn - 1) : fineW;
      rowMaxX[r] = mx >= mn ? Math.min(fineW - 1, mx + 1) : -1;
    }

    // Pass 1: gap underlay (run-length per row, snapped to whole device pixels so rows never seam)
    // so the spaces between beads read as shaded sand instead of the tray color.
    for (let fy = p0; fy <= p1; fy++) {
      const xa = rowMinX[fy];
      const xb = rowMaxX[fy];
      if (xb < xa) continue;
      const row = fy * fineW;
      const ry0 = Math.round(fy * gy);
      const ry1 = Math.round((fy + 1) * gy);
      let fx = xa;
      while (fx <= xb) {
        const cid = colors[row + fx];
        if (cid === 0) {
          fx++;
          continue;
        }
        let end = fx + 1;
        while (end <= xb && colors[row + end] === cid) end++;
        c.fillStyle = SandBoardView.gapColor(cid);
        const rx0 = Math.round(fx * gx);
        c.fillRect(rx0, ry0, Math.round(end * gx) - rx0, ry1 - ry0);
        fx = end;
      }
    }

    // Pass 2: beads (single atlas texture → batched draws)
    const half = beadPx / 2;
    SandBoardView.ensureBead(1, 0, beadPx);
    const atlas = SandBoardView.beadAtlas ? SandBoardView.beadAtlas.canvas : null;
    for (let fy = p0; fy <= p1; fy++) {
      const xa = rowMinX[fy];
      const xb = rowMaxX[fy];
      if (xb < xa) continue;
      const row = fy * fineW;
      const cyBase = (fy + 0.5) * gy;
      for (let fx = xa; fx <= xb; fx++) {
        const idx = row + fx;
        const cid = colors[idx];
        if (cid === 0) continue;
        const shade = shades[idx];
        const cell = SandBoardView.ensureBead(cid, shade, beadPx);
        const cx = (fx + 0.5) * gx + jitter[idx * 2] * g;
        const cy = cyBase + jitter[idx * 2 + 1] * g;
        if (atlas && cell > 0) {
          c.drawImage(
            atlas,
            shade * cell,
            (cid & (ATLAS_ROWS - 1)) * cell,
            cell,
            cell,
            Math.round(cx - cell / 2),
            Math.round(cy - cell / 2),
            cell,
            cell
          );
        } else {
          c.fillStyle = ColorManager.getColor(cid).sandHex;
          c.fillRect(cx - half, cy - half, beadPx, beadPx);
        }
      }
    }
    c.restore();
    rowMinX.fill(fineW);
    rowMaxX.fill(-1);
  }

  static draw(
    ctx: CanvasRenderingContext2D,
    board: SandBoardModel,
    frameX: number,
    frameY: number,
    cellSize: number
  ): void {
    const fw = board.width * cellSize;
    const fh = board.height * cellSize;
    const dpr = getRenderScale(ctx);

    const st = SandBoardView.ensureState(board);
    SandBoardView.syncSuctionAndStepPhysics(st, board);

    const L = SandBoardView.ensureLayers(fw, fh, cellSize, dpr);
    if (!L) {
      SandBoardView.drawFallback(ctx, st, frameX, frameY, fw, fh, cellSize);
      return;
    }
    SandBoardView.repaintSand(L, st);

    const lx = frameX - L.pad;
    const ly = frameY - L.pad;
    const lw = L.back.canvas.width / dpr;
    const lh = L.back.canvas.height / dpr;
    ctx.drawImage(L.back.canvas, lx, ly, lw, lh);
    ctx.drawImage(L.sand.canvas, frameX, frameY, fw, fh);
    ctx.drawImage(L.front.canvas, lx, ly, lw, lh);
  }

  /** Bezel thickness (CSS px) currently used around the picture — useful for layout clearance. */
  static getBezelThickness(cellSize: number): number {
    return Math.round(Math.max(7, Math.min(14, cellSize * 0.95)));
  }

  private static drawFallback(
    ctx: CanvasRenderingContext2D,
    st: FineSandState,
    frameX: number,
    frameY: number,
    fw: number,
    fh: number,
    cellSize: number
  ): void {
    ctx.fillStyle = Theme.frameOuterMid;
    drawRoundedRect(ctx, frameX - 10, frameY - 10, fw + 20, fh + 20, 16);
    ctx.fill();
    const g = cellSize / SUB;
    const { fineW, fineH, colors } = st;
    for (let fy = 0; fy < fineH; fy++) {
      for (let fx = 0; fx < fineW; fx++) {
        const cid = colors[fy * fineW + fx];
        if (cid === 0) continue;
        ctx.fillStyle = ColorManager.getColor(cid).sandHex;
        ctx.fillRect(frameX + fx * g, frameY + fy * g, g + 0.3, g + 0.3);
      }
    }
  }
}
