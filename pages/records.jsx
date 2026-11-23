import { useEffect, useState } from 'react'
import Link from 'next/link'

// 로컬 저장소 키 (촬영 화면 및 설정 화면과 동일한 키 공유)
export const STORAGE_RECORDS_KEY = 'jt-vial-records'
export const STORAGE_DEPARTMENTS_KEY = 'jt-vial-departments'

// JT 디자인 시스템 UX 문구 원칙(사과 없이 무엇이 잘못됐고 어떻게 해결하는지 안내)에 따른 오류 문구
function buildSaveErrorMessage(err, targetLabel = '검수 기록') {
  if (err?.name === 'QuotaExceededError' || err?.code === 22 || err?.code === 1014) {
    return `브라우저 저장 공간이 가득 차서 ${targetLabel}을(를) 저장하지 못했습니다. 불필요한 이전 데이터를 삭제하거나 브라우저 저장 공간을 확보한 뒤 다시 시도해 주세요.`
  }
  if (err?.name === 'SecurityError') {
    return `브라우저 설정에서 기기 내 데이터 저장이 차단되어 ${targetLabel}을(를) 저장하지 못했습니다. 시크릿(비공개) 모드를 해제하거나 사이트 데이터 저장 권한을 허용한 뒤 다시 시도해 주세요.`
  }
  return `${targetLabel}을(를) 처리하는 중 오류가 발생했습니다(원인: ${
    err?.message || '알 수 없는 저장소 오류'
  }). 화면을 새로고침한 뒤 다시 시도해 주세요.`
}

