# JT 디자인 시스템 v5.0 — 신규 앱 규칙 (jt-core)

이 파일을 프로젝트 루트에 쓰는 AI 도구가 읽는 이름(`AGENTS.md` · `CLAUDE.md` · `GEMINI.md` 등)으로 저장하세요. 도구별 이름은 https://ds.janytree.app/resources/ai 에 있습니다.
전체 스펙이 필요하면 https://ds.janytree.app/llms.txt 를 첫 대화에 붙여넣습니다.

**AI는 작업을 시작할 때 "jt-core를 읽었고 절대 규칙은 몇 개인지"와 로고·아이콘 규칙(6·7절)을 한 줄로 요약해 보고한다.**

## 1. 앱 정보 (프로젝트 시작 시 채울 것)

- 앱 이름: [ ]
- 분야: [ ]
- 기술 스택: [ ]
- 디자인 시스템 버전: **v5.0**
- 채택 레벨: **L4 (신규 앱은 처음부터 전면 적용)**
- 조판: [ Productive (업무용·기본) / Expressive (브랜드·랜딩) ]
- 컨테이너: [ narrow 720 / max 1200 / wide 1440 / full ]

## 2. 설치 — 이 두 줄이 전부다

```html
<link rel="stylesheet" href="https://ds.janytree.app/v5/jt-tokens.css">
<link rel="stylesheet" href="https://ds.janytree.app/v5/jt-utilities.css">
```

- **웹폰트를 따로 넣지 않는다.** `jt-tokens.css`에 Pretendard·Figtree 로드가 내장돼 있다.
- 값의 정본은 **`jt-tokens.css` 하나**다. 문서와 값이 다르면 파일이 맞다.
- **이 두 파일을 편집하지 않는다.** 값을 바꿔야 하면 디렉터에게 요청한다.

## 3. 절대 규칙 (어기면 결과물을 폐기한다)

1. **색·크기·간격에 리터럴 값을 쓰지 않는다.** `#hex` · `rgb()` · 임의 `px` 전부 금지. 반드시 `var(--토큰)`.
2. **Tailwind 임의값 대괄호 표기 금지** — `bg-[#305CDE]` `text-[13px]` `p-[7px]` 등.
3. **z-index 숫자 금지.** `--z-base/raised/sticky/drawer/dropdown/overlay/modal/toast/tooltip` 만.
4. **원시 팔레트를 컴포넌트에서 직접 쓰지 않는다.** `--blue-500` 아니라 `--color-accent`. 그래야 다크·밀도 전환이 자동으로 된다.
5. **시스템 CSS를 수정하지 않는다.** 모양을 바꿔야 하면 `--jt-{컴포넌트}-*` 노브만 덮어쓴다.
   ```css
   .checkout .jt-btn { --jt-btn-min-w: 120px; }   /* ✅ */
   .jt-btn { min-width: 120px; }                  /* 🚫 */
   ```
6. **고정 `width`/`height` 금지.** `min-width` / `min-height`를 쓴다 (번역 시 글자가 최대 7배까지 길어진다).
7. **판정·상태를 색만으로 전달하지 않는다.** 반드시 글자를 병기한다 — 흑백으로 인쇄되는 COA·시험성적서에서 색은 사라진다.
8. **`--color-text-tertiary`를 글자에 쓰지 않는다.** 대비 3.19:1로 기준 미달. placeholder·도움말도 텍스트이므로 `--color-text-secondary`를 쓴다.
9. **`word-break: keep-all`을 전역이나 중국어·일본어·태국어에 적용하지 않는다.** 토큰 파일이 `:lang(ko)` 한정으로 이미 처리한다.
10. **필요한 값이 토큰에 없으면 지어내지 말고 "토큰에 없다"고 보고한다.**

## 4. 브랜드 규칙 — 2톤 모델

| 색 | 의미 | 쓰는 곳 |
|---|---|---|
| Charcoal `--color-primary` | "이것이 제니트리다" | 솔리드 주버튼 · 헤더 · 본문 글자 |
| Blue `--color-accent` | "여기를 누를 수 있다" | 링크 · 포커스 · 활성 탭 · 선택된 행 |

**주버튼을 파랑으로 만들지 않는다.** 가장 흔한 일탈이며 브랜드가 즉시 흐려진다.
뉴트럴이 화면의 90%, 색은 의미가 있을 때만 쓴다.

## 5. 상태색과 분류 표시

색은 **상태(무슨 일이 일어났나)** 를 말할 때만 쓴다. 이 색들을 다른 뜻에 쓰면 사용자가 상태로 오해한다.

