import { useEffect, useState } from 'react'

// 기록 화면 및 촬영 화면과 동일한 localStorage 키 공유
export const STORAGE_DEPARTMENTS_KEY = 'jt-vial-departments'

// JT 디자인 시스템 UX 문구 원칙(사과 없이 무엇이 잘못됐고 어떻게 해결하는지 안내)에 따른 오류 문구 생성기
function buildSaveErrorMessage(err, targetLabel = '부서 설정') {
  if (err?.name === 'QuotaExceededError' || err?.code === 22 || err?.code === 1014) {
    return `브라우저 저장 공간이 가득 차서 ${targetLabel}을(를) 저장하지 못했습니다. 불필요한 이전 데이터를 정리하거나 브라우저 저장 공간을 확보한 뒤 다시 시도해 주세요.`
  }
  if (err?.name === 'SecurityError') {
    return `브라우저 설정에서 기기 내 데이터 저장이 차단되어 ${targetLabel}을(를) 저장하지 못했습니다. 시크릿(비공개) 모드를 해제하거나 사이트 데이터 저장 권한을 허용한 뒤 다시 시도해 주세요.`
  }
  return `${targetLabel}을(를) 처리하는 중 오류가 발생했습니다(원인: ${
    err?.message || '알 수 없는 저장소 오류'
  }). 화면을 새로고침한 뒤 다시 시도해 주세요.`
}

