# B — UI Asset Harvest (Unity SandLoopGame → web)

## Tóm tắt

- Lấy art UI từ project Unity `D:\Projects\SandLoop\SandLoopGame\Assets` (chỉ đọc, không ghi/đổi tên gì bên đó) theo đúng sprite mà prefab dùng: tra `guid` trong `.prefab` → file qua `.meta`.
- Prefab đã khảo sát: `UIInGame`, `UIMission` (top bar), `ButtonBooster Variant`, `btnSetting`, `ItemDisplay`, `PopupBase`, `ButtonBase`, `ButtonClose`, `UIRevive`, `UITryAgain`, `UIQuitInGame`, `PopupReplay`, `PopupLevelPlay`/`LevelPlayContent`/`btnBooster`, `UILevelComplete`, `SettingPanel`, `MainMenuScreen`, `HomePanel`, `NodeLevel`, 3 prefab loading, `UITutorial`, `Hand`, `GameTooltip`, `NotifyPanel` (toast), `WaringDefeat`, `DataManager` (theme theo độ khó).
- **Thêm 110 file, 4,648,287 B (~4.4 MiB)** + `ui-sprites.json` (~48 KB). 94 file `cp` y nguyên byte (đã đối chiếu md5); 16 file cắt lossless (PNG→PNG) từ atlas `Slider.png` 2048² (14 file) và 2 atlas Spine (`win_ribbon_red`, `tut_hand_tap`) vì không có file rời.
- File cũ trong `public/assets/images/ui/*.png`, `buckets/`, `fonts/` giữ nguyên; đã dò ngược nguồn bằng hash (trừ `unity_game_bg.jpg`).
- CanvasScaler: **Scale With Screen Size 1080x1920, match = 0 (theo chiều rộng) trên phone**; iPad/máy gập: 1080x2200, match = 1.
- Tài liệu: `_Docs/08_UI_ASSET_SOURCE_MAP.md` (bảng nguồn, CanvasScaler, layout prefab, animation, CSS token).

## Added

**Manifest / docs**
- `public/assets/images/ui/ui-sprites.json` — 169 key (59 cũ + 110 mới), mỗi key: `file, w, h, slice[T,R,B,L]|null, (sliceCss), source, use, method, bytes`.
- `_Docs/08_UI_ASSET_SOURCE_MAP.md`
- `_Docs/changes/B_ui_assets.md` (file này)

**`public/assets/images/ui/popup/`** (14 file)

- `public/assets/images/ui/popup/popup_frame_blue.png` (924x340, 73,767 B) ← `Assets/_Game/Texture/UI/Main/more live/BGpopup2.png`
- `public/assets/images/ui/popup/popup_body_blue.png` (342x276, 16,669 B) ← `Assets/_Game/Texture/UI/Slider.png#bgbase.png` — *crop atlas rect (16,1204,342,276) [Unity y-up]*
- `public/assets/images/ui/popup/popup_header_blue.png` (1060x340, 96,939 B) ← `Assets/_Game/Texture/UI/BgTitleBase.png`
- `public/assets/images/ui/popup/popup_header_purple.png` (1060x340, 90,941 B) ← `Assets/_Game/Texture/UI/lv_hard.png`
- `public/assets/images/ui/popup/popup_header_red.png` (1060x340, 86,345 B) ← `Assets/_Game/Texture/UI/lv_sphard.png`
- `public/assets/images/ui/popup/popup_title_ribbon_purple.png` (764x196, 49,482 B) ← `Assets/_Game/Texture/UI/Main/more live/BgTitle.png`
- `public/assets/images/ui/popup/popup_ribbon_pink.png` (200x88, 23,696 B) ← `Assets/_Game/Texture/UI/gift.png`
- `public/assets/images/ui/popup/popup_panel_cream.png` (212x224, 29,518 B) ← `Assets/_Game/Texture/UI/Main/more live/BGcontent.png`
- `public/assets/images/ui/popup/popup_panel_cream_inset.png` (141x145, 9,279 B) ← `Assets/_Game/Texture/UI/Slider.png#bg_search2.png` — *crop atlas rect (1061,10,141,145) [Unity y-up]*
- `public/assets/images/ui/popup/popup_inner_border.png` (145x146, 12,752 B) ← `Assets/_Game/Texture/UI/Slider.png#borderSplash.png` — *crop atlas rect (752,9,145,146) [Unity y-up]*
- `public/assets/images/ui/popup/popup_keep_playing_bg.png` (334x250, 5,488 B) ← `Assets/_Game/Texture/UI/Slider.png#bg_bg_keep_playing.png` — *crop atlas rect (286,1794,334,250) [Unity y-up]*
- `public/assets/images/ui/popup/popup_header_tab.png` (40x196, 4,027 B) ← `Assets/_Game/Texture/UI/header.png`
- `public/assets/images/ui/popup/settings_row_bg.png` (108x296, 11,867 B) ← `Assets/_Game/Texture/UI/Main/bg2.png`
- `public/assets/images/ui/popup/popup_reward_pill.png` (54x57, 2,654 B) ← `Assets/_Game/Texture/UI/Slider.png#bg_capacity.png` — *crop atlas rect (476,624,54,57) [Unity y-up]*

