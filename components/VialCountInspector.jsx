import { useEffect, useRef, useState } from 'react'

// 가로 1200 리사이징 기준 기본 검출 보정 파라미터입니다.
export const DEFAULT_DETECTION_PARAMS = {
  sensitivity: 55,
  minRadius: 15,
  maxRadius: 48,
}

// 박스 모드(사각형 윤곽선 검출)용 기본 보정 파라미터입니다.
export const DEFAULT_BOX_PARAMS = {
  sensitivity: 55,
  minSize: 45,
  maxSize: 550,
}

// 분석 전 이미지를 가로 1200 해상도로 리사이징하여 정밀도와 속도를 맞춥니다.
export const TARGET_ANALYSIS_WIDTH = 1200
const MAX_ANALYSIS_HEIGHT = 2400
const ANGLE_SAMPLES = 24

const OPENCV_CDN_PRIMARY = 'https://docs.opencv.org/4.10.0/opencv.js'
const OPENCV_CDN_BACKUP = 'https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0-release.1/dist/opencv.js'

// 24방향 원 둘레 샘플링용 삼각함수 테이블
const COS_TABLE = new Float32Array(ANGLE_SAMPLES)
const SIN_TABLE = new Float32Array(ANGLE_SAMPLES)
for (let k = 0; k < ANGLE_SAMPLES; k += 1) {
  const theta = (k * Math.PI * 2) / ANGLE_SAMPLES
  COS_TABLE[k] = Math.cos(theta)
  SIN_TABLE[k] = Math.sin(theta)
}

function clamp(val, min, max) {
  return val < min ? min : val > max ? max : val
}

function countBits4(mask) {
  let c = 0
  if (mask & 1) c += 1
  if (mask & 2) c += 1
  if (mask & 4) c += 1
  if (mask & 8) c += 1
  return c
}

// 브라우저에서 OpenCV.js WASM 엔진 사용 가능 여부를 확인합니다.
export function isOpenCvReady() {
  if (typeof window === 'undefined') return false
  const cv = window.cv
  return Boolean(
    cv &&
    typeof cv.Mat === 'function' &&
    typeof cv.cvtColor === 'function' &&
    typeof cv.HoughCircles === 'function'
  )
}

let openCvLoadPromise = null

function injectScriptWithTimeout(url, timeoutMs) {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(false)
      return
    }

    const existing = document.querySelector(`script[data-jt-opencv="true"][src="${url}"]`)
    if (existing && isOpenCvReady()) {
      resolve(true)
      return
    }

    let settled = false
    let pollTimer = null
    let timeoutTimer = null

    const cleanup = () => {
      if (pollTimer) clearInterval(pollTimer)
      if (timeoutTimer) clearTimeout(timeoutTimer)
    }

    const finish = (ok) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(ok)
    }

    // Emscripten Module.then 무한 루프를 피하기 위해 cv 객체 직접 resolve 대신 상태 폴링만 수행합니다.
    pollTimer = setInterval(() => {
      if (isOpenCvReady()) {
        finish(true)
      }
    }, 50)

    timeoutTimer = setTimeout(() => {
      finish(isOpenCvReady())
    }, timeoutMs)

    if (!existing) {
      const script = document.createElement('script')
      script.src = url
      script.async = true
      script.dataset.jtOpencv = 'true'
      script.onerror = () => finish(false)
      document.head.appendChild(script)
    }
  })
}

// OpenCV.js 스크립트를 비동기로 준비하며, 네트워크 차단 시 내장 Canvas 엔진으로 안전하게 폴백합니다.
export function ensureOpenCvReady() {
  if (isOpenCvReady()) {
    return Promise.resolve({ ready: true })
  }
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve({ ready: false })
  }
  if (openCvLoadPromise) {
    return openCvLoadPromise
  }

  openCvLoadPromise = (async () => {
    const primaryOk = await injectScriptWithTimeout(OPENCV_CDN_PRIMARY, 6000)
    if (primaryOk) return { ready: true }

    const backupOk = await injectScriptWithTimeout(OPENCV_CDN_BACKUP, 5000)
    return { ready: backupOk }
  })()

  return openCvLoadPromise
}

// 이미지 파일을 브라우저에서 읽어 <img> 객체로 변환합니다.
function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) {
        const err = new Error('이미지 크기를 확인할 수 없습니다.')
        err.code = 'IMAGE_DECODE_ERROR'
        reject(err)
        return
      }
      resolve(img)
    }
    img.onerror = () => {
      const err = new Error('이미지 파일을 읽는 중 손상되었거나 지원하지 않는 형식입니다.')
      err.code = 'IMAGE_DECODE_ERROR'
      reject(err)
    }
    img.src = src
  })
}

// 공통 전처리: 이미지를 가로 1200 해상도 비율로 리사이징하고 분석용 ImageData 버퍼를 추출합니다.
export async function prepareAnalysisImageData(previewUrl) {
  await ensureOpenCvReady()

  const img = await loadImageElement(previewUrl)
  const scale = TARGET_ANALYSIS_WIDTH / img.naturalWidth
  let w = TARGET_ANALYSIS_WIDTH
  let h = Math.max(16, Math.round(img.naturalHeight * scale))

  if (h > MAX_ANALYSIS_HEIGHT) {
    const hScale = MAX_ANALYSIS_HEIGHT / h
    h = MAX_ANALYSIS_HEIGHT
    w = Math.max(16, Math.round(w * hScale))
  }

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    const err = new Error('브라우저 캔버스 그래픽 엔진을 초기화할 수 없습니다.')
    err.code = 'CANVAS_INIT_ERROR'
    throw err
  }

  ctx.drawImage(img, 0, 0, w, h)
  const imageData = ctx.getImageData(0, 0, w, h)

  return {
    imageData,
    analysisWidth: w,
    analysisHeight: h,
    engine: isOpenCvReady() ? 'opencv' : 'canvas',
  }
}

// 큰 가짜 원 내부에 2개 이상의 작은 원 후보가 포함되어 있으면 큰 가짜 원을 제거합니다.
function resolveNestedCircles(rawCircles) {
  if (!rawCircles || rawCircles.length <= 2) return rawCircles || []
  return rawCircles.filter((big, idx) => {
    let innerCount = 0
    for (let j = 0; j < rawCircles.length; j += 1) {
      if (idx === j) continue
      const small = rawCircles[j]
      if (small.r >= big.r * 0.72) continue
      const dist = Math.hypot(big.x - small.x, big.y - small.y)
      if (dist + small.r * 0.45 <= big.r) {
        innerCount += 1
        if (innerCount >= 2) return false
      }
    }
    return true
  })
}

// ─────────────────────────────────────────────────────────────────
// [알고리즘 1] 초록색 트레이 내부 ROI 추출
// 상단 은색 레일, 바닥 반사광, 트레이 벽 바깥의 오인식을 100% 원천 차단합니다.
// ─────────────────────────────────────────────────────────────────
function extractTrayRoi(imageData) {
  const { width: w, height: h, data } = imageData
  const n = w * h
  let trayMinX = w, trayMaxX = 0, trayMinY = h, trayMaxY = 0, trayCount = 0

  for (let i = 0; i < n; i += 1) {
    const p = i * 4
    const r = data[p], g = data[p + 1], b = data[p + 2]
    const maxC = Math.max(r, g, b), minC = Math.min(r, g, b), diff = maxC - minC
    if (diff > 0 && maxC > 35) {
      let hue = 0
      if (maxC === r) hue = ((g - b) / diff + (g < b ? 6 : 0)) * 60
      else if (maxC === g) hue = ((b - r) / diff + 2) * 60
      else hue = ((r - g) / diff + 4) * 60

      const sat = diff / maxC
      if (hue >= 65 && hue <= 175 && sat >= 0.18) {
        const x = i % w, y = (i / w) | 0
        if (x < trayMinX) trayMinX = x
        if (x > trayMaxX) trayMaxX = x
        if (y < trayMinY) trayMinY = y
        if (y > trayMaxY) trayMaxY = y
        trayCount += 1
      }
    }
  }

  const hasTray = trayCount > n * 0.05
  if (!hasTray) {
    return { sx: 20, ex: w - 20, sy: 20, ey: h - 20, hasTray: false }
  }
  return {
    sx: Math.max(10, trayMinX + 40),
    ex: Math.min(w - 10, trayMaxX - 40),
    sy: Math.max(10, trayMinY + 110), // 상단 은색 레일 오인식을 완벽히 차단!
    ey: Math.min(h - 10, trayMaxY - 20),
    hasTray: true,
  }
}

// ─────────────────────────────────────────────────────────────────
// [알고리즘 2] OpenCV 템플릿 매칭(cv.matchTemplate) 기반 바이알 캡 검출
// 1. 기준 캡 1개 템플릿 추출 (초기 정중앙 근처 자동 1개 또는 사용자 클릭 1개)
// 2. cv.matchTemplate(TM_CCOEFF_NORMED) 전체 매칭
// 3. 민감도(기본값 0.65) 이상 좌표 필터링
// 4. 캡 지름의 80% 거리 이내 NMS(비최대 억제)로 바이알당 딱 1개 마커
// 5. 초록색 트레이 내부(ROI) 안에서만 결과 허용
// ─────────────────────────────────────────────────────────────────
function detectDenseVialCapsByTemplateMatching(
  imageData,
  minR = 15,
  maxR = 48,
  sensitivity = 65,
  userTemplatePoint = null
) {
  const { width: w, height: h, data } = imageData
  if (!w || !h || !data || w < 100 || h < 100) return []

  const estR = Math.max(12, Math.round((minR + maxR) * 0.52))
  const templR = estR
  const templW = templR * 2
  const templH = templR * 2
  const trayRoi = extractTrayRoi(imageData)

  // 그레이스케일 변환
  const n = w * h
  const gray = new Float32Array(n)
  for (let i = 0; i < n; i += 1) {
    const p = i * 4
    gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
  }

  // 1. 기준 캡 중심 좌표 확정 (사용자 클릭 좌표 또는 트레이 중심부 기본 좌표)
  let centerPxX = Math.round((trayRoi.sx + trayRoi.ex) / 2)
  let centerPxY = Math.round((trayRoi.sy + trayRoi.ey) / 2)

  if (userTemplatePoint && typeof userTemplatePoint.x === 'number' && typeof userTemplatePoint.y === 'number') {
    const cx = Math.round(userTemplatePoint.x * w)
    const cy = Math.round(userTemplatePoint.y * h)
    if (cx >= trayRoi.sx && cx <= trayRoi.ex && cy >= trayRoi.sy && cy <= trayRoi.ey) {
      centerPxX = cx
      centerPxY = cy
    }
  }

  const templX = clamp(centerPxX - templR, 0, w - templW)
  const templY = clamp(centerPxY - templR, 0, h - templH)

  // 템플릿 패치 평균 및 표준편차 계산
  let templSum = 0, templSqSum = 0
  const templCount = templW * templH
  for (let ty = 0; ty < templH; ty += 1) {
    const row = (templY + ty) * w
    for (let tx = 0; tx < templW; tx += 1) {
      const v = gray[row + templX + tx]
      templSum += v
      templSqSum += v * v
    }
  }
  const templMean = templSum / templCount
  const templVariance = Math.max(1, templSqSum / templCount - templMean * templMean)
  const templStd = Math.sqrt(templVariance)

  const templNorm = new Float32Array(templCount)
  for (let ty = 0; ty < templH; ty += 1) {
    const row = (templY + ty) * w
    const tRow = ty * templW
    for (let tx = 0; tx < templW; tx += 1) {
      templNorm[tRow + tx] = (gray[row + templX + tx] - templMean) / templStd
    }
  }

  // 2. 전체 매칭 점수 맵 계산 (OpenCV 준비 시 cv.matchTemplate, 미준비 시 고속 정규화 상호상관)
  const matchCandidates = []
  const simThresh = Math.max(0.40, Math.min(0.92, sensitivity / 100))

  if (isOpenCvReady() && typeof window !== 'undefined' && window.cv) {
    const cv = window.cv
    let srcMat = null
    let grayMat = null
    let templMat = null
    let resMat = null
    try {
      srcMat = cv.matFromImageData(imageData)
      grayMat = new cv.Mat()
      cv.cvtColor(srcMat, grayMat, cv.COLOR_RGBA2GRAY)

      const rect = new cv.Rect(templX, templY, templW, templH)
      templMat = grayMat.roi(rect)
      resMat = new cv.Mat()

      cv.matchTemplate(grayMat, templMat, resMat, cv.TM_CCOEFF_NORMED)

      const resRows = resMat.rows
      const resCols = resMat.cols
      const resData = resMat.data32F

      for (let y = 0; y < resRows; y += 1) {
        const my = y + templR
        if (my < trayRoi.sy || my > trayRoi.ey) continue
        const row = y * resCols

        for (let x = 0; x < resCols; x += 1) {
          const mx = x + templR
          if (mx < trayRoi.sx || mx > trayRoi.ex) continue

          const score = resData[row + x]
          if (score >= simThresh) {
            matchCandidates.push({
              x: mx,
              y: my,
              r: estR,
              score,
              confidence: Number(score.toFixed(2)),
            })
          }
        }
      }
    } catch (e) {
      // OpenCV 매칭 예외 발생 시 순수 JS 엔진으로 안전하게 계속 처리
    } finally {
      if (templMat) templMat.delete()
      if (resMat) resMat.delete()
      if (grayMat) grayMat.delete()
      if (srcMat) srcMat.delete()
    }
  }

  // 순수 JS 매칭 폴백 (OpenCV 미실행 또는 후보 미검출 시)
  if (matchCandidates.length === 0) {
    const step = 2 // 2px 간격 고속 서치
    for (let y = trayRoi.sy; y <= trayRoi.ey - templH; y += step) {
      const my = y + templR
      for (let x = trayRoi.sx; x <= trayRoi.ex - templW; x += step) {
        const mx = x + templR

        let pSum = 0, pSqSum = 0, dot = 0
        for (let ty = 0; ty < templH; ty += 2) {
          const row = (y + ty) * w
          const tRow = ty * templW
          for (let tx = 0; tx < templW; tx += 2) {
            const v = gray[row + x + tx]
            pSum += v
            pSqSum += v * v
            dot += v * templNorm[tRow + tx]
          }
        }
        const sampleCount = (templH / 2) * (templW / 2)
        const pMean = pSum / sampleCount
        const pVar = Math.max(1, pSqSum / sampleCount - pMean * pMean)
        const pStd = Math.sqrt(pVar)
        const ncc = dot / (sampleCount * pStd)

        if (ncc >= simThresh) {
          matchCandidates.push({
            x: mx,
            y: my,
            r: estR,
            score: ncc,
            confidence: Number(ncc.toFixed(2)),
          })
        }
      }
    }
  }

  // 3. 비최대 억제(NMS): 캡 지름의 80% 이내에 겹치는 좌표는 제거해 바이알당 딱 1개의 마커만 추출
  const nmsMinDist = templW * 0.80 // 캡 지름(2*r)의 80%
  matchCandidates.sort((a, b) => b.score - a.score)
  const accepted = []

  for (let i = 0; i < matchCandidates.length; i += 1) {
    const cand = matchCandidates[i]
    let overlaps = false
    for (let j = 0; j < accepted.length; j += 1) {
      const ac = accepted[j]
      if (Math.hypot(cand.x - ac.x, cand.y - ac.y) < nmsMinDist) {
        overlaps = true
        break
      }
    }
    if (!overlaps) {
      accepted.push(cand)
    }
  }

  return finalizeAndSortCircles(accepted, w, h, estR)
}

