# 08 — UI Asset Source Map (Unity SandLoopGame → Web)

> Tài liệu do agent B (UI Asset Harvest) tạo. Nguồn Unity (chỉ đọc): `D:\Projects\SandLoop\SandLoopGame\Assets`.
> Manifest máy đọc được: `public/assets/images/ui/ui-sprites.json` (169 key, mỗi key một dòng).

## 1. Quy ước

- **Đường dẫn web**: mọi file nằm dưới `public/`, URL runtime là `assets/images/...` (key `file` trong JSON).
- **Kích thước**: pixel gốc của sprite. Mọi sprite UI Unity dùng `spritePixelsToUnits = 100`, pivot `(0.5, 0.5)` → trên Canvas 1080 thì **1 px sprite = 1 unit canvas** (Image "Set Native Size").
- **9-slice**: Unity lưu `spriteBorder {x: L, y: B, z: R, w: T}`. Trong bảng/JSON đã đổi sang thứ tự CSS `[top, right, bottom, left]` → dùng thẳng:
  `border-image: url(...) T R B L fill / calc(T*var(--u)) calc(R*var(--u)) calc(B*var(--u)) calc(L*var(--u)) stretch;`
- **`sliceCss`** (chỉ có ở `btn_wide_*`): border Unity của các nút rộng bị kéo lệch (vd. `btn xanh` L=106 nhưng R=320). Ảnh đối xứng trái/phải nên dùng giá trị gợi ý (L=R=min) cho CSS.
- **Crop**: phần lớn file là `cp` y nguyên byte (đã kiểm md5). Ngoại lệ (cột *Nguồn* ghi `crop`): sprite nằm trong atlas `Slider.png` (2048², 1.3 MB) hoặc atlas Spine → đã cắt lossless bằng PIL, không đổi định dạng (PNG→PNG).
- Thư mục: `ui/` gốc (file cũ, giữ nguyên tên) + `ui/popup|buttons|icons|hud|win|lose|home|loading|tutorial/` + `app/` (PWA icon).

## 2. CanvasScaler (tham chiếu bố cục)

| Canvas | File | UI Scale Mode | Reference | Match (serialized) | Match runtime |
|---|---|---|---|---|---|
| ScreenManager (UIInGame, MainMenuScreen) | `GamePlugin/Resources/Screen/ScreenManager.prefab` | Scale With Screen Size | **1080 x 1920** | 1 | **0 (phone)** |
| PopupManager (mọi popup) | `GamePlugin/Resources/Controller/PopupManager.prefab` | Scale With Screen Size | 1080 x 1920 | 1 | **0 (phone)** |
| Canvas trong scene | `_Game/Scenes/SceneGame.unity` (`Canvas`, `PopupHolder`, `ScreenHolder`) | Scale With Screen Size | 1080 x 1920 | 0 | 0 |

- `ScreenMatchMode = 0` (MatchWidthOrHeight). Runtime (`MyCoreGame/Scripts/Common/UIManager.cs`, `PopupManager.Awake`, `SafeAreaFolding.cs`): **phone → match = 0, ref 1080x1920 (scale theo chiều rộng)**; **iPad / máy gập → match = 1, ref 1080x2200 (scale theo chiều cao)**.
- Root các screen/popup có `SafeAreaPanel` (bọc safe-area notch).
- **Đề xuất web**: `--u = min(100vw / 1080, 100dvh / 1920)` = 1 unit Unity. Phone dọc → theo chiều rộng (giống match 0); màn rộng hơn 9:16 (tablet/desktop) → khóa theo chiều cao và căn giữa cột 1080u (gần với chế độ iPad match 1; nếu muốn giống hệt iPad thì dùng `100dvh / 2200`). Mọi kích thước ở mục 4 là unit Unity → nhân `--u`. Dùng `env(safe-area-inset-*)` thay cho `SafeAreaPanel`.

## 3. Bảng file

### Đã có từ trước (`ui/` gốc)

