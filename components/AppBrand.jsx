// 로고 + 앱 이름 (jt-core 6절) — 크기·위치·다크·좁힌 사이드바는 jt-utilities.css 의 .jt-appbrand 가 처리합니다.
// ⚠️ 로고 심볼은 공식 파일(.jt-logo)을 사용하며, 글자 색상은 디자인 시스템 토큰(var(--color-text))을 따릅니다.
const LOGO = 'https://ds.janytree.app/brand/logo'

export default function AppBrand({
  title = 'Janytree',
  subtitle = 'Auto Vial Calculator',
  href = '/',
}) {
  return (
    <a className="jt-appbrand" href={href}>
      <span className="jt-logo">
        <img className="on-light" src={`${LOGO}/logo-mark.svg`} alt="Janytree" />
        <img className="on-dark" src={`${LOGO}/logo-mark-light.svg`} alt="Janytree" />
      </span>
      <span
        className="jt-appbrand-name"
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          lineHeight: 'var(--lh-tight)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--fs-base)',
            fontWeight: 700,
            color: 'var(--color-text)',
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontSize: 'var(--fs-xs)',
            fontWeight: 600,
            color: 'var(--color-text)',
            letterSpacing: '0.02em',
          }}
        >
          {subtitle}
        </span>
      </span>
    </a>
  )
}
