import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TinderCard from 'react-tinder-card'

function IntroPage({ hostProfile, onLogin, onSeenIntro }) {
  const navigate = useNavigate()
  const redirectTimer = useRef(null)
  const [transitionMessage, setTransitionMessage] = useState('')
  const [transitionNeedsAction, setTransitionNeedsAction] = useState(false)

  useEffect(() => {
    document.body.classList.add('intro-open')
    return () => {
      document.body.classList.remove('intro-open')
      if (redirectTimer.current) clearTimeout(redirectTimer.current)
    }
  }, [])

  const startLoginFlow = (message, delayMs, auto = true) => {
    if (redirectTimer.current) clearTimeout(redirectTimer.current)
    setTransitionMessage(message)
    setTransitionNeedsAction(!auto)
    if (!auto) return
    redirectTimer.current = setTimeout(() => {
      onSeenIntro?.()
      onLogin()
    }, delayMs)
  }

  return (
    <div className="landing-page">
      <div className="landing-copy">
        <div className="tinder-stage">
          <span className="swipe-side-label left">이놈을 모른다 <br/> 왼쪽으로 스윽</span>
          <TinderCard
            preventSwipe={['up', 'down']}
            onSwipe={(dir) => {
              if (dir === 'right') {
                startLoginFlow('그러면 빨리 로그인 해', 900, true)
              } else if (dir === 'left') {
                onSeenIntro?.()
                navigate('/info')
              }
            }}
          >
            <div className="swipe-card preview-card">
              <div className="preview-photo-wrap">
                <img src="/dance.png" alt="호스트 사진" className="preview-photo" />
                <div className="image-overlay preview-overlay">
                  *저희 모임은 술을 강제하지 않습니다* <br /> *주최자의 주량은 소주 한병입니다*
                </div>
              </div>
              <div className="preview-body">
                <p className="eyebrow">HOST</p>
                <h3>{hostProfile.name}</h3>
                <p className="tagline">{hostProfile.tagline}</p>
                <p className="intro">{hostProfile.intro}</p>
                <div className="chips">
                  {(hostProfile.interests || []).slice(0, 4).map((chip) => (
                    <span key={chip} className="chip">
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </TinderCard>
          <span className="swipe-side-label right">이놈을 안다 <br/> 오른쪽으로 스윽</span>
        </div>

        <p className="swipe-hint-inline outside">
          *이렇게 뜨는건 저밖에 없습니다. 틴더냐고 자꾸 놀려서* <br /> *송년회 당일에 제시되는 여러 주제에 안다/모른다로 답한 것을 바탕으로 저녁식사
          테이블이 배정됩니다.*
        </p>

        {transitionMessage && (
          <div className="transition-message">
            <p className="lede">{transitionMessage || '잠시만요...'}</p>
            {transitionNeedsAction ? (
              <button
                className="primary"
                onClick={() => {
                  onSeenIntro?.()
                  onLogin()
                }}
              >
                로그인 화면으로 이동
              </button>
            ) : (
              <p className="muted">로그인 화면으로 이동합니다.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default IntroPage
