# 06. LỘ TRÌNH PHÁT TRIỂN (MILESTONES), ĐẢM BẢO CHẤT LƯỢNG (QA) & RỦI RO

> **Điều hướng nhanh:** [00_INDEX](./PLAN_SAND_CONVEYOR.md) | [01_MECHANICS](./01_GAME_DESIGN_MECHANICS.md) | [02_ARCHITECTURE](./02_TECH_ARCHITECTURE_FOLDER.md) | [03_ASSETS](./03_ASSET_SPEC_INVENTORY.md) | [04_SCHEMA_CONFIG](./04_DATA_SCHEMA_CONFIG.md) | [05_LEVEL_DATA](./05_LEVEL_DATA_PACK.md) | **06_ROADMAP_QA**

---

## 1. Lộ trình Thực hiện (Milestones M0 $\rightarrow$ M4)

Tổng thời gian dự kiến cho bản Demo Web hoàn chỉnh: **5 ngày làm việc** (mỗi task $\le 0.5$ ngày, có tiêu chí nghiệm thu rõ ràng).

| Milestone | Mã Task & Nội dung công việc | Phụ thuộc | Thời lượng | Tiêu chí Nghiệm thu (Acceptance Criteria) |
| :--- | :--- | :---: | :---: | :--- |
| **M0: Setup & Data** | **T0.1:** Khởi tạo dự án Vite + TypeScript + PixiJS v8 + GSAP + Howler + Vitest. | — | `0.5 ngày` | Chạy `pnpm dev`, `pnpm test`, `pnpm build` không lỗi; khung `1080×1920` tự căn giữa màn hình. |
| | **T0.2:** Đưa `palette.json`, `balance.json` và 5 file `level-001..005.json` vào `public/assets/data/` kèm script `tools/validate-levels.ts`. | T0.1 | `0.5 ngày` | Lệnh `pnpm validate-levels` báo `PASS` cả 5 màn chơi (kiểm tra `colorId: int`, tổng cát = tổng sức chứa xô, tổng vít = $3 \times \text{số xô}$). |
| **M1: Pure TS Core Logic** | **T1.1:** Xây dựng `LinearConveyorModel` (`defaultActiveSlots = 2`, `maxActiveSlots = 4`), `SandBucketModel` (3 lỗ vít + đóng/mở nắp) và `BufferDockModel` (5 lỗ chờ). | T0.2 | `0.5 ngày` | Pass unit test: xô chưa đủ 3 vít thì `isOpen === false`; đủ 3 vít thì `isOpen === true`; vít từ Buffer tự động bay lên khi có xô cùng `colorId`. |
| | **T1.2:** Xây dựng `QueueColumnModel` (FIFO, 3 vít hiện + `+N` ẩn + vít `?`) và `SandBoardModel` (trọng lực rơi cát & hút đáy theo `colorId: int`). | T1.1 | `0.5 ngày` | Pass unit test: chỉ xô đã mở nắp mới hút cát cùng `colorId` từ hàng đáy; các ô cát phía trên tự rơi xuống lấp chỗ trống. |
| | **T1.3:** Xây dựng `BoosterRule.ts` cho 3 Boosters: `ExtraSlot` (`2 -> 3 -> 4`), `Hand` (mở khóa xô đang chọn), `Shuffle` (ưu tiên `colorId` của xô trên băng chuyền). | T1.2 | `0.5 ngày` | Pass unit test cho cả 3 Boosters; `Shuffle` luôn đảm bảo $\ge 2$ cột Queue có vít đỉnh khớp `colorId` với xô đang khóa trên băng chuyền. |
| **M2: Gameplay View & FX** | **T2.1:** Dựng `ColorManager.ts` + `SandBoardView.ts` + `SandStreamFX.ts` (vẽ tranh hạt cát mịn tint theo `palette.json` & dòng cát bay xuống xô). | T1.2 | `0.5 ngày` | Đổi thử 1 mã Hex trong `palette.json` thì màu cát, xô và vít đổi theo ngay lập tức; tốc độ khung hình giữ vững 60 FPS. |
| | **T2.2:** Dựng `LinearConveyorView.ts` (băng tải chạy ngang, 2 hầm trái/phải, nhấn giữ tăng tốc) và `SandBucketView.ts` (đai 3 lỗ vít, nắp bật mở, chữ `%`). | T1.1, T2.1 | `0.5 ngày` | Xô lăn mượt trên băng chuyền Linear; khi nhận đủ 3 vít thì xoay khóa, bật nắp và dâng cát kèm tỷ lệ `%`. |
| | **T2.3:** Dựng `BufferDockView.ts` (5 lỗ chờ) và `QueueColumnView.ts` (ống thủy tinh, viền màu `rimColorId`, 3 vít hiện + nhãn `+N` dưới đáy). | T1.2 | `0.5 ngày` | Tap vào cột Queue phóng vít đỉnh bay theo đường cong Bezier vào lỗ xô (hoặc vào Buffer); các vít dưới đôn lên mượt mà. |
| **M3: UI, Boosters & Audio** | **T3.1:** Dựng `TopHudView`, `BoosterBarView` (3 nút Booster: `ExtraSlot`, `Hand`, `Shuffle`), `HandBoosterOverlay` và `ShuffleSpiralFX`. | T1.3, T2.3 | `0.5 ngày` | Bấm Booster 1 mở thêm slot băng chuyền (tối đa 4); bấm Booster 2 chạm xô mở nắp ngay; bấm Booster 3 xoáy đảo vít đẹp mắt. |
| | **T3.2:** Dựng `MenuScene`, `ResultScene` (Win / Lose / Revive `+1 lỗ Buffer`), `SaveManager` và tích hợp âm thanh ASMR (`AudioManager`). | T3.1 | `0.5 ngày` | Chơi trọn vẹn 5 màn chơi, lưu tiến trình vào `localStorage`, đầy đủ hiệu ứng âm thanh tháo vít, bật nắp và cát chảy. |
| **M4: QA, Tool & Deploy** | **T4.1:** Viết `tools/image-to-level.ts` (chuyển ảnh PNG sang ma trận `colorId: int`), chạy E2E Playwright test và đóng gói bản build `dist/`. | T3.2 | `0.5 ngày` | Toàn bộ Unit Test + E2E Test xanh; bản build `dist/` chạy mượt trên cả Desktop và Mobile. |

