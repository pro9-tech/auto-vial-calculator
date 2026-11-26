// 100% 오프라인 온디바이스(로컬) ONNX Runtime Web 기반 YOLO26 객체 탐지 추론 모듈
// 외부 API 키나 네트워크 통신 없이 브라우저 내에서 직접 /best.onnx를 실행합니다.

let ortInstance = null
let onnxSession = null
let sessionLoadingPromise = null

// ort.min.js 스크립트 로드
export function loadOrtScript() {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (window.ort) return Promise.resolve(window.ort)

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-jt-ort="true"]')
    if (existing) {
      if (window.ort) {
        resolve(window.ort)
        return
      }
      existing.addEventListener('load', () => resolve(window.ort))
      existing.addEventListener('error', (err) => reject(err))
      return
    }

    const script = document.createElement('script')
    script.src = '/ort.min.js'
    script.dataset.jtOrt = 'true'
    script.async = true
    script.onload = () => {
      if (window.ort) {
        resolve(window.ort)
      } else {
        reject(new Error('ort.min.js가 로드되었으나 window.ort를 찾을 수 없습니다.'))
      }
    }
    script.onerror = () => {
      reject(new Error('/ort.min.js 로컬 파일을 로드하지 못했습니다.'))
    }
    document.head.appendChild(script)
  })
}

// WASM 및 스크립트 초기화 (로컬 우선 및 CDN 폴백)
export async function getOrt() {
  if (ortInstance) return ortInstance
  if (typeof window === 'undefined') return null

  const ort = await loadOrtScript()
  if (!ort) throw new Error('ONNX Runtime Web 엔진을 브라우저에서 초기화할 수 없습니다.')
  ortInstance = ort

  // WASM 경로 설정: public 로컬 경로 우선, 누락 시 CDN 폴백 지원
  if (ortInstance && ortInstance.env && ortInstance.env.wasm) {
    ortInstance.env.wasm.wasmPaths = {
      'ort-wasm-simd-threaded.wasm': '/ort-wasm/ort-wasm-simd-threaded.wasm',
      'ort-wasm-simd-threaded.jsep.wasm': '/ort-wasm/ort-wasm-simd-threaded.jsep.wasm',
      'ort-wasm.wasm': '/ort-wasm/ort-wasm.wasm',
    }
    // 기본 디렉터리 경로 설정
    ortInstance.env.wasm.wasmPaths = '/ort-wasm/'
    ortInstance.env.wasm.numThreads = 1 // 모바일 환경 호환성
  }

  return ortInstance
}

// best.onnx 세션 초기화 및 캐싱
export async function getOnnxSession() {
  if (onnxSession) return onnxSession
  if (sessionLoadingPromise) return sessionLoadingPromise

  sessionLoadingPromise = (async () => {
    const ort = await getOrt()
    if (!ort) throw new Error('ONNX Runtime을 브라우저 환경에서 로드할 수 없습니다.')

    // 모델 파일 로컬 경로 (/best.onnx)
    const modelUrl = '/best.onnx'
    const session = await ort.InferenceSession.create(modelUrl, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    })
    onnxSession = session
    return session
  })()

  try {
    const session = await sessionLoadingPromise
    return session
  } catch (err) {
    sessionLoadingPromise = null
    throw err
  }
}

/**
 * 640x640 레터박스(Letterbox) 전처리:
 * 가로세로 비율이 깨지지 않도록 회색 여백(#727272)을 넣어 리사이즈하고,
 * 0~1 정규화 후 NCHW [1, 3, 640, 640] float32 텐서 생성
 */
export function preprocessImageTo640(img) {
  const origW = img.naturalWidth || img.videoWidth || img.width
  const origH = img.naturalHeight || img.videoHeight || img.height

  const targetSize = 640
  const canvas = document.createElement('canvas')
  canvas.width = targetSize
  canvas.height = targetSize
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  // 회색 배경 (114/255) 레터박스
  ctx.fillStyle = '#727272'
  ctx.fillRect(0, 0, targetSize, targetSize)

  // 종횡비 유지 스케일
  const scale = Math.min(targetSize / origW, targetSize / origH)
  const newW = Math.round(origW * scale)
  const newH = Math.round(origH * scale)
  const padX = Math.round((targetSize - newW) / 2)
  const padY = Math.round((targetSize - newH) / 2)

  ctx.drawImage(img, padX, padY, newW, newH)
  const imgData = ctx.getImageData(0, 0, targetSize, targetSize)
  const { data } = imgData

  // 1x3x640x640 NCHW Float32Array
  const floatData = new Float32Array(3 * targetSize * targetSize)
  const planeSize = targetSize * targetSize

  for (let i = 0; i < planeSize; i++) {
    const pi = i * 4
    floatData[i] = data[pi] / 255.0 // R
    floatData[planeSize + i] = data[pi + 1] / 255.0 // G
    floatData[planeSize * 2 + i] = data[pi + 2] / 255.0 // B
  }

  return {
    floatData,
    origW,
    origH,
    scale,
    padX,
    padY,
  }
}