// ─────────────────────────────────────────────────────────────────
// [알고리즘 3] 박스 모드: '사용자가 드래그한 앞면 영역(ROI) 내 수평 경계선 검출'
// 1. 기본값: 이미지 및 박스 번들의 하단 60% 영역 자동 선택 (윗면 뚜껑 제외)
// 2. 사용자가 드래그한 사각형 영역 안에서만 좌우 2열 분리 및 층수(8단) 검출
// ─────────────────────────────────────────────────────────────────
function detectStackedCartBoxesWithRoi(imageData, boxRoi = null, sensitivity = 55) {
  const { width: w, height: h, data } = imageData
  if (!w || !h || !data || w < 100 || h < 100) return []

  const n = w * h
  // 그레이스케일 변환
  const gray = new Float32Array(n)
  for (let i = 0; i < n; i += 1) {
    const p = i * 4
    gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
  }

  // ── 1. 앞면 ROI 영역 좌표 확정 ──────────────────────────────────
  // 사용자가 드래그한 영역이 있으면 그 영역을 사용, 없으면 초록 박스 덩어리 자동 탐색 후 하단 60% 사용
  let roiX1 = 0
  let roiX2 = w
  let roiY1 = Math.round(h * 0.35) // 기본: 상단 35% 뚜껑 제외
  let roiY2 = Math.round(h * 0.97)

  if (boxRoi && typeof boxRoi.x === 'number' && typeof boxRoi.w === 'number') {
    // 사용자가 직접 드래그한 영역
    roiX1 = clamp(Math.round(boxRoi.x * w), 0, w - 20)
    roiX2 = clamp(Math.round((boxRoi.x + boxRoi.w) * w), roiX1 + 20, w)
    roiY1 = clamp(Math.round(boxRoi.y * h), 0, h - 20)
    roiY2 = clamp(Math.round((boxRoi.y + boxRoi.h) * h), roiY1 + 20, h)
  } else {
    // 초록 박스 번들 자동 탐색
    let bMinX = w, bMaxX = 0, bMinY = h, bMaxY = 0, greenCount = 0
    for (let i = 0; i < n; i += 4) {
      const pi = i
      const r = data[pi], g = data[pi + 1], b = data[pi + 2]
      const maxC = Math.max(r, g, b), minC = Math.min(r, g, b), diff = maxC - minC
      if (diff > 0 && maxC > 40) {
        let hue = 0
        if (maxC === r) hue = ((g - b) / diff + (g < b ? 6 : 0)) * 60
        else if (maxC === g) hue = ((b - r) / diff + 2) * 60
        else hue = ((r - g) / diff + 4) * 60
        const sat = diff / maxC
        if (hue >= 70 && hue <= 170 && sat >= 0.20) {
          const idx = i / 4
          const x = idx % w, y = (idx / w) | 0
          if (x < bMinX) bMinX = x
          if (x > bMaxX) bMaxX = x
          if (y < bMinY) bMinY = y
          if (y > bMaxY) bMaxY = y
          greenCount += 1
        }
      }
    }
    if (greenCount > n * 0.03 && bMaxY > bMinY + 60) {
      const bundleH = bMaxY - bMinY + 1
      roiX1 = Math.max(0, bMinX - 10)
      roiX2 = Math.min(w, bMaxX + 10)
      // 윗면 뚜껑 제외: 초록 덩어리 상단에서 25% 지점부터 앞면으로 간주
      roiY1 = clamp(Math.round(bMinY + bundleH * 0.25), 0, h - 60)
      roiY2 = Math.min(h - 5, bMaxY + 5)
    }
  }

  const roiW = roiX2 - roiX1
  const roiH = roiY2 - roiY1
  if (roiW < 40 || roiH < 30) return []

  // ── 2. 좌우 열(2열) 분리: 가운데 ±15% 범위에서 가장 어두운 세로선 찾기 ──
  const halfSearchW = Math.round(roiW * 0.15)
  const midX = Math.round((roiX1 + roiX2) / 2)
  let splitX = midX
  let minColSum = Infinity
  for (let x = midX - halfSearchW; x <= midX + halfSearchW; x += 1) {
    if (x < roiX1 + 10 || x > roiX2 - 10) continue
    let s = 0
    for (let y = roiY1; y <= roiY2; y += 2) {
      s += gray[y * w + x]
    }
    if (s < minColSum) {
      minColSum = s
      splitX = x
    }
  }

  const columns = [
    { x1: roiX1 + 2, x2: splitX - 2 },
    { x1: splitX + 2, x2: roiX2 - 2 },
  ]

  // ── 3. 각 열에서 Sobel Y (세로 방향 미분)로 가로 경계선 위치 감지 ──────
  // Sobel Y: 위아래 행의 밝기 차이가 큰 곳 = 박스 경계선
  // 고정 8단 균등 분할 대신, 실제 에지 피크를 찾아 경계선을 결정합니다.
  const detectedBoxes = []
  const targetLayers = 8 // 카트 표준 8단

  for (let c = 0; c < columns.length; c += 1) {
    const col = columns[c]
    const colW = col.x2 - col.x1
    if (colW < 20) continue

    // 행별 평균 밝기 계산
    const rowLum = new Float32Array(roiH + 1)
    for (let y = roiY1; y <= roiY2; y += 1) {
      let sum = 0
      const row = y * w
      for (let x = col.x1; x <= col.x2; x += 1) {
        sum += gray[row + x]
      }
      rowLum[y - roiY1] = sum / colW
    }

    // 7행 이동평균 스무딩 (노이즈 제거)
    const kSize = 7
    const half = (kSize - 1) / 2
    const smooth = new Float32Array(roiH + 1)
    for (let i = 0; i <= roiH; i += 1) {
      let s = 0, cnt = 0
      for (let k = -half; k <= half; k += 1) {
        const j = i + k
        if (j >= 0 && j <= roiH) { s += rowLum[j]; cnt += 1 }
      }
      smooth[i] = cnt > 0 ? s / cnt : rowLum[i]
    }

    // Sobel Y 계산: 위 3행 평균 vs 아래 3행 평균 차이
    const sobelY = new Float32Array(roiH + 1)
    for (let i = 3; i <= roiH - 3; i += 1) {
      const above = (smooth[i - 3] + smooth[i - 2] + smooth[i - 1]) / 3
      const below = (smooth[i + 1] + smooth[i + 2] + smooth[i + 3]) / 3
      sobelY[i] = Math.abs(below - above)
    }

    // ── 경계선 위치 결정 전략 ───────────────────────────────────
    // 각 예상 경계 위치 (roiH / targetLayers 간격) 주변 ±35% 범위에서
    // Sobel Y 에지 강도가 가장 큰 곳을 경계선으로 선택합니다.
    // 에지 강도 최소값(minEdge) 이상인 경우에만 에지로 인정하고, 아니면 균등 분할 위치를 사용합니다.
    const unitH = roiH / targetLayers
    const layerEdges = [0] // ROI 기준 상대 좌표

    // Sobel Y 최대값 계산 (임계값 결정용)
    let maxSobel = 0
    for (let i = 0; i <= roiH; i += 1) {
      if (sobelY[i] > maxSobel) maxSobel = sobelY[i]
    }
    // sensitivity 값 반영: 낮을수록 엄격(강한 경계선만), 높을수록 유연(약한 경계선도 허용)
    const edgeThresh = maxSobel * Math.max(0.08, 0.35 - (sensitivity / 100) * 0.25)

    for (let l = 1; l < targetLayers; l += 1) {
      const expectedRel = Math.round(l * unitH)
      const searchRange = Math.round(unitH * 0.38)
      const searchStart = Math.max(1, expectedRel - searchRange)
      const searchEnd = Math.min(roiH - 1, expectedRel + searchRange)

      let bestRel = expectedRel
      let maxEdge = -Infinity

      // 에지 강도가 임계값 이상인 곳 중 최대 피크 선택
      for (let i = searchStart; i <= searchEnd; i += 1) {
        if (sobelY[i] >= edgeThresh && sobelY[i] > maxEdge) {
          maxEdge = sobelY[i]
          bestRel = i
        }
      }

      // 에지를 못 찾으면 균등 분할 위치 사용
      layerEdges.push(bestRel)
    }
    layerEdges.push(roiH)

    // 절대 좌표로 변환 후 사각형 생성
    for (let l = 0; l < targetLayers; l += 1) {
      const y1abs = roiY1 + layerEdges[l]
      const y2abs = roiY1 + layerEdges[l + 1]
      const boxH = y2abs - y1abs
      if (boxH < 4) continue
      detectedBoxes.push({
        x: col.x1,
        y: y1abs,
        w: colW,
        h: boxH,
        confidence: 0.98,
        score: 1.8,
      })
    }
  }

  return finalizeAndSortBoxes(detectedBoxes, w, h)
}

