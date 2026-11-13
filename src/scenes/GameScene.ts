import { BalanceConfig, GameConfig } from '../config/game.config';
import { AudioManager } from '../core/AudioManager';
import { InputManager } from '../core/InputManager';
import { SaveManager } from '../core/SaveManager';
import { StateMachine } from '../core/StateMachine';
import { GameState } from '../game/GameState';
import { LevelLoader } from '../game/level/LevelLoader';
import { SandBucketModel } from '../game/models/SandBucketModel';
import { BoosterRule } from '../game/rules/BoosterRule';
import { SandSuctionRule } from '../game/rules/SandSuctionRule';
import { ScrewFlightPlan, ScrewMatchRule } from '../game/rules/ScrewMatchRule';
import { BoosterBarView } from '../ui/hud/BoosterBarView';
import { HandBoosterOverlay } from '../ui/hud/HandBoosterOverlay';
import { TopHudView } from '../ui/hud/TopHudView';
import { BufferDockView } from '../view/entities/BufferDockView';
import { ConveyorLayout, LinearConveyorView } from '../view/entities/LinearConveyorView';
import { QueueColumnsLayout, QueueColumnView } from '../view/entities/QueueColumnView';
import { SandBoardView } from '../view/entities/SandBoardView';
import { SandBucketView } from '../view/entities/SandBucketView';
import { ScrewView } from '../view/entities/ScrewView';
import { ConfettiFX } from '../view/fx/ConfettiFX';
import { SandStreamFX } from '../view/fx/SandStreamFX';
import { ShuffleSpiralFX } from '../view/fx/ShuffleSpiralFX';
import { MenuScene } from './MenuScene';
import { ResultScene } from './ResultScene';

interface ActiveFlyingScrew {
  plan: ScrewFlightPlan;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  startedAtMs: number;
}

export class GameScene {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stageEl: HTMLElement;
  private hintEl: HTMLElement;

  private state!: GameState;
  private fsm = new StateMachine();
  private input = new InputManager();

  private sandStreamFX = new SandStreamFX();
  private shuffleFX = new ShuffleSpiralFX();
  private confettiFX = new ConfettiFX();

  private topHud: TopHudView;
  private boosterBar: BoosterBarView;
  private handOverlay: HandBoosterOverlay;
  private menuScene: MenuScene;
  private resultScene: ResultScene;

  private flyingScrews: ActiveFlyingScrew[] = [];
  private bgImage: HTMLImageElement | null = null;
  private bgImageLoaded = false;
  private gameSpeed: 1 | 2 | 5 = 1;

  // Responsive layout metrics
  private viewW = 480;
  private viewH = 840;
  private dpr = 1;
  private boardFrameX = 0;
  private boardFrameY = 0;
  private boardCellSize = 20;
  private boardBottomY = 0;
  private conveyorLayout!: ConveyorLayout;
  private bufferDockY = 0;
  private bufferSlotSize = 32;
  private queueLayout!: QueueColumnsLayout;

  constructor(canvas: HTMLCanvasElement, stageEl: HTMLElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.stageEl = stageEl;
    this.hintEl = document.getElementById('gameplay-hint')!;

    this.topHud = new TopHudView({
      onRestart: () => this.startLevel(this.state.levelData.levelId),
      onOpenLevelMenu: () => this.menuScene.show(this.state.levelData.levelId),
      onToggleSound: () => {
        AudioManager.setSoundEnabled(!AudioManager.isSoundEnabled());
        this.syncHud();
      },
      onToggleSpeed: () => this.cycleGameSpeed()
    });

    this.boosterBar = new BoosterBarView({
      onUseExtraSlot: () => this.handleUseExtraSlot(),
      onUseHand: () => this.handleToggleHandBooster(),
      onUseShuffle: () => this.handleUseShuffleBooster()
    });

    this.handOverlay = new HandBoosterOverlay(() => {
      if (this.fsm.phase === 'BOOSTER_HAND_SELECT') {
        this.fsm.transitionTo('PLAYING');
        this.handOverlay.setVisible(false);
        this.syncHud();
      }
    });

    this.menuScene = new MenuScene((levelId) => this.startLevel(levelId));

    this.resultScene = new ResultScene({
      onNextLevel: () => {
        const nextId = (this.state.levelData.levelId % 5) + 1;
        SaveManager.setCurrentLevel(nextId);
        this.startLevel(nextId);
      },
      onRetryLevel: () => this.startLevel(this.state.levelData.levelId),
      onReviveBuffer: () => {
        if (this.state.bufferDock.addReviveSlot()) {
          this.state.revivesRemaining--;
          this.fsm.transitionTo('PLAYING');
          this.syncHud();
        }
      }
    });

    this.bindEvents();
    this.initBackgroundArt();
  }