export default function SettingsPage() {
  // 신규 부서명을 입력받는 인풋 상태
  const [newDeptName, setNewDeptName] = useState('')
  // 부서 목록 상태 (가짜 데이터 없이 순수 빈 배열로 시작)
  const [departments, setDepartments] = useState([])
  // 초기 로딩 상태
  const [isLoading, setIsLoading] = useState(true)

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

  // 1. 컴포넌트 마운트 시 localStorage에서 실제 등록된 부서 목록만 로드 (가짜 데이터 없음)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_DEPARTMENTS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          setDepartments(parsed)
        }
      }
    } catch (err) {
      console.error('부서 목록 로드 실패:', err)
      openAlertModal(
        '저장된 부서 목록을 불러오지 못했습니다',
        '브라우저에 저장된 부서 목록 형식이 올바르지 않습니다. 캐시를 지우거나 새로고침해 주세요.'
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 부서 목록 변경 시 localStorage에 영구 보존
  function saveDepartmentsToStorage(updated) {
    try {
      window.localStorage.setItem(STORAGE_DEPARTMENTS_KEY, JSON.stringify(updated))
      setDepartments(updated)
    } catch (err) {
      const errMsg = buildSaveErrorMessage(err, '담당 부서 목록')
      openAlertModal('부서 설정을 저장하지 못했습니다', errMsg)
    }
  }

  // 신규 부서 추가 핸들러
  function handleAddDepartment(e) {
    e.preventDefault()
    const trimmed = newDeptName.trim()
    if (!trimmed) return

    // 중복 부서명 검사
    if (departments.some((d) => d.name === trimmed)) {
      openAlertModal(
        '이미 등록된 부서입니다',
        `"${trimmed}" 부서는 이미 등록되어 있습니다. 다른 이름을 입력해 주세요.`
      )
      return
    }

    const newDept = {
      id: `dept-${Date.now()}`,
      name: trimmed,
      isDefault: departments.length === 0, // 첫 번째 등록 부서는 자동 기본 부서 지정
      icon: 'business',
    }

    const updated = [...departments, newDept]
    saveDepartmentsToStorage(updated)
    setNewDeptName('')
  }

  // 부서 삭제 핸들러 (앱 내 모달 확인 후 삭제)
  function handleDeleteDepartment(deptToDelete) {
    openConfirmModal({
      title: '담당 부서 삭제',
      message: `"${deptToDelete.name}" 부서를 삭제하시겠습니까? [기록] 화면의 부서 선택 목록에서도 제외됩니다.`,
      isDanger: true,
      confirmText: '부서 삭제',
      onConfirm: () => {
        const filtered = departments.filter((dept) => dept.id !== deptToDelete.id)
        // 삭제하려는 부서가 기본 부서였고 다른 부서가 남아있다면 첫 번째 부서를 기본으로 승격
        if (deptToDelete.isDefault && filtered.length > 0) {
          filtered[0].isDefault = true
        }
        saveDepartmentsToStorage(filtered)
      },
    })
  }

  // 기본 부서 설정 핸들러
  function handleSetDefault(id) {
    const updated = departments.map((dept) => ({
      ...dept,
      isDefault: dept.id === id,
    }))
    saveDepartmentsToStorage(updated)
  }

  return (
    <>
      {/* 1. "부서 입력 및 관리" 메인 설정 카드 */}
      <section
        className="jt-card jt-stack-4"
        aria-label="부서 설정"
      >
        <div className="jt-stack-2">
          <div className="jt-row" style={{ gap: 'var(--space-2)' }}>
            <h2 style={{ margin: 0, fontSize: 'var(--fs-xl)', fontWeight: 700 }}>
              담당 부서 설정
            </h2>
            <span className="jt-badge" style={{ alignSelf: 'center' }}>
              {isLoading ? '조회 중' : `${departments.length}개 등록됨`}
            </span>
          </div>
          <p className="jt-help" style={{ margin: 0 }}>
            이곳에 부서를 등록해 두면, [기록] 화면의 담당 부서 선택창에 자동으로 표시됩니다.
          </p>
        </div>

        {/* 부서 신규 입력 폼 */}
        <form onSubmit={handleAddDepartment} className="jt-row" style={{ gap: 'var(--space-2)' }}>
          <input
            type="text"
            className="jt-input"
            placeholder="새 부서명을 입력하세요 (예: 제조1팀, 물류팀)..."
            value={newDeptName}
            onChange={(e) => setNewDeptName(e.target.value)}
            style={{ flex: 1 }}
            aria-label="새 부서명 입력"
            disabled={isLoading}
          />
          <button type="submit" className="jt-btn" disabled={!newDeptName.trim() || isLoading}>
            <span className="jt-ico" aria-hidden="true">
              add
            </span>
            부서 추가
          </button>
        </form>

        {/* 등록된 부서 목록: 로딩 상태 / 빈 상태 / 등록된 부서 카드 목록 */}
        <div style={{ marginTop: 'var(--space-2)' }}>
          {isLoading ? (
            /* 로딩 상태: 스켈레톤 화면 */
            <div className="jt-stack-3" aria-label="부서 목록 불러오는 중">
              {[1, 2, 3, 4, 5].map((idx) => (
                <div
                  key={idx}
                  className="jt-skeleton"
                  style={{
                    minHeight: 'var(--control-height-lg)',
                    borderRadius: 'var(--radius-md)',
                  }}
                />
              ))}
            </div>
          ) : departments.length === 0 ? (
            /* 빈 상태: 등록된 부서가 없을 때 안내 화면 */
            <div
              className="jt-empty"
              style={{
                padding: 'var(--space-8) var(--space-4)',
                backgroundColor: 'var(--color-bg-subtle)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <span className="jt-ico jt-ico-lg" aria-hidden="true">
                corporate_fare
              </span>
              <p className="jt-empty-title">등록된 부서가 없습니다</p>
              <p className="jt-empty-desc">
                위의 입력칸에 부서명을 입력하고 [부서 추가] 버튼을 눌러 등록해 주세요.
              </p>
            </div>
          ) : (
            /* 등록된 부서 카드 목록 */
            <div className="jt-stack-2">
              <span className="jt-help">등록된 부서 목록</span>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-2)',
                }}
              >
                {departments.map((dept) => (
                  <li
                    key={dept.id}
                    className="jt-row"
                    style={{
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: 'var(--space-3) var(--space-4)',
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div className="jt-row" style={{ gap: 'var(--space-3)', alignItems: 'center' }}>
                      <span className="jt-ico" aria-hidden="true">
                        {dept.icon || 'business'}
                      </span>
                      <strong style={{ fontSize: 'var(--fs-base)' }}>{dept.name}</strong>
                      {dept.isDefault && (
                        <span className="jt-badge jt-badge-pass" style={{ fontSize: 'var(--fs-xs)' }}>
                          내 기본 부서
                        </span>
                      )}
                    </div>

                    <div className="jt-row" style={{ gap: 'var(--space-2)' }}>
                      {!dept.isDefault && (
                        <button
                          type="button"
                          className="jt-btn jt-btn-sm"
                          onClick={() => handleSetDefault(dept.id)}
                          style={{
                            backgroundColor: 'transparent',
                            color: 'var(--color-text)',
                            border: '1px solid var(--color-border)',
                          }}
                        >
                          기본 지정
                        </button>
                      )}
                      <button
                        type="button"
                        className="jt-icon-btn"
                        onClick={() => handleDeleteDepartment(dept)}
                        aria-label={`${dept.name} 삭제`}
                        title="부서 삭제"
                      >
                        <span className="jt-ico jt-ico-sm" aria-hidden="true">
                          delete
                        </span>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* 2. 추후 추가될 추가 설정 영역 안내 카드 */}
      <section
        className="jt-card jt-stack-3"
        aria-label="추가 설정 안내"
        style={{
          borderStyle: 'dashed',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="jt-row" style={{ gap: 'var(--space-2)' }}>
          <span className="jt-ico" aria-hidden="true">
            tune
          </span>
          <h3 style={{ margin: 0, fontSize: 'var(--fs-base)', fontWeight: 700 }}>
            추가 설정 항목 (추후 추가 예정)
          </h3>
        </div>
        <p className="jt-help" style={{ margin: 0 }}>
          바이알 트레이 규격(기본 수량 100개/50개), AI 인식 감도 조절, 자동 저장 옵션 등이 다음 단계에서 이곳에 추가될 예정입니다.
        </p>
      </section>

      {/* 앱 내 확인/알림 모달 (브라우저 기본 alert, confirm 대체) */}
      {modalState.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-modal-title"
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
              <h3 id="settings-modal-title" style={{ margin: 0, fontSize: 'var(--fs-base)', fontWeight: 700 }}>
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