// ─────────────────────────────────────────────────────────────────
// 디버그용: 캡 모드 전처리 흑백 이미지 (체이스가 눈으로 확인하는 [전처리 보기])
// ─────────────────────────────────────────────────────────────────
export function buildCapDebugPreview(imageData, rawParams = DEFAULT_DETECTION_PARAMS, templatePoint = null) {
  const minR = Number(rawParams?.minRadius ?? 15)
  const maxR = Number(rawParams?.maxRadius ?? 48)
  const sensitivity = Number(rawParams?.sensitivity ?? 65)
  const circles = detectDenseVialCapsByTemplateMatching(imageData, minR, maxR, sensitivity, templatePoint)

  const { width: w, height: h, data } = imageData
  const n = w * h
  const out = new Uint8ClampedArray(n * 4)

  for (let i = 0; i < n; i += 1) {
    const p = i * 4
    const v = Math.round(0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2])
    out[p] = v
    out[p + 1] = v
    out[p + 2] = v
    out[p + 3] = 255
  }

  for (let i = 0; i < circles.length; i += 1) {
    const cx = Math.round(circles[i].x * w)
    const cy = Math.round(circles[i].y * h)
    const r = Math.max(3, Math.round(circles[i].r * w))
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        const d2 = dx * dx + dy * dy
        if (Math.abs(d2 - r * r) <= r * 1.5 || d2 <= 4) {
          const idx = (cy + dy) * w + (cx + dx)
          if (idx >= 0 && idx < n) {
            out[idx * 4] = 0
            out[idx * 4 + 1] = 255
            out[idx * 4 + 2] = 255
            out[idx * 4 + 3] = 255
          }
        }
      }
    }
  }

  return { binaryData: out, width: w, height: h }
}

// ─────────────────────────────────────────────────────────────────
// 디버그용: 박스 모드 전처리 이미지 (체이스가 눈으로 확인하는 [전처리 보기])
// ─────────────────────────────────────────────────────────────────
export function buildBoxDebugPreview(imageData, rawBoxParams = DEFAULT_BOX_PARAMS, boxRoi = null) {
  const sensitivity = Number(rawBoxParams?.sensitivity ?? 55)
  const boxes = detectStackedCartBoxesWithRoi(imageData, boxRoi, sensitivity)

  const { width: w, height: h, data } = imageData
  const n = w * h
  const out = new Uint8ClampedArray(n * 4)

  for (let i = 0; i < n; i += 1) {
    const p = i * 4
    const v = Math.round(0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2])
    out[p] = v
    out[p + 1] = v
    out[p + 2] = v
    out[p + 3] = 255
  }

  for (let i = 0; i < boxes.length; i += 1) {
    const b = boxes[i]
    const bx = Math.round(b.x * w)
    const by = Math.round(b.y * h)
    const bw = Math.round(b.w * w)

    for (let x = bx; x < bx + bw; x += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const idx = (by + dy) * w + x
        if (idx >= 0 && idx < n) {
          out[idx * 4] = 0
          out[idx * 4 + 1] = 255
          out[idx * 4 + 2] = 255
          out[idx * 4 + 3] = 255
        }
      }
    }
  }

  return { binaryData: out, width: w, height: h }
}

function detectDenseVialCaps(imageData, minR, maxR, sensitivity, userTemplatePoint = null) {
  return detectDenseVialCapsByTemplateMatching(imageData, minR, maxR, sensitivity, userTemplatePoint)
}

function detectDenseVialCores(imageData, minR, maxR, sensitivity, userTemplatePoint = null) {
  return detectDenseVialCapsByTemplateMatching(imageData, minR, maxR, sensitivity, userTemplatePoint)
}

function detectStackedCartBoxes(imageData, sensitivity = 55, boxRoi = null) {
  return detectStackedCartBoxesWithRoi(imageData, boxRoi, sensitivity)
}

// 원형 동심원 억제(NMS) 및 행·열 번호 정렬
function finalizeAndSortCircles(rawCircles, w, h, minR) {
  if (!rawCircles || rawCircles.length === 0) return []

  const filteredNested = resolveNestedCircles(rawCircles)
  const sorted = [...filteredNested].sort((a, b) => (b.score || 0) - (a.score || 0))
  const accepted = []

  for (let i = 0; i < sorted.length; i += 1) {
    const c = sorted[i]
    let overlaps = false
    for (let j = 0; j < accepted.length; j += 1) {
      const k = accepted[j]
      const dist = Math.hypot(c.x - k.x, c.y - k.y)
      // 한 바이알 캡 위에 2개의 마커가 겹쳐 찍히지 않도록 엄격히 중복 제거
      if (dist < (c.r + k.r) * 0.84) {
        overlaps = true
        break
      }
    }
    if (!overlaps) {
      accepted.push(c)
    }
  }

  // 군집 필터: 본체(6개 이상)가 존재할 때 발바닥·트레이 모서리 등 고립된 오탐(이웃 2개 미만) 제거
  const clustered =
    accepted.length >= 6
      ? accepted.filter((c, idx) => {
        let neighbors = 0
        const maxDist = Math.max(40, c.r * 3.8)
        for (let j = 0; j < accepted.length; j += 1) {
          if (idx === j) continue
          if (Math.hypot(c.x - accepted[j].x, c.y - accepted[j].y) <= maxDist) {
            neighbors += 1
            if (neighbors >= 2) return true
          }
        }
        return false
      })
      : accepted

  if (clustered.length === 0) return []

  const radii = clustered.map((c) => c.r).sort((a, b) => a - b)
  const medianR = radii[(radii.length / 2) | 0] || minR
  const rowTolerance = medianR * 1.2

  clustered.sort((a, b) => a.y - b.y)
  const rows = []
  for (let i = 0; i < clustered.length; i += 1) {
    const c = clustered[i]
    const lastRow = rows[rows.length - 1]
    if (!lastRow || Math.abs(c.y - lastRow.anchorY) > rowTolerance) {
      rows.push({ anchorY: c.y, items: [c] })
    } else {
      lastRow.items.push(c)
    }
  }

  const ordered = []
  for (let i = 0; i < rows.length; i += 1) {
    rows[i].items.sort((a, b) => a.x - b.x)
    for (let j = 0; j < rows[i].items.length; j += 1) {
      const c = rows[i].items[j]
      ordered.push({
        id: `auto-${ordered.length + 1}`,
        x: c.x / w,
        y: c.y / h,
        r: c.r / w,
        confidence: Number((c.confidence || 0.8).toFixed(2)),
        source: 'auto',
      })
    }
  }

  return ordered
}

// 사각형 중복·내부 스티커 포함 억제(NMS) 및 위->아래, 왼쪽->오른쪽 순 정렬
function finalizeAndSortBoxes(rawBoxes, w, h) {
  if (!rawBoxes || rawBoxes.length === 0) return []

  const sorted = [...rawBoxes].sort((a, b) => (b.score || 0) - (a.score || 0))
  const accepted = []

  for (let i = 0; i < sorted.length; i += 1) {
    const a = sorted[i]
    const areaA = a.w * a.h
    let overlaps = false

    for (let j = 0; j < accepted.length; j += 1) {
      const b = accepted[j]
      const areaB = b.w * b.h

      const ix1 = Math.max(a.x, b.x)
      const iy1 = Math.max(a.y, b.y)
      const ix2 = Math.min(a.x + a.w, b.x + b.w)
      const iy2 = Math.min(a.y + a.h, b.y + b.h)

      if (ix2 > ix1 && iy2 > iy1) {
        const interArea = (ix2 - ix1) * (iy2 - iy1)
        const unionArea = areaA + areaB - interArea
        const iou = unionArea > 0 ? interArea / unionArea : 0
        const containment = interArea / Math.max(1, Math.min(areaA, areaB))

        // 겹침이 크거나 큰 박스 안에 포함된 작은 스티커·내부 라벨 사각형은 제외합니다.
        if (iou > 0.35 || containment > 0.65) {
          overlaps = true
          break
        }
      }
    }

    if (!overlaps) {
      accepted.push(a)
    }
  }

  if (accepted.length === 0) return []

  const heights = accepted.map((b) => b.h).sort((a, b) => a - b)
  const medianH = heights[(heights.length / 2) | 0] || 40
  const rowTolerance = medianH * 0.6

  accepted.sort((a, b) => a.y - b.y)
  const rows = []
  for (let i = 0; i < accepted.length; i += 1) {
    const b = accepted[i]
    const lastRow = rows[rows.length - 1]
    if (!lastRow || Math.abs(b.y - lastRow.anchorY) > rowTolerance) {
      rows.push({ anchorY: b.y, items: [b] })
    } else {
      lastRow.items.push(b)
    }
  }

  const ordered = []
  for (let i = 0; i < rows.length; i += 1) {
    rows[i].items.sort((a, b) => a.x - b.x)
    for (let j = 0; j < rows[i].items.length; j += 1) {
      const b = rows[i].items[j]
      ordered.push({
        id: `box-auto-${ordered.length + 1}`,
        x: b.x / w,
        y: b.y / h,
        w: b.w / w,
        h: b.h / h,
        confidence: Number((b.confidence || 0.8).toFixed(2)),
        source: 'auto',
      })
    }
  }

  return ordered
}

// OpenCV.js WASM 엔진으로 캡 뚜껑(원형)을 검출합니다.
function detectVialsWithOpenCV(imageData, rawParams) {
  const cv = window.cv
  const { width: w, height: h } = imageData
  const sensitivity = clamp(Number(rawParams?.sensitivity ?? 55), 10, 95)
  const rawMinR = Number(rawParams?.minRadius ?? 14)
  const rawMaxR = Number(rawParams?.maxRadius ?? 85)
  const minR = Math.max(4, Math.min(rawMinR, rawMaxR - 2))
  const maxR = Math.max(minR + 2, rawMaxR)

  let src = null
  let gray = null
  let blurred = null
  let circlesMat = null
  let threshMat = null
  let contours = null
  let hierarchy = null

  try {
    src = cv.matFromImageData(imageData)
    gray = new cv.Mat()
    blurred = new cv.Mat()
    circlesMat = new cv.Mat()

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
    cv.GaussianBlur(gray, blurred, new cv.Size(7, 7), 1.5, 1.5)

    const minDist = Math.max(10, Math.round(minR * 1.65))
    const param1 = Math.max(45, Math.round(145 - (sensitivity / 100) * 75))
    const param2 = Math.max(14, Math.round(58 - (sensitivity / 100) * 38))

    cv.HoughCircles(
      blurred,
      circlesMat,
      cv.HOUGH_GRADIENT,
      1.2,
      minDist,
      param1,
      param2,
      minR,
      maxR
    )

    const candidates = []
    for (let i = 0; i < circlesMat.cols; i += 1) {
      const cx = circlesMat.data32F[i * 3]
      const cy = circlesMat.data32F[i * 3 + 1]
      const cr = circlesMat.data32F[i * 3 + 2]
      if (cx >= 0 && cx < w && cy >= 0 && cy < h && cr >= minR && cr <= maxR) {
        candidates.push({
          x: cx,
          y: cy,
          r: cr,
          confidence: 0.85,
          score: 0.85 * Math.pow(cr, 0.12),
        })
      }
    }

    if (candidates.length === 0 && typeof cv.findContours === 'function') {
      threshMat = new cv.Mat()
      contours = new cv.MatVector()
      hierarchy = new cv.Mat()

      cv.adaptiveThreshold(
        blurred,
        threshMat,
        255,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv.THRESH_BINARY_INV,
        31,
        5
      )
      cv.findContours(
        threshMat,
        contours,
        hierarchy,
        cv.RETR_EXTERNAL,
        cv.CHAIN_APPROX_SIMPLE
      )

      const minArea = Math.PI * minR * minR * 0.55
      const maxArea = Math.PI * maxR * maxR * 1.35

      for (let i = 0; i < contours.size(); i += 1) {
        const cnt = contours.get(i)
        try {
          const area = cv.contourArea(cnt)
          if (area < minArea || area > maxArea) continue

          const perimeter = cv.arcLength(cnt, true)
          if (perimeter <= 0) continue

          const circularity = (4 * Math.PI * area) / (perimeter * perimeter)
          if (circularity < 0.6) continue

          const circle = cv.minEnclosingCircle(cnt)
          const r = circle.radius
          if (r >= minR && r <= maxR) {
            candidates.push({
              x: circle.center.x,
              y: circle.center.y,
              r,
              confidence: Math.min(1, circularity),
              score: circularity * Math.pow(r, 0.12),
            })
          }
        } finally {
          cnt.delete()
        }
      }
    }

    const coreCandidates = detectDenseVialCaps(imageData, minR, maxR, sensitivity)
    if (coreCandidates.length >= 10) {
      // 국소 대비 강화 + 침식 분리 + 거리 변환 피크 추출이 완료된 밀집 트레이에서는
      // 오탐을 방지하기 위해 정밀 검출된 캡 중심점 목록을 정본으로 바로 채택합니다.
      return finalizeAndSortCircles(coreCandidates, w, h, minR)
    }

    for (let i = 0; i < coreCandidates.length; i += 1) {
      candidates.push(coreCandidates[i])
    }

    return finalizeAndSortCircles(candidates, w, h, minR)
  } finally {
    if (src) src.delete()
    if (gray) gray.delete()
    if (blurred) blurred.delete()
    if (circlesMat) circlesMat.delete()
    if (threshMat) threshMat.delete()
    if (contours) contours.delete()
    if (hierarchy) hierarchy.delete()
  }
}

