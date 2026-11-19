import Link from 'next/link'
import { useRouter } from 'next/router'
import AppBrand from './AppBrand'

// 앱 전체에서 공통으로 사용하는 이름과 메뉴 목록입니다.
export const APP_NAME = 'Auto Vial Calculator'

// 왼쪽 사이드바와 모바일 하단 탭바에 공통으로 들어가는 3개 핵심 메뉴입니다.
export const NAV_ITEMS = [
  { href: '/', label: '촬영', icon: '/brand/icons/upload.svg' },
  { href: '/records', label: '기록', icon: '/brand/icons/fact_check.svg' },
  { href: '/settings', label: '설정', icon: '/brand/icons/settings.svg' },
]

// 현재 주소(pathname)에 맞는 화면 제목을 찾아주는 도우미 함수입니다.
export function getPageTitle(pathname) {
  const matched = NAV_ITEMS.find((item) => item.href === pathname)
  return matched ? matched.label : APP_NAME
}

// 모든 화면을 감싸는 공통 골격(App Shell + 모바일 하단 탭바) 부품입니다.
export default function AppLayout({ children, dark, onToggleTheme }) {
  const router = useRouter()
  const pageTitle = getPageTitle(router.pathname)

  return (
    <>
      {/* 키보드나 화면 읽기 프로그램 사용자가 바로 본문으로 이동할 수 있는 건너뛰기 링크입니다. */}
      <a className="jt-sr-only" href="#main">
        본문으로 건너뛰기
      </a>

      {/* 데스크톱: 좌측 사이드바 + 우측 본문 2열 구조(.jt-shell) */}
      <div className="jt-shell">
        <aside className="jt-sidebar" aria-label="주요 메뉴" style={{ minHeight: '100vh' }}>
          {/* 로고와 앱 이름은 반드시 사이드바 맨 위 첫 번째 자식으로 둡니다. */}
          <AppBrand />

          {NAV_ITEMS.map((item) => {
            const isActive = router.pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className="jt-nav-item"
                aria-current={isActive ? 'page' : undefined}
              >
                {/* 주요 내비게이션은 네트워크 차단 시에도 깨지지 않도록 SVG 마스크(.jt-ico-mask)를 씁니다. */}
                <span
                  className="jt-ico-mask"
                  style={{ '--jt-ico-url': `url(${item.icon})` }}
                  aria-hidden="true"
                />
                <span className="jt-nav-label">{item.label}</span>
              </Link>
            )
          })}
        </aside>

        <div>
          {/* 상단바: 모바일·태블릿에서는 심볼 로고만 보이고, 우측에 다크/라이트 모드 전환 아이콘 버튼이 배치됩니다. */}
          <header className="jt-topbar">
            <AppBrand />
            <h1 className="jt-topbar-title">{pageTitle}</h1>
            <div className="jt-topbar-actions">
              {/* 특수문자나 이모지 대신 공식 아이콘 버튼(.jt-icon-btn + .jt-ico)을 사용합니다. */}
              <button
                type="button"
                className="jt-icon-btn"
                onClick={onToggleTheme}
                aria-label={dark ? '라이트 모드로 전환' : '다크 모드로 전환'}
                title={dark ? '라이트 모드로 전환' : '다크 모드로 전환'}
              >
                <span className="jt-ico" aria-hidden="true">
                  {dark ? 'light_mode' : 'dark_mode'}
                </span>
              </button>
            </div>
          </header>

          {/* 본문 영역: narrow(720) 폭 제한(.jt-container-narrow)과 세로 간격(.jt-stack-6)을 적용합니다. */}
          <main className="jt-main jt-container-narrow jt-stack-6" id="main">
            {children}
          </main>
        </div>
      </div>

      {/* 모바일 하단 탭바: .jt-shell 바깥에 두어야 모바일 하단 여백이 자동으로 확보됩니다. */}
      <nav className="jt-tabbar" aria-label="주요 메뉴">
        {NAV_ITEMS.map((item) => {
          const isActive = router.pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className="jt-tabbar-item"
              aria-current={isActive ? 'page' : undefined}
            >
              <span
                className="jt-ico-mask"
                style={{ '--jt-ico-url': `url(${item.icon})` }}
                aria-hidden="true"
              />
              <span className="jt-tabbar-label">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
