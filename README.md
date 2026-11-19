# JT 스타터 — Next.js

## 실행

```bash
npm install
npm run dev
```

http://localhost:3000

## 들어 있는 것

| 파일 | 무엇 |
|---|---|
| `styles/globals.css` | 디자인 시스템 링크 두 줄 + body 기본 스타일 |
| `pages/_app.jsx` | viewport 메타 |
| `components/AppBrand.jsx` | 로고 + 앱 이름 부품 — `name` 만 바꿔 쓰세요 |
| `pages/index.jsx` | 앱 셸 + 검색 + 표 + 판정 배지 + 다크 전환 + 빈 상태 |
| `AGENTS.md` | AI 코딩 도구에 주는 규칙 파일 (`jt-core.md` 와 같은 내용) |

## Tailwind를 추가한다면

**버전을 먼저 확인하세요.**

```bash
npx tailwindcss --help | head -1
```

| 버전 | 쓸 파일 |
|---|---|
| v4 | `https://ds.janytree.app/jt-tailwind-v4.css` (`@theme inline`) |
| v3 | `tailwind.config.js` 브리지 |

⚠️ **v4에서는 `tailwind.config.js`가 에러 없이 조용히 무시됩니다.**
⚠️ `content` / `@source` 경로가 빠지면 **개발서버는 멀쩡하고 프로덕션 빌드에서만** 스타일이 사라집니다. 배포 전 반드시 `npm run build`로 확인하세요.

## 다음에 할 일

1. `AGENTS.md`를 쓰는 AI 도구에 규칙으로 등록 (도구별 파일 이름: https://ds.janytree.app/resources/ai)
2. https://ds.janytree.app/components 에서 컴포넌트 복사
3. 배포 전 https://ds.janytree.app/develop/checklist 확인
