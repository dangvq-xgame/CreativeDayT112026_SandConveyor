# 05. ĐẶC TẢ & KIỂM CHỨNG 5 MÀN CHƠI MẪU (`colorId: int`)

> **Điều hướng nhanh:** [00_INDEX](./PLAN_SAND_CONVEYOR.md) | [01_MECHANICS](./01_GAME_DESIGN_MECHANICS.md) | [02_ARCHITECTURE](./02_TECH_ARCHITECTURE_FOLDER.md) | [03_ASSETS](./03_ASSET_SPEC_INVENTORY.md) | [04_SCHEMA_CONFIG](./04_DATA_SCHEMA_CONFIG.md) | **05_LEVEL_DATA** | [06_ROADMAP_QA](./06_ROADMAP_QA_RISKS.md)

---

## 1. Bảng Tra cứu Nhanh `colorId: int`

Toàn bộ dữ liệu trong 5 màn chơi dưới đây đều lưu bằng số nguyên **`colorId: int`**. Khi muốn đổi màu hiển thị, chỉ cần sửa file `palette.json` (xem tại [04_DATA_SCHEMA_CONFIG.md](./04_DATA_SCHEMA_CONFIG.md)):

| `colorId` (int) | Tên màu | Mã Hex mặc định | Dùng trong các Level |
| :---: | :--- | :---: | :--- |
| **`1`** | Sky Blue (Xanh dương) | `#3898FF` | Level 3 |
| **`3`** | Charcoal Black (Đen than - Lông mèo) | `#3A3A42` | Level 5 |
| **`4`** | Leaf Green (Xanh lá đậm - Lá hoa) | `#3FAC1D` | Level 3, Level 5 |
| **`5`** | Vibrant Orange (Cam) | `#FF7A29` | Level 4 |
| **`6`** | Candy Pink (Hồng phấn) | `#FF66B5` | Level 2, Level 3, Level 5 |
| **`7`** | Royal Violet (Tím) | `#8A4FFF` | Level 4 |
| **`8`** | Ruby Red (Đỏ) | `#F0524F` | Level 4 |
| **`9`** | Aqua Cyan (Xanh ngọc) | `#36C5F0` | Level 1, Level 2, Level 4 |
| **`10`** | Sunny Gold (Vàng tươi) | `#FFD13B` | Level 1, Level 2, Level 3, Level 4, Level 5 |
| **`11`** | Cream White (Trắng kem - Cánh hoa & Mắt mèo) | `#F5EFE0` | Level 5 |
| **`12`** | Lime Meadow (Xanh nõn chuối - Nền cỏ) | `#A8E028` | Level 5 |

---

## 2. Quy tắc Kiểm chứng Toán học Bắt buộc (Level Validation Rules)

Mọi file `level-XXX.json` trong thư mục `_Docs/levels/` đã được kiểm chứng tự động qua 3 bất biến toán học:
1. **Kích thước lưới (`Grid Dimensions`):** `sandBoard.grid.length === sandBoard.height` và mọi hàng `row.length === sandBoard.width`.
2. **Bảo toàn lượng cát (`Sand Conservation`):** Với mọi `colorId`, tổng số ô mang `colorId` đó trên `sandBoard.grid` **bằng chính xác** tổng `capacity` của tất cả xô mang `colorId` đó trong `bucketQueue`.
3. **Bảo toàn đinh vít 3 lỗ (`Screw 3-Hole Conservation`):** Mỗi xô trên băng chuyền có `requiredScrews = 3` lỗ khóa $\rightarrow$ Với mọi `colorId`, tổng số đinh vít mang `colorId` đó trong các cột `queueColumns` **bằng chính xác** $3 \times (\text{số xô mang } \text{colorId} \text{ đó})$.

---

## 3. Chi tiết & Bảng Kiểm chứng Từng Level

### 🟢 Level 1: Sunny Waves (Tutorial)
- **File JSON tách rời:** [levels/level-001.json](./levels/level-001.json)
- **Cấu hình Băng chuyền:** `initialActiveSlots = 2`, `maxActiveSlots = 4`, `bufferSlots = 5`.
- **Kích thước tranh cát:** `10 × 6` = `60` ô logic ($\times 16 = 960$ hạt cát mịn).
- **Số cột Queue:** `4` cột, mỗi cột chứa đúng `3` vít (hiển thị đủ 3 vít trong ống, chưa có hàng đợi ẩn `+N`).