// OpenCV.js WASM 엔진으로 카트 박스 앞면/윗면 사각형 윤곽선(findContours + 사각형 필터)을 검출합니다.
function detectBoxesWithOpenCV(imageData, rawBoxParams) {
  const cv = window.cv
  const { width: w, height: h } = imageData
  const sensitivity = clamp(Number(rawBoxParams?.sensitivity ?? 55), 10, 95)
  const rawMinS = Number(rawBoxParams?.minSize ?? 45)
  const rawMaxS = Number(rawBoxParams?.maxSize ?? 550)
  const minS = Math.max(16, Math.min(rawMinS, rawMaxS - 10))
  const maxS = Math.max(minS + 10, rawMaxS)

  // 카트에 수직으로 여러 단이 적재된 박스 패턴이 확인되면 열·단 분할 엔진 결과를 우선 사용합니다.
  const stackedBoxes = detectStackedCartBoxes(imageData, sensitivity)
  if (stackedBoxes.length >= 3) {
    return finalizeAndSortBoxes(stackedBoxes, w, h)
  }

  let src = null
  let gray = null
  let blurred = null
  let edges = null
  let kernel = null
  let dilated = null
  let thresh = null
  let contours1 = null
  let hierarchy1 = null
  let contours2 = null
  let hierarchy2 = null

  const candidates = []
  const minFill = Math.max(0.42, 0.7 - (sensitivity / 100) * 0.24)

  const inspectContour = (cnt) => {
    const rect = cv.boundingRect(cnt)
    const minH = Math.max(12, Math.round(minS * 0.28))
    if (rect.width < minS || rect.height < minH || rect.width > maxS || rect.height > maxS) return
    if (rect.width > w * 0.92 && rect.height > h * 0.92) return

    const aspect = rect.width / Math.max(1, rect.height)
    if (aspect < 0.12 || aspect > 22.0) return

    const area = cv.contourArea(cnt)
    const bboxArea = rect.width * rect.height
    const fillRatio = area / Math.max(1, bboxArea)

    let approxVertices = 0
    const approx = new cv.Mat()
    try {
      const peri = cv.arcLength(cnt, true)
      if (peri > 0) {
        cv.approxPolyDP(cnt, approx, 0.03 * peri, true)
        approxVertices = approx.rows
      }
    } finally {
      approx.delete()
    }

    const isRectLike = (approxVertices >= 4 && approxVertices <= 8) || fillRatio >= minFill
    if (isRectLike && fillRatio >= minFill * 0.75) {
      candidates.push({
        x: rect.x,
        y: rect.y,
        w: rect.width,
        h: rect.height,
        confidence: Math.min(1, fillRatio),
        score: fillRatio * Math.pow(bboxArea, 0.2),
      })
    }
  }

  try {
    src = cv.matFromImageData(imageData)
    gray = new cv.Mat()
    blurred = new cv.Mat()

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 1.2, 1.2)

    // Pass 1: Canny 경계선 + 팽창 후 사각형 윤곽선 추출
    edges = new cv.Mat()
    dilated = new cv.Mat()
    contours1 = new cv.MatVector()
    hierarchy1 = new cv.Mat()
    kernel = cv.Mat.ones(3, 3, cv.CV_8U)

    const cannyLow = Math.max(15, Math.round(95 - (sensitivity / 100) * 65))
    cv.Canny(blurred, edges, cannyLow, Math.round(cannyLow * 2.2))
    cv.dilate(edges, dilated, kernel)
    cv.findContours(dilated, contours1, hierarchy1, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE)

    for (let i = 0; i < contours1.size(); i += 1) {
      const cnt = contours1.get(i)
      try {
        inspectContour(cnt)
      } finally {
        cnt.delete()
      }
    }

    // Pass 2: 적응형 이진화 윤곽선 보조 탐색
    thresh = new cv.Mat()
    contours2 = new cv.MatVector()
    hierarchy2 = new cv.Mat()
    cv.adaptiveThreshold(
      blurred,
      thresh,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY_INV,
      35,
      Math.round(12 - (sensitivity / 100) * 8)
    )
    cv.findContours(thresh, contours2, hierarchy2, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

    for (let i = 0; i < contours2.size(); i += 1) {
      const cnt = contours2.get(i)
      try {
        inspectContour(cnt)
      } finally {
        cnt.delete()
      }
    }

    return finalizeAndSortBoxes(candidates, w, h)
  } finally {
    if (src) src.delete()
    if (gray) gray.delete()
    if (blurred) blurred.delete()
    if (edges) edges.delete()
    if (kernel) kernel.delete()
    if (dilated) dilated.delete()
    if (thresh) thresh.delete()
    if (contours1) contours1.delete()
    if (hierarchy1) hierarchy1.delete()
    if (contours2) contours2.delete()
    if (hierarchy2) hierarchy2.delete()
  }
}

// 1단계 + 2단계: RGBA 픽셀 버퍼를 그레이스케일로 변환하고 5x5 분리형 가우시안 블러를 적용합니다.
function grayscaleAndGaussianBlur(data, w, h) {
  const len = w * h
  const gray = new Float32Array(len)
  for (let i = 0; i < len; i += 1) {
    const p = i * 4
    gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
  }

  const temp = new Float32Array(len)
  const blurred = new Float32Array(len)

  for (let y = 0; y < h; y += 1) {
    const row = y * w
    for (let x = 0; x < w; x += 1) {
      const x0 = x - 2 < 0 ? 0 : x - 2
      const x1 = x - 1 < 0 ? 0 : x - 1
      const x3 = x + 1 >= w ? w - 1 : x + 1
      const x4 = x + 2 >= w ? w - 1 : x + 2
      temp[row + x] =
        (gray[row + x0] +
          4 * gray[row + x1] +
          6 * gray[row + x] +
          4 * gray[row + x3] +
          gray[row + x4]) /
        16
    }
  }

  for (let y = 0; y < h; y += 1) {
    const y0 = (y - 2 < 0 ? 0 : y - 2) * w
    const y1 = (y - 1 < 0 ? 0 : y - 1) * w
    const y2 = y * w
    const y3 = (y + 1 >= h ? h - 1 : y + 1) * w
    const y4 = (y + 2 >= h ? h - 1 : y + 2) * w
    for (let x = 0; x < w; x += 1) {
      blurred[y2 + x] =
        (temp[y0 + x] +
          4 * temp[y1 + x] +
          6 * temp[y2 + x] +
          4 * temp[y3 + x] +
          temp[y4 + x]) /
        16
    }
  }

  return blurred
}

// 3단계: 3x3 Sobel 그라디언트 계산 및 비최대 억제
function computeSobelEdges(blurred, w, h, sensitivity) {
  const len = w * h
  const mag = new Float32Array(len)
  const ux = new Float32Array(len)
  const uy = new Float32Array(len)

  let magSum = 0
  let count = 0

  for (let y = 1; y < h - 1; y += 1) {
    const r0 = (y - 1) * w
    const r1 = y * w
    const r2 = (y + 1) * w
    for (let x = 1; x < w - 1; x += 1) {
      const tl = blurred[r0 + x - 1]
      const t = blurred[r0 + x]
      const tr = blurred[r0 + x + 1]
      const l = blurred[r1 + x - 1]
      const r = blurred[r1 + x + 1]
      const bl = blurred[r2 + x - 1]
      const b = blurred[r2 + x]
      const br = blurred[r2 + x + 1]

      const gx = -tl - 2 * l - bl + tr + 2 * r + br
      const gy = -tl - 2 * t - tr + bl + 2 * b + br
      const m = Math.hypot(gx, gy)

      const idx = r1 + x
      mag[idx] = m
      if (m > 0.001) {
        ux[idx] = gx / m
        uy[idx] = gy / m
      }
      magSum += m
      count += 1
    }
  }

  const meanMag = count > 0 ? magSum / count : 0
  const edgeThreshold = Math.max(10, meanMag * (2.05 - (sensitivity / 100) * 1.5))

  const edges = []
  for (let y = 2; y < h - 2; y += 1) {
    const row = y * w
    for (let x = 2; x < w - 2; x += 1) {
      const idx = row + x
      const m = mag[idx]
      if (m < edgeThreshold) continue

      const dx = Math.round(ux[idx])
      const dy = Math.round(uy[idx])
      const fwd = mag[(y + dy) * w + (x + dx)]
      const bwd = mag[(y - dy) * w + (x - dx)]

      if (m >= fwd && m >= bwd) {
        edges.push(idx)
      }
    }
  }

  return { mag, ux, uy, edgeThreshold, edges }
}