**`public/assets/images/ui/buttons/`** (19 file)

- `public/assets/images/ui/buttons/btn_wide_green.png` (428x212, 34,675 B) ← `Assets/_Game/Texture/UI/Main/more live/btn xanh.png`
- `public/assets/images/ui/buttons/btn_wide_orange.png` (532x212, 34,369 B) ← `Assets/_Game/Texture/UI/Main/more live/btn cam.png`
- `public/assets/images/ui/buttons/btn_wide_red.png` (532x212, 36,524 B) ← `Assets/_Game/Texture/UI/Main/main home/btn.png`
- `public/assets/images/ui/buttons/btn_wide_blue.png` (436x216, 23,993 B) ← `Assets/_Game/Texture/UI/Main/main home/xanh.png`
- `public/assets/images/ui/buttons/btn_wide_purple.png` (532x212, 37,049 B) ← `Assets/_Game/Texture/UI/Main/main home/tim.png`
- `public/assets/images/ui/buttons/btn_wide_gray.png` (532x212, 19,401 B) ← `Assets/_Game/Texture/UI/Main/more live/gray.png`
- `public/assets/images/ui/buttons/btn_pill_green.png` (111x227, 16,954 B) ← `Assets/_Game/Texture/UI/Slider.png#btngreen.png` — *crop atlas rect (261,148,111,227) [Unity y-up]*
- `public/assets/images/ui/buttons/btn_pill_orange.png` (118x227, 12,541 B) ← `Assets/_Game/Texture/UI/Slider.png#btnorange.png` — *crop atlas rect (139,383,118,227) [Unity y-up]*
- `public/assets/images/ui/buttons/btn_pill_blue.png` (70x139, 5,748 B) ← `Assets/_Game/Texture/UI/Slider.png#btn_blue.png` — *crop atlas rect (1056,691,70,139) [Unity y-up]*
- `public/assets/images/ui/buttons/btn_pill_gray.png` (114x227, 11,237 B) ← `Assets/_Game/Texture/UI/Slider.png#btngray.png` — *crop atlas rect (139,148,114,227) [Unity y-up]*
- `public/assets/images/ui/buttons/btn_pill_purple.png` (116x226, 15,435 B) ← `Assets/_Game/Texture/UI/Slider.png#btn_play_hard.png` — *crop atlas rect (380,149,116,226) [Unity y-up]*
- `public/assets/images/ui/buttons/btn_pill_red.png` (127x227, 15,274 B) ← `Assets/_Game/Texture/UI/Slider.png#btn_play_sphard.png` — *crop atlas rect (4,142,127,227) [Unity y-up]*
- `public/assets/images/ui/buttons/btn_round_ring.png` (168x164, 17,465 B) ← `Assets/_Game/Texture/UI/GamePlay/Pause/bg_btn2.png`
- `public/assets/images/ui/buttons/btn_round_ring_navy.png` (148x148, 8,270 B) ← `Assets/_Game/Texture/UI/GamePlay/Mission/Ui level mission/Normal_bgsetting.png`
- `public/assets/images/ui/buttons/btn_setting_shadow.png` (88x92, 3,943 B) ← `Assets/_Game/Texture/UI/GamePlay/Pause/btn_setting_shadow.png`
- `public/assets/images/ui/buttons/toggle_off_slash.png` (116x120, 6,899 B) ← `Assets/_Game/Texture/UI/off.png`
- `public/assets/images/ui/buttons/dot_on.png` (43x43, 2,772 B) ← `Assets/_Game/Texture/UI/Package/MoreLive/on.png`
- `public/assets/images/ui/buttons/dot_off.png` (43x43, 2,517 B) ← `Assets/_Game/Texture/UI/Package/MoreLive/off.png`
- `public/assets/images/ui/buttons/btn_plus_square_green.png` (128x128, 15,934 B) ← `Assets/_Game/Texture/UI/AddSlot.png`

