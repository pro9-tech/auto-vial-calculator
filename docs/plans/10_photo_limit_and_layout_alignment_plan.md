# 10. 자동바이알계산기 — "촬영" 화면 모드별 최대 5장 및 레이아웃 정돈 계획서

## 1. 목적
- 체이스의 세부 피드백을 반영하여 사용자 경험과 화면 균형을 개선합니다.
- 수정 내용:
  1. **모드당 최대 사진 등록 장수**: 10장 $\rightarrow$ **5장**으로 변경 (캡 최대 5장, 박스 최대 5장).
  2. **버튼 높이 일치 및 입력칸 위치 조정**: '1박스당 바이알 수량 입력칸'을 [박스 사진 추가] 버튼 아래로 이동시켜 좌우 사진 추가 버튼의 수평 높이를 완벽하게 통일.
  3. **최종 계산 버튼 문구 간소화**: `[바이알 갯수 계산]`으로 심플하고 직관적으로 변경.

## 2. 세부 작업 내용
- `pages/index.jsx`의 최대 등록 장수 검증 로직을 5장으로 수정.
- 배지 문구: `0 / 5장` 형태로 표기.
- 카트 박스 카드의 UI 순서:
  - 헤더 $\rightarrow$ [박스 사진 추가] 버튼 (캡 사진 추가 버튼과 완벽하게 수평 위치 일치) $\rightarrow$ 1박스당 바이알 수량 입력칸 $\rightarrow$ 사진 목록 그리드
- 최종 하단 버튼: `바이알 갯수 계산` (`disabled={!hasAnyPhotos || isLoading}`)
- 디자인 시스템 JT v5.0 규칙 철저 준수 (토큰, `.jt-*` 클래스 활용).

## 3. 사용하는 `.jt-*` 컴포넌트 목록
- 레이아웃·카드: `.jt-card`, `.jt-row`, `.jt-stack-1`, `.jt-stack-2`, `.jt-stack-3`, `.jt-stack-4`, `.jt-sr-only`
- 버튼·스위처: `.jt-btn`, `.jt-btn-lg`, `.jt-icon-btn`, `.jt-switcher`, `.jt-switcher-item`
- 입력·폼: `.jt-input`, `.jt-input-sm`
- 표·태그·배지: `.jt-table-wrap`, `.jt-table`, `.jt-num`, `.jt-tag`, `.jt-badge`, `.jt-badge-pass`
- 상태·수치·결과: `.jt-stat`, `.jt-stat-label`, `.jt-stat-value`, `.jt-stat-unit`, `.jt-empty`, `.jt-empty-title`, `.jt-loader`, `.jt-loader-lg`
- 텍스트·아이콘: `.jt-help`, `.jt-ico`, `.jt-ico-sm`, `.jt-ico-lg`