  private initBackgroundArt(): void {
    if (typeof Image === 'undefined') return;
    const img = new Image();
    img.onload = () => {
      this.bgImageLoaded = true;
    };
    img.src = './assets/images/ui/unity_game_bg.jpg';
    this.bgImage = img;
  }

  startLevel(levelId: number): void {
    const levelData = LevelLoader.loadLevel(levelId);
    SaveManager.setCurrentLevel(levelData.levelId);
    this.state = new GameState(levelData);
    this.flyingScrews = [];
    this.sandStreamFX.clear();
    this.confettiFX.clear();
    this.handOverlay.setVisible(false);
    this.resultScene.hide();
    this.fsm.transitionTo('PLAYING');

    this.recalculateLayout();
    this.state.conveyor.refillSlots(
      this.conveyorLayout.trackStartX,
      this.conveyorLayout.trackEndX,
      this.conveyorLayout.visibleMinX,
      this.conveyorLayout.visibleMaxX,
      true
    );
    this.hintEl.style.opacity = levelData.levelId === 1 ? '1' : '0';
    this.syncHud();
  }

  recalculateLayout(): void {
    const rect = this.stageEl.getBoundingClientRect();
    this.viewW = Math.max(320, rect.width);
    this.viewH = Math.max(540, rect.height);
    this.dpr = Math.min(GameConfig.maxDevicePixelRatio, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.viewW * this.dpr);
    this.canvas.height = Math.round(this.viewH * this.dpr);

    if (!this.state) return;

    const topAreaY = 58;
    const maxBoardH = this.viewH * 0.295;
    const gw = this.state.sandBoard.width;
    const gh = this.state.sandBoard.height;

    this.boardCellSize = Math.max(
      7,
      Math.floor(Math.min((this.viewW - 44) / gw, (maxBoardH - 12) / gh))
    );
    this.boardFrameX = Math.round((this.viewW - gw * this.boardCellSize) / 2);
    this.boardFrameY = topAreaY + 10;
    this.boardBottomY = this.boardFrameY + gh * this.boardCellSize;

    const bucketWidth = Math.min(76, (this.viewW - 28) / 4.4);
    const bucketCenterY = this.boardBottomY + this.viewH * 0.068;
    const beltLeftX = 8;
    const beltRightX = this.viewW - 8;
    const tunnelWidth = bucketWidth * 0.5;
    const visibleMinX = beltLeftX + tunnelWidth * 0.55;
    const visibleMaxX = beltRightX - tunnelWidth * 0.55;
    const trackStartX = visibleMinX - bucketWidth * 0.5;
    const trackEndX = visibleMaxX + bucketWidth * 0.5;

    this.conveyorLayout = {
      beltLeftX,
      beltRightX,
      tunnelWidth,
      visibleMinX,
      visibleMaxX,
      trackStartX,
      trackEndX,
      bucketCenterY,
      bucketWidth
    };

    this.bufferDockY = bucketCenterY + bucketWidth * 0.92;
    this.bufferSlotSize = Math.min(33, (this.viewW - 96) / 6.2);

    const zoneX = 14;
    const zoneY = this.bufferDockY + this.bufferSlotSize * 0.85 + 18;
    const zoneW = this.viewW - 28;
    const bottomBoosterBarReserve = 96;
    const zoneH = Math.max(136, this.viewH - zoneY - bottomBoosterBarReserve);

    const numCols = this.state.queueColumns.length;
    const visibleDepth = BalanceConfig.queueColumns.visibleDepth;
    const tubeWidth = Math.min(
      72,
      ((zoneW - 14) / numCols) * 0.82,
      (zoneH - 36) / (visibleDepth * 0.78 + 0.48)
    );
    const screwRadius = tubeWidth * 0.35;
    const rowStepY = screwRadius * 2.12;

    this.queueLayout = {
      zoneX,
      zoneY,
      zoneW,
      zoneH,
      tubeWidth,
      screwRadius,
      rowStepY,
      visibleDepth
    };
  }