| `colorId` | Tên màu | Số ô trên `sandBoard.grid` | Số xô trong `bucketQueue` | Tổng `capacity` của xô | Số vít trong `queueColumns` ($3 \times \text{xô}$) | Trạng thái Verify |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| **`9`** | Aqua Cyan | `30` ô | `2` xô (`15` ô/xô) | `30` | `6` vít | ✅ PASS |
| **`10`** | Sunny Gold | `30` ô | `2` xô (`15` ô/xô) | `30` | `6` vít | ✅ PASS |
| **Tổng** | **2 màu** | **60 ô** | **4 xô** | **60** | **12 vít** | ✅ **100% KHỚP** |

---

### 🔵 Level 2: Berry Sunset (Làm quen Hàng đợi ẩn `+N` & BufferDock)
- **File JSON tách rời:** [levels/level-002.json](./levels/level-002.json)
- **Cấu hình Băng chuyền:** `initialActiveSlots = 2`, `maxActiveSlots = 4`, `bufferSlots = 5`.
- **Kích thước tranh cát:** `12 × 8` = `96` ô logic ($\times 16 = 1.536$ hạt cát mịn).
- **Số cột Queue:** `4` cột có độ sâu `[5, 4, 5, 4]` $\rightarrow$ hiển thị 3 vít trong ống và nhãn **`+2, +1, +2, +1`** dưới đáy ống.

| `colorId` | Tên màu | Số ô trên `sandBoard.grid` | Số xô trong `bucketQueue` | Tổng `capacity` của xô | Số vít trong `queueColumns` ($3 \times \text{xô}$) | Trạng thái Verify |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| **`6`** | Candy Pink | `32` ô | `2` xô (`16` ô/xô) | `32` | `6` vít | ✅ PASS |
| **`9`** | Aqua Cyan | `32` ô | `2` xô (`16` ô/xô) | `32` | `6` vít | ✅ PASS |
| **`10`** | Sunny Gold | `32` ô | `2` xô (`16` ô/xô) | `32` | `6` vít | ✅ PASS |
| **Tổng** | **3 màu** | **96 ô** | **6 xô** | **96** | **18 vít** | ✅ **100% KHỚP** |

---

### 🟣 Level 3: Tropical Bloom (Giới thiệu Booster 1: `ExtraSlot` mở băng chuyền từ 2 $\rightarrow$ 3–4 slot)
- **File JSON tách rời:** [levels/level-003.json](./levels/level-003.json)
- **Cấu hình Băng chuyền:** `initialActiveSlots = 2`, `maxActiveSlots = 4`, `bufferSlots = 5`.
- **Kích thước tranh cát:** `12 × 10` = `120` ô logic ($\times 16 = 1.920$ hạt cát mịn).
- **Số cột Queue:** `4` cột, mỗi cột chứa `6` vít $\rightarrow$ hiển thị 3 vít trong ống + nhãn **`+3`** dưới đáy ống.

| `colorId` | Tên màu | Số ô trên `sandBoard.grid` | Số xô trong `bucketQueue` | Tổng `capacity` của xô | Số vít trong `queueColumns` ($3 \times \text{xô}$) | Trạng thái Verify |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| **`1`** | Sky Blue | `30` ô | `2` xô (`15` ô/xô) | `30` | `6` vít | ✅ PASS |
| **`4`** | Leaf Green | `30` ô | `2` xô (`15` ô/xô) | `30` | `6` vít | ✅ PASS |
| **`6`** | Candy Pink | `30` ô | `2` xô (`15` ô/xô) | `30` | `6` vít | ✅ PASS |
| **`10`** | Sunny Gold | `30` ô | `2` xô (`15` ô/xô) | `30` | `6` vít | ✅ PASS |
| **Tổng** | **4 màu** | **120 ô** | **8 xô** | **120** | **24 vít** | ✅ **100% KHỚP** |

---

### 🟠 Level 4: Rainbow Strata (5 Cột Queue + Vít ẩn `?` + Booster 2 `Hand` & Booster 3 `Shuffle`)
- **File JSON tách rời:** [levels/level-004.json](./levels/level-004.json)
- **Cấu hình Băng chuyền:** `initialActiveSlots = 2`, `maxActiveSlots = 4`, `bufferSlots = 5`.
- **Kích thước tranh cát:** `14 × 10` = `140` ô logic ($\times 16 = 2.240$ hạt cát mịn).
- **Số cột Queue:** Mở rộng lên **`5` cột**, mỗi cột `6` vít (hiện 3 vít + nhãn `+3`), mỗi cột có 1 vít ẩn `isMystery: true` ở vị trí thứ 4.

