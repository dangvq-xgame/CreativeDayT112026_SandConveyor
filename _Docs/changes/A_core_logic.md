# A — Core Logic: nâng cấp lên chuẩn production

> Phạm vi: `src/core/**`, `src/game/**`, `src/config/**`, `src/types/**`, `src/utils/**`, `tools/**`, `tests/unit/**`.
> Baseline để so sánh: snapshot `scratchpad/baseline/` (không phải git HEAD).

## Tóm tắt

- **Priority 0 (đã giao sớm cho agent UI):** API Settings hoàn chỉnh — `AudioManager.setMusicEnabled/isMusicEnabled` (BGM loop `ingame_bg.mp3`), `pauseAll/resumeAll` cho `visibilitychange`, sound/music được **lưu vào SaveManager** và khởi tạo từ save; module mới `Haptics` (rung an toàn, lưu `settings.vibrationEnabled`); `SaveManager.updateSettings/getSettings/subscribe`.
- **19 bug thật đã sửa** (mục Fixed). 14 bug đã được chứng minh bằng một bộ "probe" chạy trên code baseline: cả 14 đều FAIL trên baseline và PASS trên code mới.
- **Logic game không còn bị nhân bản trong tool:** `tools/validate-levels.mjs` giờ nạp **chính các file TS thật** (LevelValidator, GameState, ScrewMatchRule, SandSuctionRule…) qua Vite `ssrLoadModule`; bot solver + stress test nằm trong `src/game/level/LevelSimulator.ts` và cũng được chạy trong Vitest.
- RNG có thể seed (`createSeededRandom`) và được inject vào Shuffle/stress test → test deterministic.
- Magic number chuyển vào `src/config` (`GameplayConfig`, `AudioConfig`, `HAPTIC_PATTERNS`, `SAVE_DEFAULTS`); bỏ toàn bộ `any`; JSDoc cho API public; các singleton đều có class `*Impl` export để test với dependency giả.
- Test: **7 → 199** (3 → 13 file test). `tsc` sạch, 5/5 level PASS.
- Không thay đổi dependency, không đổi dữ liệu level/palette, không phá vỡ API mà scenes/views/ui đang gọi.

## Added

| File | Nội dung |
| --- | --- |
| `src/core/Haptics.ts` | `HapticsImpl` + singleton `Haptics`: `isSupported/isEnabled/setEnabled/light/medium/success/error/vibrate`. Feature-detect `navigator.vibrate`, gọi đúng `this` (tránh "Illegal invocation"), try/catch, no-op trên desktop/iOS; tắt rung → `vibrate(0)` hủy rung đang chạy. |
| `src/config/audio.config.ts` | `SfxKey`, `SFX_FILES`, `BGM_FILE`, `AudioConfig` (volume BGM, throttle tiếng cát, pitch…). |
| `src/config/haptics.config.ts` | `HAPTIC_PATTERNS` (light 10ms, medium 22ms, success [14,40,26], error [40,30,40]). |
| `src/utils/random.ts` | `RandomFn`, `createSeededRandom(seed)` (mulberry32), `randomInt` (luôn trong khoảng kể cả RNG trả 1/NaN), `shuffleInPlace` (Fisher–Yates). |
| `src/utils/math.utils.ts` | `clamp`, `clamp01`, `isFiniteNumber`, `toIntAtLeast`, `positiveMod`. |
| `src/game/level/normalizeLevel.ts` | `normalizeLevelData(level)` — deep copy + điền mặc định (`conveyorConfig`, `subDivision`, `requiredScrews`, `columnIndex`…), không mutate input. |
| `src/game/level/LevelSimulator.ts` | `simulateGreedyBot`, `stressTestRandomUnlockOrder`, `settleState` — mô phỏng headless bằng model/rule thật. |
| `src/config/game.config.ts` | `GameplayConfig` (hằng số trước đây hard-code), `validateBalanceConfig(cfg)`. |
| `src/config/constants.ts` | `SUPPORTED_LANGUAGES`, `DEFAULT_LANGUAGE`, `SAVE_DEFAULTS`. |
| `src/types/level.types.ts` | `LanguageCode`, `BoosterKey`, `SaveSettings` (SaveData dùng lại, cấu trúc không đổi). |
| Model/rule helpers | xem mục "API mới cho UI". |
| `tests/unit/*` | 10 file test mới + `helpers.ts` (fixture level, `MemoryStorage`, `FakeSettingsStore`). |