  private bindEvents(): void {
    this.canvas.addEventListener('pointerdown', (e) => {
      AudioManager.unlock();
      this.input.onPointerDown();
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.handleCanvasTap(x, y, performance.now());
    });

    window.addEventListener('pointerup', () => this.input.onPointerUp());
    window.addEventListener('pointercancel', () => this.input.onPointerUp());
  }

  cycleGameSpeed(): void {
    if (this.gameSpeed === 1) this.gameSpeed = 2;
    else if (this.gameSpeed === 2) this.gameSpeed = 5;
    else this.gameSpeed = 1;
    AudioManager.playUiClick();
    this.topHud.setSpeed(this.gameSpeed);
  }

  private handleCanvasTap(x: number, y: number, nowMs: number): void {
    if (!this.state) return;

    // 1. If in BOOSTER_HAND_SELECT mode, check if user tapped a locked bucket on the conveyor!
    if (this.fsm.phase === 'BOOSTER_HAND_SELECT') {
      const { bucketCenterY, bucketWidth } = this.conveyorLayout;
      if (Math.abs(y - bucketCenterY) <= bucketWidth * 0.68) {
        for (let i = 0; i < this.state.conveyor.activeSlots; i++) {
          const b = this.state.conveyor.slots[i];
          if (
            b &&
            !b.isOpen &&
            b.getMissingScrewsCount() > 0 &&
            Math.abs(x - b.visualX) <= bucketWidth * 0.5
          ) {
            this.executeHandBoosterOnBucket(b, i, nowMs);
            return;
          }
        }
      }
      return;
    }

    if (this.fsm.phase !== 'PLAYING') return;

    // 2. Check if user tapped the in-canvas green [+] ExtraSlot button next to BufferDock
    const extraBtn = BufferDockView.getExtraSlotButtonCenter(
      this.viewW / 2,
      this.bufferDockY,
      this.state.bufferDock.getCapacity(),
      this.bufferSlotSize
    );
    if (Math.hypot(x - extraBtn.x, y - extraBtn.y) <= extraBtn.radius * 1.25) {
      this.handleUseExtraSlot();
      return;
    }

    // 3. Check if user tapped a LOCKED BAY on the conveyor (Fish Jam Fever style: tap to unlock bay directly!)
    const { bucketCenterY, bucketWidth, trackStartX, trackEndX, visibleMinX, visibleMaxX } = this.conveyorLayout;
    if (Math.abs(y - bucketCenterY) <= bucketWidth * 0.72) {
      for (let i = this.state.conveyor.activeSlots; i < this.state.conveyor.maxActiveSlots; i++) {
        const bayX = this.state.conveyor.getSlotX(i, trackStartX, trackEndX, visibleMinX, visibleMaxX);
        if (Math.abs(x - bayX) <= bucketWidth * 0.5) {
          this.handleUseExtraSlot();
          return;
        }
      }
    }

    // 4. Check if user tapped a locked bucket on the conveyor to auto-pull a matching top screw from QueueColumns
    if (Math.abs(y - bucketCenterY) <= bucketWidth * 0.62) {
      for (let i = 0; i < this.state.conveyor.activeSlots; i++) {
        const b = this.state.conveyor.slots[i];
        if (
          b &&
          !b.isOpen &&
          b.getMissingScrewsCount() > 0 &&
          Math.abs(x - b.visualX) <= bucketWidth * 0.5
        ) {
          const matchingColIdx = this.state.queueColumns.findIndex(
            (col) => col.peekTop()?.colorId === b.colorId
          );
          if (matchingColIdx >= 0) {
            this.tapQueueColumn(matchingColIdx, nowMs);
            return;
          }
        }
      }
    }

    // 4. Check if user tapped one of the QueueColumns
    const { zoneY, zoneH, zoneW } = this.queueLayout;
    if (y >= zoneY - 16 && y <= zoneY + zoneH + 16) {
      const cols = this.state.queueColumns;
      const pitch = (zoneW - 20) / cols.length;
      for (let c = 0; c < cols.length; c++) {
        const cx = QueueColumnView.getTubeCenterX(c, cols.length, this.viewW / 2, zoneW);
        if (Math.abs(x - cx) <= pitch * 0.49) {
          this.tapQueueColumn(c, nowMs);
          break;
        }
      }
    }
  }