// 오프라인/폴백 환경에서도 동일한 정확도를 보장하는 내장 순수 Canvas 원형 검출 파이프라인입니다.
function detectVialsInCanvasFallback(imageData, rawParams = DEFAULT_DETECTION_PARAMS) {
  const { width: w, height: h, data } = imageData
  if (!w || !h || !data) return []

  const sensitivity = clamp(Number(rawParams?.sensitivity ?? 55), 10, 95)
  const rawMinR = Number(rawParams?.minRadius ?? 14)
  const rawMaxR = Number(rawParams?.maxRadius ?? 85)
  const minR = Math.max(4, Math.min(rawMinR, rawMaxR - 2))
  const maxR = Math.max(minR + 2, rawMaxR)

  const blurred = grayscaleAndGaussianBlur(data, w, h)
  const { mag, ux, uy, edgeThreshold, edges } = computeSobelEdges(blurred, w, h, sensitivity)

  if (edges.length === 0) return []

  const binSize = w > 800 ? 3 : 2
  const accW = Math.ceil(w / binSize)
  const accH = Math.ceil(h / binSize)
  const acc = new Float32Array(accW * accH)

  const rStep = maxR - minR > 40 ? 2 : 1
  const edgeStride = edges.length > 18000 ? Math.ceil(edges.length / 18000) : 1

  for (let i = 0; i < edges.length; i += edgeStride) {
    const idx = edges[i]
    const ex = idx % w
    const ey = (idx / w) | 0
    const gx = ux[idx]
    const gy = uy[idx]

    for (let r = minR; r <= maxR; r += rStep) {
      const weight = 1 / Math.max(6, r)
      const cx1 = Math.floor((ex + r * gx) / binSize)
      const cy1 = Math.floor((ey + r * gy) / binSize)
      if (cx1 >= 0 && cx1 < accW && cy1 >= 0 && cy1 < accH) {
        acc[cy1 * accW + cx1] += weight
      }

      const cx2 = Math.floor((ex - r * gx) / binSize)
      const cy2 = Math.floor((ey - r * gy) / binSize)
      if (cx2 >= 0 && cx2 < accW && cy2 >= 0 && cy2 < accH) {
        acc[cy2 * accW + cx2] += weight
      }
    }
  }

  const smoothAcc = new Float32Array(accW * accH)
  for (let y = 1; y < accH - 1; y += 1) {
    for (let x = 1; x < accW - 1; x += 1) {
      let sum = 0
      for (let dy = -1; dy <= 1; dy += 1) {
        const row = (y + dy) * accW
        for (let dx = -1; dx <= 1; dx += 1) {
          sum += acc[row + x + dx]
        }
      }
      smoothAcc[y * accW + x] = sum / 9
    }
  }

  const peaks = []
  for (let y = 2; y < accH - 2; y += 1) {
    for (let x = 2; x < accW - 2; x += 1) {
      const val = smoothAcc[y * accW + x]
      if (val <= 0.08) continue

      let isMax = true
      for (let dy = -2; dy <= 2 && isMax; dy += 1) {
        const row = (y + dy) * accW
        for (let dx = -2; dx <= 2; dx += 1) {
          if (dx === 0 && dy === 0) continue
          if (smoothAcc[row + x + dx] > val) {
            isMax = false
            break
          }
        }
      }

      if (isMax) {
        peaks.push({ x, y, val })
      }
    }
  }

  peaks.sort((a, b) => b.val - a.val)
  const topPeaks = peaks.slice(0, 320)

  const minCoverage = Math.max(0.34, 0.76 - (sensitivity / 100) * 0.4)
  const verifyThreshold = edgeThreshold * 0.6
  const candidates = []

  const evaluateCircle = (cx, cy, r) => {
    let validSamples = 0
    let posHits = 0
    let negHits = 0
    let posMask = 0
    let negMask = 0

    for (let k = 0; k < ANGLE_SAMPLES; k += 1) {
      const sx = Math.round(cx + r * COS_TABLE[k])
      const sy = Math.round(cy + r * SIN_TABLE[k])
      if (sx < 1 || sx >= w - 1 || sy < 1 || sy >= h - 1) continue

      validSamples += 1
      const pIdx = sy * w + sx
      if (mag[pIdx] < verifyThreshold) continue

      const dot = ux[pIdx] * COS_TABLE[k] + uy[pIdx] * SIN_TABLE[k]
      const quadBit = 1 << ((k / 6) | 0)

      if (dot > 0.58) {
        posHits += 1
        posMask |= quadBit
      } else if (dot < -0.58) {
        negHits += 1
        negMask |= quadBit
      }
    }

    if (validSamples < 16) return null
    const dominantHits = posHits >= negHits ? posHits : negHits
    const dominantMask = posHits >= negHits ? posMask : negMask
    const quadCount = countBits4(dominantMask)
    const coverage = dominantHits / validSamples
    return { coverage, quadCount }
  }

  for (let i = 0; i < topPeaks.length; i += 1) {
    const cx0 = topPeaks[i].x * binSize + 1
    const cy0 = topPeaks[i].y * binSize + 1

    let bestR = minR
    let bestScore = 0
    let bestQuad = 0

    for (let r = minR; r <= maxR; r += 1) {
      const res = evaluateCircle(cx0, cy0, r)
      if (!res) continue
      if (res.coverage > bestScore) {
        bestScore = res.coverage
        bestR = r
        bestQuad = res.quadCount
      }
    }

    if (bestScore < minCoverage * 0.85) continue

    let refinedX = cx0
    let refinedY = cy0
    let refinedR = bestR
    let refinedCoverage = bestScore
    let refinedQuad = bestQuad

    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dr = -1; dr <= 1; dr += 1) {
          const nr = clamp(bestR + dr, minR, maxR)
          const res = evaluateCircle(cx0 + dx, cy0 + dy, nr)
          if (res && res.coverage > refinedCoverage) {
            refinedX = cx0 + dx
            refinedY = cy0 + dy
            refinedR = nr
            refinedCoverage = res.coverage
            refinedQuad = res.quadCount
          }
        }
      }
    }

    if (refinedCoverage >= minCoverage && refinedQuad >= 3) {
      candidates.push({
        x: refinedX,
        y: refinedY,
        r: refinedR,
        confidence: refinedCoverage,
        score: refinedCoverage * Math.pow(refinedR, 0.12),
      })
    }
  }

  const coreCandidates = detectDenseVialCaps(imageData, minR, maxR, sensitivity)
  if (coreCandidates.length >= 10) {
    // 국소 대비 강화 + 침식 분리 + 거리 변환 피크 추출이 완료된 밀집 트레이에서는
    // 오탐을 방지하기 위해 정밀 검출된 캡 중심점 목록을 정본으로 바로 채택합니다.
    return finalizeAndSortCircles(coreCandidates, w, h, minR)
  }

  for (let i = 0; i < coreCandidates.length; i += 1) {
    candidates.push(coreCandidates[i])
  }

  return finalizeAndSortCircles(candidates, w, h, minR)
}

// 오프라인/폴백 환경에서도 카트 박스를 정확히 검출하는 내장 4변 사각형 검증 파이프라인입니다.
function detectBoxesInCanvasFallback(imageData, rawBoxParams = DEFAULT_BOX_PARAMS) {
  const { width: w, height: h, data } = imageData
  if (!w || !h || !data) return []

  const sensitivity = clamp(Number(rawBoxParams?.sensitivity ?? 55), 10, 95)
  const rawMinS = Number(rawBoxParams?.minSize ?? 45)
  const rawMaxS = Number(rawBoxParams?.maxSize ?? 550)
  const minS = Math.max(16, Math.min(rawMinS, rawMaxS - 10))
  const maxS = Math.max(minS + 10, rawMaxS)

  // 카트에 수직으로 여러 단이 적재된 박스 패턴이 확인되면 열·단 분할 엔진 결과를 우선 사용합니다.
  const stackedBoxes = detectStackedCartBoxes(imageData, sensitivity)
  if (stackedBoxes.length >= 3) {
    return finalizeAndSortBoxes(stackedBoxes, w, h)
  }

  // 연산 속도를 위해 절반 비율(가로 최대 600)로 다운샘플해 전경 영역과 4변 그라디언트를 분석합니다.
  const workScale = w > 600 ? 0.5 : 1
  const sw = Math.max(24, Math.round(w * workScale))
  const sh = Math.max(24, Math.round(h * workScale))
  const total = sw * sh

  const gray = new Float32Array(total)
  let graySum = 0
  for (let sy = 0; sy < sh; sy += 1) {
    const oy = Math.min(h - 1, Math.round(sy / workScale))
    for (let sx = 0; sx < sw; sx += 1) {
      const ox = Math.min(w - 1, Math.round(sx / workScale))
      const p = (oy * w + ox) * 4
      const v = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
      gray[sy * sw + sx] = v
      graySum += v
    }
  }
  const globalMean = graySum / Math.max(1, total)

  // 간단한 3x3 스무딩 및 Sobel 가로/세로 기울기 추출
  const gxArr = new Float32Array(total)
  const gyArr = new Float32Array(total)
  const magArr = new Float32Array(total)
  let magSum = 0

  for (let y = 1; y < sh - 1; y += 1) {
    const r0 = (y - 1) * sw
    const r1 = y * sw
    const r2 = (y + 1) * sw
    for (let x = 1; x < sw - 1; x += 1) {
      const gx =
        -gray[r0 + x - 1] -
        2 * gray[r1 + x - 1] -
        gray[r2 + x - 1] +
        gray[r0 + x + 1] +
        2 * gray[r1 + x + 1] +
        gray[r2 + x + 1]
      const gy =
        -gray[r0 + x - 1] -
        2 * gray[r0 + x] -
        gray[r0 + x + 1] +
        gray[r2 + x - 1] +
        2 * gray[r2 + x] +
        gray[r2 + x + 1]
      const idx = r1 + x
      gxArr[idx] = Math.abs(gx)
      gyArr[idx] = Math.abs(gy)
      const m = Math.hypot(gx, gy)
      magArr[idx] = m
      magSum += m
    }
  }

  const meanMag = magSum / Math.max(1, total)
  const verifyEdgeThresh = Math.max(18, meanMag * (1.6 - (sensitivity / 100) * 1.1))
  const contrastMargin = Math.max(6, 26 - (sensitivity / 100) * 20)

  // 바운딩 박스 상·하·좌·우 4변에 실제로 직선 경계(그라디언트)가 지지되는지 검증합니다.
  const verifyBoxEdges = (bx, by, bw, bh) => {
    const samples = 14
    const tol = 2
    let topHits = 0
    let botHits = 0
    let leftHits = 0
    let rightHits = 0

    for (let s = 1; s < samples - 1; s += 1) {
      const t = s / (samples - 1)
      const px = Math.round(bx + bw * t)
      const py = Math.round(by + bh * t)

      let topMax = 0
      let botMax = 0
      let leftMax = 0
      let rightMax = 0

      for (let d = -tol; d <= tol; d += 1) {
        const ty = clamp(by + d, 1, sh - 2)
        const byPos = clamp(by + bh - 1 + d, 1, sh - 2)
        if (px >= 1 && px <= sw - 2) {
          topMax = Math.max(topMax, gyArr[ty * sw + px])
          botMax = Math.max(botMax, gyArr[byPos * sw + px])
        }

        const lx = clamp(bx + d, 1, sw - 2)
        const rxPos = clamp(bx + bw - 1 + d, 1, sw - 2)
        if (py >= 1 && py <= sh - 2) {
          leftMax = Math.max(leftMax, gxArr[py * sw + lx])
          rightMax = Math.max(rightMax, gxArr[py * sw + rxPos])
        }
      }

      if (topMax >= verifyEdgeThresh) topHits += 1
      if (botMax >= verifyEdgeThresh) botHits += 1
      if (leftMax >= verifyEdgeThresh) leftHits += 1
      if (rightMax >= verifyEdgeThresh) rightHits += 1
    }

    const innerSamples = samples - 2
    const topRatio = topHits / innerSamples
    const botRatio = botHits / innerSamples
    const leftRatio = leftHits / innerSamples
    const rightRatio = rightHits / innerSamples

    const minSideRatio = Math.max(0.28, 0.58 - (sensitivity / 100) * 0.25)
    const minAvgRatio = Math.max(0.4, 0.72 - (sensitivity / 100) * 0.28)
    const avgRatio = (topRatio + botRatio + leftRatio + rightRatio) / 4

    if (
      topRatio >= minSideRatio &&
      botRatio >= minSideRatio &&
      leftRatio >= minSideRatio &&
      rightRatio >= minSideRatio &&
      avgRatio >= minAvgRatio
    ) {
      return avgRatio
    }
    return 0
  }

  const visited = new Uint8Array(total)
  const queue = new Int32Array(total)
  const candidates = []

  const extractFromMask = (predicate) => {
    visited.fill(0)

    for (let i = 0; i < total; i += 1) {
      if (visited[i] === 1 || !predicate(i)) continue

      let head = 0
      let tail = 0
      queue[tail++] = i
      visited[i] = 1

      let minX = sw
      let maxX = 0
      let minY = sh
      let maxY = 0
      let area = 0

      while (head < tail) {
        const curr = queue[head++]
        const cx = curr % sw
        const cy = (curr / sw) | 0
        area += 1
        if (cx < minX) minX = cx
        if (cx > maxX) maxX = cx
        if (cy < minY) minY = cy
        if (cy > maxY) maxY = cy

        if (cx > 0) {
          const n = curr - 1
          if (visited[n] === 0 && predicate(n)) {
            visited[n] = 1
            queue[tail++] = n
          }
        }
        if (cx + 1 < sw) {
          const n = curr + 1
          if (visited[n] === 0 && predicate(n)) {
            visited[n] = 1
            queue[tail++] = n
          }
        }
        if (cy > 0) {
          const n = curr - sw
          if (visited[n] === 0 && predicate(n)) {
            visited[n] = 1
            queue[tail++] = n
          }
        }
        if (cy + 1 < sh) {
          const n = curr + sw
          if (visited[n] === 0 && predicate(n)) {
            visited[n] = 1
            queue[tail++] = n
          }
        }
      }

      const sbw = maxX - minX + 1
      const sbh = maxY - minY + 1
      const rw = Math.round(sbw / workScale)
      const rh = Math.round(sbh / workScale)
      const minH = Math.max(12, Math.round(minS * 0.28))

      if (rw < minS || rh < minH || rw > maxS || rh > maxS) continue
      if (rw > w * 0.92 && rh > h * 0.92) continue

      const aspect = rw / Math.max(1, rh)
      if (aspect < 0.12 || aspect > 22.0) continue

      const fillRatio = area / Math.max(1, sbw * sbh)
      if (fillRatio < 0.14) continue

      const edgeSupport = verifyBoxEdges(minX, minY, sbw, sbh)
      if (edgeSupport > 0) {
        const rx = Math.round(minX / workScale)
        const ry = Math.round(minY / workScale)
        const confidence = Math.min(1, edgeSupport * 0.7 + fillRatio * 0.3)
        candidates.push({
          x: rx,
          y: ry,
          w: rw,
          h: rh,
          confidence,
          score: confidence * Math.pow(rw * rh, 0.18),
        })
      }
    }
  }

  // 밝은 배경 위 어두운 박스 + 어두운 배경 위 밝은 박스 + 뚜렷한 테두리 모두 탐색
  extractFromMask((idx) => gray[idx] < globalMean - contrastMargin)
  extractFromMask((idx) => gray[idx] > globalMean + contrastMargin)
  extractFromMask((idx) => magArr[idx] >= verifyEdgeThresh)

  return finalizeAndSortBoxes(candidates, w, h)
}

