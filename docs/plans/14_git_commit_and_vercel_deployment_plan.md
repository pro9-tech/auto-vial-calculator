# 14. Git 커밋 및 Vercel 배포 가이드 계획서

## 1. 개요 및 목적
- **목적**: 현재까지 완성된 `자동바이알계산기(Auto Vial Calculator)`의 소스 코드와 계획 문서를 Git 저장소에 커밋하고, GitHub 리포지토리와 연동한 뒤 Vercel 클라우드 플랫폼에 정식 배포합니다.
- **대상 사용자**: 체이스 (초보 개발자/실무자)
- **보호 원칙**:
  - 기존의 검증된 소스 코드(`pages/index.jsx`, `components/VialCountInspector.jsx` 등) 훼손 절대 금지.
  - 빌드 산출물(`.next/`)과 패키지 폴더(`node_modules/`), 스크래치 파일은 `.gitignore`를 통해 Git 추적 대상에서 안전하게 제외.
  - 모든 계획 문서(`docs/plans/*.md`)를 누락 없이 커밋에 포함.

## 2. 작업 절차
1. **.gitignore 검증**:
   - `node_modules/`, `.next/`, `out/`, `test_*.mjs`, `scratch/` 등 불필요한 대용량 파일 제외 완료.
2. **Git 초기화 및 스테이징**:
   - `git init` 명령으로 로컬 저장소 생성.
   - `git branch -M main`으로 기본 브랜치명을 표준 `main`으로 설정.
   - `git add .` 및 `git status`로 필수 소스 및 `docs/plans/` 포함 여부 확인.
3. **첫 공식 커밋(Initial Commit)**:
   - 명확하고 의미 있는 커밋 메시지 작성:
     `feat: 자동바이알계산기 듀얼 모드 OpenCV 검출 및 기록/설정 기능 구현 완료`
4. **GitHub 리포지토리 연결 가이드**:
   - 체이스가 GitHub에서 신규 리포지토리를 만들고 원격 주소를 등록하여 푸시할 수 있도록 직관적인 안내 제공.
5. **Vercel 자동 배포 가이드**:
   - Vercel 웹사이트에서 GitHub 리포지토리를 가져와(Import) 버튼 한 번으로 배포하는 방법 상세 설명.
