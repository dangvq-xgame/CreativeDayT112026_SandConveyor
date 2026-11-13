# 03. CHUẨN TÀI NGUYÊN (ASSET SPEC) & BẢNG KIỂM KÊ

> **Điều hướng nhanh:** [00_INDEX](./PLAN_SAND_CONVEYOR.md) | [01_MECHANICS](./01_GAME_DESIGN_MECHANICS.md) | [02_ARCHITECTURE](./02_TECH_ARCHITECTURE_FOLDER.md) | **03_ASSETS** | [04_SCHEMA_CONFIG](./04_DATA_SCHEMA_CONFIG.md) | [05_LEVEL_DATA](./05_LEVEL_DATA_PACK.md) | [06_ROADMAP_QA](./06_ROADMAP_QA_RISKS.md)

---

## 1. Nguyên tắc Thiết kế Tài nguyên Đổi màu Động theo `colorId: int`

Vì toàn bộ hệ thống dữ liệu sử dụng **`colorId` kiểu số nguyên (`int`)** để dễ dàng thay đổi mã màu về sau mà không phải xuất lại hình ảnh hay sửa level:
- Tất cả các thành phần mang màu sắc gameplay gồm: **Hạt cát (`fx-sand-grain`)**, **Thân xô (`spr-bucket-body`)**, **Nắp xô (`spr-bucket-lid`)**, **Đống cát trong miệng xô (`spr-bucket-sandheap`)**, **Đầu đinh vít (`spr-screw-head`)** và **Viền miệng ống (`spr-tube-rim`)** đều được lưu dưới dạng **Sprite Trắng/Xám gốc (Grayscale Tintable Base)** + **Lớp bóng kính (Highlight Overlay)** tách rời.
- Lúc chạy game, `ColorManager.getColor(colorId: number)` đọc mã Hex từ `palette.json` và gán trực tiếp vào thuộc tính `sprite.tint` của PixiJS.
- **Lợi ích:** Khi muốn đổi màu của bất kỳ `colorId` nào (ví dụ đổi màu `colorId = 6` từ Hồng phấn sang Hồng đậm), chỉ cần sửa đúng 1 dòng Hex trong `public/assets/data/palette.json` — toàn bộ hạt cát trên tranh, xô cát, nắp xô, đinh vít và viền ống sẽ tự động đổi màu đồng bộ 100%!

---

## 2. Quy ước Đặt tên & Thông số Kỹ thuật

### 2.1. Quy ước Đặt tên
- Chữ thường (`lowercase`), nối từ bằng dấu gạch ngang (`kebab-case`), không dấu, không khoảng trắng.
- Tiền tố bắt buộc:
  - `spr-` : Sprite đối tượng trong sân chơi (`spr-bucket-body`, `spr-screw-head`).
  - `ui-` : Thành phần giao diện & nút Booster (`ui-booster-extraslot`, `ui-booster-hand`, `ui-booster-shuffle`).
  - `bg-` : Hình nền (`bg-main-sky`).
  - `fx-` : Hạt hiệu ứng (`fx-sand-grain`, `fx-sparkle`).
  - `sfx-` / `bgm-` : Âm thanh hiệu ứng và nhạc nền.
  - `fnt-` : Font chữ.

### 2.2. Thông số Định dạng Chuẩn
- **Hình ảnh & Atlas:**
  - Độ phân giải thiết kế gốc: **`1080 × 1920 px`** (Portrait 9:16).
  - Đóng gói vào 1 Atlas duy nhất `game-atlas.webp` (kèm `.png` fallback), kích thước tối đa `2048 × 2048 px`, `padding: 2px`, `extrude: 1px` để không bị hở viền khi co giãn.
- **Icon UI:** Định dạng `.svg` hoặc `.webp` sắc nét ở mật độ màn hình `@2x`.
- **Âm thanh:**
  - Xuất song song 2 định dạng: `.ogg` (ưu tiên cho Chrome/Android/Desktop) và `.mp3` (fallback cho iOS Safari).
  - Tần số lấy mẫu: `44.1 kHz`, chuẩn hóa âm lượng `-14 LUFS`.
