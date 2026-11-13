# Sand Conveyor Web Demo (`CreativeDayT112026_SandConveyor`)

Bản Demo Web chuẩn chỉnh kết hợp 3 cơ chế gameplay:
1. **Tầng Trên — Tranh Cát (`SandBoard` / kiểu *Sand Loop*):** Ma trận 2 chiều `grid: number[][]` dùng `colorId: int`. Cát chảy từ hàng đáy xuống xô cùng màu trên băng chuyền, các hạt cát phía trên rơi xuống theo trọng lực.
2. **Tầng Giữa — Băng chuyền Tuyến tính (`LinearConveyor`) & Xô 3 Lỗ (`SandBucket`):**
   - Chạy ngang một chiều (`isLinear = true`), mặc định **`defaultActiveSlots = 2`**, mở tối đa **`maxActiveSlots = 4`** (cấu hình trong [`src/config/balance.json`](./src/config/balance.json)).
   - Mỗi xô cát có **3 lỗ khóa vít** trên thân. Phải nhận đủ **3 đinh vít cùng `colorId`** từ dưới bắn lên thì khóa mới xoay mở và bật nắp để hứng cát (`0% -> 100%`).
   - Có khay chờ tạm **`BufferDock` (5 lỗ)** nằm giữa băng chuyền và các cột hàng đợi.
3. **Tầng Dưới — Cột Hàng Đợi (`QueueColumns` / kiểu *Color Blast*):**
   - Các cột ống thủy tinh thẳng đứng hiển thị **3 đinh vít đầu tiên** (`items[0..2]`) và nhãn **`+N`** báo số đinh vít ẩn bên dưới (hỗ trợ đinh vít ẩn dấu hỏi `?`).
4. **Hệ thống 3 Boosters:**
   - **Booster 1 (`ExtraSlot` — `+ Mở Slot`):** Mở thêm `+1` slot hoạt động trên băng chuyền Linear (`2 -> 3 -> 4`).
   - **Booster 2 (`Hand` — `👆 Bàn Tay`):** Chọn 1 xô đang khóa trên băng chuyền để tự động rút đủ các đinh vít cùng `colorId` còn thiếu từ Buffer/Queue, lấp đầy 3 lỗ và **mở nắp xô ngay lập tức**.
   - **Booster 3 (`Shuffle` — `🔀 Đảo Vít`):** Xoáy đảo toàn bộ đinh vít trong các cột Queue theo quỹ đạo lốc xoáy, ưu tiên đưa tối thiểu 2 vít trùng `colorId` với xô đang khóa trên băng chuyền lên đỉnh cột.

---

## Cách chạy & Kiểm thử

```bash
# Cài đặt dependencies
pnpm install

# Kiểm tra tính toàn vẹn toán học & Bot giải tự động cho cả 5 Level JSON
pnpm validate-levels

# Chạy Unit Tests (Vitest)
pnpm test

# Chạy Server phát triển (Vite Dev Server)
pnpm dev

# Đóng gói bản Production (dist/)
pnpm build
```

## Thay đổi màu sắc nhanh qua `palette.json`
Toàn bộ dữ liệu màn chơi (`public/assets/data/levels/level-001..005.json`) sử dụng **`colorId: number` (`int`: `1..12`)**. Khi muốn thay đổi mã màu hiển thị của bất kỳ ID nào, chỉ cần sửa mã Hex tại [`public/assets/data/palette.json`](./public/assets/data/palette.json).