---

## 2. Chiến lược Đảm bảo Chất lượng (QA & Testing)

### 2.1. Kiểm thử Tự động (Automated Tests)
1. **Unit Test Logic (`tests/unit/` — Vitest):**
   - `LinearConveyorModel.test.ts`: Kiểm tra khởi tạo đúng `defaultActiveSlots = 2`, gọi `extraSlot()` tăng lên `3`, `4` và không vượt quá `maxActiveSlots = 4`.
   - `ScrewMatchRule.test.ts`: Kiểm tra bắn 3 vít cùng `colorId` vào xô $\rightarrow$ `bucket.isOpen === true` $\rightarrow$ bắt đầu hút cát; kiểm tra vít nằm ở `BufferDock` tự bay lên khi xô mới cùng `colorId` xuất hiện.
   - `BoosterRule.test.ts`:
     - Test **Booster 2 (`Hand`)**: Chọn 1 xô đang có `0/3` hoặc `1/3` vít $\rightarrow$ rút chính xác số vít còn thiếu từ `BufferDock` và `QueueColumns` để lấp đủ `3/3` lỗ vít, mở nắp xô ngay lập tức.
     - Test **Booster 3 (`Shuffle`)**: Chạy 100 lần ngẫu nhiên, xác nhận 100% lần chạy đều đưa ít nhất `minPriorityTopMatches = 2` vít có `colorId` trùng với xô trên băng chuyền lên vị trí `items[0]` của các cột Queue.
