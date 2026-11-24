# 23. 캔버스 이벤트 연결 및 박스 모드 Sobel Y 경계선 감지 수정 계획서

> 작성일: 2026-11-24

## 문제 요약

### 문제 1: 캔버스 마우스 이벤트 미연결
- `VialCountInspector.jsx`의 `<canvas>` 엘리먼트에 `onClick={handleCanvasClick}`이 연결되어 있었으나 `handleCanvasClick` 함수 자체가 정의되지 않아 오류 발생
- `onMouseDown / onMouseMove / onMouseUp` 핸들러는 정의되어 있었지만 canvas에 연결되지 않아 클릭 → 기준 캡 선택 / 드래그 → 앞면 ROI 지정 기능이 전혀 작동하지 않았음

### 문제 2: index.jsx에 콜백 props 미연결
- `VialCountInspector` 컴포넌트에 `onSelectTemplatePoint`, `onSetBoxRoi` props가 전달되지 않았음
- 해당 함수(`handleSelectTemplatePoint`, `handleSetBoxRoi`)도 정의되지 않아 캡 클릭 / 박스 드래그 결과가 상태에 반영되지 않았음

### 문제 3: 박스 모드 경계선 미감지
- 초록 박스 사진에서 행별 평균 밝기 변화(Sobel 단순 최솟값)만으로는 경계선을 찾지 못해 5박스만 출력됨
- 기존 접근: 행별 최솟값 위치를 무조건 경계선으로 사용
- 신규 접근: **Sobel Y 미분 (위3행 vs 아래3행 평균 차이)** + 에지 임계값(`sensitivity` 반영) → 실제 에지 피크를 경계선으로 선택, 에지 없으면 균등 분할 사용

## 수정 내용

### `components/VialCountInspector.jsx`
1. `<canvas>` 엘리먼트에 `onMouseDown`, `onMouseMove`, `onMouseUp`, `onMouseLeave` 연결
2. 캡 모드 안내 오버레이 ("아무 캡 정중앙을 클릭하면 재계산") 추가
3. 박스 모드 안내 오버레이 ("드래그로 앞면 영역 지정") + [앞면 기본값 리셋] 버튼 추가
4. `detectStackedCartBoxesWithRoi` 함수 개선:
   - 초록 박스 자동 탐색 로직 개선 (4픽셀씩 건너뜀 → 더 빠른 처리)
   - 행별 Sobel Y 미분 (7행 스무딩 → 위3/아래3 평균 차이) 계산
   - `sensitivity`에 비례한 에지 임계값 적용
   - 에지 피크가 없으면 균등 분할 위치 사용 (안전망)

### `pages/index.jsx`
1. `handleSelectTemplatePoint(photoId, pt)` 함수 추가:
   - `detectVialsInImageData(photo.imageData, capParams, pt)` 즉시 호출
   - `capPhotos` 상태에서 해당 사진의 `templatePoint`, `circles`, `count` 업데이트
2. `handleSetBoxRoi(photoId, roi)` 함수 추가:
   - `detectBoxesInImageData(photo.imageData, boxParams, roi)` 즉시 호출
   - `boxPhotos` 상태에서 해당 사진의 `boxRoi`, `boxes`, `count` 업데이트
3. `VialCountInspector` 태그에 `onSelectTemplatePoint`, `onSetBoxRoi` props 전달

## 빌드 결과
- `npx next build` → Exit code 0, 경고 없음 ✅
