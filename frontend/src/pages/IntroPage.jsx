import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ""

function IntroPage({ onLogin, onSeenIntro }) {
  const navigate = useNavigate()
  const [publicProfiles, setPublicProfiles] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)

  useEffect(() => {
    document.body.classList.add('intro-open')
    return () => {
      document.body.classList.remove('intro-open')
    }
  }, [])

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const res = await fetch(`${API_BASE}/profiles/public?limit=50`)
        const data = await res.json()
        setPublicProfiles(data.profiles || [])
      } catch (err) {
        console.error("Failed to fetch profiles:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchProfiles()
  }, [])

  const currentProfile = publicProfiles[currentIndex]

  const goNext = () => {
    if (currentIndex < publicProfiles.length - 1 && !isAnimating) {
      setIsAnimating(true)
      setSwipeOffset(-100)
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1)
        setSwipeOffset(0)
        setIsAnimating(false)
      }, 200)
    }
  }

  const goPrev = () => {
    if (currentIndex > 0 && !isAnimating) {
      setIsAnimating(true)
      setSwipeOffset(100)
      setTimeout(() => {
        setCurrentIndex(currentIndex - 1)
        setSwipeOffset(0)
        setIsAnimating(false)
      }, 200)
    }
  }

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
    touchEndX.current = e.touches[0].clientX
  }

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX
    const diff = touchEndX.current - touchStartX.current
    if (Math.abs(diff) < 150) {
      setSwipeOffset(diff * 0.3)
    }
  }

  const handleTouchEnd = () => {
    const diff = touchEndX.current - touchStartX.current
    setSwipeOffset(0)
    
    if (diff > 50) {
      goPrev()
    } else if (diff < -50) {
      goNext()
    }
  }

  const handleMouseDown = (e) => {
    touchStartX.current = e.clientX
    touchEndX.current = e.clientX
  }

  const handleMouseMove = (e) => {
    if (e.buttons !== 1) return
    touchEndX.current = e.clientX
    const diff = touchEndX.current - touchStartX.current
    if (Math.abs(diff) < 150) {
      setSwipeOffset(diff * 0.3)
    }
  }

  const handleMouseUp = () => {
    const diff = touchEndX.current - touchStartX.current
    setSwipeOffset(0)
    
    if (diff > 50) {
      goPrev()
    } else if (diff < -50) {
      goNext()
    }
  }

  const handleJoin = () => {
    onSeenIntro?.()
    onLogin()
  }

  return (
    <div className="landing-page intro-page">
      <div className="intro-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          ← 돌아가기
        </button>
        <h2>참가자들</h2>
      </div>

      {loading ? (
        <div className="loading-state">프로필 불러오는 중...</div>
      ) : publicProfiles.length > 0 ? (
        <div className="profile-carousel">
          <div className="carousel-counter">
            {currentIndex + 1} / {publicProfiles.length}
          </div>
          
          <div 
            className="carousel-card-wrapper"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div 
              className="carousel-card"
              style={{
                transform: `translateX(${swipeOffset}px)`,
                transition: isAnimating ? 'transform 0.2s ease-out' : 'none',
              }}
            >
              <h3 className="card-name">{currentProfile?.name || "익명"}</h3>
              <p className="card-tagline">{currentProfile?.tagline || ""}</p>
              <p className="card-intro">{currentProfile?.intro || "자기소개가 없어요"}</p>
              {currentProfile?.interests?.length > 0 && (
                <div className="card-chips">
                  {currentProfile.interests.slice(0, 5).map((interest, idx) => (
                    <span key={idx} className="chip">{interest}</span>
                  ))}
                  {currentProfile.interests.length > 5 && (
                    <span className="chip more">+{currentProfile.interests.length - 5}</span>
                  )}
                </div>
              )}
            </div>
            
            <div className="swipe-hint">
              ← 슥슥 넘겨보세요 →
            </div>
          </div>

          <div className="carousel-dots">
            {publicProfiles.slice(0, 10).map((_, idx) => (
              <span 
                key={idx} 
                className={`dot ${idx === currentIndex ? 'active' : ''}`}
                onClick={() => !isAnimating && setCurrentIndex(idx)}
              />
            ))}
            {publicProfiles.length > 10 && (
              <span className="dot-more">...</span>
            )}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <p>아직 공개된 프로필이 없어요</p>
          <p className="muted">첫 번째로 등록해보세요!</p>
        </div>
      )}

      <div className="intro-actions">
        <button className="btn-primary" onClick={handleJoin}>
          나도 참여하기
        </button>
      </div>
    </div>
  )
}

export default IntroPage