// NMS (Non-Maximum Suppression)
function runNms(boxes, iouThreshold = 0.45) {
  boxes.sort((a, b) => b.confidence - a.confidence)
  const selected = []
  for (let i = 0; i < boxes.length; i++) {
    const b1 = boxes[i]
    let keep = true
    for (let j = 0; j < selected.length; j++) {
      const b2 = selected[j]
      if (b1.classId !== b2.classId) continue

      const x1 = Math.max(b1.x1, b2.x1)
      const y1 = Math.max(b1.y1, b2.y1)
      const x2 = Math.min(b1.x2, b2.x2)
      const y2 = Math.min(b1.y2, b2.y2)
      const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
      const area1 = Math.max(0, b1.x2 - b1.x1) * Math.max(0, b1.y2 - b1.y1)
      const area2 = Math.max(0, b2.x2 - b2.x1) * Math.max(0, b2.y2 - b2.y1)
      const iou = inter / Math.max(1e-6, area1 + area2 - inter)
      if (iou > iouThreshold) {
        keep = false
        break
      }
    }
    if (keep) selected.push(b1)
  }
  return selected
}

/**
 * 100% 로컬 온디바이스 YOLO26 추론 실행
 * @param {HTMLImageElement|ImageBitmap} imageElement 
 * @param {number} confThreshold confidence 기준값 (기본 0.35)
 * @returns {Promise<{ boxes: Array, capCount: number, boxCount: number, circles: Array, rectBoxes: Array }>}
 */
export async function runYoloInference(imageElement, confThreshold = 0.35) {
  const ort = await getOrt()
  const session = await getOnnxSession()

  // 1. 전처리 (640x640 레터박스 NCHW)
  const { floatData, origW, origH, scale, padX, padY } = preprocessImageTo640(imageElement)
  const inputTensor = new ort.Tensor('float32', floatData, [1, 3, 640, 640])

  // 2. 온디바이스 ONNX 추론 실행
  const feeds = { [session.inputNames[0]]: inputTensor }
  const results = await session.run(feeds)
  const output = results[session.outputNames[0]]

  const dims = output.dims
  const data = output.data
  const candidates = []

  // 출력 형식 판별 및 파싱:
  // 1) (1, 300, 6) 형태: NMS-free 헤드 ([x1, y1, x2, y2, score, class_id])
  // 2) (1, 6, 8400) 형태: 표준 YOLO ([cx, cy, w, h, score_box, score_cap])
  if (dims.length === 3 && dims[1] === 300 && dims[2] === 6) {
    const numRows = 300
    for (let i = 0; i < numRows; i++) {
      const offset = i * 6
      const x1 = data[offset]
      const y1 = data[offset + 1]
      const x2 = data[offset + 2]
      const y2 = data[offset + 3]
      const score = data[offset + 4]
      const classId = Math.round(data[offset + 5])

      if (score >= confThreshold) {
        candidates.push({ x1, y1, x2, y2, confidence: score, classId })
      }
    }
  } else if (dims.length === 3 && dims[1] === 6 && dims[2] > 0) {
    const numAnchors = dims[2]
    for (let i = 0; i < numAnchors; i++) {
      const cx = data[0 * numAnchors + i]
      const cy = data[1 * numAnchors + i]
      const w = data[2 * numAnchors + i]
      const h = data[3 * numAnchors + i]
      const score0 = data[4 * numAnchors + i] // vial_box
      const score1 = data[5 * numAnchors + i] // vial_cap

      const classId = score0 > score1 ? 0 : 1
      const maxScore = Math.max(score0, score1)

      if (maxScore >= confThreshold) {
        const x1 = cx - w / 2
        const y1 = cy - h / 2
        const x2 = cx + w / 2
        const y2 = cy + h / 2
        candidates.push({ x1, y1, x2, y2, confidence: maxScore, classId })
      }
    }
  }

  // 중복 제거
  const filtered = candidates.length > 0 ? runNms(candidates, 0.45) : []

  // 원본 사진 좌표계(0~1 정규화)로 역변환
  const circles = []
  const rectBoxes = []
  let boxCount = 0
  let capCount = 0

  for (let i = 0; i < filtered.length; i++) {
    const det = filtered[i]
    // 패딩과 스케일을 역계산하여 원본 이미지 픽셀 좌표 획득
    const rx1 = Math.max(0, Math.min(origW, (det.x1 - padX) / scale))
    const ry1 = Math.max(0, Math.min(origH, (det.y1 - padY) / scale))
    const rx2 = Math.max(0, Math.min(origW, (det.x2 - padX) / scale))
    const ry2 = Math.max(0, Math.min(origH, (det.y2 - padY) / scale))

    const normX1 = rx1 / origW
    const normY1 = ry1 / origH
    const normW = (rx2 - rx1) / origW
    const normH = (ry2 - ry1) / origH

    if (det.classId === 0) {
      // vial_box
      boxCount++
      rectBoxes.push({
        id: `yolo-box-${boxCount}`,
        x: normX1,
        y: normY1,
        w: normW,
        h: normH,
        confidence: Number(det.confidence.toFixed(2)),
        source: 'yolo',
      })
    } else if (det.classId === 1) {
      // vial_cap: 정확한 캡 중앙 위치(cx, cy) 및 반지름 계산
      capCount++
      const normCx = (rx1 + rx2) / (2 * origW)
      const normCy = (ry1 + ry2) / (2 * origH)
      const normR = Math.max(normW, normH) / 2
      circles.push({
        id: `yolo-cap-${capCount}`,
        x: normCx,
        y: normCy,
        r: normR,
        confidence: Number(det.confidence.toFixed(2)),
        source: 'yolo',
      })
    }
  }

  return {
    rawDetections: filtered,
    circles,
    boxes: rectBoxes,
    capCount,
    boxCount,
    origW,
    origH,
  }
}