2. **Kiểm chứng Dữ liệu Màn chơi (`tools/validate-levels.ts`):**
   - Kiểm tra mọi `colorId` xuất hiện trong `sandBoard.grid`, `bucketQueue`, `queueColumns` đều tồn tại trong `palette.json`.
   - Kiểm tra tổng ô cát của từng `colorId` == tổng `capacity` của xô mang `colorId` đó.
   - Kiểm tra tổng số vít của từng `colorId` == $3 \times (\text{số xô mang } \text{colorId} \text{ đó})$.

### 2.2. Checklist QA trên Thiết bị
- [ ] **Đổi màu nhanh qua `palette.json`:** Sửa thử mã Hex của `colorId: 6` trong `palette.json`, F5 trình duyệt $\rightarrow$ cả hạt cát trên tranh, thân xô, nắp xô, đinh vít và viền ống mang `colorId: 6` đều đổi sang màu mới.
- [ ] **Cấu hình Slot băng chuyền qua `balance.json`:** Đổi `defaultActiveSlots` từ `2` sang `3` trong `balance.json` $\rightarrow$ vào game có sẵn 3 slot trên băng chuyền và chỉ mở thêm được 1 lần nữa là đạt `maxActiveSlots = 4`.
- [ ] **Trải nghiệm Mobile Touch:** Không bị cuộn trang hay zoom trình duyệt khi tap liên tục vào các cột Queue; nhấn giữ tăng tốc băng chuyền mượt mà.

---

## 3. Rủi ro Kỹ thuật & Giải pháp

| Rủi ro | Mức độ | Giải pháp thiết kế đã áp dụng |
| :--- | :---: | :--- |
| **1. Đinh vít đang bay thì xô trên băng chuyền Linear đã di chuyển đi chỗ khác** | Trung bình | Cập nhật toạ độ đích `(tx, ty)` của đinh vít đang bay ở mỗi frame theo vị trí thực tế của lỗ thứ `k` trên xô (`bucket.getHolePosition(k)`). |
| **2. Render 3.000+ hạt cát ở Level 5 gây nóng máy yếu** | Cao | Dùng 1 texture hạt tròn trắng duy nhất kết hợp PixiJS batching + tint theo `colorId`, chỉ cập nhật vị trí $Y$ cho các cột đang có cát sụt xuống. |
| **3. Bấm `Shuffle` khi còn quá ít vít trong ống (< 3 vít)** | Thấp | Giống `LevelControllerBase.Booster.cs` (`CountLimitShuffle = 3`): Nếu tổng số vít còn lại trong tất cả các cột `< 3` thì hiện thông báo nhẹ và không trừ lượt Booster. |

---

## 4. 5 Việc Làm Ngay Hôm Nay

1. **Duyệt bộ tài liệu đã tách nhỏ (`01` $\rightarrow$ `06`)** và 5 file JSON trong thư mục [_Docs/levels/](file:///d:/_DemoCreative/CreativeDayT112026_SandConveyor/_Docs/levels).
2. **Khởi tạo bộ khung dự án (Milestone M0):** Tạo `package.json`, `tsconfig.json`, `vite.config.ts` và copy `palette.json`, `balance.json`, `level-001..005.json` vào `public/assets/data/`.
3. **Viết `ColorManager` & Pure TS Models (Milestone M1):** Hiện thực hóa hệ thống `colorId: int`, băng chuyền Linear (`defaultActiveSlots = 2`, `maxActiveSlots = 4`), xô cát 3 lỗ vít và các cột Queue.
4. **Dựng giao diện Sân chơi & 3 Boosters (Milestone M2 + M3):** Kết nối PixiJS hiển thị tranh cát, băng chuyền Linear, ống thủy tinh và 3 Boosters (`ExtraSlot`, `Hand`, `Shuffle`).
5. **Copy bộ âm thanh chuẩn từ `SandLoopGame`:** Đưa các file SFX (`SFX_Twist_2.mp3`, `SFX_Print_Color.wav`, `SFX_Swipe.mp3`...) vào dự án web để hoàn thiện cảm giác chơi (game feel).