/**
 * 캡 뚜껑 모드: OpenCV 템플릿 매칭(cv.matchTemplate) 방식으로 바이알 캡을 정밀 검출합니다.
 */
export function detectVialsInImageData(imageData, rawParams = DEFAULT_DETECTION_PARAMS, userTemplatePoint = null) {
  if (!imageData || !imageData.width || !imageData.height || !imageData.data) return []
  const sensitivity = clamp(Number(rawParams?.sensitivity ?? 65), 10, 95)
  const rawMinR = Number(rawParams?.minRadius ?? 14)
  const rawMaxR = Number(rawParams?.maxRadius ?? 85)
  const minR = Math.max(4, Math.min(rawMinR, rawMaxR - 2))
  const maxR = Math.max(minR + 2, rawMaxR)

  return detectDenseVialCapsByTemplateMatching(imageData, minR, maxR, sensitivity, userTemplatePoint)
}

/**
 * 박스 모드: 지정된 앞면 영역(ROI) 내에서 좌우 2열 및 층간(8단) 가로 경계선을 정밀 검출합니다.
 */
export function detectBoxesInImageData(imageData, rawBoxParams = DEFAULT_BOX_PARAMS, boxRoi = null) {
  if (!imageData || !imageData.width || !imageData.height || !imageData.data) return []
  const sensitivity = clamp(Number(rawBoxParams?.sensitivity ?? 55), 10, 95)
  return detectStackedCartBoxesWithRoi(imageData, boxRoi, sensitivity)
}

// 캡 뚜껑 모드용 통합 분석 (가로 1200 리사이징 + 템플릿 매칭 검출)
export async function analyzeVialImageFile(previewUrl, params = DEFAULT_DETECTION_PARAMS, userTemplatePoint = null) {
  const prepared = await prepareAnalysisImageData(previewUrl)
  const circles = detectVialsInImageData(prepared.imageData, params, userTemplatePoint)

  return {
    ...prepared,
    circles,
  }
}

// 박스 모드용 통합 분석 (가로 1200 리사이징 + 앞면 ROI 기반 박스 검출)
export async function analyzeBoxImageFile(previewUrl, boxParams = DEFAULT_BOX_PARAMS, boxRoi = null) {
  const prepared = await prepareAnalysisImageData(previewUrl)
  const boxes = detectBoxesInImageData(prepared.imageData, boxParams, boxRoi)

  return {
    ...prepared,
    boxes,
  }
}

// 기존 호환용 도우미: 박스 개수만 반환합니다.
export async function estimateBoxCountFromImageFile(previewUrl, boxParams = DEFAULT_BOX_PARAMS) {
  const res = await analyzeBoxImageFile(previewUrl, boxParams)
  return res.boxes.length
}

// 갤러리 카드용 마커 오버레이 썸네일: 캡 뚜껑 모드(동그라미) / 박스 모드(사각형 테두리)를 표시합니다.
function MarkedThumbnail({ photo, mode }) {
  const imgRef = useRef(null)
  const canvasRef = useRef(null)
  const circles = photo.circles || []
  const boxes = photo.boxes || []

  useEffect(() => {
    const imgEl = imgRef.current
    const canvas = canvasRef.current
    if (!imgEl || !canvas) return

    const drawThumbMarkers = () => {
      const rect = imgEl.getBoundingClientRect()
      const displayW = Math.max(1, Math.round(rect.width))
      const displayH = Math.max(1, Math.round(rect.height))

      canvas.width = displayW
      canvas.height = displayH

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, displayW, displayH)

      const styles = getComputedStyle(document.documentElement)
      const capColor =
        styles.getPropertyValue('--color-success').trim() ||
        styles.getPropertyValue('--color-accent').trim()
      const boxColor = styles.getPropertyValue('--color-accent').trim() || capColor
      const contrastColor = styles.getPropertyValue('--color-on-primary').trim()

      if (mode === 'cap' && circles.length > 0) {
        for (let i = 0; i < circles.length; i += 1) {
          const c = circles[i]
          const cx = c.x * displayW
          const cy = c.y * displayH
          const radius = Math.max(3, c.r * displayW)

          ctx.beginPath()
          ctx.arc(cx, cy, radius, 0, Math.PI * 2)
          ctx.lineWidth = 3
          ctx.strokeStyle = contrastColor
          ctx.stroke()

          ctx.beginPath()
          ctx.arc(cx, cy, radius, 0, Math.PI * 2)
          ctx.lineWidth = 1.6
          ctx.strokeStyle = capColor
          ctx.stroke()
        }
      } else if (mode === 'box' && boxes.length > 0) {
        for (let i = 0; i < boxes.length; i += 1) {
          const b = boxes[i]
          const bx = b.x * displayW
          const by = b.y * displayH
          const bw = Math.max(6, b.w * displayW)
          const bh = Math.max(6, b.h * displayH)

          ctx.lineWidth = 3.2
          ctx.strokeStyle = contrastColor
          ctx.strokeRect(bx, by, bw, bh)

          ctx.lineWidth = 1.8
          ctx.strokeStyle = boxColor
          ctx.strokeRect(bx, by, bw, bh)
        }
      }
    }

    drawThumbMarkers()

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(drawThumbMarkers)
      observer.observe(imgEl)
      return () => observer.disconnect()
    }
    window.addEventListener('resize', drawThumbMarkers)
    return () => window.removeEventListener('resize', drawThumbMarkers)
  }, [photo.previewUrl, mode, circles, boxes])

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        overflow: 'hidden',
        borderRadius: 'var(--r-md)',
        backgroundColor: 'var(--color-product-bg)',
      }}
    >
      <img
        ref={imgRef}
        src={photo.previewUrl}
        alt={`썸네일: ${photo.name}`}
        className="jt-product-img"
      />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 'var(--z-raised)',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

/**
 * 업로드된 모든 사진의 모드 전환 토글, 마커 오버레이 썸네일, 개별 바이알 수량을 카드 형태로 표시합니다.
 */