export default function RecordsPage() {
  // 실제 검수 기록 목록 (가짜 데이터 없이 빈 배열로 시작)
  const [records, setRecords] = useState([])
  // '설정' 화면에서 등록된 실제 담당 부서 목록 (가짜 데이터 없음)
  const [departmentOptions, setDepartmentOptions] = useState([])
  // 초기 로딩 상태
  const [isLoading, setIsLoading] = useState(true)
  // 검색어 상태
  const [searchTerm, setSearchTerm] = useState('')
  // 상세 열람할 특정 검수 기록 선택 상태
  const [selectedRecord, setSelectedRecord] = useState(null)

  // 앱 내 모달 상태 (브라우저 기본 alert, confirm 대체)
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    isConfirm: false,
    isDanger: false,
    confirmText: '확인',
    onConfirm: null,
  })

  // 모달 열기/닫기 도우미 함수
  function openAlertModal(title, message) {
    setModalState({
      isOpen: true,
      title,
      message,
      isConfirm: false,
      isDanger: false,
      confirmText: '확인',
      onConfirm: null,
    })
  }

  function openConfirmModal({ title, message, isDanger = false, confirmText = '확인', onConfirm }) {
    setModalState({
      isOpen: true,
      title,
      message,
      isConfirm: true,
      isDanger,
      confirmText,
      onConfirm,
    })
  }

  function closeModal() {
    setModalState((prev) => ({ ...prev, isOpen: false, onConfirm: null }))
  }

  // 1. 컴포넌트 마운트 시 localStorage에서 실제 검수 기록 및 실제 부서 목록 로드
  useEffect(() => {
    try {
      // 1) '촬영' 화면에서 저장된 실제 검수 기록 로드
      const rawRecords = window.localStorage.getItem(STORAGE_RECORDS_KEY)
      if (rawRecords) {
        const parsed = JSON.parse(rawRecords)
        if (Array.isArray(parsed)) {
          setRecords(parsed)
        }
      }

      // 2) '설정' 화면에서 사용자가 직접 등록한 부서 목록 로드 (가짜 데이터 채우지 않음)
      const rawDepts = window.localStorage.getItem(STORAGE_DEPARTMENTS_KEY)
      if (rawDepts) {
        const parsedDepts = JSON.parse(rawDepts)
        if (Array.isArray(parsedDepts)) {
          setDepartmentOptions(parsedDepts)
        }
      }
    } catch (err) {
      console.error('기록 및 부서 로드 실패:', err)
      openAlertModal(
        '저장된 데이터를 불러오지 못했습니다',
        '브라우저에 저장된 검수 기록 또는 부서 목록 형식이 올바르지 않습니다. 캐시를 지우거나 새로고침해 주세요.'
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 기록 목록 변경 시 localStorage에 안전하게 영구 저장하는 도우미
  function saveRecordsToStorage(updatedRecords) {
    try {
      window.localStorage.setItem(STORAGE_RECORDS_KEY, JSON.stringify(updatedRecords))
      setRecords(updatedRecords)
    } catch (err) {
      const errMsg = buildSaveErrorMessage(err, '수정된 검수 기록')
      openAlertModal('검수 기록을 저장하지 못했습니다', errMsg)
    }
  }

  // 제품명 수정 핸들러 (인라인 변경 후 즉시 로컬 저장소 반영)
  function handleProductNameChange(id, newName) {
    const next = records.map((item) =>
      item.id === id ? { ...item, productName: newName } : item
    )
    saveRecordsToStorage(next)
    if (selectedRecord?.id === id) {
      setSelectedRecord((prev) => (prev ? { ...prev, productName: newName } : null))
    }
  }

  // 차수 수정 핸들러 (자유 입력 후 즉시 로컬 저장소 반영)
  function handleRoundChange(id, newRound) {
    const next = records.map((item) =>
      item.id === id ? { ...item, round: newRound } : item
    )
    saveRecordsToStorage(next)
    if (selectedRecord?.id === id) {
      setSelectedRecord((prev) => (prev ? { ...prev, round: newRound } : null))
    }
  }

  // 담당부서 선택 핸들러 (선택 후 즉시 로컬 저장소 반영)
  function handleTeamChange(id, newTeam) {
    const next = records.map((item) =>
      item.id === id ? { ...item, team: newTeam } : item
    )
    saveRecordsToStorage(next)
    if (selectedRecord?.id === id) {
      setSelectedRecord((prev) => (prev ? { ...prev, team: newTeam } : null))
    }
  }

  // 검수 기록 개별 삭제 (앱 내 모달 확인 후 삭제)
  function handleDeleteRecord(recordToDelete) {
    openConfirmModal({
      title: '검수 기록 삭제',
      message: `${recordToDelete.date}의 "${recordToDelete.productName || '검수 기록'}" 내역을 삭제하시겠습니까? 삭제된 기록은 복구할 수 없습니다.`,
      isDanger: true,
      confirmText: '기록 삭제',
      onConfirm: () => {
        const next = records.filter((item) => item.id !== recordToDelete.id)
        saveRecordsToStorage(next)
        if (selectedRecord?.id === recordToDelete.id) {
          setSelectedRecord(null)
        }
      },
    })
  }

  // 검색어(제품명, 차수 또는 팀명)에 따라 목록 필터링
  const filteredRecords = records.filter(
    (rec) =>
      (rec.productName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (rec.round || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (rec.team || '').includes(searchTerm)
  )

  const isEmpty = records.length === 0

  return (
    <>
      {/* 메인 카드: 최근 검수 기록 */}
      <section
        className="jt-card jt-stack-4"
        aria-label="최근 검수 기록"
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: 'calc(100vh - var(--topbar-height) - var(--space-12))',
        }}
      >
        {/* 상단 헤더: 제목과 기록 건수, 그리고 [새 촬영] 바로가기 버튼 */}
        <div className="jt-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div className="jt-stack-2">
            <div className="jt-row" style={{ gap: 'var(--space-2)' }}>
              <h2 style={{ margin: 0, fontSize: 'var(--fs-xl)', fontWeight: 700 }}>
                최근 검수 기록
              </h2>
              <span className="jt-badge" style={{ alignSelf: 'center' }}>
                {isLoading ? '조회 중' : `${filteredRecords.length} 건`}
              </span>
            </div>
            <p className="jt-help" style={{ margin: 0 }}>
              최근에 사진을 촬영하고 AI로 분석했던 바이알 개수 이력을 열람합니다.
            </p>
          </div>

          <Link href="/" className="jt-btn">
            <span className="jt-ico" aria-hidden="true">
              photo_camera
            </span>
            새 사진 촬영 / 검수
          </Link>
        </div>

        {/* 검색창: 상단 배치 */}
        <div className="jt-row" style={{ gap: 'var(--space-2)' }}>
          <span className="jt-ico" aria-hidden="true" style={{ alignSelf: 'center' }}>
            search
          </span>
          <input
            type="search"
            className="jt-input"
            placeholder="제품명, 차수 또는 담당 부서를 검색하세요..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ flex: 1 }}
            aria-label="기록 검색"
            disabled={isLoading || isEmpty}
          />
          {searchTerm && (
            <button
              type="button"
              className="jt-btn jt-btn-sm"
              onClick={() => setSearchTerm('')}
            >
              초기화
            </button>
          )}
        </div>

        {/* 메인 콘텐츠 영역: 로딩 상태 / 빈 상태 / 실제 데이터 표 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {isLoading ? (
            /* 로딩 상태: 스켈레톤 화면 */
            <div className="jt-stack-3" aria-label="기록 불러오는 중" style={{ padding: 'var(--space-4) 0' }}>
              {[1, 2, 3, 4, 5].map((idx) => (
                <div
                  key={idx}
                  className="jt-skeleton"
                  style={{ minHeight: 'var(--control-height-lg)', borderRadius: 'var(--radius-md)' }}
                />
              ))}
            </div>
          ) : isEmpty || filteredRecords.length === 0 ? (
            /* 빈 상태: 기록이 전혀 없거나 검색 결과가 없을 때의 안내 화면 */
            <div
              className="jt-empty"
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '36vh',
                padding: 'var(--space-8) var(--space-4)',
              }}
            >
              <span className="jt-ico jt-ico-lg" aria-hidden="true" style={{ fontSize: 'var(--fs-display-sm)' }}>
                inventory_2
              </span>
              <p className="jt-empty-title" style={{ fontSize: 'var(--fs-lg)' }}>
                {searchTerm ? '일치하는 검수 기록이 없습니다' : '저장된 검수 기록이 없습니다'}
              </p>
              <p className="jt-empty-desc">
                {searchTerm
                  ? '다른 제품명, 차수 또는 팀명으로 다시 검색해 보세요.'
                  : '바이알 사진을 촬영하고 [검수 기록 저장]을 누르면 최근 분석 기록이 이곳에 차례대로 쌓입니다.'}
              </p>
              {!searchTerm && (
                <Link href="/" className="jt-btn jt-btn-lg" style={{ marginTop: 'var(--space-2)' }}>
                  <span className="jt-ico" aria-hidden="true">
                    photo_camera
                  </span>
                  바이알 사진 촬영하러 가기
                </Link>
              )}
            </div>
          ) : (
            /* 실제 데이터 표: 인라인 제품명, 차수, 부서 선택 및 개수/상세 열람 */
            <div className="jt-table-wrap" style={{ flex: 1 }}>
              <table className="jt-table" style={{ fontSize: 'var(--fs-sm)', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr>
                    <th style={{ whiteSpace: 'nowrap' }}>검수 일시</th>
                    <th style={{ whiteSpace: 'nowrap' }}>제품명</th>
                    <th style={{ whiteSpace: 'nowrap', width: '6rem' }}>차수</th>
                    <th style={{ whiteSpace: 'nowrap' }}>담당 부서</th>
                    <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>파악 개수</th>
                    <th style={{ textAlign: 'center', width: 'var(--control-height)', whiteSpace: 'nowrap' }}>열람</th>
                    <th style={{ textAlign: 'center', width: 'var(--control-height)', whiteSpace: 'nowrap' }}>삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((item) => (
                    <tr
                      key={item.id}
                      style={{
                        backgroundColor:
                          selectedRecord?.id === item.id ? 'var(--color-bg-subtle)' : undefined,
                      }}
                    >
                      <td className="jt-num" style={{ whiteSpace: 'nowrap' }}>{item.date}</td>

                      {/* 제품명: 인라인 자유 입력 */}
                      <td>
                        <input
                          type="text"
                          className="jt-input jt-input-sm"
                          value={item.productName || ''}
                          onChange={(e) => handleProductNameChange(item.id, e.target.value)}
                          placeholder="제품명 입력..."
                          style={{
                            minWidth: '10rem',
                            fontSize: 'var(--fs-sm)',
                            height: 'var(--control-height-sm)',
                          }}
                          aria-label={`${item.date} 제품명`}
                        />
                      </td>

                      {/* 차수 인라인 자유 입력 */}
                      <td>
                        <input
                          type="text"
                          className="jt-input jt-input-sm"
                          value={item.round || ''}
                          onChange={(e) => handleRoundChange(item.id, e.target.value)}
                          placeholder="1차"
                          style={{
                            width: '4.5rem',
                            textAlign: 'center',
                            fontSize: 'var(--fs-sm)',
                            height: 'var(--control-height-sm)',
                          }}
                          aria-label={`${item.productName || item.date} 차수`}
                        />
                      </td>

                      {/* 담당부서: '설정' 화면과 연동된 셀렉트 드롭다운 */}
                      <td>
                        <select
                          className="jt-select jt-select-sm"
                          value={item.team || ''}
                          onChange={(e) => handleTeamChange(item.id, e.target.value)}
                          style={{
                            fontSize: 'var(--fs-sm)',
                            height: 'var(--control-height-sm)',
                            minWidth: '7.5rem',
                          }}
                          aria-label={`${item.productName || item.date} 담당 부서 선택`}
                        >
                          {/* 설정에 부서가 없을 때 안내 옵션 */}
                          {departmentOptions.length === 0 && !item.team && (
                            <option value="">(부서 미등록)</option>
                          )}
                          {/* 현재 기록된 팀이 설정 목록에 없는 경우에도 유지 표시 */}
                          {item.team &&
                            !departmentOptions.some((d) => d.name === item.team) && (
                              <option value={item.team}>{item.team}</option>
                            )}
                          {departmentOptions.map((dept) => (
                            <option key={dept.id || dept.name} value={dept.name}>
                              {dept.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* 파악 개수 */}
                      <td className="jt-num" style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {item.count != null ? `${item.count} 개` : '-'}
                      </td>

                      {/* 상세 열람 아이콘 버튼 */}
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="jt-icon-btn"
                          onClick={() =>
                            setSelectedRecord(selectedRecord?.id === item.id ? null : item)
                          }
                          aria-label={`${item.productName || '선택한 항목'} 상세 분석 열람`}
                          title="상세 분석 열람"
                        >
                          <span className="jt-ico jt-ico-sm" aria-hidden="true">
                            {selectedRecord?.id === item.id ? 'expand_less' : 'visibility'}
                          </span>
                        </button>
                      </td>

                      {/* 삭제 아이콘 버튼 */}
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="jt-icon-btn"
                          onClick={() => handleDeleteRecord(item)}
                          aria-label={`${item.productName || item.date} 기록 삭제`}
                          title="기록 삭제"
                        >
                          <span className="jt-ico jt-ico-sm" aria-hidden="true">
                            delete
                          </span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 상세 열람 영역: 선택된 검수 기록의 세부 분석 정보 표시 */}
        {selectedRecord && (
          <div
            className="jt-stack-3"
            style={{
              marginTop: 'var(--space-4)',
              padding: 'var(--space-4)',
              backgroundColor: 'var(--color-bg-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div className="jt-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="jt-row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
                <span className="jt-ico" aria-hidden="true">
                  analytics
                </span>
                <h3 style={{ margin: 0, fontSize: 'var(--fs-base)', fontWeight: 700 }}>
                  {selectedRecord.productName || '미지정 제품'} ({selectedRecord.round || '미지정 차수'}) 상세 내역
                </h3>
              </div>
              <button
                type="button"
                className="jt-icon-btn"
                onClick={() => setSelectedRecord(null)}
                aria-label="상세 내역 닫기"
              >
                <span className="jt-ico jt-ico-sm" aria-hidden="true">
                  close
                </span>
              </button>
            </div>

            <dl className="jt-desc" style={{ fontSize: 'var(--fs-sm)' }}>
              <dt>검수 일시</dt>
              <dd className="jt-num">{selectedRecord.date}</dd>
              <dt>제품명</dt>
              <dd>{selectedRecord.productName || '(미입력)'}</dd>
              <dt>검수 차수</dt>
              <dd>{selectedRecord.round || '(미입력)'}</dd>
              <dt>담당 부서</dt>
              <dd>{selectedRecord.team || '(미지정)'}</dd>
              <dt>총 파악 개수</dt>
              <dd className="jt-num" style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                {selectedRecord.count != null ? `${selectedRecord.count} 개` : '-'}
              </dd>
              {selectedRecord.photoCount != null && (
                <>
                  <dt>등록 사진 수</dt>
                  <dd className="jt-num">{selectedRecord.photoCount} 장</dd>
                </>
              )}
              {selectedRecord.capCount != null && (
                <>
                  <dt>캡 뚜껑 모드</dt>
                  <dd className="jt-num">{selectedRecord.capCount} 개 검출</dd>
                </>
              )}
              {selectedRecord.boxCount != null && (
                <>
                  <dt>카트 박스 모드</dt>
                  <dd>
                    <span className="jt-num">{selectedRecord.boxCount}</span> 박스 × 박스당{' '}
                    <span className="jt-num">{selectedRecord.vialsPerBox || 50}</span>개 ={' '}
                    <strong className="jt-num">
                      {(selectedRecord.boxCount || 0) * (selectedRecord.vialsPerBox || 50)}개
                    </strong>
                  </dd>
                </>
              )}
            </dl>

            {/* 과거 구역별 데이터가 있는 경우 호환 표시 */}
            {Array.isArray(selectedRecord.zones) && selectedRecord.zones.length > 0 && (
              <div className="jt-stack-2">
                <span className="jt-help">구역별 세부 개수</span>
                <div className="jt-row" style={{ flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  {selectedRecord.zones.map((z) => (
                    <span key={z.name} className="jt-tag" style={{ fontSize: 'var(--fs-xs)' }}>
                      {z.name}: <strong className="jt-num" style={{ marginLeft: 'var(--space-1)' }}>{z.count}개</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 앱 내 확인/알림 모달 (브라우저 기본 alert, confirm 대체) */}
      {modalState.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="records-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'var(--color-overlay)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 'var(--z-modal)',
            padding: 'var(--space-4)',
          }}
        >
          <div
            className="jt-card jt-stack-4"
            style={{
              width: '100%',
              maxWidth: '24rem',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div className="jt-row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
              <span
                className="jt-ico"
                aria-hidden="true"
                style={{
                  color: modalState.isDanger ? 'var(--color-error)' : 'var(--color-accent)',
                }}
              >
                {modalState.isDanger ? 'warning' : 'info'}
              </span>
              <h3 id="records-modal-title" style={{ margin: 0, fontSize: 'var(--fs-base)', fontWeight: 700 }}>
                {modalState.title}
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--fs-sm)', lineHeight: 1.6 }}>
              {modalState.message}
            </p>
            <div className="jt-row" style={{ justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              {modalState.isConfirm && (
                <button
                  type="button"
                  className="jt-btn"
                  style={{
                    backgroundColor: 'transparent',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                  }}
                  onClick={closeModal}
                >
                  취소
                </button>
              )}
              <button
                type="button"
                className="jt-btn"
                style={{
                  backgroundColor: modalState.isDanger ? 'var(--color-error)' : undefined,
                  color: modalState.isDanger ? 'var(--color-text-inverse)' : undefined,
                }}
                onClick={() => {
                  if (modalState.onConfirm) modalState.onConfirm()
                  closeModal()
                }}
              >
                {modalState.confirmText || '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
