# 25. YOLO26 온디바이스(best.onnx) 객체 탐지 연동 구현 계획서

> 작성일: 2026-11-26

## 1. 개요 및 요구사항
- **목표**: 프로젝트 폴더에 추가된 `best.onnx`(YOLO26 Small 기반 객체 탐지 모델)를 활용하여 외부 API 키나 서버 통신 없이 **100% 오프라인 온디바이스(로컬 브라우저)** 환경에서 직접 추론하도록 연동.
- **모델 경로**: `public/best.onnx` (정적 자산 서빙 경로)
- **입력 크기**: $640 \times 640$ (레터박스 패딩 유지, $0 \sim 1$ 정규화 Float32 NCHW 텐서)
- **클래스 매핑**:
  - `0`: `vial_box` (카트/박스)
  - `1`: `vial_cap` (바이알 캡)
- **신뢰도 기준**: `confidence >= 0.5`
- **오프라인 환경**: 외부 API 호출/키 입력란 배제, `ort-wasm/` 디렉터리에 로컬 WebAssembly 런타임 배치.

## 2. 세부 구현 내용

### A. ONNX Runtime Web 로컬 런타임 자산 구축
- `public/ort.min.js`: 브라우저 내 ONNX 추론 클라이언트 스크립트.
- `public/ort-wasm/`: WebAssembly 바이너리(`ort-wasm-simd-threaded.wasm` 등)를 로컬 호스팅하여 네트워크 단절 시에도 100% 로컬 구동 보장.

### B. 온디바이스 YOLO26 추론 엔진 (`utils/yoloOnnx.js`)
1. **전처리 (`preprocessImageTo640`)**:
   - 원본 이미지 비율을 유지하면서 $640 \times 640$ 캔버스 중앙에 배치(회색 `#727272` 레터박스).
   - $1 \times 3 \times 640 \times 640$ 형태의 Float32 NCHW 배열 생성 ($0 \sim 1$ 범위).
2. **추론 및 출력 파싱 (`runYoloInference`)**:
   - `images` 입력 텐서 공급 후 `output0` 획득.
   - NMS-free 및 표준 YOLO 앵커 구조 모두 지원:
     - `[1, 300, 6]` 또는 `[1, 6, 8400]` 포맷 처리.
     - `score >= 0.5` 필터링 및 원본 좌표 역변환(0~1 정규화).
     - `vial_box`는 사각형 바운딩 박스(`boxes`), `vial_cap`은 원형 마커(`circles`)로 변환.

### C. 검출 파이프라인 연동 (`components/VialCountInspector.jsx`)
- `analyzeVialImageFile` 및 `analyzeBoxImageFile`에서 로컬 YOLO26 추론을 우선 수행.
- 검출 결과가 존재하면 즉시 화면에 마커 및 개수 표시(`engine: 'yolo-onnx'`).
- 예외 상황 발생 시 기존 클래식 컴퓨터 비전 알고리즘으로 안전 폴백.

### D. 촬영 화면 UI 연동 (`pages/index.jsx`)
- 상단 상태 배지에 `YOLO26 온디바이스 활성` 표시.
- 개별 검출 내역 표의 계산 방식에 `YOLO26 온디바이스 탐지` 표기.

## 3. 검증 결과
- `npx next build` 컴파일 및 정적 페이지 생성 통과 확인 완료.