  private tapQueueColumn(colIndex: number, nowMs: number): void {
    const col = this.state.queueColumns[colIndex];
    if (!col || col.isEmpty()) return;

    const res = ScrewMatchRule.popColumnTop(
      col,
      this.state.conveyor,
      this.state.bufferDock,
      nowMs
    );

    if (!res.ok) {
      if (res.outOfSpace) {
        AudioManager.playErrorBonk();
        this.fsm.transitionTo('WAIT_REVIVE');
        setTimeout(() => {
          AudioManager.playLose();
          const pct = Math.round(this.state.sandBoard.getProgressRatio() * 100);
          const canRevive =
            this.state.revivesRemaining > 0 && this.state.bufferDock.canAddReviveSlot();
          this.resultScene.showLose(pct, canRevive);
        }, 280);
      }
      return;
    }

    this.hintEl.style.opacity = '0';
    AudioManager.playScrewPop();
    if (res.flight) {
      this.launchScrewFlight(res.flight, nowMs);
    }
    this.syncHud();
  }

  private launchScrewFlight(plan: ScrewFlightPlan, nowMs: number): void {
    let fromX = this.viewW / 2;
    let fromY = this.bufferDockY;

    if (plan.sourceType === 'queue') {
      fromX = QueueColumnView.getTubeCenterX(
        plan.sourceIndex,
        this.state.queueColumns.length,
        this.viewW / 2,
        this.queueLayout.zoneW
      );
      fromY = QueueColumnView.getScrewRowY(plan.sourceDepthIndex ?? 0, this.queueLayout);
    } else {
      fromX = BufferDockView.getSlotX(
        this.viewW / 2,
        plan.sourceIndex,
        this.state.bufferDock.getCapacity(),
        this.bufferSlotSize * 1.24
      );
      fromY = this.bufferDockY;
    }

    let toX = fromX;
    let toY = this.bufferDockY;
    if (plan.targetType === 'bucket' && plan.targetBucket) {
      const [hx, hy] = SandBucketView.getHolePosition(
        plan.targetBucket.visualX,
        this.conveyorLayout.bucketCenterY,
        this.conveyorLayout.bucketWidth,
        plan.targetHoleIndex ?? 0
      );
      toX = hx;
      toY = hy;
    } else if (plan.targetType === 'buffer') {
      toX = BufferDockView.getSlotX(
        this.viewW / 2,
        plan.targetSlotIndex,
        this.state.bufferDock.getCapacity(),
        this.bufferSlotSize * 1.24
      );
      toY = this.bufferDockY;
    }

    this.flyingScrews.push({
      plan,
      fromX,
      fromY,
      toX,
      toY,
      startedAtMs: nowMs
    });
  }

