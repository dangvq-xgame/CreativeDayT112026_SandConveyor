# TÀI LIỆU KẾ HOẠCH TỔNG THỂ (MASTER INDEX) — SAND CONVEYOR WEB

> **Dự án:** `CreativeDayT112026_SandConveyor`  
> **Mô hình Gameplay:** Kết hợp **Sand Loop** (Tranh cát chảy + Băng chuyền Linear) × **Screw Puzzle** (Xô cát khóa bởi 3 lỗ vít + Khay chờ 5 lỗ) × **Color Blast** (Các cột hàng đợi Queue bắn phần tử ở đỉnh).

Bộ tài liệu kế hoạch đã được **tách nhỏ thành 6 tài liệu chuyên biệt** và **5 file JSON màn chơi độc lập** để bạn dễ đọc, dễ đối chiếu (verify) và kiểm tra nhanh từng phần:

---

## 📂 Danh mục Tài liệu Thiết kế & Kỹ thuật (`_Docs/`)

| STT | File Tài liệu | Nội dung chính cần kiểm tra (Verify) |
| :---: | :--- | :--- |
| **01** | **[01_GAME_DESIGN_MECHANICS.md](./01_GAME_DESIGN_MECHANICS.md)** | • Phân tích bản gốc & Sơ đồ Core Loop 3 tầng.<br>• Cơ chế **Băng chuyền Linear** (`defaultActiveSlots = 2`, `maxActiveSlots = 4`).<br>• Cơ chế **Xô cát 3 lỗ khóa**: đủ 3 vít cùng `colorId` ở dưới mới mở nắp để cát từ tranh chảy xuống.<br>• Cơ chế **Cột Queue hàng đợi** (kiểu Color Blast: hiện 3 vít + nhãn `+N`).<br>• Đặc tả chi tiết **3 Boosters**: `Booster 1: ExtraSlot (+1 slot)`, `Booster 2: Hand`, `Booster 3: Shuffle`. |
| **02** | **[02_TECH_ARCHITECTURE_FOLDER.md](./02_TECH_ARCHITECTURE_FOLDER.md)** | • Bảng lựa chọn công nghệ (PixiJS v8, GSAP, TypeScript, Vite, Howler, Vitest).<br>• Sơ đồ luồng Scene & State Machine (Mermaid).<br>• Phân tách tầng Pure TS Game Logic (`src/game/`) và View (`src/view/`).<br>• **Cây thư mục dự án đầy đủ** đến từng file. |
| **03** | **[03_ASSET_SPEC_INVENTORY.md](./03_ASSET_SPEC_INVENTORY.md)** | • Nguyên tắc thiết kế Sprite trắng/xám (Tintable Base) để đổi màu động theo `colorId: int`.<br>• Chuẩn đặt tên (`spr-`, `ui-`, `bg-`, `fx-`, `sfx-`, `fnt-`), thông số Atlas/Audio/Font.<br>• Ngân sách dung lượng (`<= 1.5 MB`) & **Bảng kiểm kê tài nguyên đầy đủ**. |
| **04** | **[04_DATA_SCHEMA_CONFIG.md](./04_DATA_SCHEMA_CONFIG.md)** | • Toàn bộ TypeScript Interfaces chuẩn hóa **`colorId: number` (`int`)**.<br>• File cấu hình **`balance.json`** (`defaultActiveSlots: 2`, `maxActiveSlots: 4`, thông số 3 Boosters).<br>• File bảng màu trung tâm **`palette.json`** ánh xạ `colorId: 1..12` sang mã Hex *(sau này muốn đổi màu chỉ cần sửa file này)*. |
| **05** | **[05_LEVEL_DATA_PACK.md](./05_LEVEL_DATA_PACK.md)** | • Quy tắc kiểm chứng toán học 100% (`Tổng ô cát == Tổng sức chứa xô`, `Tổng vít == 3 × Số xô`).<br>• Bảng thống kê chi tiết số lượng ô cát, số xô và số vít theo từng `colorId: int` của **5 Level mẫu**. |
| **06** | **[06_ROADMAP_QA_RISKS.md](./06_ROADMAP_QA_RISKS.md)** | • Lộ trình thực hiện chia nhỏ theo Milestones (`M0` $\rightarrow$ `M4`).<br>• Chiến lược Unit Test, Level Validator CLI, Checklist QA, Rủi ro & **5 việc làm ngay**. |

---

## 🎮 Danh mục 5 File JSON Level Mẫu Tách Rời (`_Docs/levels/`)

Tất cả 5 file JSON dưới đây đều sử dụng **`colorId: int`** (`1..12`) và đã vượt qua kiểm tra cân bằng toán học 100%:

1. 🟢 **[levels/level-001.json](./levels/level-001.json)** — *Sunny Waves (Tutorial)*: Lưới `10×6` (`60` ô), 2 màu (`colorId: 9, 10`), 4 xô cát, 4 cột Queue (12 vít).
2. 🔵 **[levels/level-002.json](./levels/level-002.json)** — *Berry Sunset*: Lưới `12×8` (`96` ô), 3 màu (`colorId: 6, 9, 10`), 6 xô cát, 4 cột Queue có hàng đợi ẩn `+2, +1, +2, +1` (18 vít).
3. 🟣 **[levels/level-003.json](./levels/level-003.json)** — *Tropical Bloom*: Lưới `12×10` (`120` ô), 4 màu (`colorId: 1, 4, 6, 10`), 8 xô cát, 4 cột Queue sâu `+3` (24 vít).
4. 🟠 **[levels/level-004.json](./levels/level-004.json)** — *Rainbow Strata*: Lưới `14×10` (`140` ô), 5 màu (`colorId: 5, 7, 8, 9, 10`), 10 xô cát, **5 cột Queue** có vít ẩn `?` (30 vít).
5. 🌟 **[levels/level-005.json](./levels/level-005.json)** — *Black Cat in Flower Garden (Mockup Level 9)*: Lưới `16×12` (`192` ô = `3.072` hạt mịn), 6 màu (`colorId: 3, 4, 6, 10, 11, 12`), 10 xô cát, 4 cột Queue sâu `+5, +4, +5, +4` (30 vít).

---

## ⚡ Tóm tắt Nhanh Các Biến Config Quan Trọng Nhất

- **Chế độ băng chuyền:** `conveyor.isLinear = true` (băng chuyền chạy thẳng ngang).
- **Slot trên băng chuyền:** `conveyor.defaultActiveSlots = 2`, `conveyor.maxActiveSlots = 4` (mở thêm từng slot bằng **Booster 1: `ExtraSlot`**).
- **Số lỗ vít khóa trên mỗi xô cát:** `conveyor.holesPerBucket = 3` (đủ 3 vít cùng `colorId` mới mở nắp cho cát chảy xuống).
- **3 Boosters:**
  - `id: 1` — `extra_slot`: Mở thêm `+1` slot trên băng chuyền Linear (tối đa `4`).
  - `id: 2` — `hand`: Chọn 1 xô đang khóa trên băng chuyền để tự động rút đủ 3 vít cùng `colorId` mở nắp ngay lập tức.
  - `id: 3` — `shuffle`: Đảo toàn bộ vít trong các cột Queue, ưu tiên đưa màu của các xô đang nằm trên băng chuyền lên đỉnh cột.
- **Định danh màu sắc:** Toàn bộ dùng `colorId: int` (`1..12`), tra cứu mã màu Hex tại `palette.json`.
