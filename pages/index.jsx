import { useEffect, useRef, useState } from 'react'
import VialCountInspector, {
  DEFAULT_BOX_PARAMS,
  DEFAULT_DETECTION_PARAMS,
  VialPhotoGallery,
  analyzeBoxImageFile,
  analyzeVialImageFile,
  detectBoxesInImageData,
  detectVialsInImageData,
  ensureOpenCvReady,
  isOpenCvReady,
} from '../components/VialCountInspector'

// 한 모드당 등록 가능한 최대 사진 수 (기존 규칙 유지)
const MAX_PHOTOS_PER_MODE = 5
// 기본 설정 및 기록 저장소 키
const STORAGE_VIALS_PER_BOX_KEY = 'jt-vials-per-box'
const STORAGE_RECORDS_KEY = 'jt-vial-records'
const STORAGE_DEPARTMENTS_KEY = 'jt-vial-departments'
const DEFAULT_VIALS_PER_BOX = '50'

// 파일 크기를 읽기 쉬운 MB/KB 단위로 변환합니다.
function formatFileSize(bytes) {
  if (!bytes) return '0 KB'
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

// JT UX 문구 원칙(사과 없이 무엇이 잘못됐고 어떻게 고치는지 안내)에 따른 저장 오류 문구 생성기
function buildSaveErrorMessage(err, targetLabel = '검수 기록') {
  if (err?.code === 'INVALID_BOX_QUANTITY') {
    return '박스 1개당 바이알 개수가 올바르지 않아 계산 결과를 저장하지 못했습니다. 상단 기본 설정 칸에 1 이상의 숫자를 입력한 뒤 [검수 기록 저장]을 다시 눌러 주세요.'
  }
  if (err?.name === 'QuotaExceededError' || err?.code === 22 || err?.code === 1014) {
    return `브라우저 저장 공간이 가득 차서 ${targetLabel}을(를) 저장하지 못했습니다. 불필요한 이전 데이터를 비우거나 브라우저 저장 공간을 확보한 뒤 다시 시도해 주세요.`
  }
  if (err?.name === 'SecurityError') {
    return `브라우저 설정에서 기기 내 데이터 저장이 차단되어 ${targetLabel}을(를) 저장하지 못했습니다. 시크릿(비공개) 모드를 해제하거나 사이트 데이터 저장 권한을 허용한 뒤 다시 시도해 주세요.`
  }
  return `${targetLabel}을(를) 저장하는 중 오류가 발생했습니다(원인: ${
    err?.message || '알 수 없는 저장소 오류'
  }). 화면을 새로고침한 뒤 다시 시도해 주세요.`
}

export default function CapturePage() {
  // 1. 바이알 캡 뚜껑 모드 사진 목록 (최대 5장)
  const [capPhotos, setCapPhotos] = useState([])
  // 2. 카트 박스 모드 사진 목록 (최대 5장)
  const [boxPhotos, setBoxPhotos] = useState([])
  // 3. 기본 설정: 박스 1개당 바이알 개수 (기본값 50, localStorage 자동 저장)
  const [vialsPerBox, setVialsPerBox] = useState(DEFAULT_VIALS_PER_BOX)
  const [settingsSaveError, setSettingsSaveError] = useState('')

  // 4. 모드별 오차 보정 파라미터 (캡 원형 파라미터 / 박스 사각형 파라미터) 및 적용 범위
  const [capParams, setCapParams] = useState(DEFAULT_DETECTION_PARAMS)
  const [boxParams, setBoxParams] = useState(DEFAULT_BOX_PARAMS)
  const [applyScope, setApplyScope] = useState('all')
  // 확대 보정 뷰어에 선택된 사진 ({ mode: 'cap' | 'box', id: string })
  const [activePhotoKey, setActivePhotoKey] = useState(null)

  // 5. 드래그 앤 드롭, YOLO/OpenCV 엔진 상태 및 순차 분석 진행 상태
  const [dragOverMode, setDragOverMode] = useState(null)
  const [cvEngineReady, setCvEngineReady] = useState(false)
  const [yoloEngineReady, setYoloEngineReady] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState({
    active: false,
    current: 0,
    total: 0,
    fileName: '',
  })
  const [hasInspected, setHasInspected] = useState(false)
  const [analysisError, setAnalysisError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [hasSaved, setHasSaved] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  // 6. 브라우저 기본 alert/confirm 대신 사용하는 인앱 모달 상태
  const [modalState, setModalState] = useState({
    open: false,
    title: '',
    message: '',
    confirmLabel: '확인',
    cancelLabel: '',
    danger: false,
    onConfirm: null,
  })

  const capInputRef = useRef(null)
  const boxInputRef = useRef(null)
  const modalConfirmBtnRef = useRef(null)
  const lastFocusedRef = useRef(null)
  const objectUrlsRef = useRef(new Set())
  const toastTimerRef = useRef(null)
  const sliderDebounceRef = useRef(null)
  const analysisRunIdRef = useRef(0)

  // 마운트 시: (1) localStorage에서 '박스 1개당 바이알 개수' 복원, (2) OpenCV.js 백그라운드 예열
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_VIALS_PER_BOX_KEY)
      if (saved !== null) {
        const parsed = Number(saved)
        if (Number.isFinite(parsed) && parsed >= 1) {
          setVialsPerBox(String(Math.floor(parsed)))
        }
      }
    } catch (err) {
      setSettingsSaveError(buildSaveErrorMessage(err, '박스당 기본 바이알 개수 설정'))
    }

    let active = true
    ensureOpenCvReady().then((res) => {
      if (active) {
        setCvEngineReady(Boolean(res?.ready))
      }
    })
    // 온디바이스 YOLO26 best.onnx 세션 백그라운드 예열
    import('../utils/yoloOnnx')
      .then((mod) => mod.getOnnxSession())
      .then(() => {
        if (active) setYoloEngineReady(true)
      })
      .catch((e) => {
        console.warn('YOLO ONNX 백그라운드 로드 안내:', e?.message || e)
      })
    return () => {
      active = false
    }
  }, [])

  // 언마운트 시 생성한 임시 이미지 URL과 타이머를 정리합니다.
  useEffect(() => {
    const urls = objectUrlsRef.current
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
      urls.clear()
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      if (sliderDebounceRef.current) clearTimeout(sliderDebounceRef.current)
    }
  }, [])

  // 모달 열림/닫힘 시 접근성 포커스 이동 및 Escape 키 닫기 처리
  useEffect(() => {
    if (!modalState.open) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeModal()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    const focusTimer = setTimeout(() => {
      modalConfirmBtnRef.current?.focus()
    }, 0)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      clearTimeout(focusTimer)
    }
  }, [modalState.open])

  function openModal({
    title,
    message,
    confirmLabel = '확인',
    cancelLabel = '',
    danger = false,
    onConfirm = null,
  }) {
    if (typeof document !== 'undefined') {
      lastFocusedRef.current = document.activeElement
    }
    setModalState({
      open: true,
      title,
      message,
      confirmLabel,
      cancelLabel,
      danger,
      onConfirm,
    })
  }

  function closeModal() {
    setModalState((prev) => ({ ...prev, open: false, onConfirm: null }))
    setTimeout(() => {
      if (lastFocusedRef.current && typeof lastFocusedRef.current.focus === 'function') {
        lastFocusedRef.current.focus()
      }
    }, 0)
  }

  function showToast(msg) {
    setToastMessage(msg)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => {
      setToastMessage('')
    }, 3500)
  }

  // 기본 설정('박스 1개당 바이알 개수') 변경 시 즉시 상태 및 localStorage 자동 저장
  function handleVialsPerBoxChange(rawVal) {
    setVialsPerBox(rawVal)
    setHasSaved(false)
    setSaveError('')
    setSettingsSaveError('')

    const parsed = Number(rawVal)
    if (rawVal.trim() === '' || !Number.isFinite(parsed) || parsed < 1) {
      return
    }

    try {
      window.localStorage.setItem(STORAGE_VIALS_PER_BOX_KEY, String(Math.floor(parsed)))
    } catch (err) {
      setSettingsSaveError(buildSaveErrorMessage(err, '박스당 바이알 개수 설정'))
    }
  }

  // 등록된 사진들을 1장씩 순차적으로 자동 분석하여 실시간으로 합계와 썸네일 마커를 갱신합니다.
  async function runSequentialAnalysis(
    capTargets,
    boxTargets,
    capP = capParams,
    boxP = boxParams
  ) {
    const total = capTargets.length + boxTargets.length
    if (total === 0) return

    const runId = ++analysisRunIdRef.current
    setIsAnalyzing(true)
    setHasInspected(true)
    setAnalysisError('')
    setSaveError('')
    setHasSaved(false)

    const failedNames = []
    let stepIndex = 0

    try {
      for (let i = 0; i < capTargets.length; i += 1) {
        if (analysisRunIdRef.current !== runId) return
        const target = capTargets[i]
        stepIndex += 1
        setAnalysisProgress({
          active: true,
          current: stepIndex,
          total,
          fileName: target.name,
        })

        await new Promise((resolve) => setTimeout(resolve, 25))
        if (analysisRunIdRef.current !== runId) return

        try {
          const result = await analyzeVialImageFile(target.previewUrl, capP)
          if (analysisRunIdRef.current !== runId) return
          if (result.engine === 'opencv') setCvEngineReady(true)

          setCapPhotos((prev) =>
            prev.map((p) =>
              p.id === target.id
                ? {
                    ...p,
                    imageData: result.imageData,
                    analysisWidth: result.analysisWidth,
                    analysisHeight: result.analysisHeight,
                    circles: result.circles,
                    boxes: p.boxes || [],
                    rawYoloDetections: result.rawYoloDetections || p.rawYoloDetections || [],
                    count: result.circles.length,
                    engine: result.engine,
                    analyzed: true,
                    analyzing: false,
                  }
                : p
            )
          )
        } catch (err) {
          failedNames.push(`${target.name} (${err.message})`)
          setCapPhotos((prev) =>
            prev.map((p) => (p.id === target.id ? { ...p, analyzing: false } : p))
          )
        }
      }

      for (let i = 0; i < boxTargets.length; i += 1) {
        if (analysisRunIdRef.current !== runId) return
        const target = boxTargets[i]
        stepIndex += 1
        setAnalysisProgress({
          active: true,
          current: stepIndex,
          total,
          fileName: target.name,
        })

        await new Promise((resolve) => setTimeout(resolve, 25))
        if (analysisRunIdRef.current !== runId) return

        try {
          const result = await analyzeBoxImageFile(target.previewUrl, boxP)
          if (analysisRunIdRef.current !== runId) return
          if (result.engine === 'opencv') setCvEngineReady(true)

          setBoxPhotos((prev) =>
            prev.map((p) =>
              p.id === target.id
                ? {
                    ...p,
                    imageData: result.imageData,
                    analysisWidth: result.analysisWidth,
                    analysisHeight: result.analysisHeight,
                    boxes: result.boxes,
                    circles: p.circles || [],
                    rawYoloDetections: result.rawYoloDetections || p.rawYoloDetections || [],
                    count: result.boxes.length,
                    engine: result.engine,
                    analyzed: true,
                    analyzing: false,
                  }
                : p
            )
          )
        } catch (err) {
          failedNames.push(`${target.name} (${err.message})`)
          setBoxPhotos((prev) =>
            prev.map((p) => (p.id === target.id ? { ...p, analyzing: false } : p))
          )
        }
      }

      if (failedNames.length > 0 && analysisRunIdRef.current === runId) {
        const msg = `일부 사진을 분석하지 못했습니다: ${failedNames.join(', ')}. 손상되지 않은 일반 사진(JPG, PNG)으로 다시 시도해 주세요.`
        setAnalysisError(msg)
        openModal({
          title: '이미지 분석 중 오류가 발생했습니다',
          message: msg,
        })
      }
    } catch (err) {
      if (analysisRunIdRef.current === runId) {
        const msg = `사진 분석을 진행할 수 없습니다(원인: ${
          err?.message || '브라우저 그래픽 처리 오류'
        }). 다른 이미지 파일로 다시 시도해 주세요.`
        setAnalysisError(msg)
        openModal({
          title: '이미지 분석 실패',
          message: msg,
        })
      }
    } finally {
      if (analysisRunIdRef.current === runId) {
        setIsAnalyzing(false)
        setAnalysisProgress({ active: false, current: 0, total: 0, fileName: '' })
      }
    }
  }

  // 다중 사진 선택/드롭 공통 처리 (모드당 최대 5장 검증 + 업로드 즉시 자동 순차 분석)
  function addPhotosForMode(mode, fileList) {
    const files = Array.from(fileList || [])
    if (files.length === 0) return

    const currentList = mode === 'cap' ? capPhotos : boxPhotos
    const modeLabel = mode === 'cap' ? '캡 뚜껑 모드' : '박스 모드'
    const remainingSlots = MAX_PHOTOS_PER_MODE - currentList.length

    if (remainingSlots <= 0) {
      openModal({
        title: `${modeLabel} 사진 등록 한도 초과`,
        message: `${modeLabel} 사진은 한 번에 최대 ${MAX_PHOTOS_PER_MODE}장까지만 등록할 수 있습니다. 기존 사진을 삭제한 뒤 새 사진을 추가해 주세요.`,
      })
      return
    }

    const invalidFiles = []
    const validItems = []

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i]
      if (!file.type.startsWith('image/') || file.size === 0) {
        invalidFiles.push(file.name)
        continue
      }
      if (validItems.length >= remainingSlots) continue

      const previewUrl = URL.createObjectURL(file)
      objectUrlsRef.current.add(previewUrl)

      validItems.push({
        id: `${mode}-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        sizeLabel: formatFileSize(file.size),
        previewUrl,
        imageData: null,
        analysisWidth: 0,
        analysisHeight: 0,
        circles: [],
        boxes: [],
        count: 0,
        analyzed: false,
        analyzing: true,
      })
    }

    if (invalidFiles.length > 0) {
      openModal({
        title: '이미지 파일을 읽을 수 없습니다',
        message: `다음 파일은 이미지 형식이 아니거나 비어 있어 제외했습니다: ${invalidFiles.join(', ')}. JPG 또는 PNG 사진을 선택해 주세요.`,
      })
    }

    if (files.length - invalidFiles.length > remainingSlots) {
      openModal({
        title: `최대 ${MAX_PHOTOS_PER_MODE}장까지만 등록했습니다`,
        message: `${modeLabel} 사진은 최대 ${MAX_PHOTOS_PER_MODE}장 제한이 있어 앞의 ${remainingSlots}장만 받아들였습니다.`,
      })
    }

    if (validItems.length === 0) return

    if (mode === 'cap') {
      setCapPhotos((prev) => [...prev, ...validItems])
      if (!activePhotoKey) {
        setActivePhotoKey({ mode: 'cap', id: validItems[0].id })
      }
      runSequentialAnalysis(validItems, [], capParams, boxParams)
    } else {
      setBoxPhotos((prev) => [...prev, ...validItems])
      if (!activePhotoKey) {
        setActivePhotoKey({ mode: 'box', id: validItems[0].id })
      }
      runSequentialAnalysis([], validItems, capParams, boxParams)
    }
  }

  function handleCapFileChange(event) {
    addPhotosForMode('cap', event.target.files)
    event.target.value = ''
  }

  function handleBoxFileChange(event) {
    addPhotosForMode('box', event.target.files)
    event.target.value = ''
  }

  // 사진별 [캡 뚜껑 모드] <-> [박스 모드] 전환 토글 처리 (즉시 재검출 및 총합계 갱신)
  function handleSwitchPhotoMode(photoId, fromMode, toMode) {
    if (fromMode === toMode || isAnalyzing) return

    const sourceList = fromMode === 'cap' ? capPhotos : boxPhotos
    const targetList = toMode === 'cap' ? capPhotos : boxPhotos
    const targetLabel = toMode === 'cap' ? '캡 뚜껑 모드' : '박스 모드'

    if (targetList.length >= MAX_PHOTOS_PER_MODE) {
      openModal({
        title: `${targetLabel} 정원 초과`,
        message: `${targetLabel}에는 최대 ${MAX_PHOTOS_PER_MODE}장까지만 등록할 수 있어 전환하지 못했습니다. ${targetLabel}의 기존 사진을 1장 이상 삭제한 뒤 다시 전환해 주세요.`,
      })
      return
    }

    const photo = sourceList.find((p) => p.id === photoId)
    if (!photo) return

    let convertedPhoto = { ...photo }

    if (photo.imageData) {
      if (toMode === 'cap') {
        const circles = detectVialsInImageData(photo.imageData, capParams)
        convertedPhoto = {
          ...photo,
          circles,
          count: circles.length,
          engine: isOpenCvReady() ? 'opencv' : 'canvas',
          analyzed: true,
          analyzing: false,
        }
      } else {
        const boxes = detectBoxesInImageData(photo.imageData, boxParams)
        convertedPhoto = {
          ...photo,
          boxes,
          count: boxes.length,
          engine: isOpenCvReady() ? 'opencv' : 'canvas',
          analyzed: true,
          analyzing: false,
        }
      }
    }

    if (fromMode === 'cap') {
      setCapPhotos((prev) => prev.filter((p) => p.id !== photoId))
      setBoxPhotos((prev) => [...prev, convertedPhoto])
    } else {
      setBoxPhotos((prev) => prev.filter((p) => p.id !== photoId))
      setCapPhotos((prev) => [...prev, convertedPhoto])
    }

    setActivePhotoKey({ mode: toMode, id: photoId })
    setHasSaved(false)
    setHasInspected(true)

    if (!photo.imageData) {
      if (toMode === 'cap') {
        runSequentialAnalysis([{ ...convertedPhoto, analyzing: true }], [], capParams, boxParams)
      } else {
        runSequentialAnalysis([], [{ ...convertedPhoto, analyzing: true }], capParams, boxParams)
      }
    }
  }

  // 드래그 앤 드롭 이벤트 핸들러
  function handleDragEnter(mode, event) {
    event.preventDefault()
    event.stopPropagation()
    setDragOverMode(mode)
  }

  function handleDragOver(mode, event) {
    event.preventDefault()
    event.stopPropagation()
    if (dragOverMode !== mode) {
      setDragOverMode(mode)
    }
  }

  function handleDragLeave(event) {
    event.preventDefault()
    event.stopPropagation()
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setDragOverMode(null)
    }
  }

  function handleDrop(mode, event) {
    event.preventDefault()
    event.stopPropagation()
    setDragOverMode(null)
    if (isAnalyzing) return
    addPhotosForMode(mode, event.dataTransfer?.files)
  }

  function removePhoto(mode, photoId) {
    const list = mode === 'cap' ? capPhotos : boxPhotos
    const target = list.find((item) => item.id === photoId)
    if (target?.previewUrl) {
      URL.revokeObjectURL(target.previewUrl)
      objectUrlsRef.current.delete(target.previewUrl)
    }

    const nextCaps = mode === 'cap' ? capPhotos.filter((item) => item.id !== photoId) : capPhotos
    const nextBoxes = mode === 'box' ? boxPhotos.filter((item) => item.id !== photoId) : boxPhotos

    if (mode === 'cap') {
      setCapPhotos(nextCaps)
    } else {
      setBoxPhotos(nextBoxes)
    }

    if (activePhotoKey?.mode === mode && activePhotoKey?.id === photoId) {
      if (nextCaps.length > 0) {
        setActivePhotoKey({ mode: 'cap', id: nextCaps[0].id })
      } else if (nextBoxes.length > 0) {
        setActivePhotoKey({ mode: 'box', id: nextBoxes[0].id })
      } else {
        setActivePhotoKey(null)
      }
    }

    if (nextCaps.length === 0 && nextBoxes.length === 0) {
      setHasInspected(false)
    }
    setHasSaved(false)
  }

  function handleRequestClearAll() {
    openModal({
      title: '등록한 사진을 모두 비울까요?',
      message: '현재 올려둔 캡 뚜껑 모드 사진과 박스 모드 사진 및 계산 결과가 모두 초기화됩니다.',
      confirmLabel: '모두 비우기',
      cancelLabel: '취소',
      danger: true,
      onConfirm: () => {
        analysisRunIdRef.current += 1
        capPhotos.forEach((p) => {
          URL.revokeObjectURL(p.previewUrl)
          objectUrlsRef.current.delete(p.previewUrl)
        })
        boxPhotos.forEach((p) => {
          URL.revokeObjectURL(p.previewUrl)
          objectUrlsRef.current.delete(p.previewUrl)
        })
        setCapPhotos([])
        setBoxPhotos([])
        setActivePhotoKey(null)
        setIsAnalyzing(false)
        setAnalysisProgress({ active: false, current: 0, total: 0, fileName: '' })
        setHasInspected(false)
        setHasSaved(false)
        setAnalysisError('')
        setSaveError('')
        closeModal()
      },
    })
  }

  // 하단 "바이알 갯수 계산" 버튼 클릭 시 전체 사진을 순차 일괄 재검수합니다.
  function handleCalculate() {
    if ((capPhotos.length === 0 && boxPhotos.length === 0) || isAnalyzing) return

    setCapPhotos((prev) => prev.map((p) => ({ ...p, analyzing: true })))
    setBoxPhotos((prev) => prev.map((p) => ({ ...p, analyzing: true })))
    runSequentialAnalysis(capPhotos, boxPhotos, capParams, boxParams)
  }

  // 캡 뚜껑 모드 슬라이더 실시간 디바운스 보정 (민감도 0.15~0.70 대응 및 즉시 갱신)
  function handleChangeCapParams(nextParams) {
    setCapParams(nextParams)
    setHasSaved(false)

    if (sliderDebounceRef.current) clearTimeout(sliderDebounceRef.current)
    sliderDebounceRef.current = setTimeout(() => {
      window.requestAnimationFrame(async () => {
        const targetId = activePhotoKey?.mode === 'cap' ? activePhotoKey.id : null
        const confThresh = Math.max(0.15, Math.min(0.70, (nextParams.sensitivity || 35) / 100))

        setCapPhotos((prev) => {
          return prev.map((photo) => {
            if (applyScope === 'active' && targetId && photo.id !== targetId) return photo
            if (photo.rawYoloDetections && photo.rawYoloDetections.length > 0) {
              // YOLO 원본 디텍션에서 새 confidence 기준으로 즉시 필터링
              const filtered = photo.rawYoloDetections.filter(
                (d) => d.classId === 1 && d.confidence >= confThresh
              )
              const circles = filtered.map((d, idx) => ({
                id: `yolo-cap-${idx + 1}`,
                x: (d.normX1 + d.normX2) / 2,
                y: (d.normY1 + d.normY2) / 2,
                r: Math.max(d.normW, d.normH) / 2,
                confidence: d.confidence,
                source: 'yolo',
              }))
              return {
                ...photo,
                circles,
                count: circles.length,
              }
            } else if (photo.imageData) {
              const circles = detectVialsInImageData(photo.imageData, nextParams)
              return {
                ...photo,
                circles,
                count: circles.length,
              }
            }
            return photo
          })
        })
      })
    }, 200)
  }

  // 박스 모드 슬라이더 실시간 디바운스 보정
  function handleChangeBoxParams(nextParams) {
    setBoxParams(nextParams)
    setHasSaved(false)

    if (sliderDebounceRef.current) clearTimeout(sliderDebounceRef.current)
    sliderDebounceRef.current = setTimeout(() => {
      window.requestAnimationFrame(async () => {
        const targetId = activePhotoKey?.mode === 'box' ? activePhotoKey.id : null
        const confThresh = Math.max(0.15, Math.min(0.70, (nextParams.sensitivity || 35) / 100))

        setBoxPhotos((prev) => {
          return prev.map((photo) => {
            if (applyScope === 'active' && targetId && photo.id !== targetId) return photo
            if (photo.rawYoloDetections && photo.rawYoloDetections.length > 0) {
              // YOLO 원본 디텍션에서 새 confidence 기준으로 즉시 필터링
              const filtered = photo.rawYoloDetections.filter(
                (d) => d.classId === 0 && d.confidence >= confThresh
              )
              const boxes = filtered.map((d, idx) => ({
                id: `yolo-box-${idx + 1}`,
                x: d.normX1,
                y: d.normY1,
                w: d.normW,
                h: d.normH,
                confidence: d.confidence,
                source: 'yolo',
              }))
              return {
                ...photo,
                boxes,
                count: boxes.length,
              }
            } else if (photo.imageData) {
              const boxes = detectBoxesInImageData(photo.imageData, nextParams)
              return {
                ...photo,
                boxes,
                count: boxes.length,
              }
            }
            return photo
          })
        })
      })
    }, 200)
  }

  function handleResetParams(mode) {
    if (mode === 'box') {
      handleChangeBoxParams(DEFAULT_BOX_PARAMS)
    } else {
      handleChangeCapParams(DEFAULT_DETECTION_PARAMS)
    }
  }

  // 캡 뚜껑 모드 확대 오버레이 클릭 시 원형 마커 추가/제외
  function handleToggleCircleAtPoint(photoId, nx, ny) {
    setHasSaved(false)
    setCapPhotos((prev) =>
      prev.map((photo) => {
        if (photo.id !== photoId) return photo
        const currentCircles = photo.circles || []

        const hitIndex = currentCircles.findIndex((c) => {
          const dist = Math.hypot(c.x - nx, c.y - ny)
          return dist <= Math.max(c.r * 1.25, 0.03)
        })

        let nextCircles
        if (hitIndex !== -1) {
          nextCircles = currentCircles.filter((_, idx) => idx !== hitIndex)
        } else {
          const avgRadius = (capParams.minRadius + capParams.maxRadius) / 2
          const normRadius = avgRadius / Math.max(100, photo.analysisWidth || 1200)
          nextCircles = [
            ...currentCircles,
            {
              id: `manual-${Date.now()}`,
              x: nx,
              y: ny,
              r: normRadius,
              confidence: 1,
              source: 'manual',
            },
          ]
        }

        return {
          ...photo,
          circles: nextCircles,
          count: nextCircles.length,
        }
      })
    )
  }

  // 박스 모드 확대 오버레이 클릭 시 사각형 마커 추가/제외
  function handleToggleBoxAtPoint(photoId, nx, ny) {
    setHasSaved(false)
    setBoxPhotos((prev) =>
      prev.map((photo) => {
        if (photo.id !== photoId) return photo
        const currentBoxes = photo.boxes || []

        const hitIndex = currentBoxes.findIndex(
          (b) => nx >= b.x && nx <= b.x + b.w && ny >= b.y && ny <= b.y + b.h
        )

        let nextBoxes
        if (hitIndex !== -1) {
          nextBoxes = currentBoxes.filter((_, idx) => idx !== hitIndex)
        } else {
          const avgSide = (boxParams.minSize + boxParams.maxSize) * 0.38
          const normW = Math.min(0.45, Math.max(0.08, avgSide / Math.max(100, photo.analysisWidth || 1200)))
          const normH = Math.min(0.45, Math.max(0.08, avgSide / Math.max(100, photo.analysisHeight || 900)))
          const bx = Math.max(0, Math.min(1 - normW, nx - normW / 2))
          const by = Math.max(0, Math.min(1 - normH, ny - normH / 2))

          nextBoxes = [
            ...currentBoxes,
            {
              id: `box-manual-${Date.now()}`,
              x: bx,
              y: by,
              w: normW,
              h: normH,
              confidence: 1,
              source: 'manual',
            },
          ]
        }

        return {
          ...photo,
          boxes: nextBoxes,
          count: nextBoxes.length,
        }
      })
    )
  }

  // 캡 모드: 사용자가 사진 위 특정 캡을 클릭하면 그 캡을 기준 템플릿으로 삼아 전체 재매칭합니다.
  function handleSelectTemplatePoint(photoId, pt) {
    setHasSaved(false)
    setCapPhotos((prev) =>
      prev.map((photo) => {
        if (photo.id !== photoId || !photo.imageData) return photo
        // 클릭한 좌표를 templatePoint로 저장하고 즉시 재검출
        const circles = detectVialsInImageData(photo.imageData, capParams, pt)
        return {
          ...photo,
          templatePoint: pt,
          circles,
          count: circles.length,
          engine: isOpenCvReady() ? 'opencv' : 'canvas',
        }
      })
    )
  }

  // 박스 모드: 사용자가 드래그한 앞면 영역(ROI)으로 즉시 재검출합니다.
  function handleSetBoxRoi(photoId, roi) {
    setHasSaved(false)
    setBoxPhotos((prev) =>
      prev.map((photo) => {
        if (photo.id !== photoId || !photo.imageData) return photo
        // roi가 null이면 기본값(하단 60%) 적용
        const boxes = detectBoxesInImageData(photo.imageData, boxParams, roi)
        return {
          ...photo,
          boxRoi: roi,
          boxes,
          count: boxes.length,
          engine: isOpenCvReady() ? 'opencv' : 'canvas',
        }
      })
    )
  }

  // 카트 박스 사진의 인식 박스 수를 스테퍼(−/+)로 보정합니다.
  function handleAdjustBoxCount(photoId, deltaOrValue, isAbsolute = false) {
    setHasSaved(false)
    setBoxPhotos((prev) =>
      prev.map((photo) => {
        if (photo.id !== photoId) return photo
        const nextCount = isAbsolute
          ? Math.max(0, Math.min(999, Number(deltaOrValue) || 0))
          : Math.max(0, Math.min(999, (photo.count || 0) + deltaOrValue))
        return { ...photo, count: nextCount }
      })
    )
  }

  // 최종 수량 합산 계산 (사진 추가/삭제/모드 전환/슬라이더/박스당 수량 변경 즉시 반영)
  const parsedVialsPerBox = Number(vialsPerBox)
  const safeVialsPerBox =
    Number.isFinite(parsedVialsPerBox) && parsedVialsPerBox >= 1 ? Math.floor(parsedVialsPerBox) : 0
  const totalCapVials = capPhotos.reduce((sum, p) => sum + (p.count || 0), 0)
  const totalBoxes = boxPhotos.reduce((sum, p) => sum + (p.count || 0), 0)
  const totalBoxVials = totalBoxes * safeVialsPerBox
  const grandTotalVials = totalCapVials + totalBoxVials
  const hasAnyPhotos = capPhotos.length > 0 || boxPhotos.length > 0

  // 검수 결과 저장 및 저장 실패 시 UX 문구 원칙 기반 상세 안내
  function handleSaveRecord() {
    setSaveError('')

    try {
      if (boxPhotos.length > 0 && (!Number.isFinite(parsedVialsPerBox) || parsedVialsPerBox < 1)) {
        const err = new Error('유효하지 않은 1박스당 수량')
        err.code = 'INVALID_BOX_QUANTITY'
        throw err
      }

      const now = new Date()
      const pad = (n) => String(n).padStart(2, '0')
      const formattedDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
        now.getHours()
      )}:${pad(now.getMinutes())}`

      // 설정 화면에서 등록된 기본 부서 가져오기 (등록된 부서가 없으면 빈 문자열)
      let defaultTeam = ''
      try {
        const rawDepts = window.localStorage.getItem(STORAGE_DEPARTMENTS_KEY)
        if (rawDepts) {
          const parsedDepts = JSON.parse(rawDepts)
          if (Array.isArray(parsedDepts) && parsedDepts.length > 0) {
            const def = parsedDepts.find((d) => d.isDefault) || parsedDepts[0]
            if (def?.name) defaultTeam = def.name
          }
        }
      } catch (e) {
        // 부서 읽기 오류 시 미지정 유지
      }

      const newRecord = {
        id: `INS-${Date.now()}`,
        date: formattedDate,
        productName: '현장 촬영 검수',
        round: '1차',
        team: defaultTeam,
        count: grandTotalVials,
        capCount: totalCapVials,
        boxCount: totalBoxes,
        vialsPerBox: safeVialsPerBox,
        photoCount: capPhotos.length + boxPhotos.length,
      }

      const raw = window.localStorage.getItem(STORAGE_RECORDS_KEY)
      const existing = raw ? JSON.parse(raw) : []
      if (!Array.isArray(existing)) {
        throw new Error('기존 기록 저장소 형식이 손상되었습니다')
      }

      window.localStorage.setItem(STORAGE_RECORDS_KEY, JSON.stringify([newRecord, ...existing]))
      setHasSaved(true)
      showToast('검수 기록을 저장했습니다. [기록] 화면에서 다시 확인할 수 있습니다.')
    } catch (err) {
      const errorMsg = buildSaveErrorMessage(err, '검수 기록')
      setSaveError(errorMsg)
      openModal({
        title: '검수 기록을 저장하지 못했습니다',
        message: errorMsg,
      })
    }
  }

  return (
    <>
      {/* 숨겨진 파일 입력 (카메라/앨범 다중 선택 지원) */}
      <input
        ref={capInputRef}
        type="file"
        accept="image/*"
        multiple
        className="jt-sr-only"
        onChange={handleCapFileChange}
      />
      <input
        ref={boxInputRef}
        type="file"
        accept="image/*"
        multiple
        className="jt-sr-only"
        onChange={handleBoxFileChange}
      />

      {/* 0. 화면 최상단: 전체 총합계 크게 표시 + 기본 설정('박스 1개당 바이알 개수', localStorage 자동 저장) */}
      <section className="jt-card jt-stack-3" aria-label="총 바이알 합계 및 박스 기본 설정">
        <div
          className="jt-row"
          style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)' }}
        >
          <div className="jt-stat">
            <span className="jt-stat-label">
              총 바이알 합계 (캡 뚜껑 모드 + 박스 모드 전체)
            </span>
            <div className="jt-stat-value jt-display-sm">
              {`총 ${grandTotalVials.toLocaleString()}`}
              <span className="jt-stat-unit">개</span>
            </div>
          </div>

          {/* 기본 설정 입력칸: 박스 1개당 바이알 개수 (기본값 50, 자동 저장) */}
          <div className="jt-stack-2" style={{ gap: 'var(--space-1)', alignItems: 'flex-end' }}>
            <label htmlFor="top-vials-per-box" className="jt-label" style={{ margin: 0 }}>
              박스 1개당 바이알 개수 (자동 저장)
            </label>
            <div className="jt-row" style={{ gap: 'var(--space-2)' }}>
              <input
                id="top-vials-per-box"
                type="number"
                min="1"
                className="jt-input jt-num"
                value={vialsPerBox}
                onChange={(e) => handleVialsPerBoxChange(e.target.value)}
                aria-invalid={safeVialsPerBox < 1 ? 'true' : undefined}
                style={{
                  minHeight: 'var(--control-height-sm)',
                  width: 'auto',
                  maxWidth: '7em',
                  textAlign: 'right',
                  fontWeight: 700,
                }}
              />
              <span className="jt-num">개</span>
            </div>
          </div>
        </div>

        {/* 모드별 합계 실시간 요약 및 빠른 액션 */}
        <div className="jt-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <div className="jt-row" style={{ gap: 'var(--space-4)' }}>
            <span className="jt-help jt-num">
              {`캡 뚜껑 모드 (${capPhotos.length}/${MAX_PHOTOS_PER_MODE}장): `}
              <strong>{`${totalCapVials.toLocaleString()}개`}</strong>
            </span>
            <span className="jt-help jt-num">
              {`박스 모드 (${boxPhotos.length}/${MAX_PHOTOS_PER_MODE}장): `}
              <strong>
                {`박스 ${totalBoxes}개 × ${safeVialsPerBox} = ${totalBoxVials.toLocaleString()}개`}
              </strong>
            </span>
          </div>

          <div className="jt-row" style={{ gap: 'var(--space-2)' }}>
            <span className="jt-tag">
              {yoloEngineReady
                ? 'YOLO26 온디바이스 활성'
                : cvEngineReady
                ? 'OpenCV.js 활성'
                : '내장 비전 엔진'}
            </span>
            {hasAnyPhotos && (
              <>
                <button
                  type="button"
                  className="jt-btn jt-btn-sm"
                  onClick={handleSaveRecord}
                  disabled={isAnalyzing}
                >
                  <span className="jt-ico jt-ico-sm" aria-hidden="true">
                    save
                  </span>
                  {hasSaved ? '저장됨' : '검수 기록 저장'}
                </button>
                <button
                  type="button"
                  className="jt-btn-ghost jt-btn-sm"
                  onClick={handleRequestClearAll}
                >
                  <span className="jt-ico jt-ico-sm" aria-hidden="true">
                    delete_sweep
                  </span>
                  전체 비우기
                </button>
              </>
            )}
          </div>
        </div>

        {settingsSaveError && (
          <div className="jt-note jt-note-error" role="alert">
            {settingsSaveError}
          </div>
        )}
      </section>

      {/* 분석 오류 배너 */}
      {analysisError && (
        <div className="jt-note jt-note-error" role="alert">
          {analysisError}
        </div>
      )}

      {/* 저장 오류 배너 */}
      {saveError && (
        <div className="jt-note jt-note-error" role="alert">
          {saveError}
        </div>
      )}

      {/* 1. 기존 화면 모양 유지: 두 가지 모드가 동시에 존재하는 2열 듀얼 카드 (+ 드래그 앤 드롭 지원) */}
      <div className="jt-grid-cards" style={{ '--jt-grid-min': '16rem', alignItems: 'stretch' }}>
        {/* 모드 1: 캡 뚜껑 모드 사진 등록 (상단 촬영) */}
        <section
          className="jt-card jt-stack-3"
          aria-label="캡 뚜껑 모드 사진 등록"
          onDragEnter={(e) => handleDragEnter('cap', e)}
          onDragOver={(e) => handleDragOver('cap', e)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop('cap', e)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            borderColor: dragOverMode === 'cap' ? 'var(--color-accent)' : undefined,
            backgroundColor: dragOverMode === 'cap' ? 'var(--color-accent-bg)' : undefined,
          }}
        >
          <div
            className="jt-row"
            style={{
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              minHeight: 'var(--control-height-lg)',
            }}
          >
            <div className="jt-stack-2" style={{ gap: 'var(--space-1)' }}>
              <div className="jt-row" style={{ gap: 'var(--space-2)' }}>
                <span className="jt-ico" aria-hidden="true">
                  camera_indoor
                </span>
                <h2 style={{ margin: 0, fontSize: 'var(--fs-base)', fontWeight: 700 }}>
                  캡 뚜껑 모드 (상단 촬영)
                </h2>
              </div>
              <p className="jt-help" style={{ margin: 0, fontSize: 'var(--fs-xs)' }}>
                위에서 수직으로 찍은 둥근 뚜껑 사진 (최대 5장)
              </p>
            </div>
            <span className="jt-badge jt-num">
              {capPhotos.length} / {MAX_PHOTOS_PER_MODE}장
            </span>
          </div>

          <button
            type="button"
            className="jt-btn"
            onClick={() => capInputRef.current?.click()}
            disabled={capPhotos.length >= MAX_PHOTOS_PER_MODE || isAnalyzing}
            style={{ width: '100%' }}
          >
            <span className="jt-ico" aria-hidden="true">
              add_a_photo
            </span>
            캡 사진 추가 (상단)
          </button>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 'var(--space-12)' }}>
            {capPhotos.length === 0 ? (
              <div
                className="jt-empty"
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  padding: 'var(--space-6) var(--space-3)',
                  backgroundColor: dragOverMode === 'cap' ? 'var(--color-accent-bg)' : 'var(--color-bg-layout)',
                  borderRadius: 'var(--r-md)',
                }}
              >
                <span className="jt-ico jt-ico-lg" aria-hidden="true">
                  grid_view
                </span>
                <p className="jt-empty-title" style={{ fontSize: 'var(--fs-sm)' }}>
                  등록된 캡 사진이 없습니다 (최대 5장)
                </p>
                <p className="jt-empty-desc" style={{ fontSize: 'var(--fs-xs)', margin: 0 }}>
                  위 버튼을 누르거나 바이알 사진을 이곳으로 끌어다 놓으세요.
                </p>
              </div>
            ) : (
              <ul className="jt-list">
                {capPhotos.map((item, idx) => (
                  <li key={item.id} className="jt-list-item">
                    <img
                      src={item.previewUrl}
                      alt={item.name}
                      className="jt-avatar jt-r-sm"
                    />
                    <div className="jt-card-row-main">
                      <div className="jt-card-row-title" style={{ fontSize: 'var(--fs-sm)' }}>
                        <span className="jt-num">#{idx + 1}</span> {item.name}
                      </div>
                      <span className="jt-card-row-meta">{item.sizeLabel}</span>
                    </div>
                    {item.analyzing ? (
                      <span className="jt-loader" role="status" aria-label={`${item.name} 분석 중`} />
                    ) : item.analyzed ? (
                      <span className="jt-badge jt-badge-pass jt-num">{item.count}개</span>
                    ) : null}
                    <button
                      type="button"
                      className="jt-btn-ghost jt-btn-sm"
                      onClick={() => handleSwitchPhotoMode(item.id, 'cap', 'box')}
                      aria-label={`${item.name}을 박스 모드로 전환`}
                      title="박스 모드로 전환"
                    >
                      박스 모드로
                    </button>
                    <button
                      type="button"
                      className="jt-icon-btn"
                      onClick={() => removePhoto('cap', item.id)}
                      aria-label={`${item.name} 삭제`}
                      title="사진 삭제"
                    >
                      <span className="jt-ico jt-ico-sm" aria-hidden="true">
                        close
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* 모드 2: 박스 모드 사진 등록 (측면 촬영) + 사진 추가 버튼 아래 바이알 수량 입력칸 */}
        <section
          className="jt-card jt-stack-3"
          aria-label="박스 모드 사진 등록"
          onDragEnter={(e) => handleDragEnter('box', e)}
          onDragOver={(e) => handleDragOver('box', e)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop('box', e)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            borderColor: dragOverMode === 'box' ? 'var(--color-accent)' : undefined,
            backgroundColor: dragOverMode === 'box' ? 'var(--color-accent-bg)' : undefined,
          }}
        >
          <div
            className="jt-row"
            style={{
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              minHeight: 'var(--control-height-lg)',
            }}
          >
            <div className="jt-stack-2" style={{ gap: 'var(--space-1)' }}>
              <div className="jt-row" style={{ gap: 'var(--space-2)' }}>
                <span className="jt-ico" aria-hidden="true">
                  local_shipping
                </span>
                <h2 style={{ margin: 0, fontSize: 'var(--fs-base)', fontWeight: 700 }}>
                  박스 모드 (카트 적재)
                </h2>
              </div>
              <p className="jt-help" style={{ margin: 0, fontSize: 'var(--fs-xs)' }}>
                사각형 박스 앞면·윗면이 보이는 사진 (최대 5장)
              </p>
            </div>
            <span className="jt-badge jt-num">
              {boxPhotos.length} / {MAX_PHOTOS_PER_MODE}장
            </span>
          </div>

          <button
            type="button"
            className="jt-btn"
            onClick={() => boxInputRef.current?.click()}
            disabled={boxPhotos.length >= MAX_PHOTOS_PER_MODE || isAnalyzing}
            style={{ width: '100%' }}
          >
            <span className="jt-ico" aria-hidden="true">
              add_a_photo
            </span>
            박스 사진 추가 (측면)
          </button>

          {/* 1박스당 바이알 수량 입력칸 (상단 기본 설정과 실시간 양방향 동기화) */}
          <div
            className="jt-row"
            style={{
              backgroundColor: 'var(--color-bg-layout)',
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--r-md)',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <label htmlFor="vials-per-box" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600 }}>
              1박스당 바이알 수량:
            </label>
            <div className="jt-row" style={{ alignItems: 'center', gap: 'var(--space-2)' }}>
              <input
                id="vials-per-box"
                type="number"
                min="1"
                className="jt-input jt-num"
                value={vialsPerBox}
                onChange={(e) => handleVialsPerBoxChange(e.target.value)}
                aria-invalid={boxPhotos.length > 0 && safeVialsPerBox < 1 ? 'true' : undefined}
                style={{
                  minHeight: 'var(--control-height-sm)',
                  width: 'auto',
                  maxWidth: '6em',
                  textAlign: 'right',
                  fontWeight: 700,
                }}
              />
              <span className="jt-num" style={{ fontSize: 'var(--fs-xs)' }}>
                개
              </span>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 'var(--space-12)' }}>
            {boxPhotos.length === 0 ? (
              <div
                className="jt-empty"
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  padding: 'var(--space-6) var(--space-3)',
                  backgroundColor: dragOverMode === 'box' ? 'var(--color-accent-bg)' : 'var(--color-bg-layout)',
                  borderRadius: 'var(--r-md)',
                }}
              >
                <span className="jt-ico jt-ico-lg" aria-hidden="true">
                  inventory_2
                </span>
                <p className="jt-empty-title" style={{ fontSize: 'var(--fs-sm)' }}>
                  등록된 박스 사진이 없습니다 (최대 5장)
                </p>
                <p className="jt-empty-desc" style={{ fontSize: 'var(--fs-xs)', margin: 0 }}>
                  위 버튼을 누르거나 카트 박스 사진을 이곳으로 끌어다 놓으세요.
                </p>
              </div>
            ) : (
              <ul className="jt-list">
                {boxPhotos.map((item, idx) => (
                  <li key={item.id} className="jt-list-item">
                    <img
                      src={item.previewUrl}
                      alt={item.name}
                      className="jt-avatar jt-r-sm"
                    />
                    <div className="jt-card-row-main">
                      <div className="jt-card-row-title" style={{ fontSize: 'var(--fs-sm)' }}>
                        <span className="jt-num">#{idx + 1}</span> {item.name}
                      </div>
                      <span className="jt-card-row-meta">{item.sizeLabel}</span>
                    </div>
                    {item.analyzing ? (
                      <span className="jt-loader" role="status" aria-label={`${item.name} 분석 중`} />
                    ) : item.analyzed ? (
                      <span className="jt-badge jt-badge-pass jt-num">
                        {`${item.count}박스 (${(item.count * safeVialsPerBox).toLocaleString()}개)`}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="jt-btn-ghost jt-btn-sm"
                      onClick={() => handleSwitchPhotoMode(item.id, 'box', 'cap')}
                      aria-label={`${item.name}을 캡 뚜껑 모드로 전환`}
                      title="캡 뚜껑 모드로 전환"
                    >
                      캡 모드로
                    </button>
                    <button
                      type="button"
                      className="jt-icon-btn"
                      onClick={() => removePhoto('box', item.id)}
                      aria-label={`${item.name} 삭제`}
                      title="사진 삭제"
                    >
                      <span className="jt-ico jt-ico-sm" aria-hidden="true">
                        close
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* 2. 최종 계산 버튼 ("바이알 갯수 계산") */}
      <section className="jt-stack-4">
        <button
          type="button"
          className="jt-btn jt-btn-lg"
          disabled={!hasAnyPhotos || isAnalyzing}
          data-loading={isAnalyzing ? 'true' : undefined}
          onClick={handleCalculate}
          style={{ width: '100%' }}
        >
          {isAnalyzing && analysisProgress.active
            ? `순차 분석 중 (${analysisProgress.current} / ${analysisProgress.total}장)`
            : '바이알 갯수 계산'}
        </button>

        {/* 자동 순차 분석 진행 표시 카드 */}
        {isAnalyzing && (
          <div className="jt-card jt-empty" role="status" aria-live="polite">
            <span className="jt-loader jt-loader-lg" role="status" aria-label="바이알 이미지 순차 분석 중" />
            <p className="jt-empty-title">
              {analysisProgress.active
                ? `모드별 자동 순차 분석 진행 중 (${analysisProgress.current} / ${analysisProgress.total}장)`
                : '사진을 가로 1200 해상도로 맞추어 분석하고 있습니다'}
            </p>
            <p className="jt-empty-desc">
              {analysisProgress.fileName
                ? `현재 분석 파일: ${analysisProgress.fileName}`
                : '원형 뚜껑과 사각형 박스 윤곽선을 차례대로 파악하고 있습니다.'}
            </p>
          </div>
        )}

        {/* 3. 결과 표시 영역: 마커 썸네일 갤러리 + 확대 슬라이더 보정 뷰어 + 상세 내역 표 */}
        {hasInspected && hasAnyPhotos && (
          <div className="jt-stack-4">
            {/* 각 사진의 마커 오버레이 썸네일, 모드 전환 토글, 개별 개수를 보여주는 갤러리 뷰 */}
            <VialPhotoGallery
              capPhotos={capPhotos}
              boxPhotos={boxPhotos}
              safeVialsPerBox={safeVialsPerBox}
              activePhotoKey={activePhotoKey}
              onSelectPhoto={(mode, id) => setActivePhotoKey({ mode, id })}
              onSwitchPhotoMode={handleSwitchPhotoMode}
              onRemovePhoto={removePhoto}
            />

            {/* 확대 마커 보정 뷰어 + 선택된 사진의 모드에 맞는 민감도/크기 슬라이더 */}
            <VialCountInspector
              capPhotos={capPhotos}
              boxPhotos={boxPhotos}
              activePhotoKey={activePhotoKey}
              onSelectPhoto={(mode, id) => setActivePhotoKey({ mode, id })}
              onSwitchPhotoMode={handleSwitchPhotoMode}
              capParams={capParams}
              boxParams={boxParams}
              onChangeCapParams={handleChangeCapParams}
              onChangeBoxParams={handleChangeBoxParams}
              onResetParams={handleResetParams}
              onToggleCircleAtPoint={handleToggleCircleAtPoint}
              onToggleBoxAtPoint={handleToggleBoxAtPoint}
              onSelectTemplatePoint={handleSelectTemplatePoint}
              onSetBoxRoi={handleSetBoxRoi}
              safeVialsPerBox={safeVialsPerBox}
              applyScope={applyScope}
              onChangeApplyScope={setApplyScope}
            />

            {/* 사진별 개별 검출 내역 표 */}
            <section className="jt-stack-2" aria-label="사진별 개별 내역">
              <div className="jt-row" style={{ justifyContent: 'space-between' }}>
                <span className="jt-help">사진별 개별 검출 내역</span>
                <span className="jt-tag">
                  <span className="jt-ico jt-ico-sm" aria-hidden="true">
                    calculate
                  </span>
                  실시간 합계 반영됨
                </span>
              </div>

              <div className="jt-table-wrap">
                <table className="jt-table">
                  <thead>
                    <tr>
                      <th>구분</th>
                      <th>파일명</th>
                      <th style={{ textAlign: 'right' }}>인식 수량</th>
                      <th>계산 방식</th>
                      <th style={{ textAlign: 'right' }}>환산 바이알 수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {capPhotos.map((item, idx) => (
                      <tr key={item.id}>
                        <td>
                          <span className="jt-tag">
                            <span className="jt-ico jt-ico-sm" aria-hidden="true">
                              camera_indoor
                            </span>
                            {`캡 뚜껑 #${idx + 1}`}
                          </span>
                        </td>
                        <td>{item.name}</td>
                        <td className="jt-num">{item.analyzing ? '분석 중' : `${item.count} 개`}</td>
                        <td>
                          {item.engine === 'yolo-onnx'
                            ? 'YOLO26 온디바이스 탐지'
                            : '원형 템플릿 매칭 + 수동 보정'}
                        </td>
                        <td className="jt-num" style={{ fontWeight: 700 }}>
                          {item.analyzing ? '—' : `${item.count.toLocaleString()} 개`}
                        </td>
                      </tr>
                    ))}
                    {boxPhotos.map((item, idx) => {
                      const converted = item.count * safeVialsPerBox
                      return (
                        <tr key={item.id}>
                          <td>
                            <span className="jt-tag">
                              <span className="jt-ico jt-ico-sm" aria-hidden="true">
                                local_shipping
                              </span>
                              {`박스 #${idx + 1}`}
                            </span>
                          </td>
                          <td>{item.name}</td>
                          <td className="jt-num">
                            <div className="jt-stepper">
                              <button
                                type="button"
                                className="jt-stepper-btn"
                                onClick={() => handleAdjustBoxCount(item.id, -1)}
                                aria-label={`${item.name} 박스 수량 1 줄이기`}
                              >
                                −
                              </button>
                              <input
                                type="number"
                                className="jt-stepper-input"
                                value={item.count}
                                onChange={(e) => handleAdjustBoxCount(item.id, e.target.value, true)}
                                aria-label={`${item.name} 박스 수량`}
                              />
                              <button
                                type="button"
                                className="jt-stepper-btn"
                                onClick={() => handleAdjustBoxCount(item.id, 1)}
                                aria-label={`${item.name} 박스 수량 1 늘리기`}
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td>
                            {item.engine === 'yolo-onnx'
                              ? 'YOLO26 온디바이스 탐지'
                              : '앞면 ROI 수평 경계선 검출'}
                          </td>
                          <td className="jt-num" style={{ fontWeight: 700 }}>
                            {item.analyzing ? '—' : `${converted.toLocaleString()} 개`}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </section>

      {/* 인앱 확인 / 오류 안내 모달 (브라우저 alert/confirm 대신 사용) */}
      {modalState.open && (
        <div
          className="jt-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal()
          }}
        >
          <div
            className="jt-modal jt-modal-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="capture-modal-title"
          >
            <h3 id="capture-modal-title" className="jt-modal-title">
              {modalState.title}
            </h3>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
              {modalState.message}
            </p>
            <div className="jt-modal-actions">
              {modalState.cancelLabel && (
                <button type="button" className="jt-btn-ghost" onClick={closeModal}>
                  {modalState.cancelLabel}
                </button>
              )}
              <button
                ref={modalConfirmBtnRef}
                type="button"
                className={modalState.danger ? 'jt-btn-danger' : 'jt-btn'}
                onClick={modalState.onConfirm || closeModal}
              >
                {modalState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 저장 완료 토스트 알림 */}
      {toastMessage && (
        <div className="jt-toast-area" role="status" aria-live="polite">
          <div className="jt-toast">{toastMessage}</div>
        </div>
      )}
    </>
  )
}
