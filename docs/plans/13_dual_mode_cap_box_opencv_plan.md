# 13. 자동바이알계산기 — [캡 뚜껑 모드] & [박스 모드] OpenCV 일괄 검출 · 사진별 모드 전환 · 사각형 오버레이 · 기본값 자동저장 구현 계획서

## 1. 목적
기존에 구현한 "촬영" 화면의 모양과 기능(드래그 앤 드롭, 가로 1200 리사이징, 자동 순차 분석, 마커 썸네일 갤러리, 확대 클릭 보정, 박스 수량 스테퍼, 인앱 모달, 기록 저장 및 UX 문구 원칙 기반 실패 안내)을 온전히 유지하면서 다음 5가지 요구사항을 추가합니다:
1. **기본 설정 ('박스 1개당 바이알 개수')**: 화면 상단(및 박스 업로드 카드 연동)에 미리 입력해 둘 수 있는 숫자 입력칸을 배치하고, 기본값 `50`으로 설정하며 `localStorage`(`'jt-vials-per-box'`)에 자동 저장·복원합니다.
2. **사진별 `[캡 뚜껑 모드]` / `[박스 모드]` 전환 토글 (모드당 최대 5장)**: 각 사진 카드(갤러리 카드 및 업로드 목록)마다 두 모드를 즉시 전환할 수 있는 토글 스위처(`.jt-switcher`)를 제공합니다.
3. **모드별 OpenCV 검출 로직**:
   - **캡 뚜껑 모드**: OpenCV.js(`cvtColor` → `GaussianBlur` → `HoughCircles` 및 보조 `findContours`, 오프라인 시 내장 Canvas 원형 검출 폴백)로 둥근 뚜껑 개수를 세어 바이알 수를 계산합니다.
   - **박스 모드**: OpenCV.js(`Canny`+`dilate` 및 `adaptiveThreshold` → `findContours` → `boundingRect`/`approxPolyDP` 사각형 필터링 + 포함도 NMS, 오프라인 시 내장 Canvas 4변 사각형 검증 폴백)로 박스 개수를 세고, `검출된 박스 수 × 박스당 바이알 개수`로 바이알 수를 자동 계산합니다(`박스 4개 × 50 = 200개` 형태).
4. **시각화 및 오차 보정**:
   - 각 사진 썸네일과 확대 뷰어 위에 모드에 맞는 **동그라미(캡 뚜껑)** 또는 **사각형 테두리(박스)** 를 Canvas 오버레이로 표시합니다.
   - 선택된 사진의 모드에 맞춰 `민감도(Threshold)`와 `최소/최대 크기` 슬라이더가 자동 전환되며 조절 시 즉시 재계산됩니다.
5. **최상단 총합계 실시간 표시**: 화면 최상단에 두 모드(각 최대 5장) 전체의 총 바이알 합계를 크게 표시하고, 추가·삭제·모드 변경·슬라이더 보정·박스당 수량 수정 시 즉시 업데이트됩니다.

---

## 2. 수정 및 생성 파일
- **계획서 저장**: `docs/plans/13_dual_mode_cap_box_opencv_plan.md`
- **컴포넌트 업그레이드**: `components/VialCountInspector.jsx`
  - `DEFAULT_BOX_PARAMS`, `prepareAnalysisImageData`, `detectBoxesInImageData`, `analyzeBoxImageFile` 추가 및 `estimateBoxCountFromImageFile` 연결
  - `MarkedThumbnail`에서 `cap` 모드(동그라미) / `box` 모드(사각형 테두리) 분기 렌더링
  - `VialPhotoGallery` 각 카드에 `[캡 뚜껑 모드]` / `[박스 모드]` 전환 토글 및 `박스 N개 × M = K개` 표시 추가
  - `VialCountInspector`에서 선택 사진 모드에 따라 원형/사각형 오버레이 클릭 보정 및 모드 맞춤 슬라이더 제공
- **페이지 업그레이드**: `pages/index.jsx`
  - 화면 최상단에 전체 총 바이알 합계 카드 + `박스 1개당 바이알 개수`(기본 `50`, `localStorage` 자동 저장 및 저장 실패 안내) 배치
  - 사진별 모드 전환(`handleSwitchPhotoMode`: 5장 초과 시 인앱 모달 안내, 여유 시 캐싱된 1200 버퍼로 즉시 재검출) 및 즉시 합산 연결

---

## 3. 사용하는 `.jt-*` 컴포넌트 목록
- 레이아웃·카드·그리드: `.jt-card`, `.jt-grid-cards`, `.jt-row`, `.jt-stack-2`, `.jt-stack-3`, `.jt-stack-4`, `.jt-divider`, `.jt-sr-only`
- 목록·버튼·스위치·스위처: `.jt-list`, `.jt-list-item`, `.jt-card-row-main`, `.jt-card-row-title`, `.jt-card-row-meta`, `.jt-avatar`, `.jt-r-sm`, `.jt-btn`, `.jt-btn-ghost`, `.jt-btn-danger`, `.jt-btn-sm`, `.jt-btn-lg`, `.jt-icon-btn`, `.jt-switch`, `.jt-switch-track`, `.jt-switcher`, `.jt-switcher-item`
- 슬라이더·스테퍼·입력: `.jt-slider`, `.jt-stepper`, `.jt-stepper-btn`, `.jt-stepper-input`, `.jt-input`, `.jt-label`, `.jt-help`
- 이미지·상태·알림·모달: `.jt-product-img`, `.jt-empty`, `.jt-empty-title`, `.jt-empty-desc`, `.jt-loader`, `.jt-loader-lg`, `.jt-note`, `.jt-note-warning`, `.jt-note-error`, `.jt-overlay`, `.jt-modal`, `.jt-modal-sm`, `.jt-modal-title`, `.jt-modal-actions`, `.jt-toast-area`, `.jt-toast`
- 표·배지·수치·아이콘: `.jt-table-wrap`, `.jt-table`, `.jt-num`, `.jt-tag`, `.jt-badge`, `.jt-badge-pass`, `.jt-badge-info`, `.jt-stat`, `.jt-stat-label`, `.jt-stat-value`, `.jt-stat-unit`, `.jt-display-sm`, `.jt-ico`, `.jt-ico-sm`, `.jt-ico-lg`
