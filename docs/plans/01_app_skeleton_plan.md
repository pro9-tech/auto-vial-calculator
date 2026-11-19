# 01. 자동바이알계산기 기본 뼈대(App Skeleton) 구현 계획서

## 1. 앱 기본 정보 (JT 디자인 시스템 v5.0 기준)
- **앱 이름**: 자동바이알계산기
- **분야**: 생산·포장 현장 바이알 수량 측정 및 품질 확인 업무 도구
- **기술 스택**: Next.js 14 (Pages Router) + React 18 + JT 디자인 시스템 v5.0 (`jt-tokens.css`, `jt-utilities.css`)
- **조판 (Typeset)**: `Productive` (업무용·기본)
- **본문 컨테이너 폭**: `narrow (720)` (`.jt-container-narrow`, `--container-narrow`)
- **모바일 내비게이션**: 하단 탭바 (`.jt-tabbar`) — 메뉴 3개(`[촬영]`, `[기록]`, `[설정]`)
- **채택 레벨**: L4 (신규 앱 처음부터 전면 적용)

## 2. 선택한 공식 템플릿 및 패턴과 근거
1. **페이지 템플릿 (`https://ds.janytree.app/develop/templates`)**
   - **`App Shell` 템플릿** (`.jt-shell` + `.jt-sidebar` + `.jt-topbar` + `.jt-main`) + **`narrow (720)` 컨테이너** (`.jt-container-narrow`)
   - **선택 이유**: 데스크톱에서는 좌측 사이드바와 상단바의 밑줄이 한 줄로 이어지는 안정적인 업무용 골격을 제공하며, 태블릿·모바일(1023px 이하)에서는 사이드바가 자동으로 접히고 상단바 심볼 로고와 하단 탭바로 전환됩니다. 휴대폰 세로 화면의 단일 흐름에 맞춰 본문 폭을 `narrow (720)`으로 결합했습니다.
2. **화면 패턴 (`https://ds.janytree.app/develop/patterns`)**
   - **`⑤ 모바일 내비게이션` (하단 탭바 `.jt-tabbar`)**: 주요 메뉴가 `[촬영]`, `[기록]`, `[설정]` 3개(5개 이하 기준 충족)이고, 생산팀·포장팀이 현장에서 휴대폰을 한 손으로 쥔 채 엄지손가락으로 즉시 화면을 전환해야 하므로 하단 탭바를 적용했습니다.
   - **`④ 로딩 · 빈 상태 · 결과` 중 빈 상태 (`.jt-empty`)**: 개별 화면과 기능 구현 전인 뼈대 단계에서 메뉴 전환이 정상 작동함을 명확히 확인하기 위해 각 페이지에 `.jt-card` + `.jt-empty` 자리 표시자를 배치했습니다.

## 3. 생성 및 수정 파일 구조
- **유지하는 파일 (수정 금지)**:
  - `AGENTS.md`: 디자인 규칙 원본 보존
  - `styles/globals.css`: `jt-tokens.css` · `jt-utilities.css` 임포트 및 `body` 기본 스타일 보존
  - `components/AppBrand.jsx`: `.jt-appbrand` 로고·앱 이름 컴포넌트 재사용
- **새로 만드는 파일**:
  - `public/brand/icons/upload.svg`, `fact_check.svg`, `settings.svg`: 공식 브랜드 아이콘 29종 중 메뉴 3종 정본 SVG (CORS 차단 없이 `.jt-ico-mask`로 안전하게 표시)
  - `pages/_document.jsx`: `lang="ko"`, `data-typeset="productive"`, Material Symbols Rounded (`display=block`) 선언
  - `components/AppLayout.jsx`: `.jt-shell`, `.jt-sidebar`, `.jt-topbar`, `.jt-main.jt-container-narrow`, `.jt-tabbar` 공통 앱 뼈대
  - `pages/records.jsx`, `pages/settings.jsx`: `[기록]`, `[설정]` 메뉴 기본 뼈대 페이지
- **수정하는 파일**:
  - `pages/_app.jsx`: 공통 `<AppLayout>` 적용 및 다크 모드 전환 상태 유지
  - `pages/index.jsx`: `[촬영]` 메뉴 기본 뼈대 페이지로 정리

## 4. JT 디자인 시스템 준수 항목
- 색·크기·간격에 `#hex`, `rgb()`, 임의 `px` 등 리터럴 값 사용 0건
- `z-index` 숫자, 고정 `width`/`height`, `--color-text-tertiary` 텍스트 사용 0건
- UI 아이콘 자리에 특수문자 및 이모지 사용 0건 (다크 모드 버튼 포함)
- 로고는 `.jt-logo` 공식 파일(라이트/다크 2장)만 사용
- `.jt-tabbar`는 `.jt-shell` 바깥에 배치하여 하단 여백 자동 계산 규칙(`body:has(.jt-tabbar) .jt-main`) 준수

## 5. 피드백 반영 및 레이아웃 보완 이력
1. **사이드바 높이 바닥까지 연장**: `.jt-sidebar`에 `minHeight: '100vh'`를 적용하여 메뉴가 적더라도 데스크톱에서 흰색 배경과 우측 경계선이 화면 끝까지 끊기지 않고 내려오도록 수정.
2. **다크 모드 토글 UI 개선**: 기존 텍스트 버튼("다크 모드")에서 디자인 시스템 규격 아이콘 버튼(`.jt-icon-btn` + `.jt-ico`)으로 교체하여 라이트 모드에서는 달(`dark_mode`), 다크 모드에서는 해(`light_mode`) 아이콘으로 전환되도록 수정.
3. **로고 영역 타이틀 구조 수정**: `AppBrand.jsx`에서 로고 심볼 옆에 윗줄 `Janytree`(`var(--fs-base)`, bold), 아랫줄 `Auto Vial Calculator`(`var(--fs-xs)`, semi-bold)로 2단 구성하고, 모든 글자색은 디자인 시스템 기본 텍스트 토큰(`var(--color-text)`)으로 검은색 통일 반영.
