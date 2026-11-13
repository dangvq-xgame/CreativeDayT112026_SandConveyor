# 04. SCHEMA DỮ LIỆU, CẤU HÌNH BALANCE & BẢNG MÀU (`colorId: int`)

> **Điều hướng nhanh:** [00_INDEX](./PLAN_SAND_CONVEYOR.md) | [01_MECHANICS](./01_GAME_DESIGN_MECHANICS.md) | [02_ARCHITECTURE](./02_TECH_ARCHITECTURE_FOLDER.md) | [03_ASSETS](./03_ASSET_SPEC_INVENTORY.md) | **04_SCHEMA_CONFIG** | [05_LEVEL_DATA](./05_LEVEL_DATA_PACK.md) | [06_ROADMAP_QA](./06_ROADMAP_QA_RISKS.md)

---

## 1. Nguyên tắc Chuẩn hóa `colorId: number` (Integer ID)

Theo yêu cầu thiết kế:
- **100% dữ liệu màu sắc trong Level, Xô cát, Đinh vít, Viền ống và Ma trận Tranh cát đều dùng số nguyên `colorId: number` (`int`)** (ví dụ: `1, 2, 3, ..., 12`, với `0` là ô trống nếu có).
- **Tuyệt đối không lưu mã màu chữ hay mã Hex trong các file `level-XXX.json`**.
- Toàn bộ việc ánh xạ từ `colorId: int` sang mã màu hiển thị (`bodyHex`, `shadowHex`, `handleHex`, `sandHex`) nằm tập trung tại **1 file duy nhất**: `public/assets/data/palette.json` (tương đương `LevelColorConfig.asset` trong dự án Unity `SandLoopGame`).
- Khi Art/Game Designer muốn tinh chỉnh tông màu, **chỉ cần sửa mã màu trong `palette.json`**, không phải sửa bất kỳ dòng nào trong dữ liệu màn chơi hay source code.

---

## 2. TypeScript Interfaces (`src/types/level.types.ts`)

