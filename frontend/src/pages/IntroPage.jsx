import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TinderCard from 'react-tinder-card'

const API_BASE = "/api";

function IntroPage({ hostProfile, onLogin, onSeenIntro, session }) {
  const navigate = useNavigate()
  const redirectTimer = useRef(null)
  const [transitionMessage, setTransitionMessage] = useState('')
  const [transitionNeedsAction, setTransitionNeedsAction] = useState(false)

  const isLoggedIn = Boolean(session?.session_token)

  useEffect(() => {
    document.body.classList.add('intro-open')
    return () => {
      document.body.classList.remove('intro-open')
      if (redirectTimer.current) clearTimeout(redirectTimer.current)
    }
  }, [])

  const handleSwipe = (dir) => {
    if (dir === 'right') {
      onSeenIntro?.()
      if (isLoggedIn) {
        navigate('/my-profile')
      } else {
        setTransitionMessage('자기소개 생략')
        setTransitionNeedsAction(true)
      }
    } else if (dir === 'left') {
      onSeenIntro?.()
      navigate('/info')
    }
  }
  
  const handleDirectLogin = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/kakao/login`);
      const data = await res.json();
      localStorage.setItem("kakao-state", data.state);
      window.location.href = data.auth_url;
    } catch (err) {
      console.error("Login redirect error:", err);
    }
  }

  return (
    <div className="landing-page">
      <div className="intro-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          ← 돌아가기
        </button>
        <h2>호스트 소개</h2>
      </div>

      <div className="landing-copy">
        <div className="tinder-stage">
          <span className="swipe-side-label left">이놈을 모른다 <br/> 왼쪽으로 스윽</span>
          
          {transitionMessage && (
            <div className="transition-message-overlay">
              <p className="lede">{transitionMessage}</p>
              <button
                className="primary"
                onClick={() => {
                  onSeenIntro?.()
                  handleDirectLogin()
                }}
              >
                카카오 로그인
              </button>
            </div>
          )}
          
          <TinderCard
            preventSwipe={['up', 'down']}
            onSwipe={handleSwipe}
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
      </div>
    </div>
  )
}

export default IntroPage