**`public/assets/images/ui/icons/`** (22 file)

- `public/assets/images/ui/icons/icon_plus_yellow.png` (81x86, 4,757 B) ← `Assets/_Game/Texture/UI/Package/MoreLive/plus.png`
- `public/assets/images/ui/icons/icon_heart.png` (256x256, 43,643 B) ← `Assets/_Game/Texture/UI/icon/heart.png`
- `public/assets/images/ui/icons/icon_heart_broken.png` (256x256, 43,760 B) ← `Assets/_Game/Texture/UI/icon/broken-heart.png`
- `public/assets/images/ui/icons/icon_heart_infinity.png` (256x256, 46,443 B) ← `Assets/_Game/Texture/UI/icon/heart_line.png`
- `public/assets/images/ui/icons/icon_star.png` (108x104, 10,684 B) ← `Assets/_Game/Texture/UI/icon/star.png`
- `public/assets/images/ui/icons/icon_infinity.png` (160x85, 47,337 B) ← `Assets/_Game/Texture/UI/icon/infinity.png`
- `public/assets/images/ui/icons/icon_coin_stack.png` (146x110, 20,401 B) ← `Assets/_Game/Texture/UI/Shop/coin1.png`
- `public/assets/images/ui/icons/icon_lock_gold.png` (94x121, 15,938 B) ← `Assets/_Game/Texture/UI/lock.png`
- `public/assets/images/ui/icons/icon_lock_silver.png` (98x120, 16,199 B) ← `Assets/_Game/Texture/UI/lock 1.png`
- `public/assets/images/ui/icons/icon_unlock.png` (88x113, 12,655 B) ← `Assets/_Game/Texture/UI/lock_on.png`
- `public/assets/images/ui/icons/icon_music.png` (80x88, 6,032 B) ← `Assets/_Game/Texture/UI/music.png`
- `public/assets/images/ui/icons/icon_vibrate.png` (88x84, 5,038 B) ← `Assets/_Game/Texture/UI/vibrate.png`
- `public/assets/images/ui/icons/icon_hint.png` (93x96, 4,811 B) ← `Assets/_Game/Texture/UI/hint.png`
- `public/assets/images/ui/icons/icon_exit.png` (124x120, 10,611 B) ← `Assets/_Game/Texture/UI/GamePlay/btn_out.png`
- `public/assets/images/ui/icons/icon_check_green.png` (136x112, 16,959 B) ← `Assets/_Game/Texture/UI/v.png`
- `public/assets/images/ui/icons/icon_check_white.png` (73x57, 3,222 B) ← `Assets/_Game/Texture/UI/V 1.png`
- `public/assets/images/ui/icons/icon_x_navy.png` (61x62, 2,893 B) ← `Assets/_Game/Texture/UI/X.png`
- `public/assets/images/ui/icons/icon_x_red.png` (60x64, 7,253 B) ← `Assets/_Game/Texture/UI/Revive/X.png`
- `public/assets/images/ui/icons/icon_basket.png` (256x256, 55,279 B) ← `Assets/_Game/Texture/UI/icon/basket.png`
- `public/assets/images/ui/icons/icon_magnet.png` (256x256, 44,676 B) ← `Assets/_Game/Texture/UI/icon/magnet.png`
- `public/assets/images/ui/icons/icon_ads.png` (116x136, 16,871 B) ← `Assets/_Game/Texture/UI/Main/more live/ads.png`
- `public/assets/images/ui/icons/badge_green.png` (88x88, 13,051 B) ← `Assets/_Game/Texture/UI/green.png`