```typescript
/**
 * Định nghĩa 1 mục màu trong bảng màu trung tâm (public/assets/data/palette.json).
 * Đồng bộ trực tiếp với cấu trúc IDColor trong LevelColorConfig.asset của SandLoopGame.
 */
export interface ColorPaletteItem {
  /** ID màu dạng số nguyên dương (1, 2, 3...). Giá trị 0 dành riêng cho ô trống (Empty). */
  colorId: number;
  /** Tên gợi nhớ cho Designer dễ đọc (không ảnh hưởng logic code) */
  name: string;
  /** Mã màu chính cho thân xô, đầu đinh vít và viền ống (tương đương ColorConfig.color) */
  bodyHex: string;
  /** Mã màu đổ bóng & viền chữ (tương đương ColorConfig.shadowColor) */
  shadowHex: string;
  /** Mã màu quai/nắp đậm hoặc rãnh vít (tương đương ColorConfig.handleColor) */
  handleHex: string;
  /** Mã màu hạt cát trên bức tranh (tương đương ColorConfig.pixelColor) */
  sandHex: string;
}

/**
 * Cấu hình cân bằng gameplay toàn cục (src/config/balance.json)
 */
export interface GameBalanceConfig {
  conveyor: {
    /** Băng chuyền chạy tuyến tính (Linear) từ trái sang phải */
    isLinear: true;
    /** Số slot hoạt động mặc định trên băng chuyền khi bắt đầu màn = 2 */
    defaultActiveSlots: number;
    /** Số slot tối đa trên băng chuyền sau khi mở bằng Booster ExtraSlot = 4 */
    maxActiveSlots: number;
    /** Số lỗ cắm đinh vít cần lấp đầy trên mỗi xô cát để mở nắp = 3 */
    holesPerBucket: number;
    /** Tốc độ di chuyển ngang của băng chuyền (px/giây) */
    beltSpeedPxPerSec: number;
    /** Hệ số nhân tốc độ khi người chơi nhấn giữ màn hình (vd: 1.75) */
    holdSpeedMultiplier: number;
    /** Ngưỡng thời gian nhấn giữ để kích hoạt tăng tốc (ms) */
    holdThresholdMs: number;
    /** Chu kỳ hút từng hạt cát từ đáy tranh xuống xô đang mở nắp (ms) */
    suctionIntervalMs: number;
  };
  bufferDock: {
    /** Số lỗ chờ đinh vít tạm mặc định = 5 */
    defaultSlots: number;
    /** Số lỗ chờ tối đa khi người chơi dùng Revive = 7 */
    maxReviveSlots: number;
  };
  queueColumns: {
    /** Số đinh vít hiển thị trực quan trong lòng ống thủy tinh = 3 */
    visibleDepth: number;
    /** Thời gian các vít bên dưới trượt lên khi vít đỉnh bay ra (ms) = 200 */
    slideUpDurationMs: number;
  };
  boosters: {
    /** Booster 1: Mở thêm +1 slot trên băng chuyền Linear (từ 2 -> 3 -> 4) */
    extraSlot: {
      id: 1;
      key: 'extra_slot';
      slotIncrement: number;
      initialCount: number;
      coinCost: number;
    };
    /** Booster 2: Bàn tay chọn mở khóa ngay 1 xô trên băng chuyền (rút đủ 3 vít cùng colorId) */
    hand: {
      id: 2;
      key: 'hand';
      mode: 'unlock_selected_bucket' | 'pick_any_screw';
      initialCount: number;
      coinCost: number;
    };
    /** Booster 3: Đảo toàn bộ vít trong các cột Queue, ưu tiên đưa màu xô trên băng chuyền lên đỉnh */
    shuffle: {
      id: 3;
      key: 'shuffle';
      minPriorityTopMatches: number;
      animDurationMs: number;
      initialCount: number;
      coinCost: number;
    };
  };
}

/**
 * Định nghĩa 1 xô đựng cát trong hàng đợi ra băng chuyền Linear
 */
export interface SandBucketDef {
  /** Số thứ tự định danh của xô trong màn chơi (1, 2, 3...) */
  id: number;
  /** ID màu dạng số nguyên (int) - khớp với palette.json và ô màu trên sandBoard.grid */
  colorId: number;
  /** Số lượng ô cát (logical cells) màu này mà xô cần hút để đầy 100% */
  capacity: number;
  /** Số lỗ đinh vít trên thân xô cần lấp đầy để mở nắp (mặc định = 3) */
  requiredScrews: number;
}

/**
 * Định nghĩa 1 đinh vít nằm trong cột Queue hàng đợi
 */
export interface QueueScrewDef {
  /** ID màu dạng số nguyên (int) của đinh vít */
  colorId: number;
  /** Nếu true (1): hiển thị dấu '?' khi nằm ở dưới, chỉ lộ màu khi trượt lên đỉnh (index 0) */
  isMystery?: boolean;
}

/**
 * Định nghĩa 1 cột Queue hàng đợi (kiểu Color Blast) ở nửa dưới màn hình
 */
export interface QueueColumnDef {
  /** Chỉ số cột từ trái sang phải (0, 1, 2, 3...) */
  columnIndex: number;
  /** ID màu dạng số nguyên (int) cho phần viền miệng ống thủy tinh */
  rimColorId: number;
  /**
   * Danh sách đinh vít xếp từ TRÊN XUỐNG DƯỚI (FIFO):
   * - items[0] là vít ở ĐỈNH (người chơi tap sẽ bắn vít này lên trước).
   * - items[0..2] là 3 vít nhìn thấy trong ống thủy tinh.
   * - items[3..end] là các vít nằm trong hàng đợi ẩn, hiển thị qua nhãn '+N' dưới đáy ống.
   */
  items: QueueScrewDef[];
}

/**
 * Cấu trúc dữ liệu chuẩn của 1 màn chơi (level-XXX.json)
 */
export interface LevelData {
  version: 1;
  levelId: number;
  title: string;
  difficulty: 'tutorial' | 'easy' | 'medium' | 'hard';
  rewardCoins: number;

  /** Ghi đè cấu hình băng chuyền riêng cho màn nếu cần (mặc định: initialActiveSlots = 2, maxActiveSlots = 4) */
  conveyorConfig: {
    initialActiveSlots: number;
    maxActiveSlots: number;
    bufferSlots: number;
  };

  /** Bức tranh cát phía trên (Sand Loop Board) */
  sandBoard: {
    width: number;
    height: number;
    /** Hệ số chia mịn hạt cát hiển thị (mặc định = 4 -> mỗi ô chia thành 4x4 = 16 hạt cát mịn) */
    subDivision: number;
    /**
     * Ma trận 2 chiều chứa colorId kiểu số nguyên (int[][]):
     * - Kích thước: height hàng x width cột.
     * - grid[0] là hàng trên cùng; grid[height - 1] là HÀNG ĐÁY tiếp xúc với băng chuyền.
     * - Giá trị 0 = ô trống; Giá trị >= 1 = colorId (tra cứu trong palette.json).
     */
    grid: number[][];
  };

  /** Hàng đợi các xô cát lần lượt đi ra băng chuyền Linear */
  bucketQueue: SandBucketDef[];

  /** Các cột Queue hàng đợi đinh vít ở bên dưới (4 đến 6 cột) */
  queueColumns: QueueColumnDef[];
}

/**
 * Dữ liệu lưu trữ localStorage (có version để hỗ trợ migration)
 */
export interface SaveData {
  version: 1;
  currentLevel: number;
  coins: number;
  boosters: {
    extraSlot: number;
    hand: number;
    shuffle: number;
  };
  settings: {
    soundEnabled: boolean;
    musicEnabled: boolean;
    vibrationEnabled: boolean;
    language: 'vi' | 'en';
  };
  completedLevels: Record<number, { stars: number; bestTimeSec: number }>;
}
```