  /**
   * Booster 1 (ExtraSlot): Unlocks +1 active slot on the Linear Conveyor (from default 2 up to max 4)
   */
  private handleUseExtraSlot(): void {
    if (this.fsm.phase !== 'PLAYING') return;
    if (this.state.conveyor.activeSlots >= this.state.conveyor.maxActiveSlots) return;

    const cost = BalanceConfig.boosters.extraSlot.coinCost;
    const save = SaveManager.getData();
    if (save.boosters.extraSlot > 0) {
      SaveManager.useBooster('extraSlot');
    } else if (save.coins >= cost) {
      SaveManager.addCoins(-cost);
    } else {
      AudioManager.playErrorBonk();
      return;
    }

    const unlocked = BoosterRule.useExtraSlot(
      this.state.conveyor,
      this.conveyorLayout.trackStartX,
      this.conveyorLayout.trackEndX
    );
    if (unlocked) {
      AudioManager.playBoosterExtraSlot();
      this.syncHud();
    }
  }

  /**
   * Booster 2 (Hand): Toggles selection mode to tap any locked bucket on the conveyor and unlock it immediately
   */
  private handleToggleHandBooster(): void {
    if (this.fsm.phase === 'BOOSTER_HAND_SELECT') {
      this.fsm.transitionTo('PLAYING');
      this.handOverlay.setVisible(false);
      this.syncHud();
      return;
    }
    if (this.fsm.phase !== 'PLAYING') return;
    if (this.state.conveyor.getLockedActiveBuckets().length === 0) return;

    AudioManager.playBoosterHandSelect();
    this.fsm.transitionTo('BOOSTER_HAND_SELECT');
    this.handOverlay.setVisible(true);
    this.syncHud();
  }

  private executeHandBoosterOnBucket(
    bucket: SandBucketModel,
    slotIndex: number,
    nowMs: number
  ): void {
    const cost = BalanceConfig.boosters.hand.coinCost;
    const save = SaveManager.getData();
    if (save.boosters.hand > 0) {
      SaveManager.useBooster('hand');
    } else if (save.coins >= cost) {
      SaveManager.addCoins(-cost);
    } else {
      AudioManager.playErrorBonk();
      this.fsm.transitionTo('PLAYING');
      this.handOverlay.setVisible(false);
      this.syncHud();
      return;
    }

    const res = BoosterRule.useHandOnBucket(
      bucket,
      slotIndex,
      this.state.bufferDock,
      this.state.queueColumns
    );

    this.fsm.transitionTo('PLAYING');
    this.handOverlay.setVisible(false);

    if (res.ok) {
      AudioManager.playBoosterHandExecute();
      for (const flight of res.flights) {
        this.launchScrewFlight(flight, nowMs);
      }
    }
    this.syncHud();
  }

  /**
   * Booster 3 (Shuffle): Swirls all screws in QueueColumns and prioritizes colors of locked buckets on the belt
   */
  private handleUseShuffleBooster(): void {
    if (this.fsm.phase !== 'PLAYING') return;
    const totalScrews = this.state.queueColumns.reduce((acc, c) => acc + c.items.length, 0);
    if (totalScrews < 2) {
      AudioManager.playErrorBonk();
      return;
    }

    const cost = BalanceConfig.boosters.shuffle.coinCost;
    const save = SaveManager.getData();
    if (save.boosters.shuffle > 0) {
      SaveManager.useBooster('shuffle');
    } else if (save.coins >= cost) {
      SaveManager.addCoins(-cost);
    } else {
      AudioManager.playErrorBonk();
      return;
    }

    const nowMs = performance.now();
    // Collect visual positions of visible screws for the spiral vortex FX
    const visualNodes: Array<{ colorId: number; x: number; y: number }> = [];
    for (let c = 0; c < this.state.queueColumns.length; c++) {
      const col = this.state.queueColumns[c];
      const tx = QueueColumnView.getTubeCenterX(
        c,
        this.state.queueColumns.length,
        this.viewW / 2,
        this.queueLayout.zoneW
      );
      const vis = col.getVisibleItems(this.queueLayout.visibleDepth);
      for (let k = 0; k < vis.length; k++) {
        visualNodes.push({
          colorId: vis[k].colorId,
          x: tx,
          y: QueueColumnView.getScrewRowY(k, this.queueLayout)
        });
      }
    }

    BoosterRule.useShuffleWithPriority(this.state.conveyor, this.state.queueColumns);
    AudioManager.playBoosterShuffle();

    this.shuffleFX.start(
      visualNodes,
      this.viewW / 2,
      this.queueLayout.zoneY + this.queueLayout.zoneH * 0.42,
      this.queueLayout.screwRadius,
      nowMs
    );
    this.fsm.transitionTo('BOOSTER_SHUFFLE_ANIM');
    this.syncHud();
  }

