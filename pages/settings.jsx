import { useState } from 'react'

// 초기 가짜 부서 데이터 5줄입니다.
// 체이스의 요청에 따라 화면 구성을 볼 수 있도록 생산팀, 포장팀, 품질팀 등의 예시 부서를 등록해 두었습니다.
const INITIAL_DEPARTMENTS = [
  { id: 'dept-01', name: '생산1팀', isDefault: true, icon: 'science' },
  { id: 'dept-02', name: '생산2팀', isDefault: false, icon: 'science' },
  { id: 'dept-03', name: '포장1팀', isDefault: false, icon: 'inventory_2' },
  { id: 'dept-04', name: '포장2팀', isDefault: false, icon: 'inventory_2' },
  { id: 'dept-05', name: '품질관리팀', isDefault: false, icon: 'verified' },
]

// 화면 상태(데이터 있음 / 로딩중 / 빈 상태)를 손쉽게 전환해 볼 수 있는 버튼 목록입니다.
const VIEW_MODES = [
  { id: 'data', label: '정상 데이터 (5건)' },
  { id: 'loading', label: '로딩중' },
  { id: 'empty', label: '빈 상태 (0건)' },
]

export default function SettingsPage() {
  // 화면 미리보기 상태 ('data': 정상 목록, 'loading': 로딩 중, 'empty': 부서 없음)
  const [viewMode, setViewMode] = useState('data')
  // 신규 부서명을 입력받는 인풋 상태
  const [newDeptName, setNewDeptName] = useState('')
  // 부서 목록 상태 (사용자가 직접 추가/삭제해볼 수 있습니다)
  const [departments, setDepartments] = useState(INITIAL_DEPARTMENTS)

  const isLoading = viewMode === 'loading'
  const isEmpty = viewMode === 'empty'
  const currentList = isEmpty ? [] : departments

  // 신규 부서 추가 핸들러
  function handleAddDepartment(e) {
    e.preventDefault()
    const trimmed = newDeptName.trim()
    if (!trimmed) return

    // 새 부서 항목 생성
    const newDept = {
      id: `dept-${Date.now()}`,
      name: trimmed,
      isDefault: departments.length === 0,
      icon: 'business',
    }

    setDepartments((prev) => [...prev, newDept])
    setNewDeptName('')
    if (viewMode === 'empty') {
      setViewMode('data')
    }
  }

  // 부서 삭제 핸들러
  function handleDeleteDepartment(id) {
    setDepartments((prev) => prev.filter((dept) => dept.id !== id))
  }

  // 기본 부서 설정 핸들러
  function handleSetDefault(id) {
    setDepartments((prev) =>
      prev.map((dept) => ({
        ...dept,
        isDefault: dept.id === id,
      }))
    )
  }

  return (
    <>
      {/* 1. 디자인 및 상태를 바로 확인할 수 있는 상태 스위처 (정식 데이터 연결 시 자동 전환됩니다) */}
      <div className="jt-row" style={{ justifyContent: 'space-between' }}>
        <span className="jt-help">화면 상태 확인</span>
        <div className="jt-switcher" role="group" aria-label="화면 상태 확인">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className="jt-switcher-item"
              aria-pressed={viewMode === mode.id}
              onClick={() => setViewMode(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. "부서 입력 및 관리" 메인 설정 카드 */}
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
              {currentList.length}개 등록됨
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
          />
          <button type="submit" className="jt-btn" disabled={!newDeptName.trim() || isLoading}>
            <span className="jt-ico" aria-hidden="true">
              add
            </span>
            부서 추가
          </button>
        </form>

        {/* 등록된 부서 목록: 로딩 상태 / 빈 상태 / 가짜 데이터 5줄 리스트 */}
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
          ) : currentList.length === 0 ? (
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
            /* 가짜 데이터 5줄: 등록된 부서 카드 목록 */
            <div className="jt-stack-2">
              <span className="jt-help">등록된 부서 목록 (가짜 데이터 5줄)</span>
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
                {currentList.map((dept) => (
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
                        {dept.icon}
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
                        onClick={() => handleDeleteDepartment(dept.id)}
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

      {/* 3. 추후 추가될 추가 설정 영역 안내 카드 */}
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
    </>
  )
}
