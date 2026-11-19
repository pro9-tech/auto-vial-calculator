# 02. 자동바이알계산기 — "촬영" 화면(`pages/index.jsx`) 구현 계획서

## 1. 화면 목표
생산팀과 포장팀이 현장에서 스마트폰 또는 PC로 바이알 사진을 찍거나 앨범에서 등록하고, `"이미지 검수"`를 눌러 파악된 바이알 개수를 확인하는 화면을 JT 디자인 시스템 v5.0 컴포넌트(`.jt-*`)와 토큰만으로 구성합니다.

## 2. 화면 핵심 구성 요소 (보이는 화면 전용)
1. **`"사진 촬영 / 앨범"` 버튼**
   - 먹색 솔리드 주버튼(`.jt-btn`)에 공식 카메라 아이콘(`.jt-ico` `photo_camera`)을 맨 앞에 배치합니다.
   - `AGENTS.md` 7절(UI 아이콘 자리에 특수문자·이모지 사용 금지)을 지키기 위해 유니코드 이모지 대신 Material Symbols Rounded 아이콘을 사용합니다.
2. **`[이미지칸]`**
   - **사진이 없을 때**: `.jt-upload` 영역 안에 `.jt-empty` 형태로 `"이미지 업로드"` 문구와 안내 문구를 보여줍니다.
   - **사진이 등록됐을 때**: `.jt-product-img` 미리보기(또는 샘플 등록 상태 안내)와 함께 `.jt-upload-list` > `.jt-upload-item`에 파일 정보 및 지우기 버튼(`.jt-icon-btn`)을 보여줍니다.
   - **로딩 상태일 때**: `.jt-loader.jt-loader-lg`와 분석 중 안내 문구를 표시합니다.
3. **`"이미지 검수"` 버튼**
   - 큰 주버튼(`.jt-btn.jt-btn-lg`)으로 배치합니다.
   - 등록된 사진이 없을 때는 비활성화(`disabled`)하고, 사진이 등록되면 활성화합니다.
   - 검수 중일 때는 `data-loading="true"`로 인라인 로딩을 표시합니다.
4. **빈 상태 · 로딩 상태 · 가짜 데이터 5줄**
   - 상단의 `.jt-switcher`(`초기` · `사진등록` · `로딩` · `빈상태`)를 통해 데이터 연결 전에도 모든 화면 상태를 즉시 확인할 수 있습니다.
   - 하단의 최근 검수 내역 영역에는 생산/포장팀 샘플 데이터 5줄(`.jt-table-wrap` > `.jt-table`), 로딩 시 `.jt-skeleton` 5줄, 내역이 없을 때 `.jt-empty` 화면을 제공합니다.

## 3. 사용하는 `.jt-*` 컴포넌트 목록
- 레이아웃·카드: `.jt-card`, `.jt-row`, `.jt-stack-2`, `.jt-stack-3`, `.jt-stack-4`, `.jt-divider`, `.jt-sr-only`
- 버튼·스위처: `.jt-btn`, `.jt-btn-lg`, `.jt-icon-btn`, `.jt-switcher`, `.jt-switcher-item`
- 업로드·이미지: `.jt-upload`, `.jt-upload-hint`, `.jt-upload-list`, `.jt-upload-item`, `.jt-upload-name`, `.jt-upload-size`, `.jt-product-img`
- 상태·결과·수치: `.jt-empty`, `.jt-empty-title`, `.jt-empty-desc`, `.jt-loader`, `.jt-loader-lg`, `.jt-skeleton`, `.jt-stat`, `.jt-stat-label`, `.jt-stat-value`, `.jt-stat-unit`, `.jt-desc`
- 표·분류·판정: `.jt-table-wrap`, `.jt-table`, `.jt-num`, `.jt-tag`, `.jt-badge`, `.jt-badge-pass`, `.jt-badge-fail`, `.jt-badge-hold`
- 텍스트·아이콘: `.jt-help`, `.jt-ico`, `.jt-ico-sm`, `.jt-ico-lg`