  update(nowMs: number, dtSec: number): void {
    if (!this.state) return;

    const effDt = dtSec * this.gameSpeed;

    if (
      this.fsm.phase === 'BOOSTER_SHUFFLE_ANIM' &&
      !this.shuffleFX.isActive(nowMs)
    ) {
      this.fsm.transitionTo('PLAYING');
      this.syncHud();
    }

    // 1. Update flying screws
    const flightDuration = Math.round(GameConfig.screwFlightDurationMs / this.gameSpeed);
    for (let i = this.flyingScrews.length - 1; i >= 0; i--) {
      const fs = this.flyingScrews[i];
      if (fs.plan.targetType === 'bucket' && fs.plan.targetBucket) {
        const [hx, hy] = SandBucketView.getHolePosition(
          fs.plan.targetBucket.visualX,
          this.conveyorLayout.bucketCenterY,
          this.conveyorLayout.bucketWidth,
          fs.plan.targetHoleIndex ?? 0
        );
        fs.toX = hx;
        fs.toY = hy;
      }

      if (nowMs - fs.startedAtMs >= flightDuration) {
        this.flyingScrews.splice(i, 1);
        if (fs.plan.targetType === 'bucket' && fs.plan.targetBucket) {
          const unlockedNow = fs.plan.targetBucket.landScrewInHole(
            fs.plan.targetHoleIndex ?? 0,
            nowMs
          );
          AudioManager.playScrewLand(fs.plan.targetHoleIndex ?? 0);
          if (unlockedNow) {
            AudioManager.playLidOpen();
            setTimeout(() => {
              this.sandStreamFX.spawnUnlockBurst(
                fs.plan.targetBucket!.visualX,
                this.conveyorLayout.bucketCenterY - this.conveyorLayout.bucketWidth * 0.44,
                fs.plan.targetBucket!.colorId
              );
            }, Math.round(GameConfig.lidTwistDurationMs / this.gameSpeed));
          }
        } else if (fs.plan.targetType === 'buffer') {
          this.state.bufferDock.markSlotLanded(fs.plan.targetSlotIndex);
          AudioManager.playScrewLand(0);
        }
        this.syncHud();
      }
    }

    // 2. Auto-flush waiting screws from BufferDock to matching buckets on conveyor
    if (this.fsm.phase === 'PLAYING') {
      const bufferFlights = ScrewMatchRule.flushBufferToConveyor(
        this.state.conveyor,
        this.state.bufferDock
      );
      for (const bf of bufferFlights) {
        this.launchScrewFlight(bf, nowMs);
      }
    }

    // 3. Advance Linear Conveyor belt & bucket positions (Fish Jam Fever fixed bay stations)
    if (this.fsm.phase === 'PLAYING' || this.fsm.phase === 'BOOSTER_SHUFFLE_ANIM') {
      const speedMult = this.input.getSpeedMultiplier(nowMs);
      this.state.conveyor.advanceBelt(effDt, speedMult);

      const { trackStartX, trackEndX, visibleMinX, visibleMaxX, bucketWidth } = this.conveyorLayout;
      for (let i = 0; i < this.state.conveyor.activeSlots; i++) {
        const b = this.state.conveyor.slots[i];
        const targetX = this.state.conveyor.getSlotX(i, trackStartX, trackEndX, visibleMinX, visibleMaxX);
        if (b) {
          if (b.spawnEnterOffsetPx > 0) {
            b.spawnEnterOffsetPx = Math.max(0, b.spawnEnterOffsetPx - 450 * effDt);
          }
          b.visualX = targetX - b.spawnEnterOffsetPx;
          if (b.completedAtMs !== null && nowMs - b.completedAtMs > (260 / this.gameSpeed)) {
            this.state.conveyor.leavingBuckets.push(b);
            this.state.conveyor.slots[i] = null;
          }
        }
      }

      for (let i = this.state.conveyor.leavingBuckets.length - 1; i >= 0; i--) {
        const lb = this.state.conveyor.leavingBuckets[i];
        lb.visualX += 480 * effDt;
        if (lb.visualX >= visibleMaxX + bucketWidth * 0.6) {
          this.state.conveyor.leavingBuckets.splice(i, 1);
        }
      }

      this.state.conveyor.refillSlots(
        this.conveyorLayout.trackStartX,
        this.conveyorLayout.trackEndX,
        this.conveyorLayout.visibleMinX,
        this.conveyorLayout.visibleMaxX,
        false,
        true
      );
    }

    // 4. Suction of bottom-row sand grains into open buckets on the conveyor
    if (this.fsm.phase === 'PLAYING' && nowMs >= this.state.nextSuctionAtMs) {
      const lidReadyDelay = (GameConfig.lidTwistDurationMs + GameConfig.lidFlipDurationMs) / this.gameSpeed;
      const drainEv = SandSuctionRule.stepSuction(
        this.state.sandBoard,
        this.state.conveyor,
        nowMs,
        lidReadyDelay,
        this.boardCellSize,
        this.boardFrameX
      );

      if (drainEv) {
        SandBoardView.notifySuctionColumn(drainEv.col);
        const startX = this.boardFrameX + (drainEv.col + 0.5) * this.boardCellSize;
        const startY = this.boardBottomY - this.boardCellSize * 0.5;
        this.sandStreamFX.spawnGrain(
          startX,
          startY,
          drainEv.bucket,
          -this.conveyorLayout.bucketWidth * 0.22,
          drainEv.colorId,
          nowMs
        );
        AudioManager.playSandGrain();

        if (drainEv.bucketCompleted) {
          AudioManager.playBucketComplete();
        }
        const interval = Math.max(10, Math.round(650 / Math.max(8, drainEv.bucket.capacity) / this.gameSpeed));
        this.state.nextSuctionAtMs = nowMs + interval;
        this.syncHud();
      }
    }

    // 5. Update sand gravity, sand stream particles & confetti
    this.state.sandBoard.updateGravity(effDt, GameConfig.gravityPxPerSecSq);
    this.sandStreamFX.update(nowMs, effDt);
    this.confettiFX.update(effDt);

    // 6. Check Win Condition
    if (this.fsm.phase === 'PLAYING' && this.state.isLevelWon()) {
      this.fsm.transitionTo('WIN');
      const lv = this.state.levelData;
      SaveManager.addCoins(lv.rewardCoins);
      SaveManager.markLevelCompleted(lv.levelId, 3, 30);
      this.confettiFX.burst(this.viewW, this.viewH);
      AudioManager.playWin();
      this.syncHud();
      setTimeout(() => {
        this.resultScene.showWin(lv.levelId, lv.rewardCoins);
      }, 650);
    }
  }