| 색 | 뜻 | 토큰 |
|---|---|---|
| 파랑 | 정보·안내 · 누를 수 있음 | `--color-info` · `--color-accent` |
| 초록 | 완료·성공 · 적합 | `--color-success` · `--color-pass` |
| 노랑 | 주의 · 보류 | `--color-warning` · `--color-hold` |
| 빨강 | 오류·위험 · 부적합 | `--color-error` · `--color-fail` |
| 보라 | 관리한계 이탈(OOS) | `--color-oos` |
| 청록 | 피부과학·임상 데이터 · 차트 (상태 아님) | 차트 전용 |

- **분류(카테고리)에는 색을 쓰지 않는다.** 세무·회계·인사 같은 분류는 회색 태그 `.jt-tag` 하나로 통일하고, 분류마다 아이콘 하나로 구별한다.
- 분류 태그와 상태 배지가 함께 나오면 **분류 태그 먼저, 상태 배지 뒤**.
- 앱 구별색(부록 A)은 **런처 아이콘 전용**이다. 앱 화면 안의 분류·태그에 쓰지 않는다.

```html
<span class="jt-tag"><span class="jt-ico" aria-hidden="true">receipt_long</span>세무</span>
<span class="jt-badge jt-badge-hold">보류</span>
```

## 6. 로고와 앱 이름

로고는 바뀌지 않고 **앱 이름만 앱마다 바뀐다.** 크기·위치는 `jt-utilities.css`의 클래스가 정한다 — 직접 CSS를 쓰지 않는다.

- **로고를 글자로 쓰지 않는다.** "JANYTREE"를 텍스트로 치거나, 로고를 직접 그리거나(SVG 손그림·CSS 도형) 색을 바꾸지 않는다. 반드시 로고 파일을 `.jt-logo`(라이트·다크 2장)로 넣는다.
- 로고 파일 `https://ds.janytree.app/brand/logo/` — 심볼 `logo-mark.svg`(다크 `logo-mark-light.svg`) · 글자형 `logo.svg`(다크 `logo-light.svg`).

**앱 화면 — 사이드바 머리: 심볼 32px + 여백 16px + 앱 이름 18px.** 같은 마크업을 사이드바 맨 위와 상단바 맨 앞에 둔다.
```html
<a class="jt-appbrand" href="/">
  <span class="jt-logo">
    <img class="on-light" src="https://ds.janytree.app/brand/logo/logo-mark.svg" alt="Janytree">
    <img class="on-dark"  src="https://ds.janytree.app/brand/logo/logo-mark-light.svg" alt="Janytree">
  </span>
  <span class="jt-appbrand-name">앱 이름</span>
</a>
```

| 상태 | 자동으로 되는 것 (앱이 할 일 없음) |
|---|---|
| 데스크톱 | 사이드바 머리 높이 = 상단바 높이 → 밑줄이 한 줄로 이어짐. 상단바 쪽 브랜드는 숨김 |
| 좁힌 사이드바 `.jt-shell[data-sidebar="rail"]` | 72px · 심볼만. 앱 이름·메뉴 글자는 화면에서만 숨김(스크린리더는 읽음) |
| 태블릿·모바일(1023px 이하) | 사이드바 대신 상단바 맨 앞에 심볼만 |
| 드로어 열림 `.jt-sidebar[data-open="true"]` | 사이드바 머리 그대로(심볼 + 앱 이름) |
| 다크 `data-theme="dark"` · 인쇄 | 흰 심볼로 교체 · 인쇄는 항상 먹색 |

- 좁힌 사이드바를 쓰면 메뉴 항목을 **아이콘 + `<span class="jt-nav-label">`** 으로, 묶음 제목을 `.jt-nav-heading`으로 만든다. 접힘 버튼에는 `aria-expanded`를 함께 바꾼다.
- 앱 이름은 12자 안쪽을 권장한다. 길면 2줄로 줄바꿈된다(말줄임 금지). 부서명 등 부가 설명은 사이드바에 넣지 않는다.

**로그인 · 스플래시 — 심볼 없이 앱 이름이 주인공, 회사는 카드 아래 글자형 로고.**
```html
<div class="jt-auth-brand">
  <h1 class="jt-auth-app">앱 이름</h1>
  <p class="jt-auth-sub">부서 · 한 줄 설명</p>          <!-- 선택 -->
</div>
<!-- …로그인 카드… -->
<div class="jt-auth-foot"><span class="jt-logo">
  <img class="on-light" src="https://ds.janytree.app/brand/logo/logo.svg" alt="Janytree">
  <img class="on-dark"  src="https://ds.janytree.app/brand/logo/logo-light.svg" alt="Janytree">
</span></div>
```

## 7. 아이콘 · 특수문자 · 이모지

**앱 화면**
- UI 아이콘 자리는 반드시 아이콘 — 하단 탭바·주요 내비는 SVG(`.jt-ico-mask`, `https://ds.janytree.app/brand/icons/`), 그 밖은 Material Symbols Rounded(`.jt-ico`).
- 아이콘 폰트를 쓰면 `<head>`에 직접 로드한다(**`display=block` 필수**, `swap` 금지):
  `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block">`
