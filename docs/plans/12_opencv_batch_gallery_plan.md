# 12. 자동바이알계산기 — OpenCV.js 다중 사진(최대 5장) 드래그앤드롭 · 자동 순차 분석 · 마커 갤러리 뷰 구현 계획서

## 1. 목적
기존에 구현한 "촬영" 화면의 모양과 기능(수동 클릭 마커 추가/제거, 카트 박스 스테퍼, 인앱 모달, 기록 저장 및 UX 문구 원칙 기반 실패 안내)을 그대로 유지하면서 다음 6가지 기능을 추가로 탑재합니다:
1. **다중 이미지 업로드 (드래그 앤 드롭 포함, 모드별 최대 5장)**: 파일 선택창과 마우스 드래그 앤 드롭으로 모드마다 최대 5장까지 한 번에 등록하며, 초과 시 인앱 모달로 안내하고 5장까지만 받아들입니다.
2. **OpenCV.js 기반 자동 순차 분석 (+ 내장 Canvas 비전 엔진 자동 폴백)**: 사진이 업로드되는 즉시 `opencv.js`(`cv.cvtColor` → `cv.GaussianBlur` → `cv.HoughCircles` 및 보조 `cv.findContours`)로 1장씩 순차 자동 카운트합니다. 사내망 등으로 CDN 로드에 실패하더라도 내장 순수 Canvas 엔진이 자동 동작합니다.
3. **결과 표시 및 마커 썸네일 갤러리 뷰**: 상단에 전체 합계 개수(`총 N개`)를 크게 표시하고, 아래에 각 사진의 동그라미 마커가 그려진 썸네일 카드와 사진별 개별 개수를 갤러리 형태로 나열합니다.
4. **민감도 및 바이알 크기 조절**: `전체 사진 공통` 또는 `현재 사진만` 선택 스위처와 함께 민감도(Threshold)·최소/최대 반지름 슬라이더로 즉시 오차를 보정할 수 있습니다.
5. **개별 삭제/추가 즉시 합산**: 5장 이내에서 특정 사진만 지우거나 새 사진을 추가하면 전체 합계가 즉시 다시 계산됩니다.
6. **가로 1200 해상도 리사이징**: 분석 전 이미지를 가로 1200 비율로 리사이징한 뒤 카운트합니다.

---

## 2. 수정 및 생성 파일
- **계획서 저장**: `docs/plans/12_opencv_batch_gallery_plan.md`
- **컴포넌트 업그레이드**: `components/VialCountInspector.jsx`
  - `ensureOpenCvReady()`, `isOpenCvReady()` OpenCV.js 비동기 싱글톤 로더 추가
  - `TARGET_ANALYSIS_WIDTH = 1200` 리사이징 및 `detectVialsWithOpenCV` + 내장 폴백 `detectVialsInImageData` 통합
  - `VialPhotoGallery` (동그라미 마커 오버레이가 그려진 썸네일 카드 갤러리 뷰) 추가
  - `VialCountInspector` 슬라이더 1200 해상도 대응 및 적용 범위 스위처(`전체 사진 공통` / `현재 사진만`) 지원
- **페이지 업그레이드**: `pages/index.jsx`
  - OpenCV.js 백그라운드 예열, 모드별 드래그 앤 드롭(`dragOverMode`), 업로드 시 자동 순차 분석(`runSequentialAnalysis`), 디바운스 슬라이더 재검출, 개별 추가/삭제 즉시 합계 반영, 상단 총 합계 + 마커 썸네일 갤러리 + 상세 보정 뷰어 연결

---

## 3. 사용하는 `.jt-*` 컴포넌트 목록
- 레이아웃·카드·그리드: `.jt-card`, `.jt-grid-cards`, `.jt-row`, `.jt-stack-2`, `.jt-stack-3`, `.jt-stack-4`, `.jt-divider`, `.jt-sr-only`
- 목록·버튼·스위치·스위처: `.jt-list`, `.jt-list-item`, `.jt-card-row-main`, `.jt-card-row-title`, `.jt-card-row-meta`, `.jt-avatar`, `.jt-r-sm`, `.jt-btn`, `.jt-btn-ghost`, `.jt-btn-danger`, `.jt-btn-sm`, `.jt-btn-lg`, `.jt-icon-btn`, `.jt-switch`, `.jt-switch-track`, `.jt-switcher`, `.jt-switcher-item`
- 슬라이더·스테퍼·입력: `.jt-slider`, `.jt-stepper`, `.jt-stepper-btn`, `.jt-stepper-input`, `.jt-input`, `.jt-label`, `.jt-help`
- 이미지·상태·알림·모달: `.jt-product-img`, `.jt-empty`, `.jt-empty-title`, `.jt-empty-desc`, `.jt-loader`, `.jt-loader-lg`, `.jt-note`, `.jt-note-info`, `.jt-note-warning`, `.jt-note-error`, `.jt-overlay`, `.jt-modal`, `.jt-modal-sm`, `.jt-modal-title`, `.jt-modal-actions`, `.jt-toast-area`, `.jt-toast`
- 표·배지·수치·아이콘: `.jt-table-wrap`, `.jt-table`, `.jt-num`, `.jt-tag`, `.jt-badge`, `.jt-badge-pass`, `.jt-badge-info`, `.jt-stat`, `.jt-stat-label`, `.jt-stat-value`, `.jt-stat-unit`, `.jt-display-sm`, `.jt-ico`, `.jt-ico-sm`, `.jt-ico-lg`