**`public/assets/images/ui/hud/`** (10 file)

- `public/assets/images/ui/hud/booster_btn_bg.png` (188x188, 24,401 B) ← `Assets/_Game/Texture/UI/BGbooster.png`
- `public/assets/images/ui/hud/booster_select_bg.png` (104x187, 12,119 B) ← `Assets/_Game/Texture/UI/Slider.png#bg_select_booster.png` — *crop atlas rect (748,1857,104,187) [Unity y-up]*
- `public/assets/images/ui/hud/booster_select_frame.png` (116x120, 2,124 B) ← `Assets/_Game/Texture/UI/Slider.png#bg_bg_booster.png` — *crop atlas rect (249,14,116,120) [Unity y-up]*
- `public/assets/images/ui/hud/level_badge_circle.png` (236x232, 37,296 B) ← `Assets/_Game/Texture/UI/GamePlay/Mission/Ui level mission/Normal_bgcharater.png`
- `public/assets/images/ui/hud/mission_slot_bg.png` (112x156, 9,435 B) ← `Assets/_Game/Texture/UI/GamePlay/Mission/Ui level mission/Normal_bg_mission.png`
- `public/assets/images/ui/hud/coin_pill_cream.png` (60x72, 3,697 B) ← `Assets/_Game/Texture/UI/Slider.png#money_bg.png` — *crop atlas rect (677,1324,60,72) [Unity y-up]*
- `public/assets/images/ui/hud/tag_hard.png` (105x93, 11,246 B) ← `Assets/_Game/Texture/UI/GamePlay/mode hard crazy/Tag Hard.png`
- `public/assets/images/ui/hud/tag_crazy.png` (111x93, 11,874 B) ← `Assets/_Game/Texture/UI/GamePlay/mode hard crazy/Tag Crazy.png`
- `public/assets/images/ui/hud/warning_edge_h.png` (60x3, 1,495 B) ← `Assets/_Game/Texture/UI/warning/img_warning.png`
- `public/assets/images/ui/hud/warning_edge_v.png` (3x60, 220 B) ← `Assets/_Game/Texture/UI/warning/img_warning_v.png`

**`public/assets/images/ui/win/`** (8 file)

- `public/assets/images/ui/win/win_ribbon_red.png` (770x220, 71,855 B) ← `Assets/_Game/Animation/Level_complete/Level_complete.png` — *crop spine atlas region (2,2,770,220)*
- `public/assets/images/ui/win/win_light_rays.png` (926x548, 95,986 B) ← `Assets/_Game/Texture/UI/light.png`
- `public/assets/images/ui/win/win_star_full.png` (144x140, 18,867 B) ← `Assets/_Game/Texture/UI/Main/Rate/star (1).png`
- `public/assets/images/ui/win/win_star_empty.png` (156x148, 9,167 B) ← `Assets/_Game/Texture/UI/Main/Rate/star_2 (1).png`
- `public/assets/images/ui/win/win_progress_bg.png` (72x72, 5,865 B) ← `Assets/_Game/Texture/UI/Win/Bgfill.png`
- `public/assets/images/ui/win/win_progress_fill.png` (76x52, 4,093 B) ← `Assets/_Game/Texture/UI/Win/fillimg.png`
- `public/assets/images/ui/win/win_title_mission_complete.png` (492x228, 134,236 B) ← `Assets/_Game/Texture/Complete/text.png`
- `public/assets/images/ui/win/win_glow.png` (512x512, 38,265 B) ← `Assets/XGameVfx/Textures/t_glow_3.png`

**`public/assets/images/ui/lose/`** (3 file)

- `public/assets/images/ui/lose/lose_bear.png` (472x708, 440,211 B) ← `Assets/_Game/Texture/UI/Revive/gau.png`
- `public/assets/images/ui/lose/lose_talk_bubble.png` (192x336, 31,285 B) ← `Assets/_Game/Texture/UI/Revive/talk_nomal.png`
- `public/assets/images/ui/lose/lose_notice_pill.png` (104x68, 5,383 B) ← `Assets/_Game/Texture/UI/Revive/blue.png`

