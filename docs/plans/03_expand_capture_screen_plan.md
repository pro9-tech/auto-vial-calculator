# 03. 자동바이알계산기 — "촬영" 화면 확장 및 검수 내역 분리 계획서

## 1. 목적
- 체이스의 요청에 따라 "촬영" 화면에서 하단의 **"최근 검수 내역" 섹션을 분리(추후 "기록" 화면에 배치)**합니다.
- "바이알 사진 등록" 영역을 모바일과 PC 화면에서 큼직하게 꽉 찬 메인 영역으로 확장합니다.
- 디자인 시스템 규칙(JT 디자인 시스템 v5.0)을 철저히 준수하여 토큰과 `.jt-*` 컴포넌트만을 사용합니다.

## 2. 화면 구성 변경 사항
1. **"최근 검수 내역" 카드 제거**
   - 기존 하단에 있던 누적 검수 기록 표는 다음 단계의 [기록] 메뉴로 이관하기 위해 촬영 화면에서 완전히 제거합니다.
2. **"바이알 사진 등록" 영역 전체 크기 확장**
   - 사진 등록 카드와 업로드 영역(`.jt-upload`)의 높이를 넉넉하고 시원하게 확장합니다.
   - 리터럴 `px` 사용을 엄격히 금지하고 디자인 시스템 토큰(`var(--space-*)`) 및 뷰포트 비율(`minHeight: '45vh'`)을 활용합니다.
3. **상태별 화면 (빈 상태 / 사진 등록 / 로딩 / 검수 완료 가짜 데이터 5줄)**
   - **빈 상태(초기)**: 사진이 없을 때 시원하게 큰 업로드 안내 칸과 비활성화된 검수 버튼.
   - **사진 등록 상태**: 실제 기기 사진 업로드 또는 샘플 등록 사진 표시 및 지우기 버튼, 활성화된 검수 버튼.
   - **로딩 상태**: 검수 진행 중 중앙에 도는 로더(`.jt-loader.jt-loader-lg`)와 안내 텍스트.
   - **검수 완료 상태 (가짜 데이터 5줄)**: 검수가 완료되었을 때 파악된 바이알 개수 요약과 함께 바이알 트레이 구역별 인식 샘플 데이터 5줄(`.jt-table-wrap` > `.jt-table`)을 보여주어 검수 결과를 직관적으로 확인.

## 3. 사용하는 `.jt-*` 컴포넌트 목록
- 레이아웃·카드: `.jt-card`, `.jt-row`, `.jt-stack-2`, `.jt-stack-3`, `.jt-stack-4`, `.jt-sr-only`
- 버튼·스위처: `.jt-btn`, `.jt-btn-lg`, `.jt-icon-btn`, `.jt-switcher`, `.jt-switcher-item`
- 업로드·이미지: `.jt-upload`, `.jt-upload-hint`, `.jt-upload-list`, `.jt-upload-item`, `.jt-upload-name`, `.jt-upload-size`, `.jt-product-img`
- 상태·수치·결과: `.jt-empty`, `.jt-empty-title`, `.jt-empty-desc`, `.jt-loader`, `.jt-loader-lg`, `.jt-stat`, `.jt-stat-label`, `.jt-stat-value`, `.jt-stat-unit`, `.jt-desc`
- 표·배지·태그: `.jt-table-wrap`, `.jt-table`, `.jt-num`, `.jt-badge`, `.jt-badge-pass`, `.jt-tag`
- 텍스트·아이콘: `.jt-help`, `.jt-ico`, `.jt-ico-sm`, `.jt-ico-lg`
