import { useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import '../styles/globals.css'
import AppLayout, { APP_NAME, getPageTitle } from '../components/AppLayout'

// 앱 전체의 공통 설정, 다크 모드 상태, 공통 골격(AppLayout)을 연결하는 진입점입니다.
export default function App({ Component, pageProps }) {
  const [dark, setDark] = useState(false)
  const router = useRouter()
  const pageTitle = getPageTitle(router.pathname)

  // 다크 모드를 켜고 끄면 html 태그의 data-theme 속성이 바뀌어 JT 토큰 색상이 자동 전환됩니다.
  function toggleTheme() {
    const next = !dark
    setDark(next)
    document.documentElement.dataset.theme = next ? 'dark' : ''
  }

  return (
    <>
      <Head>
        <title>{`${pageTitle} - ${APP_NAME}`}</title>
        {/* viewport-fit=cover 는 모바일 노치와 하단 홈바 영역을 안전하게 채우기 위해 필요합니다. */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <AppLayout dark={dark} onToggleTheme={toggleTheme}>
        <Component {...pageProps} />
      </AppLayout>
    </>
  )
}