**`public/assets/images/ui/home/`** (11 file)

- `public/assets/images/ui/home/home_bg_gradient.png` (1080x1920, 12,832 B) ← `Assets/_Game/Texture/Home/main/bg2.png`
- `public/assets/images/ui/home/home_pattern.png` (384x392, 8,677 B) ← `Assets/_Game/Texture/Home/main/partern.png`
- `public/assets/images/ui/home/home_play_capsule.png` (204x312, 34,485 B) ← `Assets/_Game/Texture/Main/Play_Btn.png`
- `public/assets/images/ui/home/home_tab_home.png` (209x222, 66,790 B) ← `Assets/_Game/Texture/Main/Home.png`
- `public/assets/images/ui/home/home_tab_setting.png` (213x223, 75,442 B) ← `Assets/_Game/Texture/Main/Setting.png`
- `public/assets/images/ui/home/home_tab_shop.png` (217x210, 55,395 B) ← `Assets/_Game/Texture/Main/Shop.png`
- `public/assets/images/ui/home/home_tab_bar.png` (52x231, 2,742 B) ← `Assets/_Game/Texture/Main/Tab_Bar.png`
- `public/assets/images/ui/home/home_tab_bar_active.png` (40x231, 2,878 B) ← `Assets/_Game/Texture/Main/Tab_Bar_Choose.png`
- `public/assets/images/ui/home/home_tab_line.png` (1080x20, 661 B) ← `Assets/_Game/Texture/Main/Tab_BarLine.png`
- `public/assets/images/ui/home/home_node_shadow.png` (271x147, 15,007 B) ← `Assets/_Game/Texture/Main/xo_shadow.png`
- `public/assets/images/ui/home/home_node_glow.png` (328x328, 27,876 B) ← `Assets/_Game/Texture/Home/main/effect.png`

**`public/assets/images/ui/loading/`** (8 file)

- `public/assets/images/ui/loading/loading_splash_bg.jpg` (1080x1920, 295,498 B) ← `Assets/IconSplash/Android/splash_native.jpg`
- `public/assets/images/ui/loading/loading_logo.png` (1135x1081, 729,019 B) ← `Assets/IconSplash/Android/splash_logo.png`
- `public/assets/images/ui/loading/loading_bg_blue.png` (2000x2000, 139,410 B) ← `Assets/GamePlugin/Misc/LevelConfig/Resources/Loading/Sprites/BG_Blue.png`
- `public/assets/images/ui/loading/loading_bar_bg.png` (116x88, 11,986 B) ← `Assets/IconSplash/iOS/bgProgressGray.png`
- `public/assets/images/ui/loading/loading_bar_fill.png` (84x48, 3,451 B) ← `Assets/IconSplash/iOS/Progress 2.png`
- `public/assets/images/ui/loading/loading_bar_knob.png` (67x67, 10,408 B) ← `Assets/IconSplash/iOS/Layer 641.png`
- `public/assets/images/ui/loading/loading_spinner.png` (104x104, 5,304 B) ← `Assets/_Game/Texture/UI/Loading.png`
- `public/assets/images/ui/loading/loading_star.png` (56x64, 3,929 B) ← `Assets/GamePlugin/Misc/LevelConfig/Resources/Loading/Sprites/Star.png`

**`public/assets/images/ui/tutorial/`** (8 file)