| File web | Nguồn Unity | Kích thước | 9-slice (T R B L) | Dùng cho |
|---|---|---|---|---|
| `ui/bg_badge_count.png` | `_Game/Texture/UI/bg_number.png` | 79x81 | — | Badge đỏ đếm số booster (ButtonBooster/Amount 70x70, text outline #820901) |
| `ui/bg_booster_slot.png` | `_Game/Texture/UI/bg_nuttron.png` | 151x154 | — | Đĩa đen tròn (bg_nuttron) - nền slot/toggle tắt |
| `ui/bg_money.png` | `_Game/Texture/UI/Shop/bg_money.png` | 282x85 | — | Thẻ vàng (Shop/bg_money 282x85) - nhãn giá trong shop |
| `ui/bg_progress.png` | `_Game/Texture/UI/InGame/BgProgress.png` | 88x56 | `27 43 27 43` | Pill navy mờ 9-slice (thanh tiến độ nền / bộ đếm "3/5" / pill coin) |
| `ui/btn_blue.png` | `_Game/Texture/UI/GamePlay/Pause/Btnblue.png` | 144x144 | — | Nút tròn xanh dương (btnSetting gear in-game, Btnblue 144) |
| `ui/btn_circle_blue.png` | `_Game/Texture/UI/GamePlay/Mission/Ui level mission/Normal_btn_setting.png` | 144x144 | — | Nút tròn xanh sáng (Normal_btn_setting) - TRÙNG normal_btn_setting |
| `ui/btn_close.png` | `_Game/Texture/UI/close.png` | 144x144 | — | Nút X đỏ tròn đóng popup (ButtonClose 144x144, góc phải trên) |
| `ui/btn_green.png` | `_Game/Texture/UI/GamePlay/Pause/btn_green.png` | 152x156 | — | Nút tròn xanh lá (btnSetting toggle ON: music/sound/vibrate) |
| `ui/btn_plus_blue.png` | `_Game/Texture/UI/plus_blue.png` | 60x64 | — | Dấu cộng kem viền xanh |
| `ui/btn_plus_green.png` | `_Game/Texture/UI/+.png` | 68x68 | — | Nút + xanh lá nhỏ (+.png: ItemDisplay plus 45x45, booster AddIcon 70x70) |
| `ui/btn_red.png` | `_Game/Texture/UI/GamePlay/Pause/btn_red.png` | 136x136 | — | Nút tròn đỏ (btnReplay / btnExit trong panel setting in-game) |
| `ui/btn_replay.png` | `_Game/Texture/UI/GamePlay/replay.png` | 78x78 | — | Icon replay trắng viền đỏ (đặt trên btn_red) |
| `ui/btn_round_green.png` | `_Game/Texture/UI/nuttron.png` | 186x189 | — | Nút tròn xanh lá lớn (nuttron 186x189) - toggle trong SettingPanel |
| `ui/btn_setting_gear.png` | `_Game/Texture/UI/GamePlay/Pause/btn_setting.png` | 124x124 | — | Icon bánh răng trắng (btnSetting/Icon 110x110) |
| `ui/fill_progress.png` | `_Game/Texture/UI/InGame/progress.png` | 72x48 | `22 36 24 34` | Fill xanh lá 9-slice cho thanh tiến độ |
| `ui/hole_socket.png` | `_Game/Texture/UI/lo.png` | 47x49 | — | Lỗ ghim (lo.png) - gameplay/tag treo |
| `ui/icon_add_slot.png` | `_Game/Texture/UI/icon/add slot.png` | 256x256 | — | Booster thêm slot (icon/add slot.png) |
| `ui/icon_gold.png` | `_Game/Texture/UI/icon/gold.png` | 256x256 | — | Đồng xu vàng (ItemDisplay coin 130x150) |
| `ui/icon_hand.png` | `_Game/Texture/UI/icon/hand.png` | 256x256 | — | Booster găng tay (icon/hand.png) |
| `ui/icon_setting.png` | `_Game/Texture/UI/icon/setting.png` | 256x256 | — | Icon setting lớn (icon/setting.png) |
| `ui/icon_shuffle.png` | `_Game/Texture/UI/icon/shuffle.png` | 256x256 | — | Booster xáo trộn (icon/shuffle.png) |
| `ui/icon_sound.png` | `_Game/Texture/UI/sound.png` | 88x88 | — | Icon loa (btnSound) |
| `ui/normal_bgtopbar.png` | `_Game/Texture/UI/GamePlay/Mission/Ui level mission/Normal_bgtopbar.png` | 508x292 | `0 254 0 248` | Nền top bar xanh 2 thùy (UIMission/BG 1168x292 scale .9, 3-slice ngang) |
| `ui/normal_btn_setting.png` | `_Game/Texture/UI/GamePlay/Mission/Ui level mission/Normal_btn_setting.png` | 144x144 | — | Nút tròn xanh sáng của gear trên top bar (UIMission btnSetting/button) |
| `ui/nut_highlight.png` | `_Game/Texture/Gameplay/highlight.png` | 16x13 | — | Gameplay: highlight đầu ốc |
| `ui/nut_sphere.png` | `_Game/Texture/Gameplay/nut.png` | 57x57 | — | Gameplay: đầu ốc tròn |
| `ui/sand_bead.png` | `Sand/Texture2D/Circle_1.png` | 256x256 | — | Gameplay: hạt cát |
| `ui/sand_noise.png` | `Sand/Texture2D/cat_Base_color_0.png` | 1024x1024 | — | Gameplay: texture noise cát (1.8MB) |
| `ui/texture_arrow.png` | `_Game/Texture/Texture_Arrow.png` | 305x164 | — | Gameplay: mũi tên băng chuyền |
| `ui/texture_conveyor.png` | `_Game/Texture/Texture_Conveyor.png` | 1025x1025 | — | Gameplay: texture băng chuyền |
| `ui/unity_game_bg.jpg` | `unknown (không khớp hash với file nào trong Unity Assets)` | 768x1376 | — | Nền in-game trời xanh mây (768x1376 JPG) |
| `buckets/1..27.png`, `buckets/xo7mau.png` (28 file) | `_Game/Texture/UI/GamePlay/Mission/Icon/Bucket/*.png` | ~256x256 | — | Icon thùng/bucket mục tiêu (key `bucket_<n>` trong JSON) |

### Popup / panel (`ui/popup/`)

| File web | Nguồn Unity | Kích thước | 9-slice (T R B L) | Dùng cho |
|---|---|---|---|---|
| `ui/popup/popup_frame_blue.png` | `_Game/Texture/UI/Main/more live/BGpopup2.png` | 924x340 | `202 462 136 460` | Khung popup chuẩn (PopupBase/MainPopup/BG): header xanh đậm + thân xanh, 9-slice |
| `ui/popup/popup_body_blue.png` | `_Game/Texture/UI/Slider.png#bgbase.png *(crop: atlas rect (16,1204,342,276) [Unity y-up])*` | 342x276 | `69 172 200 162` | Thân popup theme Normal (DataManager.themeLevels[0].main = bgbase) |
| `ui/popup/popup_header_blue.png` | `_Game/Texture/UI/BgTitleBase.png` | 1060x340 | — | Nắp header popup theme Normal (themeLevels[0].top) |
| `ui/popup/popup_header_purple.png` | `_Game/Texture/UI/lv_hard.png` | 1060x340 | — | Nắp header popup theme Hard (themeLevels[1].top) |
| `ui/popup/popup_header_red.png` | `_Game/Texture/UI/lv_sphard.png` | 1060x340 | — | Nắp header popup theme Super Hard (themeLevels[2].top) |
| `ui/popup/popup_title_ribbon_purple.png` | `_Game/Texture/UI/Main/more live/BgTitle.png` | 764x196 | — | Ribbon tiêu đề tím viền vàng (UIDonateResource) |
| `ui/popup/popup_ribbon_pink.png` | `_Game/Texture/UI/gift.png` | 200x88 | — | Ribbon nhỏ hồng (RewardVisualClaim) - nhãn phần thưởng |
| `ui/popup/popup_panel_cream.png` | `_Game/Texture/UI/Main/more live/BGcontent.png` | 212x224 | `111 106 111 104` | Panel kem bên trong popup (UIRevive Splash/Frame; = Main/chatfix1.png) |
| `ui/popup/popup_panel_cream_inset.png` | `_Game/Texture/UI/Slider.png#bg_search2.png *(crop: atlas rect (1061,10,141,145) [Unity y-up])*` | 141x145 | `63 67 78 69` | Ô kem lõm (LevelPlayContent "Select Boosters", nền danh sách) |
| `ui/popup/popup_inner_border.png` | `_Game/Texture/UI/Slider.png#borderSplash.png *(crop: atlas rect (752,9,145,146) [Unity y-up])*` | 145x146 | `72 73 72 70` | Viền khung ảnh trong popup (PopupBase/Splash/Frame = borderSplash) |
| `ui/popup/popup_keep_playing_bg.png` | `_Game/Texture/UI/Slider.png#bg_bg_keep_playing.png *(crop: atlas rect (286,1794,334,250) [Unity y-up])*` | 334x250 | `50 160 180 160` | Nền popup Revive theme Normal (themeLevels[0].popupRevive) |
| `ui/popup/popup_header_tab.png` | `_Game/Texture/UI/header.png` | 40x196 | `22 19 171 19` | Header full-screen (HeaderTab, SettingPanel/Rankings) 9-slice ngang |
| `ui/popup/settings_row_bg.png` | `_Game/Texture/UI/Main/bg2.png` | 108x296 | `123 54 171 52` | Hàng nền xanh-xám chứa các toggle trong SettingPanel (Sound row) |
| `ui/popup/popup_reward_pill.png` | `_Game/Texture/UI/Slider.png#bg_capacity.png *(crop: atlas rect (476,624,54,57) [Unity y-up])*` | 54x57 | `28 27 28 27` | Thanh phần thưởng kem viền nâu (LevelPlayContent/PrizeContent = bg_capacity) |

### Buttons / toggles (`ui/buttons/`)

| File web | Nguồn Unity | Kích thước | 9-slice (T R B L) | Dùng cho |
|---|---|---|---|---|
| `ui/buttons/btn_wide_green.png` | `_Game/Texture/UI/Main/more live/btn xanh.png` | 428x212 | `88 320 122 106` → gợi ý `88 106 122 106` | Nút chính xanh lá (ButtonBase mặc định: Play/Continue/Claim) |
| `ui/buttons/btn_wide_orange.png` | `_Game/Texture/UI/Main/more live/btn cam.png` | 532x212 | `82 378 128 152` → gợi ý `82 152 128 152` | Nút cam (x2 reward / Watch Ads trong Win, Revive) |
| `ui/buttons/btn_wide_red.png` | `_Game/Texture/UI/Main/main home/btn.png` | 532x212 | `82 449 128 81` → gợi ý `82 81 128 81` | Nút đỏ (UIQuitInGame: Quit / Give up) |
| `ui/buttons/btn_wide_blue.png` | `_Game/Texture/UI/Main/main home/xanh.png` | 436x216 | `61 361 142 61` → gợi ý `61 61 142 61` | Nút xanh dương (SettingPanel SaveYourProgress) |
| `ui/buttons/btn_wide_purple.png` | `_Game/Texture/UI/Main/main home/tim.png` | 532x212 | `82 378 128 152` → gợi ý `82 152 128 152` | Nút tím (theme Hard) |
| `ui/buttons/btn_wide_gray.png` | `_Game/Texture/UI/Main/more live/gray.png` | 532x212 | `117 364 93 166` → gợi ý `117 166 93 166` | Nút xám disabled (ButtonAdsGray trong UIRevive) |
| `ui/buttons/btn_pill_green.png` | `_Game/Texture/UI/Slider.png#btngreen.png *(crop: atlas rect (261,148,111,227) [Unity y-up])*` | 111x227 | `110 55 110 55` | Nút viên thuốc xanh lá 3-slice ngang (theme Normal btn, SettingPanel Support) |
| `ui/buttons/btn_pill_orange.png` | `_Game/Texture/UI/Slider.png#btnorange.png *(crop: atlas rect (139,383,118,227) [Unity y-up])*` | 118x227 | `0 58 0 59` | Nút viên thuốc cam 3-slice ngang |
| `ui/buttons/btn_pill_blue.png` | `_Game/Texture/UI/Slider.png#btn_blue.png *(crop: atlas rect (1056,691,70,139) [Unity y-up])*` | 70x139 | `0 34 0 34` | Viên thuốc xanh dương 3-slice ngang (dùng cho pill "Level N" trên top bar) |
| `ui/buttons/btn_pill_gray.png` | `_Game/Texture/UI/Slider.png#btngray.png *(crop: atlas rect (139,148,114,227) [Unity y-up])*` | 114x227 | `0 57 0 57` | Viên thuốc xám (disabled) |
| `ui/buttons/btn_pill_purple.png` | `_Game/Texture/UI/Slider.png#btn_play_hard.png *(crop: atlas rect (380,149,116,226) [Unity y-up])*` | 116x226 | `140 57 80 57` | Nút Play theme Hard (themeLevels[1].btn) |
| `ui/buttons/btn_pill_red.png` | `_Game/Texture/UI/Slider.png#btn_play_sphard.png *(crop: atlas rect (4,142,127,227) [Unity y-up])*` | 127x227 | `140 63 80 63` | Nút Play theme Super Hard (themeLevels[2].btn) |
| `ui/buttons/btn_round_ring.png` | `_Game/Texture/UI/GamePlay/Pause/bg_btn2.png` | 168x164 | — | Vòng viền trắng-navy sau nút tròn setting (btnSetting/BG 193x193) |
| `ui/buttons/btn_round_ring_navy.png` | `_Game/Texture/UI/GamePlay/Mission/Ui level mission/Normal_bgsetting.png` | 148x148 | — | Vòng navy viền xanh sau nút gear trên top bar (UIMission btnSetting/BG/Image) |
| `ui/buttons/btn_setting_shadow.png` | `_Game/Texture/UI/GamePlay/Pause/btn_setting_shadow.png` | 88x92 | — | Bóng xanh đậm của icon gear (đặt dưới btn_setting_gear, lệch y -2..+1) |
| `ui/buttons/toggle_off_slash.png` | `_Game/Texture/UI/off.png` | 116x120 | — | Gạch đỏ chéo phủ lên nút khi tắt (btnSetting/button/dis, Image filled) |
| `ui/buttons/dot_on.png` | `_Game/Texture/UI/Package/MoreLive/on.png` | 43x43 | — | Chấm page indicator / toggle nhỏ BẬT |
| `ui/buttons/dot_off.png` | `_Game/Texture/UI/Package/MoreLive/off.png` | 43x43 | — | Chấm page indicator / toggle nhỏ TẮT |
| `ui/buttons/btn_plus_square_green.png` | `_Game/Texture/UI/AddSlot.png` | 128x128 | — | Nút vuông bo góc xanh lá có dấu + (thêm slot, giống nút "+" cạnh bộ đếm 3/5 trong ảnh mẫu) |

### Icons (`ui/icons/`)

| File web | Nguồn Unity | Kích thước | 9-slice (T R B L) | Dùng cho |
|---|---|---|---|---|
| `ui/icons/icon_plus_yellow.png` | `_Game/Texture/UI/Package/MoreLive/plus.png` | 81x86 | — | Dấu + vàng cam 3D (đặt trên nền nhỏ để làm nút + ở pill coin) |
| `ui/icons/icon_heart.png` | `_Game/Texture/UI/icon/heart.png` | 256x256 | — | Tim (mạng) - HeartDisplay top bar |
| `ui/icons/icon_heart_broken.png` | `_Game/Texture/UI/icon/broken-heart.png` | 256x256 | — | Tim vỡ - PopupReplay / thua mất 1 mạng |
| `ui/icons/icon_heart_infinity.png` | `_Game/Texture/UI/icon/heart_line.png` | 256x256 | — | Tim vô hạn |
| `ui/icons/icon_star.png` | `_Game/Texture/UI/icon/star.png` | 108x104 | — | Sao vàng (PopupEarnStar, HomePanel TopBar) |
| `ui/icons/icon_infinity.png` | `_Game/Texture/UI/icon/infinity.png` | 160x85 | — | Ký hiệu vô hạn (booster/heart unlimited) |
| `ui/icons/icon_coin_stack.png` | `_Game/Texture/UI/Shop/coin1.png` | 146x110 | — | Chồng xu (LevelPlayContent PrizeContent, phần thưởng) |
| `ui/icons/icon_lock_gold.png` | `_Game/Texture/UI/lock.png` | 94x121 | — | Khóa vàng (btnBooster lockObj) |
| `ui/icons/icon_lock_silver.png` | `_Game/Texture/UI/lock 1.png` | 98x120 | — | Khóa bạc (ButtonBooster lockObj + text "Lv.15") |
| `ui/icons/icon_unlock.png` | `_Game/Texture/UI/lock_on.png` | 88x113 | — | Khóa mở |
| `ui/icons/icon_music.png` | `_Game/Texture/UI/music.png` | 80x88 | — | Icon nhạc (btnSetting/btnMusic) |
| `ui/icons/icon_vibrate.png` | `_Game/Texture/UI/vibrate.png` | 88x84 | — | Icon rung (btnVibrate) |
| `ui/icons/icon_hint.png` | `_Game/Texture/UI/hint.png` | 93x96 | — | Icon bóng đèn gợi ý (btnHint) |
| `ui/icons/icon_exit.png` | `_Game/Texture/UI/GamePlay/btn_out.png` | 124x120 | — | Icon thoát/về Home (btnExit trên nút tròn đỏ) |
| `ui/icons/icon_check_green.png` | `_Game/Texture/UI/v.png` | 136x112 | — | Dấu tick xanh lá (đã nhận/hoàn thành) |
| `ui/icons/icon_check_white.png` | `_Game/Texture/UI/V 1.png` | 73x57 | — | Tick trắng viền xanh (btnBooster/Select/Image trên badge_green) |
| `ui/icons/icon_x_navy.png` | `_Game/Texture/UI/X.png` | 61x62 | — | Dấu X kem viền navy |
| `ui/icons/icon_x_red.png` | `_Game/Texture/UI/Revive/X.png` | 60x64 | — | Dấu X đỏ (Revive) |
| `ui/icons/icon_basket.png` | `_Game/Texture/UI/icon/basket.png` | 256x256 | — | Booster "Move bucket" (UIInGame ButtonBooster(2), BoosterMoveObjectPanel) |
| `ui/icons/icon_magnet.png` | `_Game/Texture/UI/icon/magnet.png` | 256x256 | — | Booster nam châm (LevelPlayContent btnBooster) |
| `ui/icons/icon_ads.png` | `_Game/Texture/UI/Main/more live/ads.png` | 116x136 | — | Icon clapper quảng cáo gắn góc nút (ButtonX2Reward/Image) |
| `ui/icons/badge_green.png` | `_Game/Texture/UI/green.png` | 88x88 | — | Badge tròn xanh lá (btnBooster Select) - nền cho icon_check_white |

### HUD in-game (`ui/hud/`)

| File web | Nguồn Unity | Kích thước | 9-slice (T R B L) | Dùng cho |
|---|---|---|---|---|
| `ui/hud/booster_btn_bg.png` | `_Game/Texture/UI/BGbooster.png` | 188x188 | — | Nền nút booster tròn xanh (ButtonBooster Variant/Image 176x178, icon 125x125) |
| `ui/hud/booster_select_bg.png` | `_Game/Texture/UI/Slider.png#bg_select_booster.png *(crop: atlas rect (748,1857,104,187) [Unity y-up])*` | 104x187 | `0 60 0 60` | Ô chọn booster (PopupLevelPlay btnBooster/holder/Image 186x187) |
| `ui/hud/booster_select_frame.png` | `_Game/Texture/UI/Slider.png#bg_bg_booster.png *(crop: atlas rect (249,14,116,120) [Unity y-up])*` | 116x120 | `56 51 67 51` | Khung nền ngoài ô booster (btnBooster/BG 200x201) |
| `ui/hud/level_badge_circle.png` | `_Game/Texture/UI/GamePlay/Mission/Ui level mission/Normal_bgcharater.png` | 236x232 | — | Đĩa tròn xanh chứa "Level / N" ở top bar (UIMission/BGLevel 236x232) |
| `ui/hud/mission_slot_bg.png` | `_Game/Texture/UI/GamePlay/Mission/Ui level mission/Normal_bg_mission.png` | 112x156 | `87 56 67 54` | Ô trắng viền xanh chứa mục tiêu (UIMission/BGTarget 600x156 sliced) |
| `ui/hud/coin_pill_cream.png` | `_Game/Texture/UI/Slider.png#money_bg.png *(crop: atlas rect (677,1324,60,72) [Unity y-up])*` | 60x72 | `35 29 34 29` | Pill kem chứa số coin/heart (ItemDisplay/ButtonBase 224x96, text #874000) |
| `ui/hud/tag_hard.png` | `_Game/Texture/UI/GamePlay/mode hard crazy/Tag Hard.png` | 105x93 | `0 23 0 81` | Tag đầu lâu tím cho level Hard (UIInGame/Level/Image) |
| `ui/hud/tag_crazy.png` | `_Game/Texture/UI/GamePlay/mode hard crazy/Tag Crazy.png` | 111x93 | `0 24 0 85` | Tag cho level Super Hard/Crazy |
| `ui/hud/warning_edge_h.png` | `_Game/Texture/UI/warning/img_warning.png` | 60x3 | — | Dải gradient đỏ cạnh trái/phải màn hình khi sắp thua (WaringDefeat Left/Right, 150px, alpha .5) |
| `ui/hud/warning_edge_v.png` | `_Game/Texture/UI/warning/img_warning_v.png` | 3x60 | — | Dải gradient đỏ cạnh trên/dưới (WaringDefeat Top/Bottom) |

### Win (`ui/win/`)

| File web | Nguồn Unity | Kích thước | 9-slice (T R B L) | Dùng cho |
|---|---|---|---|---|
| `ui/win/win_ribbon_red.png` | `_Game/Animation/Level_complete/Level_complete.png *(crop: spine atlas region (2,2,770,220))*` | 770x220 | — | Ruy băng đỏ tiêu đề "Level Complete" (region "ribbon" của Spine Level_complete) - cắt từ atlas |
| `ui/win/win_light_rays.png` | `_Game/Texture/UI/light.png` | 926x548 | — | Tia sáng trắng sau icon (UIFirstOutOfHeart, UIBuyBooster) - xoay chậm |
| `ui/win/win_star_full.png` | `_Game/Texture/UI/Main/Rate/star (1).png` | 144x140 | — | Sao vàng lớn (PopupRate) - sao đạt được |
| `ui/win/win_star_empty.png` | `_Game/Texture/UI/Main/Rate/star_2 (1).png` | 156x148 | — | Sao rỗng màu nâu nhạt - sao chưa đạt |
| `ui/win/win_progress_bg.png` | `_Game/Texture/UI/Win/Bgfill.png` | 72x72 | `30 35 35 35` | Nền thanh tiến độ phần thưởng (UILevelComplete Slider/Background) |
| `ui/win/win_progress_fill.png` | `_Game/Texture/UI/Win/fillimg.png` | 76x52 | `25 37 25 37` | Fill xanh lá thanh tiến độ (Slider/Fill) |
| `ui/win/win_title_mission_complete.png` | `_Game/Texture/Complete/text.png` | 492x228 | — | Chữ "MISSION COMPLETED" (PanelFX) |
| `ui/win/win_glow.png` | `XGameVfx/Textures/t_glow_3.png` | 512x512 | — | Quầng sáng tròn (PanelFX / HomePanel tag Light, tint #ffd900) |

### Lose / Revive (`ui/lose/`)

| File web | Nguồn Unity | Kích thước | 9-slice (T R B L) | Dùng cho |
|---|---|---|---|---|
| `ui/lose/lose_bear.png` | `_Game/Texture/UI/Revive/gau.png` | 472x708 | — | Gấu thợ (VisualNoticeLose) - minh họa popup Revive/Out of space |
| `ui/lose/lose_talk_bubble.png` | `_Game/Texture/UI/Revive/talk_nomal.png` | 192x336 | `170 62 163 126` | Bong bóng thoại của gấu (themeLevels[0].boxChat) |
| `ui/lose/lose_notice_pill.png` | `_Game/Texture/UI/Revive/blue.png` | 104x68 | — | Pill kem viền xanh (themeLevels[0].bgNotice) |

### Home (`ui/home/`)

| File web | Nguồn Unity | Kích thước | 9-slice (T R B L) | Dùng cho |
|---|---|---|---|---|
| `ui/home/home_bg_gradient.png` | `_Game/Texture/Home/main/bg2.png` | 1080x1920 | — | Nền gradient xanh tím 1080x1920 (HomePanel BGHolder) |
| `ui/home/home_pattern.png` | `_Game/Texture/Home/main/partern.png` | 384x392 | — | Hoa văn tile phủ lên nền home (Image tiled) |
| `ui/home/home_play_capsule.png` | `_Game/Texture/Main/Play_Btn.png` | 204x312 | `0 96 0 96` | Skin nút Play ở Home (HomePanel/holderBtnPlay/ButtonPlay/Button, 495x238, sliced ngang L/R 96) - xanh lá viền vàng |
| `ui/home/home_tab_home.png` | `_Game/Texture/Main/Home.png` | 209x222 | — | Icon tab Home (bottom bar MainMenuScreen) |
| `ui/home/home_tab_setting.png` | `_Game/Texture/Main/Setting.png` | 213x223 | — | Icon tab Setting |
| `ui/home/home_tab_shop.png` | `_Game/Texture/Main/Shop.png` | 217x210 | — | Icon tab Shop |
| `ui/home/home_tab_bar.png` | `_Game/Texture/Main/Tab_Bar.png` | 52x231 | `0 10 0 10` | Nền tab thường (bottom bar, 3-slice ngang, cao 232) |
| `ui/home/home_tab_bar_active.png` | `_Game/Texture/Main/Tab_Bar_Choose.png` | 40x231 | `0 10 0 10` | Nền tab đang chọn |
| `ui/home/home_tab_line.png` | `_Game/Texture/Main/Tab_BarLine.png` | 1080x20 | — | Đường kẻ trên bottom bar |
| `ui/home/home_node_shadow.png` | `_Game/Texture/Main/xo_shadow.png` | 271x147 | — | Bóng dưới node level trên map (NodeLevel/Shadow) |
| `ui/home/home_node_glow.png` | `_Game/Texture/Home/main/effect.png` | 328x328 | `163 163 163 163` | Viền sáng quanh node level hiện tại (NodeLevel/fx) |

### Loading (`ui/loading/`)

| File web | Nguồn Unity | Kích thước | 9-slice (T R B L) | Dùng cho |
|---|---|---|---|---|
| `ui/loading/loading_splash_bg.jpg` | `IconSplash/Android/splash_native.jpg` | 1080x1920 | — | Ảnh splash 1080x1920 (đã có logo "Color Flow" in sẵn) |
| `ui/loading/loading_logo.png` | `IconSplash/Android/splash_logo.png` | 1135x1081 | — | Logo game Unity "Color Flow - Art Puzzle" (PopupSplashLoading/Logo) - CHÚ Ý thương hiệu |
| `ui/loading/loading_bg_blue.png` | `GamePlugin/Misc/LevelConfig/Resources/Loading/Sprites/BG_Blue.png` | 2000x2000 | — | Nền xanh hoa văn cho màn chuyển cảnh/loading level |
| `ui/loading/loading_bar_bg.png` | `IconSplash/iOS/bgProgressGray.png` | 116x88 | `42 57 44 57` | Rãnh thanh loading (PopupSplashLoading/Process 680x86 sliced) |
| `ui/loading/loading_bar_fill.png` | `IconSplash/iOS/Progress 2.png` | 84x48 | `22 42 24 40` | Fill vàng cam thanh loading (Slider/Fill sliced, cao 46) |
| `ui/loading/loading_bar_knob.png` | `IconSplash/iOS/Layer 641.png` | 67x67 | — | Cuộn len cầu vồng đầu thanh loading (Handle, mặc định ẩn) |
| `ui/loading/loading_spinner.png` | `_Game/Texture/UI/Loading.png` | 104x104 | — | Spinner chờ (_Game/Prefabs/Loading.prefab, alpha .36, xoay) |
| `ui/loading/loading_star.png` | `GamePlugin/Misc/LevelConfig/Resources/Loading/Sprites/Star.png` | 56x64 | — | Lấp lánh 4 cánh (Loading level, cũng dùng cho win sparkle) |

### Tutorial / tooltip (`ui/tutorial/`)

| File web | Nguồn Unity | Kích thước | 9-slice (T R B L) | Dùng cho |
|---|---|---|---|---|
| `ui/tutorial/tut_hand_tap.png` | `Sand/Spines/Export/hand_zoom.png *(crop: spine atlas region (250,23,228,188) + rotate 90 CW)*` | 188x228 | — | Bàn tay găng trắng chỉ ngón (region "hand_finger" của Spine hand_zoom dùng trong UITutorial/ButtonBooster) - cắt & xoay lại |
| `ui/tutorial/tut_hand_pointer.png` | `GamePlugin/Sptires/Hand/icon_hand.png` | 164x144 | — | Bàn tay chỉ (GamePlugin Hand.prefab, anim Anim_1 trượt (68,-75)->(0,0) 1s loop) |
| `ui/tutorial/tut_bubble.png` | `_Game/Texture/UI/InGame/BGPopTut.png` | 780x208 | — | Hộp thoại hướng dẫn kem viền xanh 780x208 (UITutorial/UIInGame Tutorial, text #244898) |
| `ui/tutorial/tut_arrow.png` | `_Game/Texture/UI/arrow 1.png` | 212x304 | — | Mũi tên vàng chỉ xuống/lên (Arrow Tutorial.controller) |
| `ui/tutorial/tut_spotlight.png` | `_Game/Texture/UI/InGame/Fade (4).png` | 1024x1024 | `200 200 200 200` | Viền tối mờ quanh lỗ spotlight (Unmask/Image, 9-slice 200) |
| `ui/tutorial/tooltip_body.png` | `_Game/Texture/UI/tool_tip_giua.png` | 80x128 | `40 39 87 40` | Thân tooltip kem viền xanh (GameTooltip) |
| `ui/tutorial/tooltip_arrow_up.png` | `_Game/Texture/UI/tool_tip_tren.png` | 61x59 | — | Mũi nhọn tooltip hướng lên |
| `ui/tutorial/tooltip_arrow_down.png` | `_Game/Texture/UI/tool_tip_duoi.png` | 71x70 | — | Mũi nhọn tooltip hướng xuống |

### PWA app icons (`app/`)

| File web | Nguồn Unity | Kích thước | 9-slice (T R B L) | Dùng cho |
|---|---|---|---|---|
| `app/icon_48.png` | `IconSplash/Android/mipmap-mdpi/ic_launcher.png` | 48x48 | — | Favicon / PWA icon 48 |
| `app/icon_96.png` | `IconSplash/Android/mipmap-xhdpi/ic_launcher.png` | 96x96 | — | PWA icon 96 |
| `app/icon_144.png` | `IconSplash/Android/mipmap-xxhdpi/ic_launcher.png` | 144x144 | — | PWA icon 144 |
| `app/icon_192.png` | `IconSplash/Android/mipmap-xxxhdpi/ic_launcher.png` | 192x192 | — | PWA icon 192 (purpose any) |
| `app/icon_192_round.png` | `IconSplash/Android/mipmap-xxxhdpi/ic_launcher_round.png` | 192x192 | — | Icon tròn 192 |
| `app/icon_432_foreground.png` | `IconSplash/Android/mipmap-xxxhdpi/ic_launcher_foreground.png` | 432x432 | — | Layer foreground adaptive icon (nền trong suốt) - không dùng làm maskable trực tiếp |
| `app/icon_512.jpg` | `IconSplash/iOS/Icon.jpg` | 512x512 | — | Icon iOS 512 (JPG, hình bướm - KHÁC hình Android) |

## 4. Bố cục prefab tham chiếu (unit = canvas 1080)

Ký hiệu: `a=` anchor (min[-max]), `pos=` anchoredPosition (y dương = lên), `size=` sizeDelta. Text: font `royal_kingdom_font.otf` (legacy `Text`), hiệu ứng `BetterOutline` (viền 8 hướng), `Shadow` (dx, dy; dy âm = xuống), `GradientColor` dọc trắng → `#f8eabb`.

### 4.1 Ánh xạ nhanh ảnh mẫu `_Docs/image.png` → sprite

| Phần tử mockup | Sprite đề xuất | Ghi chú |
|---|---|---|
| Nút gear tròn xanh (trái trên) | `btn_round_ring_navy` (nền, +6u) + `normal_btn_setting` + `btn_setting_shadow` + `btn_setting_gear` (110u) | đúng cấu trúc `UIMission/btnSetting` 170x170 scale .8 |
| Pill "Level 9" | `btn_pill_blue` (3-slice ngang `0 34 0 34`) hoặc `btn_wide_blue` (sliceCss `61 61 142 61`) | sprite pill gốc của UIInGame (`Level` guid aea51e05…) **bị thiếu** trong project |
| Pill coin + số | `bg_progress` (navy 9-slice `27 43 27 43`) + `icon_gold` (tràn trái) | Unity gốc dùng `coin_pill_cream` (kem, chữ `#874000`) |
| Nút "+" cạnh coin | `btn_plus_green` (Unity) hoặc CSS ô vuông cam + `icon_plus_yellow` | không có sprite ô vuông vàng |
| Bộ đếm "3/5" + nút + | `bg_progress` + `btn_plus_square_green` | |
| Nút booster tròn | `booster_btn_bg` (188) + icon booster 125u (`icon_hand`, `icon_shuffle`, `icon_add_slot`, `icon_basket`, `icon_magnet`) | |
| Badge đỏ số lượng | `bg_badge_count` 70u, chữ 40 trắng→`#f8eabb` viền `#820901` | Unity đặt **góc dưới-phải** (pos -32,-145 từ góc trên-phải); mockup đặt trên-phải |

### 4.2 In-game — `_Game/Resources/UI/Screens/UIInGame.prefab`
```
UIInGame (stretch) > Safe_Area [SafeAreaPanel]
├─ Top  a=0,1-1,1 h=550
│  └─ UIMission a=0,1-1,1 h=210 [Canvas order 80]               (_Game/Prefabs/UI/UIMission.prefab)
│     ├─ BG 1168.5x292 scale .9  normal_bgtopbar (sliced 3 ngang)
│     │  ├─ BGTarget pos(2,5) 600x156  mission_slot_bg (sliced) → HorizontalLayout icon mục tiêu
│     │  ├─ BGLevel a=1,.5 pos(-145,8) 236x232  level_badge_circle
│     │  │   ├─ "Level" 55 trắng, outline #222e5c 1.5 + shadow (1.5,-1.5)   y+29
│     │  │   └─ số level 80 trắng, outline #222e5c 2                    y-68.5
│     │  └─ btnSetting a=1,.5 pos(-118,10) 170x170 scale .8 → ring + normal_btn_setting + shadow + gear(110, y+3)
│     └─ (TopBar cũ, inactive) ItemDisplay a=1,1 pos(-25,-70) 237.5x100: coin_pill_cream 224x96 sliced,
│         icon_gold 130x150 x-92.5, text 52 #874000, btn_plus_green 45x45 (30,-40); HeartDisplay 150x150
├─ Bottom a=0,0-1,0 h=525
└─ BoosterPanel/BoosterGroup
   ├─ ButtonBooster ×4  a=.5,0 size 185x185, x = -195 | 15 | 225, y ≈ 12–15   (ButtonBooster Variant)
   │   ├─ Image (stretch) booster_btn_bg ; Icon 125x125 y+11
   │   ├─ Amount a=1,1 pos(-32,-145) 70x70 bg_badge_count ; text 40 trắng→#f8eabb, outline #820901 (1,-1)
   │   ├─ AddIcon (cùng chỗ, khi hết) btn_plus_green 70x70
   │   └─ lockObj: booster_btn_bg + icon_lock_silver 65x87 (y+23) + "Lv.15" 35 #e0e5f4 outline #040c3c
   └─ PanelSetting [Canvas order 101]
       ├─ btnSetting a=.5,0 pos(425,120) 170x170 scale .9: btn_blue + btn_setting_shadow + btn_setting_gear 110
       └─ SettingPanel: Panel dim #000 a=.78 (5000²) ; 4–5 nút btnSetting 192x192 xếp dọc cách 220u:
           btnSetting.prefab = btn_round_ring 193 + btn_green 165 + icon 110 (icon_vibrate/icon_sound/icon_music)
                               + toggle_off_slash 160 (hiện khi TẮT) ; btnExit = btn_red 165 + icon_exit 110 ; btnReplay = btn_red + btn_replay 76x72
```
- Tutorial booster trong UIInGame: màn `#000` a=.5, lỗ spotlight `tut_spotlight` (9-slice 200, a=.5), bong bóng `tut_bubble` 780x208 (text 50 `#244898`, x+81; icon 159x157 x-246), nút đóng `btn_close` 100x100 a=1,1 pos(-29.5,-32).
- Cảnh báo sắp thua (`WaringDefeat`): CanvasGroup a=.73; 4 dải 150u ở 4 cạnh `warning_edge_h/v` a=.5.

### 4.3 PopupBase (khung chung) — `_Game/Prefabs/UI/PopupBase.prefab`
```
PopupBase (stretch)
├─ BG stretch(+600 h) #000000 a=.86
└─ MainPopup (stretch)   [Animation AnimPunchScale, autoplay]
   └─ BG pos(0,-77) 960x1593.8  popup_frame_blue (sliced 202 462 136 460)
      ├─ Header a=.5,1 pos(0,-90): textTitle 600x135, 85 trắng, outline #002a92 (2) + shadow #002c94 (-1,-3)
      ├─ Splash pos(0,165) 872x868: ảnh nội dung + popup_inner_border (sliced)
      ├─ textDescription a=0,0-1,0 y=440 inset 50: 55 trắng→#f8eabb, outline #003b82 (3)
      ├─ ButtonBase a=.5,0 pos(0,216) 605x264 → Button 520x200 btn_wide_green + text 110 trắng→#f8eabb,
      │   outline #076100 (5) + shadow #076100 (-1,-5)
      └─ ButtonClose a=1,1 pos(-26,-157) 144x144 btn_close
```
Biến thể (override sprite/text): **UIQuitInGame** "Quit Level?" / "You will lose a life" / nút "Quit" = `btn_wide_red`, panel `Slider#chatfix1` (kem). **UITryAgain** tiêu đề "Level N" / "You will lose a life" / nút "Try Again" (`btn_wide_green`) + top bar coin (`ItemDisplay` a=1,1 pos(-150,-75)) và heart (`HeartDisplay` pos(-345.5,-75) 130x130, số 52 outline `#710c0c`). **PopupReplay** "Level{0}" / "Level Failed!" + `icon_heart_broken` + nút "Try Again" (skin nút = `Slider#bg_v`, viên xanh lá ~ `btn_pill_green`). **PopupLevelPlay** "Level{0}" + `LevelPlayContent` 717x547: nhãn "Select Boosters:" 47 `#874000` trên `popup_panel_cream_inset`; 2 ô booster 200x200 ở x=±140, y=-173 (`booster_select_frame` + `booster_select_bg` 186x187, icon 140, badge 90 tại (73.6,-79.3), chọn = `badge_green` 80 + `icon_check_white` 50); "Rewards:" + `popup_reward_pill` 717x147 (`icon_coin_stack` + số 64 outline `#7a1f1b`).
Theme theo độ khó (`DataManager.themeLevels`): Normal = `popup_header_blue`/`popup_body_blue`/`btn_pill_green`/outline `#043e00`; Hard = `popup_header_purple`/`btn_pill_purple`/`#4b0097`; Super Hard = `popup_header_red`/`btn_pill_red`/`#651234`.

### 4.4 Thua / hết chỗ — `_Game/Resources/UI/Popups/UIRevive.prefab`
```
BG #000 a=.86
Group (VerticalLayout, inset top 120) > MainPopup h=1080
└─ BG 924x1080 popup_frame_blue
   ├─ Header a=.5,1 pos(0,-108): "Out of Blanks!" 85 trắng, outline #002a92 (2) + shadow (-1,-3)
   ├─ Splash a=.5,1 pos(0,-515) 820x610: Frame popup_panel_cream (sliced 111 106 111 104)
   │   ├─ minh họa (Spine Out_of_slot / Lose_*) → web: icon/booster hoặc lose_bear
   │   ├─ "Need more space to continue!" 60 #203f8d (y=60 từ đáy)
   │   └─ VisualHeart: tim vỡ (Spine) → icon_heart_broken ; "You will lose a life!" 60 #00457d ; "-1" 120 outline đen
   ├─ ButtonBuy (coin, xanh) & ButtonAds = btn_wide_orange (+icon_ads) ; disabled = btn_wide_gray ; y=156 h=264
   └─ ButtonClose a=1,1 pos(-34,-79) 144
Pack (offer carousel) + chấm trang 30x30 (tắt: trắng a=.24, bật: #cacaca) → dot_off/dot_on
"Hold to see your progress" 50 outline đen 3
```
Animation `PopupRevive.anim`: `MainPopup/BG` scale 0 → 1.05 (0.333s) → 1 (0.5s).
`VisualNoticeLose` (tắt mặc định): `lose_bear` + `lose_talk_bubble` (+ `lose_notice_pill`).

### 4.5 Thắng — `_Game/Resources/UI/Popups/UILevelComplete.prefab`
```
holder [CanvasGroup, SafeArea]
├─ Tile a=.5,1 pos(0,-407) 884x396
│  ├─ Spine Level_complete (ruy băng 770x220 + chữ nhảy) pos(0,170) → web: win_ribbon_red + chữ CSS
│  └─ LevelText a=.5,1 y=-422 "Level 30" 70 trắng, outline #002a59 (2,-2)
├─ Reward: rương (Spine Chest_win) + Slider 497x72: win_progress_bg / win_progress_fill (inset 13.6x19.5),
│   "0/0" 54 outline #115300
├─ continueHolder a=.5,.1-.5,.3: ButtonContinue btn_wide_green h=230 ("1000"+icon_gold 90, 72, outline #076100 4)
│   ButtonX2Reward btn_wide_orange h=230 + icon_ads 151x155 a=0,1 pos(40,-40), "+1000" 72 outline #7a3f00
├─ ButtonContinueLarge a=0,0-1,.13 btn_wide_green
├─ SkipButton (stretch, trong suốt) "Tap to skip" 80 outline #6d0000
└─ ClaimChestPanel: "Tap to Claim" 70 trắng→#f8eabb outline đen 2 + shadow (1,-3); Spine "congratulations"
```
Animation `Level_Complete.anim` (2.08s): root scale 1.1→1 (0–0.5s); LevelText pop 0→1.15→1 (0.5–0.75s); rương 0→1.25→1 (0.67–1.25s); Gold (1.08–1.58s); X2 (1.33–1.83s); Continue (1.58–2.08s) — mỗi nút 0→1.15 trong .33s rồi →1 trong .17s. Unity **không có hệ 3 sao** → `win_star_full/empty` lấy từ PopupRate nếu muốn hiển thị sao. Tia sáng: `win_light_rays` (xoay chậm), `win_glow`.

### 4.6 Settings (tab full-screen ở Home) — `_Game/Prefabs/UI/Settings/SettingPanel.prefab`
Nền `#363d5b`; HeaderTab cao 530 (`popup_header_tab` sliced, tiêu đề 100 trắng→`#f8eabb`, outline `#170662` 3 + shadow (-1,-5)); hàng `settings_row_bg` 1030x300 (sliced) ở top -175 chứa 4 toggle Music/Sound/Vibrate/Notify (x = -330/-110/110/330; nhãn 50 outline `#161c2f`; nút `btn_round_green` 140x142, tắt = phủ `toggle_off_slash`); danh sách nút 750x212 (`btn_wide_green`, `btn_wide_blue`) spacing -5; chữ phụ "Restore purchases"/version 55 `#747fac`.
In-game settings xem 4.2 (gear bung dọc).

### 4.7 Home — `MainMenuScreen.prefab` + `HomePanel.prefab`
- Nền: `Main/BG.png` 2208x2269 (đường làng, **5 MB – không copy**) đặt giữa khung 1300x2150. Web: `home_bg_gradient` (#23316b→#4752a9) + `home_pattern` (tile) hoặc `unity_game_bg.jpg`.
- Node level: `NodeLevel` 200x200 là Spine bucket; số level font **mario-bold** 84 outline `#612300` (vàng) / `#276100` (xanh) / `#812e87` (hard) / `#8c0e2d` (crazy); `home_node_shadow` 271x147 tại (17,-112); node hiện tại `home_node_glow` 328x320.
- Nút Play: `holderBtnPlay` a=.5,0 pos(0,600) 495x237.6 → skin `home_play_capsule` (sliced ngang L/R 96), ButtonScaler2.
- Top bar 210 (coin/heart/star giống ItemDisplay). Cột nút event trái/phải rộng 300 (VerticalLayout spacing 190).
- Bottom bar cao 205: bóng `Home/shadow_chat` + `home_tab_line` (21u, y=139) + 3 tab (`home_tab_shop`, `home_tab_home`, `home_tab_setting` ~210u) trên `home_tab_bar` / `home_tab_bar_active` (sliced `0 10 0 10`, cao 232).

### 4.8 Loading
- Boot splash `GamePlugin/Resources/Popup/PopupSplashLoading.prefab`: nền Spine splash (BG 2124x2760, 7 MB – không copy → dùng `loading_splash_bg.jpg`); logo Spine a=.5,1 pos(0,-380) scale .6 → `loading_logo`; thanh a=.5,0 pos(0,181) 680x86 `loading_bar_bg` (sliced) + fill `loading_bar_fill` (sliced, cao 46, lề ~13); knob `loading_bar_knob` (ẩn); "55%" 40 outline `#523500` (2,-2); "Loading Config..." 40 outline đen ở y=270.
- Chuyển level `GamePlugin/Misc/LevelConfig/Resources/Loading/Prefabs/Loading.prefab`: nền `loading_bg_blue`, glow + Spine chuyển cảnh, `bgProgressGray` 684x88 + fill 644x48 (filled ngang), chữ 45/40 trắng outline `#363232` (3,-3), `loading_star` lấp lánh.
- Chờ mạng `_Game/Prefabs/Loading.prefab`: chặn input (order 1000), `loading_spinner` 161x161 a=.36 xoay.

### 4.9 Tutorial / tooltip / toast
- `UITutorial.prefab` (order 110): overlay `#000` a=.8 có lỗ (Unmask); `tut_arrow` 100x100 scale 1.8 (Animator nhún); tay Spine `hand_zoom` click → `tut_hand_tap`; bong bóng `tut_bubble` 780x208 a=.5,0 pos(0,300), chữ `#244898`; "Tap to continue" 110 trắng→`#f8eabb` outline `#043e00` 4 + shadow (-1,-5).
- `GamePlugin/Sptires/Hand/Hand.prefab`: `tut_hand_pointer` 209x218, anim lặp 1s: pos (68,-75)→(0,0)→(68,-75).
- `MyCoreGame/Scripts/Tooltip/GameTooltip.prefab` (order 300): `tooltip_body` sliced rộng 800, chữ 40 `#244898`; mũi `tooltip_arrow_up` 61x59 / `tooltip_arrow_down` 71x70.
- Toast `NotifyPanel.prefab` (980x400, order 200): **không có nền**, chữ 65 trắng→`#ffdc99`, outline đen 1.5 + shadow (-1,-2). Anim: bắt đầu y=-200, alpha 0, scale .1 → fade-in .1s + scale 1 trong .3s, trôi tới y=-100 trong 2s (OutQuad), giữ .6s (<30 ký tự) / 1s, fade-out .3s.

### 4.10 Hành vi nút & animation chung
| Tên | Nguồn | Giá trị |
|---|---|---|
| Nhấn nút (đa số) | `ButtonScaler2.cs` | scale 0.95, 0.1s OutQuad, thả về 1 trong 0.1s |
| Nhấn nút (close, heart) | `ButtonScaler.cs` | scale 0.9, 0.1s Linear |
| Popup mở (PopupBase) | `AnimPunchScale.anim` | 0.8 → 1.02 (.05s) → 0.98 (.117s) → 1 (.167s) |
| Popup Revive mở | `PopupRevive.anim` | 0 → 1.05 (.333s) → 1 (.5s) |
| Shop/dialog | `SystemDialogShow.anim` / `SystemDialogHide.anim` | show: 1.1→1 trong .2s; hide: y 0→-40 (.117s)→+1300 (.417s) |
| Win | `Level_Complete.anim` | xem 4.5 |
| Gear in-game | `SettingButton/Open.anim` | icon quay 1080° trong .5s (đóng: 360°→0) |
| Panel setting in-game | `SettingPanel/Open.anim` | dim 0→.78 (.58s); từng nút trượt x -700 → +60 → 0, lệch ~.08s |
| Item pulse | `ScaleItem.anim` | 1 → 1.05 → 1, 2.33s lặp |

## 5. CSS token đề xuất (lấy mẫu màu từ art + prefab)

```css
:root {
  /* scale: 1 Unity canvas unit */
  --u: min(100vw / 1080, 100dvh / 1920);
  --stage-w: calc(1080 * var(--u));

  /* overlay */
  --c-dim: rgba(0, 0, 0, .86);          /* PopupBase/BG, UIRevive */
  --c-dim-soft: rgba(0, 0, 0, .78);     /* setting panel */
  --c-tut-dim: rgba(0, 0, 0, .80);

  /* popup */
  --c-popup-header: #0066ce;  --c-popup-body: #0099ff;  --c-popup-rim: #0078d2;
  --c-panel-cream: #fdf4e0;   --c-panel-cream-edge: #b4a494;
  --c-topbar: #0099ff;        --c-booster: #0280d9;

  /* text */
  --font-ui: "RoyalKingdom", system-ui, sans-serif;   /* royal_kingdom_font.otf */
  --font-num: "MarioBold", var(--font-ui);            /* mario-bold.otf (số node level) */
  --c-text: #ffffff;  --c-text-grad-end: #f8eabb;     /* gradient dọc của mọi tiêu đề/nút */
  --c-title-stroke: #002a92;  --c-title-shadow: #002c94;
  --c-desc-stroke: #003b82;   --c-level-stroke: #222e5c;
  --c-on-cream: #203f8d;      --c-on-cream-2: #244898;  --c-on-cream-3: #00457d;
  --c-brown: #874000;         --c-muted: #747fac;

  /* button faces: top / face / lip(3D đáy) / text-stroke */
  --btn-green:  #b4ec36 #96dd34 #3ca51a #076100;
  --btn-orange: #ffd133 #fcbf01 #c58100 #7a3f00;
  --btn-red:    #f50837 #ea071e #c00000 #6d0000;
  --btn-blue:   #3699ec #348be7 #135bcc #002a92;
  --btn-purple: #b933ff #a101fc #6900c5 #4b0097;
  --btn-gray:   #bfbfbf #b9b9b9 #9f9f9f #5c5c5c;   /* stroke xám: ước lượng */
  --c-badge: #f84129;  --c-badge-stroke: #820901;
  --c-progress-top: #a3f701;  --c-progress-bottom: #4da300;  --c-track: #63678b;
  --c-settings-bg: #363d5b;   --c-settings-stroke: #161c2f;
  --c-home-top: #23316b;      --c-home-bottom: #4752a9;
  --c-theme-hard: #4b0097;    --c-theme-superhard: #651234;

  /* radii (đo từ alpha của art) */
  --r-btn-wide: calc(45 * var(--u));   /* 428x212 */
  --r-pill: 999px;
  --r-panel-cream: calc(72 * var(--u));
  --r-popup: calc(90 * var(--u));
  --r-bubble: calc(42 * var(--u));
  --r-slot: calc(34 * var(--u));

  /* shadows / outline */
  --sh-lip: 0 calc(12 * var(--u)) 0;               /* + màu lip của nút */
  --sh-drop: 0 calc(8 * var(--u)) calc(14 * var(--u)) rgba(0, 0, 0, .35);
  --stroke-title: calc(4 * var(--u));              /* BetterOutline 2 ≈ stroke 4 (2 phía) */
  --stroke-btn: calc(8 * var(--u));                /* outline 4–5 trên nút lớn */
  --ts-title: calc(-1 * var(--u)) calc(3 * var(--u)) 0 var(--c-title-shadow);
  --ts-btn-green: calc(-1 * var(--u)) calc(5 * var(--u)) 0 #076100;

  /* motion */
  --press-scale: .95;  --dur-press: 100ms;  --ease-press: cubic-bezier(.25,.46,.45,.94); /* OutQuad */
  --ease-pop: cubic-bezier(.34, 1.56, .64, 1);     /* xấp xỉ punch/OutBack */
  --dur-popup-in: 167ms;  --dur-popup-revive: 500ms;
}
```
Chữ kiểu Unity: `-webkit-text-stroke: var(--stroke-title) var(--c-title-stroke); paint-order: stroke fill; text-shadow: var(--ts-title);` + gradient `background: linear-gradient(#fff, var(--c-text-grad-end)); -webkit-background-clip: text; color: transparent` (đặt stroke trên pseudo-element nếu dùng background-clip).

## 6. Không có sprite → vẽ bằng CSS / thay thế
- Pill "Level N" gốc của UIInGame (sprite guid `aea51e0559193fd4caea2fb021c186c7` không tồn tại trong project) → `btn_pill_blue` / `btn_wide_blue` hoặc CSS.
- Pill coin navy mờ + nút "+" vuông vàng như mockup → `bg_progress` + CSS; Unity chỉ có `coin_pill_cream` và `btn_plus_green`.
- Chữ "LEVEL COMPLETE!" (chữ cái Spine), confetti, particle, sparkle quay → CSS/canvas; dùng `win_ribbon_red`, `win_light_rays`, `win_glow`, `loading_star`.
- Toggle dạng công tắc trượt: Unity không có (dùng nút tròn + gạch đỏ `toggle_off_slash`).
- Mọi viền chữ/gradient chữ, nền dim, shadow nút → CSS.
- Spine (tay tutorial, tim vỡ, rương, bucket node, out_of_slot) → ảnh tĩnh đã crop + CSS keyframes.
- Nền Home thật (`Main/BG.png` 5 MB) & splash Spine (`SpineAssets/splash/BG.png` 7 MB) không copy (vượt ngưỡng 1.5 MB).
