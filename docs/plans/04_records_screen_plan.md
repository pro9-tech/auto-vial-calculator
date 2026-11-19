# 04. 자동바이알계산기 — "기록" 화면(`pages/records.jsx`) 구현 계획서

## 1. 목적
- 체이스의 요청에 따라 이전에 분석한 바이알 사진과 개수 기록을 최근 순으로 다시 열람할 수 있는 **"기록" 화면**을 구현합니다.
- "최근 검수 기록" 영역을 화면 전체 크기로 시원하게 꽉 차도록 구성합니다.
- 디자인 시스템 규칙(JT 디자인 시스템 v5.0)을 철저히 준수하여 토큰과 `.jt-*` 컴포넌트만을 사용합니다.

## 2. 화면 구성 요소 (보이는 화면 전용)
1. **화면 상태 스위처 (`.jt-switcher`)**
   - 개발 및 디자인 검토 시 체이스께서 즉시 확인할 수 있도록 `정상(5건)` · `로딩중` · `빈상태(0건)`를 전환할 수 있는 임시 스위치를 제공합니다. (정식 데이터 연결 시 자동 전환됨)
2. **"최근 검수 기록" 전체 크기 메인 카드 (`.jt-card`)**
   - 모바일과 PC에서 화면을 채우는 넉넉한 전체 높이(`minHeight: 'calc(100vh - var(--topbar-height) - var(--space-12))'`)를 적용합니다.
   - 상단 헤더: 제목, 전체 건수 배지, 검색/필터 입력창(`.jt-input`), 요약 수치 통계(`.jt-stat`).
3. **가짜 데이터 5줄 표 (`.jt-table-wrap` > `.jt-table`)**
   - 최근 검수 순서로 정렬된 5개의 기록: 검수일시, LOT 번호, 담당 부서(`.jt-tag`), 파악 개수(`.jt-num`), 판정 배지(`.jt-badge-pass/fail/hold`), 상세 열람 버튼(`.jt-btn.jt-btn-sm`).
   - 표의 숫자열은 반드시 우측 정렬 + `class="jt-num"` 적용.
   - 판정 상태는 색상뿐만 아니라 `적합`, `부적합`, `보류` 글자를 반드시 병기.
4. **빈 상태 (`.jt-empty`)**
   - 검수 기록이 하나도 없을 때 친절한 안내 문구와 함께 [사진 촬영하러 가기] 바로가기 버튼 제공.
5. **로딩 상태 (`.jt-skeleton`)**
   - 서버에서 기록을 불러오는 동안 표시되는 5줄 스켈레톤 UI.

## 3. 사용하는 `.jt-*` 컴포넌트 목록
- 레이아웃·카드: `.jt-card`, `.jt-row`, `.jt-stack-2`, `.jt-stack-3`, `.jt-stack-4`, `.jt-divider`
- 버튼·스위처: `.jt-btn`, `.jt-btn-sm`, `.jt-switcher`, `.jt-switcher-item`, `.jt-icon-btn`
- 입력·검색: `.jt-input`
- 표·분류·배지: `.jt-table-wrap`, `.jt-table`, `.jt-num`, `.jt-tag`, `.jt-badge`, `.jt-badge-pass`, `.jt-badge-fail`, `.jt-badge-hold`
- 상태·수치·빈상태: `.jt-empty`, `.jt-empty-title`, `.jt-empty-desc`, `.jt-skeleton`, `.jt-stat`, `.jt-stat-label`, `.jt-stat-value`, `.jt-stat-unit`
- 텍스트·아이콘: `.jt-help`, `.jt-ico`, `.jt-ico-sm`, `.jt-ico-lg`