- `public/assets/images/ui/tutorial/tut_hand_tap.png` (188x228, 15,807 B) ← `Assets/Sand/Spines/Export/hand_zoom.png` — *crop spine atlas region (250,23,228,188) + rotate 90 CW*
- `public/assets/images/ui/tutorial/tut_hand_pointer.png` (164x144, 14,267 B) ← `Assets/GamePlugin/Sptires/Hand/icon_hand.png`
- `public/assets/images/ui/tutorial/tut_bubble.png` (780x208, 102,569 B) ← `Assets/_Game/Texture/UI/InGame/BGPopTut.png`
- `public/assets/images/ui/tutorial/tut_arrow.png` (212x304, 47,429 B) ← `Assets/_Game/Texture/UI/arrow 1.png`
- `public/assets/images/ui/tutorial/tut_spotlight.png` (1024x1024, 50,567 B) ← `Assets/_Game/Texture/UI/InGame/Fade (4).png`
- `public/assets/images/ui/tutorial/tooltip_body.png` (80x128, 10,095 B) ← `Assets/_Game/Texture/UI/tool_tip_giua.png`
- `public/assets/images/ui/tutorial/tooltip_arrow_up.png` (61x59, 6,958 B) ← `Assets/_Game/Texture/UI/tool_tip_tren.png`
- `public/assets/images/ui/tutorial/tooltip_arrow_down.png` (71x70, 5,468 B) ← `Assets/_Game/Texture/UI/tool_tip_duoi.png`

**`public/assets/images/app/`** (7 file)

- `public/assets/images/app/icon_48.png` (48x48, 4,992 B) ← `Assets/IconSplash/Android/mipmap-mdpi/ic_launcher.png`
- `public/assets/images/app/icon_96.png` (96x96, 16,803 B) ← `Assets/IconSplash/Android/mipmap-xhdpi/ic_launcher.png`
- `public/assets/images/app/icon_144.png` (144x144, 34,631 B) ← `Assets/IconSplash/Android/mipmap-xxhdpi/ic_launcher.png`
- `public/assets/images/app/icon_192.png` (192x192, 58,761 B) ← `Assets/IconSplash/Android/mipmap-xxxhdpi/ic_launcher.png`
- `public/assets/images/app/icon_192_round.png` (192x192, 67,407 B) ← `Assets/IconSplash/Android/mipmap-xxxhdpi/ic_launcher_round.png`
- `public/assets/images/app/icon_432_foreground.png` (432x432, 188,740 B) ← `Assets/IconSplash/Android/mipmap-xxxhdpi/ic_launcher_foreground.png`
- `public/assets/images/app/icon_512.jpg` (512x512, 269,946 B) ← `Assets/IconSplash/iOS/Icon.jpg`

## Ghi chú cho agent UI

1. **Đơn vị**: thiết kế theo canvas 1080 rộng. `--u: min(100vw / 1080, 100dvh / 1920)`; mọi số trong doc 08 mục 4 là unit → `calc(N * var(--u))`. Sprite PPU 100 ⇒ kích thước gốc của ảnh = kích thước "native" trong Unity.
2. **9-slice**: `slice` trong JSON đã theo thứ tự CSS `T R B L` → `border-image-slice: T R B L fill; border-image-width: (T R B L) * var(--u)`. Với `btn_wide_*` dùng `sliceCss` (border Unity bị lệch). `popup_frame_blue` có border trái/phải 460u → khung popup nên rộng ≥ 924u (Unity dùng 924–960u).
3. **Key quan trọng**:
   - Popup: `popup_frame_blue` (khung + header), `popup_panel_cream` (panel nội dung), `popup_inner_border`, `btn_close`, theme `popup_header_blue|purple|red` + `popup_body_blue`.
   - Nút: `btn_wide_green|orange|red|blue|purple|gray`, `btn_pill_*` (3-slice ngang), nút tròn `btn_blue`/`btn_green`/`btn_red` + vòng `btn_round_ring`, `btn_plus_green`, `btn_plus_square_green`.
   - Toggle: ON = `btn_green`/`btn_round_green` + icon (`icon_music`, `icon_sound`, `icon_vibrate`); OFF = phủ `toggle_off_slash`. Chấm trang: `dot_on`/`dot_off`.
   - HUD: `normal_btn_setting` + `btn_setting_shadow` + `btn_setting_gear` (gear), `btn_pill_blue` (pill Level), `bg_progress` (pill navy coin / 3/5), `icon_gold`, `booster_btn_bg` + `bg_badge_count`, `level_badge_circle`, `mission_slot_bg`, `normal_bgtopbar`.
   - Win: `win_ribbon_red`, `win_light_rays`, `win_glow`, `win_star_full/empty`, `win_progress_bg/fill`. Lose: `icon_heart_broken`, `lose_bear`, `lose_talk_bubble`. Tutorial: `tut_hand_tap`, `tut_hand_pointer`, `tut_bubble`, `tut_arrow`, `tut_spotlight`, `tooltip_*`.
   - Loading: `loading_bar_bg` + `loading_bar_fill` (9-slice), `loading_spinner`, `loading_bg_blue`, `loading_splash_bg.jpg`, `loading_logo`.
   - PWA: `app/icon_192.png`, `app/icon_512.jpg` (type `image/jpeg`), `app/icon_48.png` cho favicon.