## Changed

- **SaveManager**: storage được inject (`new SaveManagerImpl(() => storage)`), lấy `localStorage` lazy trong try/catch; `migrateSaveData` sanitize toàn bộ (số nguyên ≥ min, boolean thật, ngôn ngữ hợp lệ, `completedLevels` hợp lệ, version bất kỳ → 1); mọi mutator validate input, persist và notify subscriber (listener lỗi không làm hỏng listener khác).
  - *Thay đổi hành vi:* `resetAll()` **giữ nguyên settings** (âm thanh/nhạc/rung/ngôn ngữ) — "reset tiến trình" không nên bật lại âm thanh người chơi đã tắt. Dùng `resetAll({ includeSettings: true })` để xóa sạch.
- **AudioManager**: viết lại với `AudioBackend` inject được (test không cần browser). Settings đọc trực tiếp từ store mỗi lần (save là nguồn sự thật duy nhất) và subscribe store để BGM luôn khớp setting. BGM chỉ tạo/tải khi cần (lazy) và chỉ phát sau `unlock()` (autoplay policy). SFX bị chặn khi `pauseAll`. Synth fallback dùng `ensureContext()` thay vì `unlock()` (tránh "unlock" ngoài user gesture).
  - *Thay đổi hành vi:* BGM giờ **tự phát** ở lần `unlock()` đầu tiên nếu `musicEnabled` (trước đây game không có nhạc nền). Sound toggle giờ được lưu qua reload.
