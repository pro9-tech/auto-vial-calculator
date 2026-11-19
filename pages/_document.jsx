import { Html, Head, Main, NextScript } from 'next/document'

// 문서 전체의 기본 언어(한국어)와 조판(Productive: 업무용 기본)을 지정하는 파일입니다.
export default function Document() {
  return (
    <Html lang="ko" data-typeset="productive">
      <Head>
        {/* 일반 화면 아이콘(.jt-ico)이 필요할 때를 대비한 공식 아이콘 폰트 로드 (반드시 display=block 사용) */}
        {/* 웹폰트(Pretendard, Figtree)는 jt-tokens.css에 이미 내장되어 있으므로 따로 넣지 않습니다. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
