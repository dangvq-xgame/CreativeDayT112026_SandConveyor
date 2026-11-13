# Changelog

## [1.0.0] - 2026-11-13
### Added
- Bộ tài liệu kế hoạch tách nhỏ (`_Docs/01..06`) và 5 file JSON màn chơi độc lập (`level-001.json` .. `level-005.json`) chuẩn hóa `colorId: int` (`1..12`).
- Hệ thống `ColorManager` ánh xạ động `colorId: int` sang mã màu Hex từ `public/assets/data/palette.json`.
- Cơ chế `LinearConveyor` (`defaultActiveSlots = 2`, `maxActiveSlots = 4`), `SandBucket` (3 lỗ khóa đinh vít, xoay khóa & bật nắp hứng cát `0% -> 100%`), `BufferDock` (5 lỗ chờ), `QueueColumn` (hiển thị 3 vít đầu + nhãn `+N` + vít ẩn `?`) và `SandBoard` (trọng lực rơi cát + dòng cát chảy).
- Đầy đủ 3 Boosters: `Booster 1: ExtraSlot (+1 slot)`, `Booster 2: Hand (chọn mở nắp xô)`, `Booster 3: Shuffle (xoáy đảo vít ưu tiên màu trên băng chuyền)`.
- Bộ kiểm chứng `tools/validate-levels.mjs` và Unit Tests (`tests/unit/`).

