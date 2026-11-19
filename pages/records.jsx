import { useState } from 'react'
import Link from 'next/link'

// 추후 [설정] 화면에서 등록/관리하게 될 담당 부서 목록 예시입니다.
const DEPARTMENT_OPTIONS = [
  { value: '생산1팀', label: '생산1팀', icon: 'science' },
  { value: '생산2팀', label: '생산2팀', icon: 'science' },
  { value: '포장1팀', label: '포장1팀', icon: 'inventory_2' },
  { value: '포장2팀', label: '포장2팀', icon: 'inventory_2' },
  { value: '품질관리팀', label: '품질관리팀', icon: 'verified' },
]

// 최근 검수 순으로 정렬된 가짜 데이터 5줄입니다.
// 체이스의 요청에 따라 '차수'를 추가하고, 제품명과 차수는 자유롭게 작성 가능하며 부서는 선택 가능하도록 구성했습니다.
const INITIAL_RECORDS = [
  {
    id: 'INS-05',
    date: '2026-11-19 14:25',
    productName: '비타민C 바이알 10ml',
    round: '1차',
    team: '생산1팀',
    count: 100,
    inspector: '김검수',
    fileName: 'tray_batch_01.jpg',
    zones: [
      { name: '1구역(좌상)', count: 20 },
      { name: '2구역(우상)', count: 20 },
      { name: '3구역(중앙)', count: 20 },
      { name: '4구역(좌하)', count: 20 },
      { name: '5구역(우하)', count: 20 },
    ],
  },
  {
    id: 'INS-04',
    date: '2026-11-19 13:50',
    productName: '히알루론산 앰플 5ml',
    round: '2차',
    team: '포장2팀',
    count: 98,
    inspector: '이포장',
    fileName: 'tray_batch_02.jpg',
    zones: [
      { name: '1구역(좌상)', count: 20 },
      { name: '2구역(우상)', count: 19 },
      { name: '3구역(중앙)', count: 20 },
      { name: '4구역(좌하)', count: 19 },
      { name: '5구역(우하)', count: 20 },
    ],
  },
  {
    id: 'INS-03',
    date: '2026-11-19 13:15',
    productName: '콜라겐 에센스 10ml',
    round: '1차',
    team: '생산1팀',
    count: 50,
    inspector: '박품질',
    fileName: 'tray_small_09.jpg',
    zones: [
      { name: '1구역(좌)', count: 25 },
      { name: '2구역(우)', count: 25 },
    ],
  },
  {
    id: 'INS-02',
    date: '2026-11-19 11:40',
    productName: '펩타이드 솔루션 5ml',
    round: '3차',
    team: '포장1팀',
    count: 100,
    inspector: '최반장',
    fileName: 'tray_blur_08.jpg',
    zones: [
      { name: '1구역(좌상)', count: 20 },
      { name: '2구역(우상)', count: 20 },
      { name: '3구역(중앙)', count: 20 },
      { name: '4구역(좌하)', count: 20 },
      { name: '5구역(우하)', count: 20 },
    ],
  },
  {
    id: 'INS-01',
    date: '2026-11-19 10:05',
    productName: '시카 리페어 바이알 10ml',
    round: '1차',
    team: '생산2팀',
    count: 50,
    inspector: '정기술',
    fileName: 'tray_small_05.jpg',
    zones: [
      { name: '1구역(좌)', count: 25 },
      { name: '2구역(우)', count: 25 },
    ],
  },
]

// 화면 상태(데이터 있음 / 로딩중 / 데이터 없음)를 손쉽게 전환해 볼 수 있는 버튼 목록입니다.
const VIEW_MODES = [
  { id: 'data', label: '정상 데이터 (5건)' },
  { id: 'loading', label: '로딩중' },
  { id: 'empty', label: '빈 상태 (0건)' },
]

