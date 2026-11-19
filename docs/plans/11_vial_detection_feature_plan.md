# 11. 자동바이알계산기 — "촬영" 화면 브라우저 직접 바이알 원형 검출 기능 구현 계획서

## 1. 목표 및 핵심 원칙
API 키나 외부 서버 없이 사용자의 브라우저 안에서 순수 HTML5 Canvas 픽셀 분석 로직으로 사진 속 둥근 바이알(뚜껑/바닥) 개수를 자동 검출하고, 사용자가 직접 오차를 보정하고 시각적으로 검수·저장할 수 있는 기능을 구현합니다.

### 수정 및 생성 파일 범위 (최소 파일 수정 원칙)
- **새로 만드는 파일**:
  1. `docs/plans/11_vial_detection_feature_plan.md` (본 구현 계획서 영구 보존)
  2. `components/VialCountInspector.jsx` (순수 Canvas 컴퓨터 비전 원형 검출 파이프라인 + Canvas 오버레이 마커 + 민감도·반지름 슬라이더 보정 UI)
- **수정하는 파일**:
  1. `pages/index.jsx` (기존 좌우 2열 화면 모양을 유지하면서 실제 이미지 업로드·자동 검출·슬라이더 연동·인앱 확인 모달·기록 저장 및 실패 안내 문구 연결)
- **건드리지 않는 파일**: `AGENTS.md`, `styles/globals.css`, `components/AppBrand.jsx`, `components/AppLayout.jsx`, `pages/_app.jsx`, `pages/_document.jsx`, `pages/records.jsx`, `pages/settings.jsx`

---

## 2. 순수 Canvas 바이알 원형 검출 파이프라인 설계

### 2-1. 이미지 정규화 및 픽셀 버퍼 캐싱
- 업로드된 이미지 파일을 오프스크린 `<canvas>`에 긴 변 최대 `640` 비율(`scale = Math.min(1, 640 / Math.max(w, h))`)로 그린 뒤 `ImageData`를 추출해 캐싱합니다.
- 슬라이더를 움직일 때마다 이미지를 다시 디코딩하지 않고 캐싱된 픽셀 버퍼에서 즉시 재계산하므로, 모바일에서도 부드럽게 동작합니다.
- 이미지 디코딩 실패(`naturalWidth === 0` 등) 시 `IMAGE_DECODE_ERROR`를 발생시켜 사용자에게 구체적인 실패 원인을 안내합니다.

### 2-2. 5단계 전처리 및 원형 검출 (`detectVialsInImageData`)
1. **그레이스케일 변환 (Grayscale)**:
   - RGB 색상을 휘도($Y = 0.299R + 0.587G + 0.114B$) 기반의 1차원 `Float32Array`로 변환합니다.
2. **5×5 분리형 가우시안 블러 (Gaussian Blur)**:
   - 커널 `[1, 4, 6, 4, 1] / 16`을 가로·세로 방향으로 순차 적용하여 바이알 뚜껑 표면의 글자나 조명 반사광 노이즈를 부드럽게 제거합니다.
3. **3×3 Sobel 그라디언트 및 비최대 억제 (Edge Extraction)**:
   - 가로/세로 기울기($G_x, G_y$), 경계 강도($M = \sqrt{G_x^2 + G_y^2}$), 정규화 방향($u_x, u_y$)을 계산합니다.
   - 사진 전체 평균 기울기(`meanMag`)와 사용자의 **민감도(Threshold)** 슬라이더 값에 따라 자동으로 적응형 임계값(`edgeThreshold`)을 계산하여, 경계 방향 국소 최대점만 추출합니다.
4. **그라디언트 유도 허프 원 변환 (Gradient-Directed HoughCircles)**:
   - **최소/최대 반지름** 범위 내의 각 반지름 후보에 대해 경계점이 가리키는 양방향 원 중심 후보에 2픽셀 격자(`BIN = 2`) 투표를 수행합니다.
   - 누적 격자 평활화 및 5×5 국소 최대 피크 추출 후, 24방향 삼각함수 테이블을 이용해 원 둘레 일치율(`coverage`)과 극성·사분면 일관성(최소 3개 사분면 이상)을 검증합니다.