| `colorId` | Tên màu | Số ô trên `sandBoard.grid` | Số xô trong `bucketQueue` | Tổng `capacity` của xô | Số vít trong `queueColumns` ($3 \times \text{xô}$) | Trạng thái Verify |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| **`5`** | Vibrant Orange | `28` ô | `2` xô (`14` ô/xô) | `28` | `6` vít | ✅ PASS |
| **`7`** | Royal Violet | `28` ô | `2` xô (`14` ô/xô) | `28` | `6` vít | ✅ PASS |
| **`8`** | Ruby Red | `28` ô | `2` xô (`14` ô/xô) | `28` | `6` vít | ✅ PASS |
| **`9`** | Aqua Cyan | `28` ô | `2` xô (`14` ô/xô) | `28` | `6` vít | ✅ PASS |
| **`10`** | Sunny Gold | `28` ô | `2` xô (`14` ô/xô) | `28` | `6` vít | ✅ PASS |
| **Tổng** | **5 màu** | **140 ô** | **10 xô** | **140** | **30 vít** | ✅ **100% KHỚP** |

---

### 🌟 Level 5: Black Cat in Flower Garden (Bức tranh Mèo Đen & Hoa từ `image.png`)
- **File JSON tách rời:** [levels/level-005.json](./levels/level-005.json)
- **Cấu hình Băng chuyền:** `initialActiveSlots = 2`, `maxActiveSlots = 4`, `bufferSlots = 5`.
- **Kích thước tranh cát:** `16 × 12` = `192` ô logic ($\times 16 = 3.072$ hạt cát mịn).
- **Số cột Queue:** `4` cột sâu `[8, 7, 8, 7]` $\rightarrow$ hiển thị 3 vít trong ống + nhãn **`+5, +4, +5, +4`** dưới đáy ống, kèm 6 vít ẩn dấu hỏi (`isMystery: true`).

| `colorId` | Tên màu (Chi tiết trên tranh) | Số ô trên `sandBoard.grid` | Số xô trong `bucketQueue` | Tổng `capacity` của xô | Số vít trong `queueColumns` ($3 \times \text{xô}$) | Trạng thái Verify |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| **`3`** | Charcoal Black (Lông mèo đen) | `60` ô | `3` xô (`20` ô/xô) | `60` | `9` vít | ✅ PASS |
| **`12`** | Lime Meadow (Nền cỏ xanh non) | `48` ô | `2` xô (`24` ô/xô) | `48` | `6` vít | ✅ PASS |
| **`11`** | Cream White (Cánh hoa & Mắt mèo) | `36` ô | `2` xô (`18` ô/xô) | `36` | `6` vít | ✅ PASS |
| **`4`** | Leaf Green (Lá hoa xanh đậm) | `24` ô | `1` xô (`24` ô/xô) | `24` | `3` vít | ✅ PASS |
| **`10`** | Sunny Gold (Nhụy hoa vàng) | `12` ô | `1` xô (`12` ô/xô) | `12` | `3` vít | ✅ PASS |
| **`6`** | Candy Pink (Tai trong & Mũi mèo) | `12` ô | `1` xô (`12` ô/xô) | `12` | `3` vít | ✅ PASS |
| **Tổng** | **6 màu** | **192 ô** | **10 xô** | **192** | **30 vít** | ✅ **100% KHỚP** |

#### Hình dung Ma trận `grid: number[][]` của Level 5 (Mèo Đen & Hoa - `16 × 12`)
```json
[
  [12, 12, 12, 12,  3,  3, 12, 12, 12, 12,  3,  3, 12, 12, 12, 12],
  [12, 12, 12, 12,  3,  3,  3, 12, 12,  3,  3,  3, 12, 12, 12, 12],
  [12, 12, 12,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3, 12, 12, 12],
  [12, 12, 12,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3, 12, 12, 12],
  [12, 12, 12,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3, 12, 12, 12],
  [12, 12, 12,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3, 12, 12, 12],
  [12, 11, 11,  3,  3, 11, 11,  3,  3, 11, 11,  3,  3, 11, 11, 12],
  [11, 10, 10, 11,  3, 11, 11,  6,  6, 11, 11,  3, 11, 10, 10, 11],
  [11, 10, 10, 11,  3,  6,  6,  6,  6,  6,  6,  3, 11, 10, 10, 11],
  [11, 11, 11, 11,  6,  6, 10, 10, 10, 10,  6,  6, 11, 11, 11, 11],
  [ 4,  4,  4,  4, 11, 11, 11, 11, 11, 11, 11, 11,  4,  4,  4,  4],
  [ 4,  4,  4,  4,  4,  4,  4,  4,  4,  4,  4,  4,  4,  4,  4,  4]
]
```
*(Chú giải nhanh: `3` = Đen lông mèo, `6` = Hồng tai/mũi mèo, `11` = Trắng mắt mèo/cánh hoa, `10` = Vàng nhụy hoa, `4` = Xanh lá đậm, `12` = Xanh nõn chuối nền cỏ).*
