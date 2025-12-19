import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";

const API_BASE = "/api";

// Render text with *comment styled differently
function renderWithDevComment(text) {
  if (!text) return null;
  const starIndex = text.indexOf('*');
  if (starIndex === -1) {
    return <>{text}</>;
  }
  const mainPart = text.slice(0, starIndex);
  const commentPart = text.slice(starIndex);
  return (
    <>
      {mainPart}
      <span className="dev-comment">{commentPart}</span>
    </>
  );
}

export default function LandingPage({ session, onLogin, onShare }) {
  const [profileCount, setProfileCount] = useState(0);
  const [publicProfiles, setPublicProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  
  const isLoggedIn = Boolean(session?.session_token);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = isLoggedIn 
          ? { Authorization: `Bearer ${session.session_token}` }
          : {};
        
        const profilesEndpoint = isLoggedIn 
          ? `${API_BASE}/profiles/members?limit=500`
          : `${API_BASE}/profiles/public?limit=500`;
        
        const [countRes, profilesRes] = await Promise.all([
          fetch(`${API_BASE}/profiles/count`),
          fetch(profilesEndpoint, { headers }),
        ]);
        const countData = await countRes.json();
        const profilesData = await profilesRes.json();
        setProfileCount(countData.count || 0);
        setPublicProfiles(profilesData.profiles || []);
      } catch (err) {
        console.error("Failed to fetch landing data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isLoggedIn, session?.session_token]);

  const currentProfile = publicProfiles[currentIndex];

  const goNext = () => {
    if (currentIndex < publicProfiles.length - 1 && !isAnimating) {
      setIsAnimating(true);
      setSwipeOffset(-100);
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
        setSwipeOffset(0);
        setIsAnimating(false);
      }, 200);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0 && !isAnimating) {
      setIsAnimating(true);
      setSwipeOffset(100);
      setTimeout(() => {
        setCurrentIndex(currentIndex - 1);
        setSwipeOffset(0);
        setIsAnimating(false);
      }, 200);
    }
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
    const diff = touchEndX.current - touchStartX.current;
    if (Math.abs(diff) < 150) {
      setSwipeOffset(diff * 0.3);
    }
  };

  const handleTouchEnd = () => {
    const diff = touchEndX.current - touchStartX.current;
    setSwipeOffset(0);
    
    if (diff > 50) {
      goPrev();
    } else if (diff < -50) {
      goNext();
    }
  };

  const handleMouseDown = (e) => {
    touchStartX.current = e.clientX;
    touchEndX.current = e.clientX;
  };

  const handleMouseMove = (e) => {
    if (e.buttons !== 1) return;
    touchEndX.current = e.clientX;
    const diff = touchEndX.current - touchStartX.current;
    if (Math.abs(diff) < 150) {
      setSwipeOffset(diff * 0.3);
    }
  };

  const handleMouseUp = () => {
    const diff = touchEndX.current - touchStartX.current;
    setSwipeOffset(0);
    
    if (diff > 50) {
      goPrev();
    } else if (diff < -50) {
      goNext();
    }
  };

  return (
    <div className="landing-page">
      {isLoggedIn ? (
        <>
          <button className="floating-cta share" onClick={onShare}>
            카톡 공유
          </button>
          <Link className="floating-cta my-intro" to="/my-profile">
            내 프로필
          </Link>
        </>
      ) : (
        <button className="floating-cta login-btn" onClick={onLogin}>
          카톡 로그인 먼저!
        </button>
      )}
      <Link className="floating-cta info" to="/info">
        행사 정보
      </Link>

      <div className="landing-header">
        <p className="eyebrow">2025 송년회</p>
        <h1>누가 오나요?</h1>
        <div className="member-count">
          {loading ? (
            <span className="count-loading">...</span>
          ) : (
            <>
              <span className="count-number">{profileCount}</span>
              <span className="count-label">명이 참여 중</span>
            </>
          )}
        </div>
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
              {currentProfile?.profile_image && (
                <div className="card-avatar">
                  <img 
                    src={currentProfile.profile_image} 
                    alt={currentProfile?.name || "프로필"} 
                    onError={(e) => e.target.style.display = 'none'}
                  />
                </div>
              )}
              <h3 className="card-name">{currentProfile?.name || "익명"}</h3>
              <p className="card-tagline">{renderWithDevComment(currentProfile?.tagline) || ""}</p>
              <p className="card-intro">{renderWithDevComment(currentProfile?.intro) || "자기소개가 없어요"}</p>
              {currentProfile?.interests?.length > 0 && (
                <div className="card-chips">
                  {currentProfile.interests.map((interest, idx) => (
                    <span key={idx} className="chip">{interest}</span>
                  ))}
                </div>
              )}
              {currentProfile?.strengths?.length > 0 && (
                <div className="card-chips subtle">
                  {currentProfile.strengths.map((strength, idx) => (
                    <span key={idx} className="chip">{strength}</span>
                  ))}
                </div>
              )}
              {currentProfile?.visibility === "members" && (
                <span className="visibility-badge">멤버 전용</span>
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
    </div>
  );
}