---

## 3. Bảng Màu Trung Tâm (`public/assets/data/palette.json`)

Bảng màu dưới đây giữ nguyên các `colorId: int` (`1..11`) từ file `LevelColorConfig.asset` của `SandLoopGame` và bổ sung `colorId: 12` (Lime Meadow cho nền tranh mèo). **Sau này muốn đổi màu chỉ cần sửa mã Hex tại đây:**

```json
[
  {
    "colorId": 1,
    "name": "Sky Blue",
    "bodyHex": "#3898FF",
    "shadowHex": "#0058C4",
    "handleHex": "#003980",
    "sandHex": "#2C7BDB"
  },
  {
    "colorId": 2,
    "name": "Royal Blue",
    "bodyHex": "#2D4AB0",
    "shadowHex": "#14249E",
    "handleHex": "#0A1766",
    "sandHex": "#2D4AC4"
  },
  {
    "colorId": 3,
    "name": "Charcoal Black",
    "bodyHex": "#3A3A42",
    "shadowHex": "#202026",
    "handleHex": "#141418",
    "sandHex": "#2E2E32"
  },
  {
    "colorId": 4,
    "name": "Leaf Green",
    "bodyHex": "#3FAC1D",
    "shadowHex": "#28840B",
    "handleHex": "#155602",
    "sandHex": "#499431"
  },
  {
    "colorId": 5,
    "name": "Vibrant Orange",
    "bodyHex": "#FF7A29",
    "shadowHex": "#C44B00",
    "handleHex": "#803100",
    "sandHex": "#F06E22"
  },
  {
    "colorId": 6,
    "name": "Candy Pink",
    "bodyHex": "#FF66B5",
    "shadowHex": "#C73882",
    "handleHex": "#851D52",
    "sandHex": "#F27BB8"
  },
  {
    "colorId": 7,
    "name": "Royal Violet",
    "bodyHex": "#8A4FFF",
    "shadowHex": "#5411AD",
    "handleHex": "#320570",
    "sandHex": "#9662F0"
  },
  {
    "colorId": 8,
    "name": "Ruby Red",
    "bodyHex": "#F0524F",
    "shadowHex": "#B52422",
    "handleHex": "#75100E",
    "sandHex": "#E03E3B"
  },
  {
    "colorId": 9,
    "name": "Aqua Cyan",
    "bodyHex": "#36C5F0",
    "shadowHex": "#1880A0",
    "handleHex": "#0A5168",
    "sandHex": "#45C4E6"
  },
  {
    "colorId": 10,
    "name": "Sunny Gold",
    "bodyHex": "#FFD13B",
    "shadowHex": "#C99610",
    "handleHex": "#825E04",
    "sandHex": "#F7C843"
  },
  {
    "colorId": 11,
    "name": "Cream White",
    "bodyHex": "#F5EFE0",
    "shadowHex": "#B8AE99",
    "handleHex": "#807764",
    "sandHex": "#FFFFFF"
  },
  {
    "colorId": 12,
    "name": "Lime Meadow",
    "bodyHex": "#A8E028",
    "shadowHex": "#78A810",
    "handleHex": "#4E7006",
    "sandHex": "#9BE01E"
  }
]
```

---

## 4. File Cấu hình Cân bằng (`src/config/balance.json`)

```json
{
  "conveyor": {
    "isLinear": true,
    "defaultActiveSlots": 2,
    "maxActiveSlots": 4,
    "holesPerBucket": 3,
    "beltSpeedPxPerSec": 42,
    "holdSpeedMultiplier": 1.75,
    "holdThresholdMs": 125,
    "suctionIntervalMs": 18
  },
  "bufferDock": {
    "defaultSlots": 5,
    "maxReviveSlots": 7
  },
  "queueColumns": {
    "visibleDepth": 3,
    "slideUpDurationMs": 200
  },
  "boosters": {
    "extraSlot": {
      "id": 1,
      "key": "extra_slot",
      "slotIncrement": 1,
      "initialCount": 3,
      "coinCost": 150
    },
    "hand": {
      "id": 2,
      "key": "hand",
      "mode": "unlock_selected_bucket",
      "initialCount": 3,
      "coinCost": 200
    },
    "shuffle": {
      "id": 3,
      "key": "shuffle",
      "minPriorityTopMatches": 2,
      "animDurationMs": 800,
      "initialCount": 3,
      "coinCost": 120
    }
  }
}
```