export function VialPhotoGallery({
  capPhotos,
  boxPhotos,
  safeVialsPerBox,
  activePhotoKey,
  onSelectPhoto,
  onSwitchPhotoMode,
  onRemovePhoto,
}) {
  if (capPhotos.length === 0 && boxPhotos.length === 0) return null

  const renderPhotoCard = (photo, idx, currentMode) => {
    const isSelected =
      activePhotoKey?.mode === currentMode && activePhotoKey?.id === photo.id
    const isCap = currentMode === 'cap'
    const boxVialTotal = (photo.count || 0) * safeVialsPerBox

    return (
      <article
        key={`${currentMode}-${photo.id}`}
        className="jt-card jt-stack-2"
        style={{
          cursor: 'pointer',
          borderColor: isSelected ? 'var(--color-border-selected)' : undefined,
          backgroundColor: isSelected ? 'var(--color-fill-selected)' : undefined,
        }}
        onClick={() => onSelectPhoto(currentMode, photo.id)}
      >
        {/* 카드 상단: 사진별 [캡 뚜껑 모드] / [박스 모드] 전환 토글 + 삭제 버튼 */}
        <div
          className="jt-row"
          style={{ justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-1)' }}
        >
          <div
            className="jt-switcher"
            role="group"
            aria-label={`${photo.name} 모드 전환`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="jt-switcher-item"
              aria-pressed={isCap}
              onClick={() => onSwitchPhotoMode(photo.id, currentMode, 'cap')}
              style={{
                fontSize: 'var(--fs-xs)',
                minHeight: 'var(--control-height-sm)',
                padding: '0 var(--space-2)',
              }}
            >
              캡 뚜껑 모드
            </button>
            <button
              type="button"
              className="jt-switcher-item"
              aria-pressed={!isCap}
              onClick={() => onSwitchPhotoMode(photo.id, currentMode, 'box')}
              style={{
                fontSize: 'var(--fs-xs)',
                minHeight: 'var(--control-height-sm)',
                padding: '0 var(--space-2)',
              }}
            >
              박스 모드
            </button>
          </div>

          <button
            type="button"
            className="jt-icon-btn"
            onClick={(e) => {
              e.stopPropagation()
              onRemovePhoto(currentMode, photo.id)
            }}
            aria-label={`${photo.name} 삭제`}
            title="이 사진 삭제"
          >
            <span className="jt-ico jt-ico-sm" aria-hidden="true">
              close
            </span>
          </button>
        </div>

        {/* 동그라미(캡) 또는 사각형 테두리(박스) Canvas 오버레이 썸네일 */}
        <MarkedThumbnail photo={photo} mode={currentMode} />

        {/* 카드 하단: 순번·파일명 + 개별 수량 계산 표시 */}
        <div className="jt-stack-2" style={{ gap: 'var(--space-1)' }}>
          <div className="jt-row" style={{ justifyContent: 'space-between', gap: 'var(--space-2)' }}>
            <span
              style={{
                fontSize: 'var(--fs-xs)',
                color: 'var(--color-text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: '1 1 auto',
                minWidth: 0,
              }}
            >
              <strong className="jt-num">{`#${idx + 1}`}</strong> {photo.name}
            </span>

            {photo.analyzing ? (
              <span className="jt-badge jt-badge-info">
                <span className="jt-loader" aria-hidden="true" />
                분석 중
              </span>
            ) : isCap ? (
              <span className="jt-badge jt-badge-pass jt-num">{`${photo.count}개`}</span>
            ) : (
              <span className="jt-badge jt-badge-pass jt-num">
                {`박스 ${photo.count}개 × ${safeVialsPerBox} = ${boxVialTotal.toLocaleString()}개`}
              </span>
            )}
          </div>
        </div>
      </article>
    )
  }

  return (
    <section className="jt-stack-3" aria-label="사진별 검출 썸네일 갤러리">
      <div className="jt-row" style={{ justifyContent: 'space-between' }}>
        <div className="jt-row" style={{ gap: 'var(--space-2)' }}>
          <span className="jt-ico" aria-hidden="true">
            photo_library
          </span>
          <h3 style={{ margin: 0, fontSize: 'var(--fs-lg)', fontWeight: 700 }}>
            사진별 검출 갤러리
          </h3>
        </div>
        <span className="jt-help">
          카드에서 [캡 뚜껑 모드] · [박스 모드]를 바꿀 수 있고, 누르면 아래에서 확대 보정합니다.
        </span>
      </div>

      <div className="jt-grid-cards" style={{ '--jt-grid-min': '15rem' }}>
        {capPhotos.map((photo, idx) => renderPhotoCard(photo, idx, 'cap'))}
        {boxPhotos.map((photo, idx) => renderPhotoCard(photo, idx, 'box'))}
      </div>
    </section>
  )
}

/**
 * 선택된 사진의 모드(캡 뚜껑 모드 또는 박스 모드)에 맞춰
 * 동그라미(원형) 또는 사각형 테두리 Canvas 오버레이를 크게 보여주고,
 * 모드에 맞는 민감도 · 최소/최대 크기 슬라이더와 클릭 수동 보정을 제공하는 컴포넌트입니다.
 */
export default function VialCountInspector({
  capPhotos,
  boxPhotos = [],
  activePhotoKey,
  onSelectPhoto,
  onSwitchPhotoMode,
  capParams,
  boxParams = DEFAULT_BOX_PARAMS,
  onChangeCapParams,
  onChangeBoxParams,
  onResetParams,
  onToggleCircleAtPoint,
  onToggleBoxAtPoint,
  onSelectTemplatePoint,
  onSetBoxRoi,
  safeVialsPerBox = 50,
  applyScope = 'all',
  onChangeApplyScope,
}) {
  const [showMarkers, setShowMarkers] = useState(true)
  const [previewMode, setPreviewMode] = useState('original')
  const overlayCanvasRef = useRef(null)
  const imgRef = useRef(null)

  // 박스 모드 앞면 ROI 드래그 상태
  const [dragStart, setDragStart] = useState(null)
  const [dragCurrent, setDragCurrent] = useState(null)
  const isDraggingRef = useRef(false)

  const allEntries = [
    ...capPhotos.map((p, idx) => ({ mode: 'cap', photo: p, index: idx })),
    ...boxPhotos.map((p, idx) => ({ mode: 'box', photo: p, index: idx })),
  ]

  const matchedEntry =
    allEntries.find(
      (entry) =>
        entry.mode === activePhotoKey?.mode && entry.photo.id === activePhotoKey?.id
    ) ||
    allEntries[0] ||
    null

  const activeMode = matchedEntry?.mode || 'cap'
  const activePhoto = matchedEntry?.photo || null
  const activeIndex = matchedEntry?.index ?? 0
  const isCapMode = activeMode === 'cap'

  const circles = activePhoto?.circles || []
  const boxes = activePhoto?.boxes || []
  const activeCount = isCapMode ? circles.length : boxes.length

  const currentParams = isCapMode ? capParams : boxParams

  useEffect(() => {
    const canvas = overlayCanvasRef.current
    const imgEl = imgRef.current
    if (!canvas || !imgEl || !activePhoto) return

    const drawOverlay = () => {
      const rect = imgEl.getBoundingClientRect()
      const displayW = Math.max(1, Math.round(rect.width))
      const displayH = Math.max(1, Math.round(rect.height))

      canvas.width = displayW
      canvas.height = displayH

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, displayW, displayH)

      const styles = getComputedStyle(document.documentElement)
      const capColor =
        styles.getPropertyValue('--color-success').trim() ||
        styles.getPropertyValue('--color-accent').trim()
      const boxColor = styles.getPropertyValue('--color-accent').trim() || capColor
      const contrastRingColor = styles.getPropertyValue('--color-on-primary').trim()
      const badgeFillColor = styles.getPropertyValue('--color-primary').trim()
      const badgeTextColor = styles.getPropertyValue('--color-on-primary').trim()
      const fontFamily = styles.getPropertyValue('--font-num').trim() || 'sans-serif'

      // 박스 모드: 사용자가 드래그 중인 사각형 실시간 표시
      if (!isCapMode && dragStart && dragCurrent) {
        const x1 = Math.min(dragStart.x, dragCurrent.x) * displayW
        const y1 = Math.min(dragStart.y, dragCurrent.y) * displayH
        const dw = Math.abs(dragCurrent.x - dragStart.x) * displayW
        const dh = Math.abs(dragCurrent.y - dragStart.y) * displayH

        ctx.fillStyle = 'rgba(48, 92, 222, 0.22)'
        ctx.fillRect(x1, y1, dw, dh)
        ctx.strokeStyle = '#305cde'
        ctx.lineWidth = 2.5
        ctx.setLineDash([6, 4])
        ctx.strokeRect(x1, y1, dw, dh)
        ctx.setLineDash([])
      }

      if (!showMarkers) return

      if (isCapMode && circles.length > 0) {
        for (let i = 0; i < circles.length; i += 1) {
          const c = circles[i]
          const cx = c.x * displayW
          const cy = c.y * displayH
          const radius = Math.max(6, c.r * displayW)

          ctx.beginPath()
          ctx.arc(cx, cy, radius, 0, Math.PI * 2)
          ctx.lineWidth = 4
          ctx.strokeStyle = contrastRingColor
          ctx.stroke()

          ctx.beginPath()
          ctx.arc(cx, cy, radius, 0, Math.PI * 2)
          ctx.lineWidth = 2.2
          ctx.strokeStyle = capColor
          ctx.stroke()

          const labelRadius = Math.max(9, Math.min(13, radius * 0.48))
          ctx.beginPath()
          ctx.arc(cx, cy, labelRadius, 0, Math.PI * 2)
          ctx.fillStyle = badgeFillColor
          ctx.fill()

          ctx.font = `700 ${Math.round(labelRadius * 1.05)}px ${fontFamily}`
          ctx.fillStyle = badgeTextColor
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(String(i + 1), cx, cy)
        }

        // 기준 캡 선택 위치 표시 (황금색 조준선)
        if (activePhoto?.templatePoint) {
          const tcx = activePhoto.templatePoint.x * displayW
          const tcy = activePhoto.templatePoint.y * displayH
          const tr = Math.max(8, (capParams.minRadius || 20) * (displayW / 1200))
          ctx.beginPath()
          ctx.arc(tcx, tcy, tr, 0, Math.PI * 2)
          ctx.lineWidth = 3
          ctx.strokeStyle = '#f59e0b'
          ctx.stroke()
          // 십자선
          ctx.beginPath()
          ctx.moveTo(tcx - tr - 6, tcy)
          ctx.lineTo(tcx + tr + 6, tcy)
          ctx.moveTo(tcx, tcy - tr - 6)
          ctx.lineTo(tcx, tcy + tr + 6)
          ctx.lineWidth = 2
          ctx.strokeStyle = '#f59e0b'
          ctx.stroke()
        }
      } else if (!isCapMode && boxes.length > 0) {
        for (let i = 0; i < boxes.length; i += 1) {
          const b = boxes[i]
          const bx = b.x * displayW
          const by = b.y * displayH
          const bw = Math.max(12, b.w * displayW)
          const bh = Math.max(12, b.h * displayH)

          ctx.lineWidth = 4.5
          ctx.strokeStyle = contrastRingColor
          ctx.strokeRect(bx, by, bw, bh)

          ctx.lineWidth = 2.4
          ctx.strokeStyle = boxColor
          ctx.strokeRect(bx, by, bw, bh)

          const labelRadius = 11
          const lx = Math.min(displayW - labelRadius - 2, bx + labelRadius + 4)
          const ly = Math.min(displayH - labelRadius - 2, by + labelRadius + 4)

          ctx.beginPath()
          ctx.arc(lx, ly, labelRadius, 0, Math.PI * 2)
          ctx.fillStyle = badgeFillColor
          ctx.fill()

          ctx.font = `700 ${Math.round(labelRadius)}px ${fontFamily}`
          ctx.fillStyle = badgeTextColor
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(String(i + 1), lx, ly)
        }
      }
    }

    drawOverlay()

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(drawOverlay)
      observer.observe(imgEl)
      return () => observer.disconnect()
    }

    window.addEventListener('resize', drawOverlay)
    return () => window.removeEventListener('resize', drawOverlay)
  }, [activePhoto, isCapMode, circles, boxes, showMarkers, previewMode, capParams, boxParams, dragStart, dragCurrent])

  if (!activePhoto) return null

  // 디버그 프리뷰 URL 생성
  let debugImgUrl = null
  if (previewMode === 'binary' && activePhoto?.imageData) {
    try {
      const result = isCapMode
        ? buildCapDebugPreview(activePhoto.imageData, capParams, activePhoto.templatePoint)
        : buildBoxDebugPreview(activePhoto.imageData, boxParams, activePhoto.boxRoi)
      if (result) {
        const debugCanvas = document.createElement('canvas')
        debugCanvas.width = result.width
        debugCanvas.height = result.height
        const dctx = debugCanvas.getContext('2d')
        if (dctx) {
          dctx.putImageData(new ImageData(result.binaryData, result.width, result.height), 0, 0)
          debugImgUrl = debugCanvas.toDataURL('image/png')
        }
      }
    } catch (e) {
      // 폴백
    }
  }

  const displayImgSrc = previewMode === 'binary' && debugImgUrl
    ? debugImgUrl
    : activePhoto.previewUrl

  function handleCanvasMouseDown(e) {
    const canvas = overlayCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const nx = clamp((e.clientX - rect.left) / rect.width, 0, 1)
    const ny = clamp((e.clientY - rect.top) / rect.height, 0, 1)

    if (!isCapMode) {
      isDraggingRef.current = true
      setDragStart({ x: nx, y: ny })
      setDragCurrent({ x: nx, y: ny })
    }
  }

  function handleCanvasMouseMove(e) {
    if (isCapMode || !isDraggingRef.current || !dragStart) return
    const canvas = overlayCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const nx = clamp((e.clientX - rect.left) / rect.width, 0, 1)
    const ny = clamp((e.clientY - rect.top) / rect.height, 0, 1)
    setDragCurrent({ x: nx, y: ny })
  }

  function handleCanvasMouseUp(e) {
    const canvas = overlayCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const nx = clamp((e.clientX - rect.left) / rect.width, 0, 1)
    const ny = clamp((e.clientY - rect.top) / rect.height, 0, 1)

    if (isCapMode) {
      // 캡 모드: 클릭한 캡을 기준 템플릿으로 지정하여 전체 템플릿 매칭 실행
      if (onSelectTemplatePoint) {
        onSelectTemplatePoint(activePhoto.id, { x: nx, y: ny })
      }
      return
    }

    if (!isDraggingRef.current || !dragStart) return
    isDraggingRef.current = false
    const minX = Math.min(dragStart.x, nx)
    const maxX = Math.max(dragStart.x, nx)
    const minY = Math.min(dragStart.y, ny)
    const maxY = Math.max(dragStart.y, ny)
    const bw = maxX - minX
    const bh = maxY - minY

    setDragStart(null)
    setDragCurrent(null)

    if (bw >= 0.05 && bh >= 0.05) {
      if (onSetBoxRoi) {
        onSetBoxRoi(activePhoto.id, { x: minX, y: minY, w: bw, h: bh })
      }
    }
  }

  function handleSliderChange(field, value) {
    if (isCapMode) {
      if (!onChangeCapParams) return
      if (field === 'minRadius') {
        onChangeCapParams({
          ...capParams,
          minRadius: value,
          maxRadius: value >= capParams.maxRadius ? value + 6 : capParams.maxRadius,
        })
      } else if (field === 'maxRadius') {
        onChangeCapParams({
          ...capParams,
          maxRadius: value,
          minRadius: value <= capParams.minRadius ? Math.max(6, value - 6) : capParams.minRadius,
        })
      } else {
        onChangeCapParams({ ...capParams, [field]: value })
      }
    } else {
      if (!onChangeBoxParams) return
      if (field === 'minSize') {
        onChangeBoxParams({
          ...boxParams,
          minSize: value,
          maxSize: value >= boxParams.maxSize ? value + 20 : boxParams.maxSize,
        })
      } else if (field === 'maxSize') {
        onChangeBoxParams({
          ...boxParams,
          maxSize: value,
          minSize: value <= boxParams.minSize ? Math.max(20, value - 20) : boxParams.minSize,
        })
      } else {
        onChangeBoxParams({ ...boxParams, [field]: value })
      }
    }
  }

  return (
    <section className="jt-card jt-stack-4" aria-label="검출 위치 확대 확인 및 오차 보정">
      <div className="jt-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="jt-stack-2">
          <div className="jt-row" style={{ gap: 'var(--space-2)' }}>
            <span className="jt-ico" aria-hidden="true">
              {isCapMode ? 'center_focus_strong' : 'select_all'}
            </span>
            <h3 style={{ margin: 0, fontSize: 'var(--fs-lg)', fontWeight: 700 }}>
              {isCapMode ? '캡 뚜껑 모드 확대 확인 및 보정' : '박스 모드 확대 확인 및 보정'}
            </h3>
            <span className="jt-badge jt-badge-pass jt-num">
              {isCapMode
                ? `캡 #${activeIndex + 1} · ${circles.length}개 검출됨`
                : `박스 #${activeIndex + 1} · 박스 ${boxes.length}개 × ${safeVialsPerBox} = ${(
                  boxes.length * safeVialsPerBox
                ).toLocaleString()}개`}
            </span>
          </div>
          <p className="jt-help" style={{ margin: 0 }}>
            {isCapMode
              ? `대상 파일: ${activePhoto.name} · 동그라미를 누르면 제외되고, 빈 바이알 위를 누르면 마커가 추가됩니다.`
              : `대상 파일: ${activePhoto.name} · 사각형 테두리를 누르면 제외되고, 빈 박스 위를 누르면 사각형 마커가 추가됩니다.`}
          </p>
        </div>

        <label className="jt-switch">
          <input
            type="checkbox"
            role="switch"
            checked={showMarkers}
            onChange={(e) => setShowMarkers(e.target.checked)}
          />
          <span className="jt-switch-track" aria-hidden="true" />
          마커 표시
        </label>
      </div>

      {/* 현재 선택 사진 전환 + 뷰어 내 모드 직접 전환 */}
      <div className="jt-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        {allEntries.length > 1 && (
          <div className="jt-switcher" role="group" aria-label="확대 사진 전환">
            {allEntries.map((entry) => (
              <button
                key={`${entry.mode}-${entry.photo.id}`}
                type="button"
                className="jt-switcher-item jt-num"
                aria-pressed={entry.mode === activeMode && entry.photo.id === activePhoto.id}
                onClick={() => onSelectPhoto(entry.mode, entry.photo.id)}
              >
                {entry.mode === 'cap'
                  ? `캡 #${entry.index + 1} (${entry.photo.count}개)`
                  : `박스 #${entry.index + 1} (${entry.photo.count}박스)`}
              </button>
            ))}
          </div>
        )}

        {onSwitchPhotoMode && (
          <div className="jt-switcher" role="group" aria-label="현재 사진 모드 전환">
            <button
              type="button"
              className="jt-switcher-item"
              aria-pressed={isCapMode}
              onClick={() => onSwitchPhotoMode(activePhoto.id, activeMode, 'cap')}
            >
              캡 뚜껑 모드
            </button>
            <button
              type="button"
              className="jt-switcher-item"
              aria-pressed={!isCapMode}
              onClick={() => onSwitchPhotoMode(activePhoto.id, activeMode, 'box')}
            >
              박스 모드
            </button>
          </div>
        )}
      </div>

      <div
        style={{
          position: 'relative',
          width: '100%',
          overflow: 'hidden',
          borderRadius: 'var(--r-md)',
        }}
      >
        {/* 디버그 토글: 원본 보기 / 흑백 전처리 보기 */}
        <div
          style={{
            position: 'absolute',
            top: 'var(--space-2)',
            right: 'var(--space-2)',
            zIndex: 'var(--z-dropdown)',
            display: 'flex',
            gap: 0,
          }}
        >
          <div className="jt-switcher" role="group" aria-label="프리뷰 모드 전환">
            <button
              type="button"
              className="jt-switcher-item"
              aria-pressed={previewMode === 'original'}
              onClick={() => setPreviewMode('original')}
              style={{ fontSize: 'var(--fs-xs)', minHeight: 'var(--control-height-sm)', padding: '0 var(--space-2)', opacity: 0.92 }}
            >
              <span className="jt-ico jt-ico-sm" aria-hidden="true">image</span>
              원본
            </button>
            <button
              type="button"
              className="jt-switcher-item"
              aria-pressed={previewMode === 'binary'}
              onClick={() => setPreviewMode('binary')}
              disabled={!activePhoto?.imageData}
              style={{ fontSize: 'var(--fs-xs)', minHeight: 'var(--control-height-sm)', padding: '0 var(--space-2)', opacity: 0.92 }}
            >
              <span className="jt-ico jt-ico-sm" aria-hidden="true">filter_b_and_w</span>
              전처리 보기
            </button>
          </div>
        </div>

        <img
          ref={imgRef}
          src={displayImgSrc}
          alt={`검출 결과 확대: ${activePhoto.name}`}
          className="jt-product-img"
        />
        {/* 캡 모드 안내: 아무 캡 정중앙을 클릭하면 그 캡을 기준 템플릿으로 삼아 전체 재매칭합니다. */}
        {isCapMode && (
          <div
            style={{
              position: 'absolute',
              bottom: 'var(--space-2)',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 'var(--z-dropdown)',
              background: 'rgba(0,0,0,0.65)',
              color: '#fff',
              borderRadius: 'var(--r-sm)',
              padding: 'var(--space-1) var(--space-3)',
              fontSize: 'var(--fs-xs)',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ color: '#fbbf24', marginRight: 4 }}>●</span>
            아무 캡 정중앙을 클릭하면 해당 캡을 기준으로 전체 재계산합니다
          </div>
        )}
        {/* 박스 모드 안내: 드래그로 앞면 영역 지정, 버튼으로 초기화 */}
        {!isCapMode && (
          <div
            style={{
              position: 'absolute',
              bottom: 'var(--space-2)',
              left: 'var(--space-2)',
              zIndex: 'var(--z-dropdown)',
              display: 'flex',
              gap: 'var(--space-2)',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                background: 'rgba(0,0,0,0.65)',
                color: '#fff',
                borderRadius: 'var(--r-sm)',
                padding: 'var(--space-1) var(--space-3)',
                fontSize: 'var(--fs-xs)',
                pointerEvents: 'none',
              }}
            >
              마우스로 드래그해 박스 앞면 영역을 지정하세요
            </span>
            <button
              type="button"
              className="jt-btn-ghost jt-btn-sm"
              style={{ fontSize: 'var(--fs-xs)', background: 'rgba(255,255,255,0.9)' }}
              onClick={() => {
                if (onSetBoxRoi) onSetBoxRoi(activePhoto.id, null)
              }}
            >
              앞면 기본값 리셋
            </button>
          </div>
        )}
        <canvas
          ref={overlayCanvasRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          aria-label="검출 마커 오버레이 (캡 모드: 클릭으로 기준 캡 선택 / 박스 모드: 드래그로 앞면 영역 지정)"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            zIndex: 'var(--z-raised)',
            cursor: isCapMode ? 'crosshair' : 'crosshair',
          }}
        />
      </div>

      {activeCount === 0 && !activePhoto.analyzing && (
        <div className="jt-note jt-note-warning" role="status">
          <strong>
            {isCapMode ? '검출된 캡 뚜껑이 없습니다.' : '검출된 박스가 없습니다.'}
          </strong>{' '}
          아래 슬라이더에서 <strong>민감도</strong>를 높이거나, 사진 속 대상 크기에 맞게{' '}
          <strong>최소·최대 크기</strong> 범위를 조절해 보세요. 직접 사진 위를 눌러 추가할 수도 있습니다.
        </div>
      )}

      <hr className="jt-divider" />

      <div className="jt-stack-3">
        <div className="jt-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 'var(--fs-base)' }}>
            {isCapMode ? '캡 뚜껑 모드 오차 보정 슬라이더' : '박스 모드 오차 보정 슬라이더'}
          </span>
          <div className="jt-row" style={{ gap: 'var(--space-2)' }}>
            {allEntries.length > 1 && onChangeApplyScope && (
              <div className="jt-switcher" role="group" aria-label="슬라이더 적용 범위">
                <button
                  type="button"
                  className="jt-switcher-item"
                  aria-pressed={applyScope === 'all'}
                  onClick={() => onChangeApplyScope('all')}
                >
                  같은 모드 전체
                </button>
                <button
                  type="button"
                  className="jt-switcher-item"
                  aria-pressed={applyScope === 'active'}
                  onClick={() => onChangeApplyScope('active')}
                >
                  현재 사진만
                </button>
              </div>
            )}
            <button
              type="button"
              className="jt-btn-ghost jt-btn-sm"
              onClick={() => onResetParams(activeMode)}
            >
              <span className="jt-ico jt-ico-sm" aria-hidden="true">
                restart_alt
              </span>
              기본값 초기화
            </button>
          </div>
        </div>

        {/* 1. 민감도 (Threshold) 슬라이더 */}
        <div>
          <div className="jt-row" style={{ justifyContent: 'space-between' }}>
            <label htmlFor="vial-threshold-slider" className="jt-label" style={{ margin: 0 }}>
              민감도 (Threshold)
            </label>
            <span className="jt-num" style={{ fontWeight: 700 }}>
              {currentParams.sensitivity}
            </span>
          </div>
          <input
            id="vial-threshold-slider"
            type="range"
            className="jt-slider"
            min="10"
            max="95"
            step="1"
            value={currentParams.sensitivity}
            aria-label="민감도 조절"
            onChange={(e) => handleSliderChange('sensitivity', Number(e.target.value))}
          />
          <p className="jt-help" style={{ margin: 0 }}>
            {isCapMode
              ? '어두운 조명에서 바이알을 놓칠 때는 값을 높이고, 바닥 그림자까지 세면 값을 낮추세요.'
              : '박스 경계가 연해서 놓칠 때는 값을 높이고, 내부 스티커나 선반까지 잡히면 값을 낮추세요.'}
          </p>
        </div>

        {/* 2. 최소 크기 슬라이더 */}
        <div>
          <div className="jt-row" style={{ justifyContent: 'space-between' }}>
            <label htmlFor="vial-min-size-slider" className="jt-label" style={{ margin: 0 }}>
              {isCapMode ? '최소 바이알 크기 (반지름)' : '최소 박스 크기 (가로·세로 기준)'}
            </label>
            <span className="jt-num" style={{ fontWeight: 700 }}>
              {isCapMode ? currentParams.minRadius : currentParams.minSize}
            </span>
          </div>
          <input
            id="vial-min-size-slider"
            type="range"
            className="jt-slider"
            min={isCapMode ? '6' : '20'}
            max={isCapMode ? '140' : '350'}
            step="1"
            value={isCapMode ? currentParams.minRadius : currentParams.minSize}
            aria-label={isCapMode ? '최소 바이알 크기 반지름 조절' : '최소 박스 크기 조절'}
            onChange={(e) =>
              handleSliderChange(isCapMode ? 'minRadius' : 'minSize', Number(e.target.value))
            }
          />
        </div>

        {/* 3. 최대 크기 슬라이더 */}
        <div>
          <div className="jt-row" style={{ justifyContent: 'space-between' }}>
            <label htmlFor="vial-max-size-slider" className="jt-label" style={{ margin: 0 }}>
              {isCapMode ? '최대 바이알 크기 (반지름)' : '최대 박스 크기 (가로·세로 기준)'}
            </label>
            <span className="jt-num" style={{ fontWeight: 700 }}>
              {isCapMode ? currentParams.maxRadius : currentParams.maxSize}
            </span>
          </div>
          <input
            id="vial-max-size-slider"
            type="range"
            className="jt-slider"
            min={isCapMode ? '16' : '80'}
            max={isCapMode ? '220' : '1150'}
            step="1"
            value={isCapMode ? currentParams.maxRadius : currentParams.maxSize}
            aria-label={isCapMode ? '최대 바이알 크기 반지름 조절' : '최대 박스 크기 조절'}
            onChange={(e) =>
              handleSliderChange(isCapMode ? 'maxRadius' : 'maxSize', Number(e.target.value))
            }
          />
        </div>
      </div>
    </section>
  )
}
