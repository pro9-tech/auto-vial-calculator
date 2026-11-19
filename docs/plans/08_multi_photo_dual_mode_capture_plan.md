# 08. 자동바이알계산기 — "촬영" 화면 다중 사진(최대 10장) 및 듀얼 검수 모드 구현 계획서

## 1. 목적
- 체이스의 요청에 따라 "촬영" 화면(`pages/index.jsx`)을 대폭 업그레이드합니다.
- **최대 10장까지의 사진 다중 등록 및 개수 합산 기능**을 대비한 다중 썸네일/업로드 UI를 구축합니다.
- **2가지 검수 모드(동시 지원 및 모드 전환/연계)**를 지원합니다:
  1. `바이알 캡 모드`: 트레이 상공(위)에서 촬영한 바이알 캡 개수 카운팅
  2. `박스 적재 모드`: 대차/카트 측면(옆)에서 촬영한 적재 박스 개수 카운팅
- 디자인 시스템 규칙(JT 디자인 시스템 v5.0)을 철저히 준수하여 토큰과 `.jt-*` 컴포넌트만을 사용합니다.

## 2. 화면 구성 요소
1. **검수 대상 모드 선택 탭/스위처 (`.jt-switcher` 또는 탭)**:
   - `바이알 캡 (상단 촬영)` 모드
   - `카트 박스 (측면 촬영)` 모드
   - 두 모드를 동시 또는 전환하며 검수할 수 있도록 상단에 명확한 모드 표시 및 안내 제공.
2. **다중 사진 등록 (최대 10장) UI (`.jt-upload-list`, 그리드 썸네일)**:
   - 등록된 사진 장수 실시간 표시 (예: `3 / 10장 등록됨`).
   - 추가 등록 버튼: 10장 미만일 때 언제든 [사진 추가] 가능 (`multiple` 지원).
   - 등록된 사진별 썸네일 그리드와 개별 삭제 버튼(`.jt-icon-btn`).
   - 가짜 데이터로 5장의 사진 샘플과 장당 분석 개수 표시.
3. **통합 합산 결과 카드 (`.jt-stat`, `.jt-badge`)**:
   - 총 합산 개수 (예: 바이알 캡 총 500개 또는 카트 박스 총 60박스).
   - 장당 개수 내역 가짜 데이터 5줄 표 (`.jt-table-wrap` > `.jt-table`).
4. **빈 상태 (`.jt-empty`) & 로딩 상태 (`.jt-loader`)**:
   - 등록된 사진이 0장일 때의 대형 안내 영역.
   - 다중 사진을 일괄 AI 분석할 때의 대형 로딩 인디케이터.

## 3. 사용하는 `.jt-*` 컴포넌트 목록
- 레이아웃·카드: `.jt-card`, `.jt-row`, `.jt-stack-2`, `.jt-stack-3`, `.jt-stack-4`, `.jt-sr-only`
- 버튼·스위처: `.jt-btn`, `.jt-btn-lg`, `.jt-btn-sm`, `.jt-icon-btn`, `.jt-switcher`, `.jt-switcher-item`
- 업로드·리스트: `.jt-upload`, `.jt-upload-hint`, `.jt-upload-list`, `.jt-upload-item`, `.jt-upload-name`, `.jt-upload-size`, `.jt-product-img`
- 표·배지·태그: `.jt-table-wrap`, `.jt-table`, `.jt-num`, `.jt-tag`, `.jt-badge`, `.jt-badge-pass`
- 상태·수치·결과: `.jt-stat`, `.jt-stat-label`, `.jt-stat-value`, `.jt-stat-unit`, `.jt-empty`, `.jt-empty-title`, `.jt-empty-desc`, `.jt-loader`, `.jt-loader-lg`
- 텍스트·아이콘: `.jt-help`, `.jt-ico`, `.jt-ico-sm`, `.jt-ico-lg`