- **특수문자·이모지를 아이콘 대신 쓰지 않는다** — `①②③` `⋮` `✕` `▯` `★` `✅` 등. 폰트에 없으면 빈 네모(▯)로 보인다. (예외: 증감 `▲▼`, 기본 문자 `‹ › − +`)

**메시지 (메일 · 메신저 · 알림 문자 — 글자만 보내는 채널)**
- 이모지는 **문장 맨 앞에 1개, 아래 4종만**. 글자를 반드시 함께 쓴다.

| 이모지 | 뜻 | 예 |
|---|---|---|
| ✅ | 완료 | ✅ 완료 — 10월 부가세 신고서 제출 |
| ⚠️ | 주의 | ⚠️ 주의 — 마감 3일 전: 원천세 신고 |
| ⛔ | 오류·반려 | ⛔ 반려 — 증빙 누락 |
| ℹ️ | 안내 | ℹ️ 안내 — 11월 일정이 등록되었습니다 |

## 8. 컴포넌트

`.jt-*` 클래스 47종을 쓴다. 목록과 코드는 https://ds.janytree.app/components

자주 쓰는 것:

```html
<button class="jt-btn">저장</button>            <!-- ghost / danger / sm / lg -->
<input class="jt-input">                        <!-- textarea / date 는 .jt-textarea / .jt-date -->
<span class="jt-badge jt-badge-pass">적합</span> <!-- fail / hold / oos -->
<div class="jt-table-wrap"><table class="jt-table">…</table></div>
<dl class="jt-desc"><dt>LOT</dt><dd class="jt-num">26H21-03</dd></dl>
```

- 표의 숫자열은 **우측 정렬 + `class="jt-num"`** (Figtree + 자릿수 정렬).
- 표는 반드시 `.jt-table-wrap`으로 감싼다. 없으면 가로 스크롤이 페이지 전체로 번진다.
- 모바일 도움말은 `.jt-tooltip`(hover)이 아니라 **`.jt-toggletip`(클릭)** 을 쓴다.
- 모바일 주요 메뉴는 상단이 아니라 **하단 탭바 `.jt-tabbar`** (5개 이하).

## 9. 화면 완성 시 자가 점검 (매번 실행)

점검하고, 위반이 있으면 고친 뒤 **무엇을 고쳤는지 보고**한다.

- [ ] `#hex` · `rgb()` · 임의 `px` 직접 사용 0건
- [ ] Tailwind 임의값 대괄호 표기 0건
- [ ] z-index 숫자 직접 사용 0건
- [ ] 주버튼이 먹색 `--color-primary`인가 (파랑 아님)
- [ ] `--color-accent`(파랑)가 링크·포커스·활성에만 쓰였는가
- [ ] warning이 노란 배경 + 어두운 글자인가 (흰 글자 아님)
- [ ] `--color-text-tertiary`를 글자에 쓴 곳 없음
- [ ] 판정·상태에 글자가 병기되어 있음
- [ ] 12px 미만 글자 없음 (캡션 11px 예외)
- [ ] 간격 값이 모두 4px 배수
- [ ] 고정 width/height 없음 (min-* 사용)
- [ ] 모바일 폭(≤639px)에서 가로 스크롤·글자 잘림 없음
- [ ] 다크(`data-theme="dark"`)에서도 글자·테두리가 전부 보임
- [ ] 아이콘만 있는 버튼에 `aria-label` 있음
- [ ] 표가 `.jt-table-wrap`으로 감싸여 있음
- [ ] 토큰에 없는 값을 임의로 만든 곳 없음
- [ ] 로고가 `.jt-logo` 파일로 들어가 있음 — "JANYTREE" 글자·직접 그린 로고 0건, 라이트·다크에서 한 장만 보임, 사이드바 머리와 상단바 밑줄이 한 줄
- [ ] 아이콘 자리에 특수문자·이모지 0건 (`①` `⋮` `✕` `▯` `★` `✅` 등)
- [ ] 상태색(파랑·초록·노랑·빨강·보라)과 청록을 분류·태그·장식에 쓴 곳 0건
- [ ] 메시지 이모지는 ✅ ⚠️ ⛔ ℹ️ 4종만, 맨 앞 1개 + 글자 병기

## 10. 멈춤 신호 — 진행하지 말고 즉시 질문

- 필요한 색·크기가 토큰에 없을 때
- `jt-tokens.css` 또는 `jt-utilities.css`를 수정해야 할 것 같을 때
- 요청받지 않은 파일을 고쳐야 할 것 같을 때
- 구조(무엇을 화면에 넣을지)를 임의로 정해야 할 때
- 분류·태그에 색을 넣어 달라는 요청을 받았을 때 (5절 — 상태색과 겹침)