- **ColorManager**: `setPalette` bỏ entry không hợp lệ, giữ palette cũ nếu file palette hỏng/rỗng, trả về số entry nhận; `hexToNumber` hỗ trợ `#RGB`, input rác → 0; `mixHex` clamp ratio + memoize (gọi rất nhiều trong render loop); thêm `getColorIds()`.
- **AssetLoader**: tải palette + level **song song** bằng `Promise.allSettled`, `init()` không bao giờ reject và được dùng chung khi gọi đồng thời; kiểm tra shape JSON; `getLoadReport()`; `getLevel` wrap id đúng với 0/âm/NaN/số lẻ và fallback về level đầu tiên đã tải; số level lấy từ `TOTAL_LEVELS`.
- **I18n**: fallback ngôn ngữ hiện tại → `vi` → key; nội suy `{name}`; `onChange`; `has`; khởi tạo theo `settings.language` đã lưu; dictionary `en` được phép thiếu key (trước đây thiếu key trong `en.json` làm `tsc` fail).
- **EventBus**: kiểu chặt (không `any`), `once`, `listenerCount`, handler lỗi được cô lập; ngữ nghĩa emit giống DOM `EventTarget`.
- **StateMachine**: `constructor(initial?)`, `is(...phases)`, listener lỗi được cô lập, transition lồng nhau được phát theo đúng thứ tự.
- **InputManager**: inject threshold/multiplier/clock, thêm `reset()`.
- **SandBucketModel**: `requiredScrews` mặc định từ `balance.conveyor.holesPerBucket` (trước: số 3 hard-code), capacity sanitize, `reserveHole` từ chối bucket đã mở và index không hợp lệ, `landScrewInHole` idempotent; thêm `addSand` (không bao giờ tràn), `markCompletedIfFull`, `isReadyForSand`, `canAcceptScrew`, `getTakenHolesCount`, `getLandedScrewsCount`, `isCompleted`.
- **SandBoardModel**: lưới luôn đúng `height × width`; tách `findPullCandidate` (thuần, không mutate) khỏi `pullBottomCellOfColor`; chọn ứng viên O(n) thay vì sort; `updateGravity` bỏ qua dt âm/NaN; thêm `getCell`, `countCellsOfColor`, `getRemainingColorCounts`, `isCleared`, `isSettled`. Thứ tự ưu tiên rút cát **giữ nguyên**.
- **LinearConveyorModel**: sanitize cấu hình slot; `advanceBelt` bỏ qua dt/multiplier không hợp lệ; ExtraSlot dùng `balance.boosters.extraSlot.slotIncrement`; thêm `canUnlockExtraSlot`, `getRemainingBucketCount`, `updateBucketPositions`, `releaseCompletedBuckets`, `advanceLeavingBuckets` (chuyển logic đang nằm inline trong GameScene vào model để test được — UI có thể dùng hoặc không).
  - *Thay đổi hành vi:* `findTargetBucketForScrew` ưu tiên bucket **gần mở nắp nhất** (nhiều lỗ đã có vít nhất), hòa thì bucket cũ hơn (`spawnSeq`), thay vì theo thứ tự index slot (xem Fixed #2).
- **BufferDockModel**: mỗi reservation có `reservationId`; `markSlotLanded(slot, reservationId?)` (tham số mới tùy chọn); thêm `getLandedCount`, `findSlotOfColor`, `getReservationId`; sanitize constructor.
- **QueueColumnModel**: thêm `removeAt`, `findDepthOfColor`, `takeAll`, `setItems`, `getItemCount`, `isHiddenAt(depth)` (vít `?` không bao giờ ở đỉnh); BoosterRule không còn mutate trực tiếp `items`.
- **ScrewMatchRule**: `ScrewFlightPlan` thêm field tùy chọn `bufferReservationId`, `isPhantom`; thêm `predictRoute`, `hasSafeMove`; kiểu kết quả `PopColumnResult`.
- **SandSuctionRule**: tham số mặc định lấy từ `GameplayConfig` (giá trị không đổi: 630ms, 20px, 60px); tách `getSuctionCandidates`, `getPreferredColumn`.
  - *Thay đổi hành vi nhỏ:* cột ưu tiên phía trên bucket dùng `Math.floor` (cột chứa `visualX`) thay vì `Math.round` (lệch nửa ô); chỉ là tie-breaker.
- **BoosterRule**: Hand và Shuffle viết lại (xem Fixed); Shuffle nhận RNG inject (mặc định `Math.random`), trả thêm `priorityTopMatches`; thêm `canUseExtraSlot/canUseHand/canUseShuffle`.
- **GameState**: chuẩn hóa level trước khi dựng model (thiếu `conveyorConfig` không còn crash), `revivesRemaining` từ config; thêm `getTotalQueueScrews`, `hasSafeMove`, `canRevive`, `revive`.
- **LevelValidator**: không bao giờ throw với input rác; kiểm tra header, conveyorConfig, shape lưới, field bucket (capacity ≥ 1, requiredScrews ≥ 1, id không trùng), queue column, palette (tùy chọn `knownColorIds`), và bảo toàn **theo hợp của mọi màu** (sand = Σcapacity, screw = ΣrequiredScrews).
- **LevelLoader**: chuẩn hóa + validate với palette hiện tại; chỉ warn 1 lần/level.
- **tools/validate-levels.mjs**: viết lại — dùng code TS thật qua Vite SSR, RNG seed cố định (`--seed`, `--trials`), kiểm tra cả mirror `palette.json`, exit code chuẩn.

## Fixed

Mỗi mục: **triệu chứng → nguyên nhân → cách sửa → test bảo vệ**. Các mục có ★ đã được xác nhận FAIL trên code baseline bằng probe.

1. ★ **Shuffle làm hỏng cột vít khi RNG trả 1.0** → cột chứa `undefined`, game crash khi vẽ/pop. → `Math.floor(rng() * (i + 1))` có thể bằng `i + 1` (ngoài mảng). → `randomInt` luôn clamp index; Shuffle dùng `shuffleInPlace`. → `Rules.test.ts` "is robust to an RNG returning 1", `UtilsAndConfig.test.ts` "randomInt stays in range…".
2. ★ **Vít bị chia cho 2 xô cùng màu** → xô A có 2/3 vít, xô B 0/3: vít mới vào B, cả hai không mở. → `findTargetBucketForScrew` chọn theo index slot. → ưu tiên xô có nhiều lỗ đã nhận nhất, hòa thì `spawnSeq` nhỏ hơn (cùng nguyên tắc "không chia" mà SandSuctionRule đã áp dụng cho cát). → `Models.test.ts` "routes a screw to the same-color bucket closest to opening", "ties go to the oldest bucket".
3. ★ **Hand tạo "vít ma" + vít thật kẹt vĩnh viễn trong BufferDock** → dùng Hand khi vít cùng màu cuối cùng đang bay tới buffer: xô được lấp bằng vít không tồn tại, vít thật hạ cánh vào buffer và chiếm chỗ mãi mãi (có thể gây thua). → Hand chỉ tìm vít buffer đã `landed`, sau đó queue, rồi fallback "phantom". → thêm nguồn thứ 3: vít buffer đang bay (lấy luôn reservation); token `reservationId` đảm bảo cú hạ cánh cũ không đánh dấu nhầm vít khác dùng lại slot; phantom chỉ còn với dữ liệu sai và được gắn `isPhantom`. → `Rules.test.ts` "takes an in-flight buffer screw before conjuring one", `Models.test.ts` "a stale landing cannot mark another screw…".
4. ★ **Shuffle ưu tiên màu của xô không còn cần vít** → xô có 3 lỗ đã được đặt (vít đang bay) vẫn được tính là "đang khóa", vít ưu tiên lên đỉnh rồi bị đẩy vào buffer. → dùng `!b.isOpen` thay vì "còn thiếu vít". → ưu tiên theo **nhu cầu** (`getMissingScrewsCount`) của các xô khóa; màu đã đủ nhu cầu chỉ được dùng khi hết lựa chọn. → `Rules.test.ts` "ignores buckets that need no more screws".
5. ★ **LevelValidator bỏ sót xô có màu không có cát** → level không thể thắng (xô chờ cát mãi) vẫn "valid". → chỉ lặp qua màu có trong lưới cát. → kiểm tra trên **hợp** màu của cát, xô và vít (bắt cả vít mồ côi). → `Level.test.ts` "flags a bucket color that has no sand", "flags orphan screws…".
6. ★ **LevelValidator hard-code 3 vít/xô** → level dùng `requiredScrews ≠ 3` bị báo sai. → `bCount * 3`. → cộng `requiredScrews` từng xô. → `Level.test.ts` "uses each bucket requiredScrews instead of a hard-coded 3".
7. ★ **Lưới cát lệch kích thước làm level không thể thắng** → `totalInitialCells` đếm cả ô ngoài `width/height` nhưng các ô đó không bao giờ được rút → `getRemainingCells() > 0` mãi. → cells dựng từ `grid.map` thay vì `height × width`. → chuẩn hóa lưới đúng kích thước, giá trị không hợp lệ thành ô trống. → `Models.test.ts` "normalizes the grid to width × height", "treats invalid colorIds as empty".
8. ★ **StateMachine bỏ qua listener khi listener khác hủy đăng ký** → listener tự `off()` trong callback làm listener kế tiếp không được gọi. → `splice` mảng đang duyệt. → duyệt trên snapshot + kiểm tra còn đăng ký; transition lồng nhau xếp hàng đúng thứ tự. → `EventBusAndStateMachine.test.ts` "unsubscribing inside a listener does not skip the next listener", "delivers nested transitions in order".
9. ★ **EventBus lặp vô hạn** → handler tự `off()` rồi `on()` lại trong emit bị gọi lại liên tục. → duyệt trực tiếp `Set` (phần tử thêm trong lúc duyệt vẫn được duyệt). → duyệt snapshot; `off()` có hiệu lực ngay; handler lỗi được cô lập. → "handlers added during emit wait for the next emit", "a handler removing itself…", "a throwing handler does not stop the others".
10. ★ **Nhãn 100% khi xô chưa đầy** → capacity ≥ 200: 199/200 làm tròn thành 100%. → `Math.round`. → giữ công thức GDD nhưng chặn tối đa 99% khi chưa `isFull()`. → `Models.test.ts` "never shows 100% before really full".
11. ★ **Màu không có trong palette trông giống hệt màu 1 (Sky Blue)** + cấp phát object mới mỗi frame. → fallback hard-code `#3898FF`. → fallback xám trung tính `UNKNOWN_COLOR_HEX`, cache theo id. → `ColorAndI18n.test.ts` "falls back to a neutral gray…".
12. ★ **Xô capacity 0 chặn slot vĩnh viễn** → mở nắp xong không bao giờ có `completedAtMs` (suction bỏ qua xô đã đầy) → không rời băng chuyền, xô sau không spawn. → không ai đánh dấu hoàn thành. → `stepSuction` gọi `markCompletedIfFull` cho xô đang mở. → `Rules.test.ts` "completes an open zero-capacity bucket…".
13. ★ **`addCoins(NaN)` làm coin thành NaN vĩnh viễn** (lưu xuống storage thành `null`). → `Math.max(0, NaN)` = NaN. → bỏ qua số không hữu hạn. → `SaveManager.test.ts` "addCoins ignores non-finite amounts…".
14. ★ **`buyBooster` với cost âm tạo coin từ hư không** (và cost NaN vẫn cộng booster). → không validate cost. → dùng `spendCoins` (cost hữu hạn, ≥ 0, đủ tiền). → "buyBooster rejects negative costs".
15. **Save bị hỏng nhẹ không được làm sạch** → booster âm, `settings.soundEnabled: "false"` (chuỗi truthy), ngôn ngữ lạ, `completedLevels` rác đều được giữ lại. → `migrateSaveData` chỉ kiểm tra `typeof number`/`??`. → sanitize đầy đủ (xem Changed). → `SaveManager.test.ts` khối "migrateSaveData — sanitizing".
16. **Tải asset: 1 lỗi mạng làm hỏng toàn bộ khởi động; level id 0/âm/NaN crash** → `fetch` reject không được bắt → `bootstrap` thất bại; `((0-1)%5)+1 = 0` → "Level 0 not loaded". → bắt lỗi từng file, báo cáo qua `getLoadReport()`, wrap id bằng `positiveMod`, fallback level đầu tiên. → `AssetLoader.test.ts`.
17. **Âm thanh hỏng file = im lặng** → file SFX 404 vẫn được coi là "đã phát" nên không dùng synth fallback. → `playClip` trả `true` dù `play()` sẽ reject. → lắng nghe sự kiện `error` / `NotSupportedError` để đánh dấu clip hỏng → dùng synth. → `AudioManager.test.ts` "falls back to a synthesized tone when a file fails to load", "marks a clip broken when play() rejects…".
18. **I18n: key thiếu trong `en` trả về chính key** thay vì bản tiếng Việt; và thiếu key trong `en.json` làm `tsc` fail. → `dicts[lang][key] ?? key`, kiểu `Record<lang, typeof vi>`. → chuỗi fallback + dictionary `Partial`. → `ColorAndI18n.test.ts` "falls back to the default language…".
19. **GameState crash khi level thiếu `conveyorConfig`** (`undefined.initialActiveSlots`). → chuẩn hóa level trước. → `Level.test.ts` "builds every model from the level…".

## Removed

- Bản sao logic game trong `tools/validate-levels.mjs` (`pullOriginY`, bot và stress test viết lại bằng JS) — nay dùng code TS thật.
- Nhánh "restore pool" trong Shuffle (giờ kiểm tra số vít trước khi lấy ra, không cần khôi phục).
- Hàm `clamp01`/`sanitizeInt` cục bộ (dùng `src/utils/math.utils.ts`).
- Các magic number trong models/rules (chuyển vào `GameplayConfig`, `AudioConfig`).

## API mới cho UI

Tất cả đều là **bổ sung**; chữ ký cũ giữ nguyên.

```ts
// ---- src/core/AudioManager.ts — singleton AudioManager (class AudioManagerImpl)
isSoundEnabled(): boolean
setSoundEnabled(enabled: boolean): void          // lưu settings.soundEnabled
isMusicEnabled(): boolean
setMusicEnabled(enabled: boolean): void          // lưu settings.musicEnabled + phát/dừng BGM
playMusic(): void                                // yêu cầu BGM (mặc định đã bật); phát khi đã unlock
stopMusic(): void                                // dừng BGM, không đổi setting
isMusicPlaying(): boolean
unlock(): void                                   // gọi trong user gesture; resume AudioContext + bắt đầu BGM
pauseAll(): void                                 // page hidden: suspend AudioContext + pause BGM, chặn SFX
resumeAll(): void                                // page visible: BGM chỉ phát lại nếu trước đó đang phát và vẫn bật
isPaused(): boolean

// ---- src/core/Haptics.ts — singleton Haptics (class HapticsImpl)
isSupported(): boolean
isEnabled(): boolean
setEnabled(enabled: boolean): void               // lưu settings.vibrationEnabled; tắt → hủy rung
light(): boolean; medium(): boolean; success(): boolean; error(): boolean
vibrate(pattern: number | readonly number[]): boolean

// ---- src/core/SaveManager.ts — singleton SaveManager (class SaveManagerImpl)
getSettings(): Readonly<SaveSettings>
updateSettings(partial: Partial<SaveSettings>): void
subscribe(listener: (data: Readonly<SaveData>) => void): () => void
spendCoins(amount: number): boolean
getBoosterCount(key: BoosterKey): number
addBooster(key: BoosterKey, count?: number): void
resetAll(options?: { includeSettings?: boolean }): void   // mặc định giữ settings

// ---- src/core/I18n.ts — singleton I18n (class I18nImpl)
t(key: I18nKey | string, params?: Record<string, string | number>): string
has(key: string): boolean
onChange(cb: (lang: LanguageCode) => void): () => void

// ---- src/core/AssetLoader.ts
getLoadReport(): { paletteLoaded: boolean; loadedLevelIds: number[]; failed: { url: string; reason: string }[] }
normalizeLevelId(levelId: number): number; hasLevel(id: number): boolean; getLevelCount(): number

// ---- src/core/ColorManager.ts
getColorIds(): ColorId[]

// ---- src/core/StateMachine.ts
is(...phases: GamePhase[]): boolean

// ---- src/core/InputManager.ts
reset(): void

// ---- src/game/GameState.ts
getTotalQueueScrews(): number
hasSafeMove(): boolean                           // false = mọi cú tap đều thua
canRevive(): boolean
revive(): boolean                                // +1 slot buffer, trừ revivesRemaining

// ---- src/game/models/LinearConveyorModel.ts
canUnlockExtraSlot(): boolean
getRemainingBucketCount(): number
updateBucketPositions(dtSec: number, trackStartX: number, trackEndX: number, slideSpeedPxPerSec?: number): void
releaseCompletedBuckets(nowMs: number, delayMs?: number): SandBucketModel[]   // mặc định 280ms
advanceLeavingBuckets(dtSec: number, exitX: number, speedPxPerSec?: number): SandBucketModel[]

// ---- src/game/models/SandBucketModel.ts
addSand(amount: number, nowMs: number): number; markCompletedIfFull(nowMs: number): boolean
isReadyForSand(nowMs: number, lidOpenReadyDelayMs: number): boolean; isCompleted(): boolean
canAcceptScrew(colorId: ColorId): boolean; getTakenHolesCount(): number; getLandedScrewsCount(): number

// ---- src/game/models/SandBoardModel.ts
isCleared(): boolean; isSettled(): boolean; getCell(x: number, y: number): SandCell | null
countCellsOfColor(colorId: ColorId): number; getRemainingColorCounts(): Map<ColorId, number>
findPullCandidate(colorId: ColorId, preferredColX?: number): SandPullResult | null

// ---- src/game/models/BufferDockModel.ts
markSlotLanded(slotIndex: number, reservationId?: number): boolean   // trước: void (nới rộng, call site cũ không bị ảnh hưởng)
getReservationId(slotIndex: number): number | null
getLandedCount(): number; findSlotOfColor(colorId: ColorId, landedOnly?: boolean): number

// ---- src/game/models/QueueColumnModel.ts
isHiddenAt(depth: number): boolean               // true → vẽ "?" (không bao giờ ở đỉnh)
getItemCount(): number; findDepthOfColor(c): number; removeAt(depth): QueueScrewDef | null
takeAll(): QueueScrewDef[]; setItems(items: QueueScrewDef[]): void

// ---- src/game/rules/ScrewMatchRule.ts
ScrewFlightPlan.bufferReservationId?: number     // target buffer
ScrewFlightPlan.isPhantom?: true                 // Hand với dữ liệu sai
ScrewMatchRule.predictRoute(col, conveyor, dock): 'bucket' | 'buffer' | 'out_of_space' | 'empty'
ScrewMatchRule.hasSafeMove(columns, conveyor, dock): boolean

// ---- src/game/rules/BoosterRule.ts
BoosterRule.canUseExtraSlot(conveyor) / canUseHand(conveyor) / canUseShuffle(columns): boolean
useShuffleWithPriority(..., rng?: RandomFn) → { ok, totalScrews, priorityTopMatches? }

// ---- src/config
GameplayConfig  // lidOpenReadyDelayMs, bucketDespawnDelayMs, bucketSpawnSlideSpeedPxPerSec, bucketLeaveSpeedPxPerSec, ...
AudioConfig, SFX_FILES, BGM_FILE, HAPTIC_PATTERNS, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE
```

## Đề xuất cho agent UI

1. **Visibility:** `document.addEventListener('visibilitychange', () => document.hidden ? AudioManager.pauseAll() : AudioManager.resumeAll())`; đồng thời gọi `input.reset()` khi ẩn trang để băng chuyền không bị "giữ tốc" khi quay lại.
2. **Unlock audio sớm hơn:** hiện chỉ `pointerdown` trên canvas gọi `AudioManager.unlock()`. Nên gọi thêm 1 lần cho `pointerdown` ở `document` (popup/menu DOM) để BGM bắt đầu ngay từ cú chạm đầu tiên. Nếu không muốn nhạc ở menu: `AudioManager.stopMusic()` / `playMusic()` khi vào game.
3. **Settings popup:** dùng `AudioManager.setSoundEnabled/setMusicEnabled`, `Haptics.setEnabled`, ngôn ngữ: `SaveManager.updateSettings({ language })` + `I18n.setLanguage(lang)`. Có thể `SaveManager.subscribe(...)` để cập nhật HUD (coin/booster) thay vì đọc lại thủ công.
4. **Haptics gợi ý:** `light()` khi pop vít, `medium()` khi mở nắp / dùng booster, `success()` khi xô đầy / thắng, `error()` khi bonk / thua.
5. **Token buffer:** khi vít bay tới buffer hạ cánh, gọi `bufferDock.markSlotLanded(plan.targetSlotIndex, plan.bufferReservationId)` (tham số thứ 2 tránh đánh dấu nhầm khi Hand lấy vít đang bay). Không truyền thì vẫn chạy như cũ.
6. **Hand + vít đang bay:** nếu `flight.sourceType === 'buffer'` và vít nguồn đang bay tới slot đó, nên xóa/điều hướng flight cũ trong `flyingScrews` (hiện nó vẫn bay tới slot trống rồi biến mất — chỉ là hình ảnh).
7. **Đưa logic khỏi GameScene:** có thể thay đoạn inline bằng `conveyor.updateBucketPositions(dt, trackStartX, trackEndX)`, `conveyor.releaseCompletedBuckets(nowMs)`, `conveyor.advanceLeavingBuckets(dt, visibleMaxX + bucketWidth * 0.55)`; dùng `state.revive()` cho nút revive; `BoosterRule.canUse*` để disable nút booster; `SaveManager.spendCoins(cost)` thay cho `coins >= cost` + `addCoins(-cost)`.
8. **Số level:** GameScene dùng `% 5` hard-code → nên dùng `TOTAL_LEVELS` hoặc `AssetLoader.getLevelCount()`.
9. **Hiển thị vít `?`:** dùng `column.isHiddenAt(depth)`.
10. **Báo lỗi tải dữ liệu:** `AssetLoader.getLoadReport().failed` có thể hiện toast; `getLevel` chỉ throw khi không tải được level nào.
11. **Gợi ý "hết nước đi":** `state.hasSafeMove() === false` nghĩa là mọi cột đều dẫn tới thua — có thể nháy nút Shuffle/Hand.
12. Khi ExtraSlot tăng `activeSlots`, khoảng cách slot thay đổi nên các xô "nhảy" vị trí ngay lập tức (hành vi cũ, không đổi) — có thể tween `visualX` ở view.
13. `balance.conveyor.suctionIntervalMs` hiện không được dùng (GameScene tự tính interval) — cân nhắc dùng config.

## Kết quả kiểm thử

| Lệnh | Baseline | Sau nâng cấp |
| --- | --- | --- |
| `npx tsc --noEmit` | OK | OK (0 lỗi) |
| `npx vitest run` | 3 file, 7 test pass | **13 file, 199 test pass** |
| `node tools/validate-levels.mjs` | 5/5 PASS (JS nhân bản logic) | **5/5 PASS** dùng rule TS thật, stress 3×200 trial/level với seed cố định (~2.6s) |

Kết quả `validate-levels`:
```
[PASS] level-001.json (Nắng Vàng Rực Rỡ) — Grid 24x20, Colors: [1, 5, 10], Buckets: 8, Screws: 24, Bot solved in 24 taps, StressTest(slots 2:200/200 3:200/200 4:200/200) PASS
[PASS] level-002.json (Dưa Hấu Mùa Hè) — ... Bot solved in 24 taps ... PASS
[PASS] level-003.json (Cá Heo Vượt Sóng) — ... Bot solved in 24 taps ... PASS
[PASS] level-004.json (Cáo Nhỏ Tinh Nghịch) — ... Bot solved in 30 taps ... PASS
[PASS] level-005.json (Mèo Đen Hoa Trắng) — ... Bot solved in 33 taps ... PASS
All 5 level(s) PASS (seed=20261114, trials=200)
```

Xác minh bug bằng probe (file tạm trong scratchpad, không nằm trong repo): 14 probe chạy trên `baseline/src` → **14/14 FAIL**; cùng probe trên `src` hiện tại → 13/14 PASS (probe #6 dùng fixture thiếu `version/levelId/conveyorConfig` nên validator mới chặt hơn từ chối — test chính thức tương ứng trong `Level.test.ts` dùng fixture đầy đủ và PASS).

Test mới: `SaveManager` (22), `AudioManager` (23), `Haptics` (8), `EventBusAndStateMachine` (12), `ColorAndI18n` (9), `AssetLoader` (7), `UtilsAndConfig` (8), `Models` (36), `Rules` (29), `Level` (38 — gồm validator, normalize, GameState, simulator và 5 level thật: mirror `_Docs`, validator, bot, stress test).

## Vấn đề còn tồn đọng

- `pixi.js`, `gsap`, `howler` có trong `package.json` nhưng không được dùng ở đâu (không thay đổi dependency theo yêu cầu).
- Bot solver "nhìn thấy" màu vít `?` — đây là kiểm tra khả năng giải, không phải mô phỏng người chơi công bằng.
- AudioManager vẫn dùng `HTMLAudioElement.cloneNode()` cho mỗi lần phát SFX (đơn giản, đủ cho demo); nếu cần độ trễ thấp trên iOS nên chuyển sang `AudioBuffer` (decode một lần).
- Các key config không được dùng: `GameConfig.backgroundColor`, `balance.conveyor.isLinear`, `balance.conveyor.suctionIntervalMs` (giữ lại vì là tài liệu thiết kế / có thể agent UI dùng).
- Lose được phát hiện khi người chơi tap (đúng GDD). `GameState.hasSafeMove()` đã có sẵn nếu muốn cảnh báo sớm.
- Logic thời gian thực (flight, despawn, interval hút cát) vẫn nằm trong `GameScene` (ngoài phạm vi); các helper model tương ứng đã có và đã được test.

## Danh sách file đã chạm

**Sửa:** `src/config/constants.ts`, `src/config/game.config.ts`, `src/types/level.types.ts`, `src/core/AssetLoader.ts`, `src/core/AudioManager.ts`, `src/core/ColorManager.ts`, `src/core/EventBus.ts`, `src/core/I18n.ts`, `src/core/InputManager.ts`, `src/core/SaveManager.ts`, `src/core/StateMachine.ts`, `src/game/GameState.ts`, `src/game/level/LevelLoader.ts`, `src/game/level/LevelValidator.ts`, `src/game/models/BufferDockModel.ts`, `src/game/models/LinearConveyorModel.ts`, `src/game/models/QueueColumnModel.ts`, `src/game/models/SandBoardModel.ts`, `src/game/models/SandBucketModel.ts`, `src/game/rules/BoosterRule.ts`, `src/game/rules/SandSuctionRule.ts`, `src/game/rules/ScrewMatchRule.ts`, `tools/validate-levels.mjs`.

**Mới:** `src/core/Haptics.ts`, `src/config/audio.config.ts`, `src/config/haptics.config.ts`, `src/utils/random.ts`, `src/utils/math.utils.ts`, `src/game/level/normalizeLevel.ts`, `src/game/level/LevelSimulator.ts`, `tests/unit/helpers.ts`, `tests/unit/SaveManager.test.ts`, `tests/unit/AudioManager.test.ts`, `tests/unit/Haptics.test.ts`, `tests/unit/EventBusAndStateMachine.test.ts`, `tests/unit/ColorAndI18n.test.ts`, `tests/unit/AssetLoader.test.ts`, `tests/unit/UtilsAndConfig.test.ts`, `tests/unit/Models.test.ts`, `tests/unit/Rules.test.ts`, `tests/unit/Level.test.ts`, `_Docs/changes/A_core_logic.md`.

**Không đổi:** `src/utils/canvas.utils.ts`, `src/config/balance.json`, dữ liệu level/palette (`public/assets/data/**`, `_Docs/levels/**` — không phát hiện lỗi dữ liệu), 3 file test cũ (`BoosterRule`, `ConveyorAndBucket`, `SandBoardAndSuction` vẫn PASS nguyên vẹn).