  render(nowMs: number): void {
    if (!this.state) return;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Unity 3D mobile background image with sky-blue gradient fallback
    if (this.bgImageLoaded && this.bgImage) {
      ctx.drawImage(this.bgImage, 0, 0, this.viewW, this.viewH);
      // Soft atmospheric veil so gameplay elements pop with high contrast
      ctx.fillStyle = 'rgba(205, 236, 255, 0.22)';
      ctx.fillRect(0, 0, this.viewW, this.viewH);
    } else {
      const skyGrad = ctx.createLinearGradient(0, 0, 0, this.viewH);
      skyGrad.addColorStop(0, '#a8d8ff');
      skyGrad.addColorStop(0.55, '#bfe3fb');
      skyGrad.addColorStop(1, '#d8eeff');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
    }

    // 1. Upper Area: SandBoard (Sand Loop style)
    SandBoardView.draw(
      ctx,
      this.state.sandBoard,
      this.boardFrameX,
      this.boardFrameY,
      this.boardCellSize
    );

    // 2. Sand Streams & Burst Particles
    this.sandStreamFX.draw(ctx, nowMs, this.conveyorLayout.bucketCenterY);

    // 3. Middle Area: Linear Conveyor Belt & 3-Hole Sand Buckets
    LinearConveyorView.draw(
      ctx,
      this.state.conveyor,
      this.conveyorLayout,
      nowMs,
      this.input.isHoldingFastForward(nowMs),
      this.fsm.phase === 'BOOSTER_HAND_SELECT'
    );

    // 4. Buffer Dock (5 waiting holes + [+] ExtraSlot button)
    BufferDockView.draw(
      ctx,
      this.state.bufferDock,
      this.viewW / 2,
      this.bufferDockY,
      this.bufferSlotSize,
      this.state.conveyor
    );

    // 5. Lower Area: Color Blast Queue Columns (Glass Tubes with top 3 screws + '+N' badge)
    const isShuffling = this.shuffleFX.isActive(nowMs);
    QueueColumnView.drawAll(
      ctx,
      this.state.queueColumns,
      this.queueLayout,
      this.viewW / 2,
      nowMs,
      isShuffling
    );

    // 6. Shuffle Spiral Vortex FX
    if (isShuffling) {
      this.shuffleFX.draw(ctx, nowMs);
    }

    // 7. Flying Screws in transit (Bezier arc + spin)
    const flightDuration = GameConfig.screwFlightDurationMs;
    for (const fs of this.flyingScrews) {
      const e = Math.min(1, Math.max(0, (nowMs - fs.startedAtMs) / flightDuration));
      const k = e < 0.25 ? 0 : (e - 0.25) / 0.75;
      const q = k * k * (3 - 2 * k);
      const x = fs.fromX + (fs.toX - fs.fromX) * q;
      const y =
        fs.fromY +
        (fs.toY - fs.fromY) * q -
        Math.sin(k * Math.PI) * 42 -
        (e < 0.25 ? (e / 0.25) * 10 : 10 * (1 - k));

      ScrewView.draw(ctx, x, y, this.bufferSlotSize * 0.38, fs.plan.colorId, {
        rotation: e * 12,
        scale: 1 + (e < 0.3 ? e : 0.3 * (1 - k)),
        showShaft: e < 0.72
      });
    }

    // 8. Win Confetti FX
    this.confettiFX.draw(ctx);
  }

  private syncHud(): void {
    if (!this.state) return;
    this.topHud.update(
      this.state.levelData.levelId,
      this.state.levelData.title,
      this.state.sandBoard.getProgressRatio()
    );

    const hasLockedBuckets = this.state.conveyor.getLockedActiveBuckets().length > 0;
    const totalQueueScrews = this.state.queueColumns.reduce((acc, c) => acc + c.items.length, 0);
    this.boosterBar.update(
      this.state.conveyor,
      hasLockedBuckets,
      totalQueueScrews,
      this.fsm.phase === 'BOOSTER_HAND_SELECT'
    );
  }
}