- **Font chữ:** `fnt-fredoka-bold.woff2` (hỗ trợ đầy đủ ký tự Tiếng Việt & Tiếng Anh, dung lượng `< 35 KB`).

---

## 3. Ngân sách Tài nguyên & Hiệu năng (Performance Budget)

| Hạng mục | Ngân sách Tối đa | Mục tiêu Thực tế (Demo) |
| :--- | :---: | :---: |
| **Tổng dung lượng tải lần đầu (Gzip)** | $\le 1.5\text{ MB}$ | `~850 KB` |
| **Dung lượng Texture Atlas (`game-atlas.webp`)** | $\le 500\text{ KB}$ | `~220 KB` |
| **Dung lượng Audio (SFX + BGM)** | $\le 600\text{ KB}$ | `~350 KB` |
| **Thời gian tải trang lần đầu (4G / Fast 3G)** | $< 2.5\text{ giây}$ | `< 1.2 giây` |
| **Tốc độ khung hình (FPS trên Mobile tầm trung)** | $60\text{ FPS}$ | $60\text{ FPS}$ (Draw calls $< 25$) |

---

## 4. Bảng Kiểm kê Tài nguyên Đầy đủ (Asset Inventory)

| ID (`asset-manifest.json`) | Loại | Đường dẫn (`public/assets/...`) | Kích thước / Định dạng | Dùng ở đâu | Nguồn / Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `fnt-fredoka` | Font | `fonts/fnt-fredoka-bold.woff2` | `~32 KB` / WOFF2 | Chữ HUD, `%` trên xô, `+N` dưới ống | Có sẵn (Google Fonts) |
| `bg-main-sky` | Image | `images/backgrounds/bg-main-sky.webp` | `1080×1920` / WebP | Nền bầu trời xanh tươi của `GameScene` | Sinh từ mockup `image.png` |
| `spr-sand-frame` | Atlas Frame | `images/atlases/game-atlas.webp` | `960×680` (9-slice) | Khung viền xanh trắng bao quanh tranh cát | Cắt từ `image.png` / Vector |
| `fx-sand-grain` | Atlas Frame | `images/atlases/game-atlas.webp` | `32×32` / Trắng (Tint) | Hạt cát tròn trên tranh & dòng cát chảy | Texture hạt tròn có bóng |
| `spr-conveyor-belt` | Atlas Frame | `images/atlases/game-atlas.webp` | `980×110` / Tileable | Mặt băng chuyền Linear chạy ngang | Có sẵn (`Texture_Conveyor.png`) |
| `spr-conveyor-tunnel`| Atlas Frame | `images/atlases/game-atlas.webp` | `160×240` / PNG | Cổng vòm đường hầm 2 đầu băng chuyền | Cắt từ `image.png` / Vector |
| `spr-bucket-body` | Atlas Frame | `images/atlases/game-atlas.webp` | `200×180` / Trắng (Tint)| Thân xô đựng cát (tint theo `colorId`) | Tách lớp Base + Highlight |
| `spr-bucket-lid` | Atlas Frame | `images/atlases/game-atlas.webp` | `210×70` / Trắng (Tint) | Nắp xô cát (xoay mở khi đủ 3 vít) | Tách lớp Base + Highlight |
| `spr-bucket-strip` | Atlas Frame | `images/atlases/game-atlas.webp` | `180×64` / PNG | Đai khóa ngang chứa 3 lỗ vít trên xô | Vẽ Vector / Atlas |
| `spr-bucket-hole` | Atlas Frame | `images/atlases/game-atlas.webp` | `44×44` / PNG | Lỗ tròn trống trên đai khóa xô cát | Vẽ Vector / Atlas |
| `spr-bucket-sandheap`| Atlas Frame | `images/atlases/game-atlas.webp` | `160×60` / Trắng (Tint) | Đống cát nhô lên trong miệng xô đã mở | Vẽ Vector / Atlas |
| `spr-screw-head` | Atlas Frame | `images/atlases/game-atlas.webp` | `96×96` / Trắng (Tint) | Đinh vít dấu `+` (tint theo `colorId`) | Tách lớp Base + Dấu `+` đậm |
| `spr-screw-mystery` | Atlas Frame | `images/atlases/game-atlas.webp` | `96×96` / PNG xám `?` | Vít ẩn dấu hỏi `?` trong cột Queue | Vẽ Vector / Atlas |
| `spr-tube-glass` | Atlas Frame | `images/atlases/game-atlas.webp` | `180×480` / Bán trong | Ống thủy tinh chứa cột Queue hàng đợi | Cắt từ `image.png` / Vector |
| `spr-tube-rim` | Atlas Frame | `images/atlases/game-atlas.webp` | `196×44` / Trắng (Tint) | Viền miệng ống thủy tinh (tint theo `rimColorId`)| Tách lớp Base + Highlight |
| `spr-buffer-dock` | Atlas Frame | `images/atlases/game-atlas.webp` | `560×100` (9-slice) | Khay chờ 5 lỗ tạm giữa băng chuyền & ống | Vẽ Vector / Atlas |
| `ui-booster-slot` | UI Icon | `images/ui/ui-booster-extraslot.svg` | `128×128` / SVG | Icon Booster 1: Mở thêm slot băng chuyền (`+`) | Vẽ SVG chuẩn mockup |
| `ui-booster-hand` | UI Icon | `images/ui/ui-booster-hand.svg` | `128×128` / SVG/PNG | Icon Booster 2: Bàn tay chọn mở xô/lấy vít | Lấy từ `SandLoopGame` |
| `ui-booster-shuffle` | UI Icon | `images/ui/ui-booster-shuffle.svg` | `128×128` / SVG/PNG | Icon Booster 3: 2 mũi tên xoay đảo vít | Cắt từ `image.png` / SVG |
| `sfx-screw-pop` | Audio SFX | `audio/sfx/sfx-screw-pop.ogg` | `0.08s` / OGG+MP3 | Tiếng bật vít khỏi đỉnh cột Queue | Có sẵn (`SandLoopGame`) |
| `sfx-screw-land` | Audio SFX | `audio/sfx/sfx-screw-land.ogg` | `0.06s` / OGG+MP3 | Tiếng vít cắm vào lỗ trên xô / Buffer | Có sẵn (`SandLoopGame`) |
| `sfx-lid-open` | Audio SFX | `audio/sfx/sfx-lid-open.ogg` | `0.45s` / OGG+MP3 | Tiếng xoay khóa 3 vít & bật nắp xô | Có sẵn (`SFX_Twist_2.mp3`) |
| `sfx-sand-drain` | Audio SFX | `audio/sfx/sfx-sand-drain.ogg` | `0.15s` / OGG+MP3 | Tiếng hạt cát chảy xuống xô | Có sẵn (`SFX_Print_Color.wav`) |
| `sfx-booster-shuffle`| Audio SFX | `audio/sfx/sfx-booster-shuffle.ogg` | `0.80s` / OGG+MP3 | Tiếng lốc xoáy khi dùng Booster 3 (Shuffle) | Có sẵn (`SFX_Swipe.mp3`) |
| `sfx-booster-hand` | Audio SFX | `audio/sfx/sfx-booster-hand.ogg` | `0.35s` / OGG+MP3 | Tiếng kích hoạt Booster 2 (Hand) | Có sẵn (`SFX_Punch.mp3`) |
| `sfx-win` / `sfx-lose`| Audio SFX | `audio/sfx/sfx-win.ogg` | `1.50s` / OGG+MP3 | Nhạc hiệu thắng / thua màn chơi | Có sẵn (`SandLoopGame`) |