4. **Chữ**: toàn bộ UI Unity dùng `royal_kingdom_font.otf` (đã có ở `public/assets/fonts/`), số node level dùng `mario-bold.otf`. Kiểu chuẩn: trắng → `#f8eabb` gradient dọc + viền đậm theo màu nền (xanh `#002a92`, nút xanh lá `#076100`, cam `#7a3f00`, đỏ `#6d0000`, badge `#820901`) + shadow lệch xuống 3–5u. Chữ trên nền kem: `#203f8d`/`#244898`; trên pill kem: `#874000`.
5. **Animation**: nhấn nút scale .95 / 100ms OutQuad; popup mở 0.8→1.02→0.98→1 trong 167ms (PopupBase) hoặc 0→1.05→1 trong 500ms (Revive); win: các phần tử pop 0→1.15→1 lần lượt; gear in-game quay 1080° và các nút trượt từ trái vào có overshoot. Chi tiết ở doc 08 mục 4.10.
6. Badge số lượng booster trong Unity nằm **dưới-phải** nút; mockup `_Docs/image.png` đặt **trên-phải** → theo mockup.
7. Theme độ khó (Normal/Hard/Super Hard) có sẵn bộ header/body/button tương ứng (xem doc 08 mục 4.3) nếu muốn đổi màu popup theo level.

## Vấn đề còn tồn đọng

- **Thương hiệu**: `loading_logo.png`, `loading_splash_bg.jpg` ghi "Color Flow – Art Puzzle"; icon app là lâu đài cát (Android) còn `icon_512.jpg` (iOS) là hình bướm khác hẳn. Cần quyết định có dùng cho "Sand Conveyor" không. Không có icon 512 PNG/maskable thật (`icon_432_foreground.png` là layer foreground có nền trong suốt).
- `unity_game_bg.jpg` (file cũ) không khớp hash với file nào trong Unity → nguồn chưa rõ (có thể là ảnh render/convert).
- Sprite pill "Level N" của UIInGame (guid `aea51e0559193fd4caea2fb021c186c7`) không tồn tại trong project Unity → thay bằng `btn_pill_blue`/`btn_wide_blue`/CSS. Không có nút "+" vuông vàng, toggle dạng trượt, chữ "LEVEL COMPLETE" tĩnh (là Spine), confetti → CSS.
- Không copy (quá 1.5 MB): nền Home `_Game/Texture/Main/BG.png` (5 MB, 2208x2269), nền splash Spine `_Game/SpineAssets/splash/BG.png` (7 MB), atlas `Slider.png` (1.3 MB, chỉ cắt phần cần).
- 16 file crop không byte-identical với nguồn (là vùng con trong atlas): `popup_body_blue`, `popup_panel_cream_inset`, `popup_inner_border`, `popup_keep_playing_bg`, `popup_reward_pill`, `btn_pill_*` (6), `booster_select_bg`, `booster_select_frame`, `coin_pill_cream`, `win_ribbon_red`, `tut_hand_tap` (xem trường `method` trong JSON).
- File cũ trùng nhau: `btn_circle_blue.png` = `normal_btn_setting.png` (cùng nguồn). Một số file cũ là sprite gameplay nằm trong `ui/` (`nut_*`, `sand_*`, `texture_*`, `hole_socket`) — giữ nguyên vì không thuộc quyền sửa/xóa.
- Border Unity của nút rộng bị lệch (artist kéo handle sai) → đã thêm `sliceCss`; nếu nút trông méo hãy chỉnh lại slice thủ công.