5. **동심원·틈새 가짜 원 억제 (Circle NMS) 및 일련번호 정렬**:
   - 검출 점수가 높은 원부터 채택하되, 중심 거리가 `(r1 + r2) * 0.80` 미만인 동심원(뚜껑 바깥 테두리와 안쪽 링 중복 검출)이나 밀집 원 사이의 빈 틈새 가짜 원을 제거합니다.
   - 채택된 원들은 행(위→아래)과 열(왼쪽→오른쪽) 순서로 정렬하여 `1, 2, 3...` 번호를 부여합니다.

### 2-3. 카트 박스 측면 윤곽선 추정 (`estimateBoxCountFromImageFile`)
- 그레이스케일 → 가우시안 블러 → 적응형 경계 이진화 및 연결 윤곽선 탐색을 통해 박스 후보 개수를 추정하고, 결과 표에서 스테퍼(`.jt-stepper`)로 수량을 즉시 보정할 수 있게 합니다.

---

## 3. 오차 보정 UI, Canvas 오버레이, 인앱 모달 및 저장 실패 문구 설계

1. **Canvas 오버레이 및 수동 터치 보정 (`<VialCountInspector />`)**:
   - 원본 사진(`<img>`) 위에 투명 `<canvas>`를 정확히 겹쳐(`position: 'absolute'`, `inset: 0`, `zIndex: 'var(--z-raised)'`) 검출된 원형 테두리와 일련번호를 그립니다.
   - 사용자가 동그라미 위를 누르면 오검출 마커가 제거되고, 놓친 바이알 위를 누르면 마커가 추가되어 즉시 수량에 반영됩니다.
   - 오차 보정 슬라이더(`.jt-slider`): **민감도(Threshold)**, **최소 바이알 크기(반지름)**, **최대 바이알 크기(반지름)** 3종 제공.
2. **인앱 확인/안내 모달 (`.jt-overlay` > `.jt-modal.jt-modal-sm`)**:
   - 브라우저 기본 팝업(`alert`, `confirm`)을 완전히 제거하고 앱 내부 모달과 포커스 이동·`Escape` 키 닫기를 지원합니다.
3. **검수 기록 저장 및 UX 문구 원칙 적용 (`https://ds.janytree.app/develop/ux-writing`)**:
   - 사과 표현을 쓰지 않고 **무엇이 잘못되었는지**와 **어떻게 해결하는지**를 구체적으로 안내합니다.
   - 저장소 용량 초과(`QuotaExceededError`), 저장 권한 차단(`SecurityError`), 박스당 수량 입력 오류(`InvalidBoxQuantity`), 데이터 형식 오류를 구분해 `.jt-note.jt-note-error`와 안내 모달로 알려줍니다.

---

## 4. 사용하는 `.jt-*` 컴포넌트 목록
- 레이아웃·카드: `.jt-card`, `.jt-grid-cards`, `.jt-row`, `.jt-stack-2`, `.jt-stack-3`, `.jt-stack-4`, `.jt-stack-6`, `.jt-divider`, `.jt-sr-only`
- 버튼·스위치·스위처: `.jt-btn`, `.jt-btn-ghost`, `.jt-btn-danger`, `.jt-btn-sm`, `.jt-btn-lg`, `.jt-icon-btn`, `.jt-switcher`, `.jt-switcher-item`, `.jt-switch`, `.jt-switch-track`, `.jt-stepper`, `.jt-stepper-btn`, `.jt-stepper-input`
- 입력·슬라이더: `.jt-input`, `.jt-label`, `.jt-slider`, `.jt-help`
- 이미지·업로드·상태·알림: `.jt-product-img`, `.jt-empty`, `.jt-empty-title`, `.jt-empty-desc`, `.jt-loader`, `.jt-loader-lg`, `.jt-note`, `.jt-note-warning`, `.jt-note-error`, `.jt-toast-area`, `.jt-toast`
- 모달·표·배지·통계: `.jt-overlay`, `.jt-modal`, `.jt-modal-sm`, `.jt-modal-title`, `.jt-modal-actions`, `.jt-table-wrap`, `.jt-table`, `.jt-num`, `.jt-tag`, `.jt-badge`, `.jt-badge-pass`, `.jt-badge-warning`, `.jt-badge-fail`, `.jt-stat`, `.jt-stat-label`, `.jt-stat-value`, `.jt-stat-unit`
- 아이콘: `.jt-ico`, `.jt-ico-sm`, `.jt-ico-lg`