export default function RecordsPage() {
  // 화면 미리보기 상태 ('data': 정상 목록, 'loading': 로딩 중, 'empty': 기록 없음)
  const [viewMode, setViewMode] = useState('data')
  // 검색창 입력 상태 (기본 빈칸 유지)
  const [searchTerm, setSearchTerm] = useState('')
  // 상세 열람할 특정 검수 기록을 선택하는 상태입니다.
  const [selectedRecord, setSelectedRecord] = useState(null)
  // 제품명, 차수, 담당부서를 현장에서 자유롭게 수정/선택할 수 있도록 상태로 관리합니다.
  const [records, setRecords] = useState(INITIAL_RECORDS)

  const isLoading = viewMode === 'loading'
  const isEmpty = viewMode === 'empty'

  // 제품명 수정 핸들러
  function handleProductNameChange(id, newName) {
    setRecords((prev) =>
      prev.map((item) => (item.id === id ? { ...item, productName: newName } : item))
    )
  }

  // 1번 요구사항: 차수 수정 핸들러 (자유롭게 입력 가능)
  function handleRoundChange(id, newRound) {
    setRecords((prev) =>
      prev.map((item) => (item.id === id ? { ...item, round: newRound } : item))
    )
  }

  // 2번 요구사항: 담당부서 선택 핸들러 (목록에서 선택)
  function handleTeamChange(id, newTeam) {
    setRecords((prev) =>
      prev.map((item) => (item.id === id ? { ...item, team: newTeam } : item))
    )
  }

  // 검색어(제품명, 차수 또는 팀명)에 따라 목록을 필터링합니다.
  const filteredRecords = isEmpty
    ? []
    : records.filter(
        (rec) =>
          rec.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          rec.round.toLowerCase().includes(searchTerm.toLowerCase()) ||
          rec.team.includes(searchTerm)
      )

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
              onClick={() => {
                setViewMode(mode.id)
                setSelectedRecord(null)
              }}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. "최근 검수 기록" 전체 크기 메인 카드 */}
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
                {isEmpty ? '0 건' : `${filteredRecords.length} 건`}
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

        {/* 검색창: 빈칸 유지 및 상단 배치 */}
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

        {/* 메인 콘텐츠 영역: 로딩 상태 / 빈 상태 / 가짜 데이터 5줄 표 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {isLoading ? (
            /* 로딩 상태: 서버에서 기록을 가져올 때의 스켈레톤 화면 */
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
            /* 빈 상태: 기록이 전혀 없거나 검색 결과가 없을 때의 친절한 안내 화면 */
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
                  : '바이알 사진을 촬영하고 검수하면 최근 분석 기록이 이곳에 차례대로 쌓입니다.'}
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
            /* 가짜 데이터 5줄 표: 모든 글씨 한 줄 정렬 및 제품명-차수-담당부서 구성 */
            <div className="jt-table-wrap" style={{ flex: 1 }}>
              <table className="jt-table" style={{ fontSize: 'var(--fs-sm)', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr>
                    <th style={{ whiteSpace: 'nowrap' }}>검수 일시</th>
                    <th style={{ whiteSpace: 'nowrap' }}>제품명</th>
                    {/* 1번 요구사항: '제품명'과 '담당부서' 사이에 '차수' 열 신설 */}
                    <th style={{ whiteSpace: 'nowrap', width: '6rem' }}>차수</th>
                    {/* 2번 요구사항: '담당부서' 열 (선택 가능) */}
                    <th style={{ whiteSpace: 'nowrap' }}>담당 부서</th>
                    <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>파악 개수</th>
                    <th style={{ textAlign: 'center', width: 'var(--control-height)', whiteSpace: 'nowrap' }}>열람</th>
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
                          value={item.productName}
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

                      {/* 1번 요구사항: 차수 인라인 자유 입력 (예: 1차, 2차 등) */}
                      <td>
                        <input
                          type="text"
                          className="jt-input jt-input-sm"
                          value={item.round}
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

                      {/* 2번 요구사항: 담당부서 클릭 시 선택 가능한 셀렉트 박스 */}
                      <td>
                        <select
                          className="jt-select jt-select-sm"
                          value={item.team}
                          onChange={(e) => handleTeamChange(item.id, e.target.value)}
                          style={{
                            fontSize: 'var(--fs-sm)',
                            height: 'var(--control-height-sm)',
                            minWidth: '7.5rem',
                          }}
                          aria-label={`${item.productName || item.date} 담당 부서 선택`}
                        >
                          {DEPARTMENT_OPTIONS.map((dept) => (
                            <option key={dept.value} value={dept.value}>
                              {dept.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* 파악 개수 */}
                      <td className="jt-num" style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {item.count} 개
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 상세 열람 영역: 아이콘 버튼을 눌렀을 때 선택된 기록의 상세 분석 정보 표시 */}
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
            <div className="jt-row" style={{ justifyContent: 'space-between' }}>
              <div className="jt-row" style={{ gap: 'var(--space-2)' }}>
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
              <dd>{selectedRecord.team}</dd>
              <dt>검수 담당자</dt>
              <dd>{selectedRecord.inspector}</dd>
              <dt>등록 사진</dt>
              <dd>{selectedRecord.fileName}</dd>
              <dt>파악된 총 개수</dt>
              <dd className="jt-num" style={{ fontWeight: 600 }}>{selectedRecord.count} 개</dd>
            </dl>

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
          </div>
        )}
      </section>
    </>
  )
}
