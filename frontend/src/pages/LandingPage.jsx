import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export default function LandingPage({ session, onLogin }) {
  const [profileCount, setProfileCount] = useState(0);
  const [publicProfiles, setPublicProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [countRes, profilesRes] = await Promise.all([
          fetch(`${API_BASE}/profiles/count`),
          fetch(`${API_BASE}/profiles/public?limit=50`),
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
  }, []);

  const isLoggedIn = Boolean(session?.session_token);
  const currentProfile = publicProfiles[currentIndex];

  const goNext = () => {
    if (currentIndex < publicProfiles.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  return (
    <div className="landing-page">
      <div className="landing-header">
        <p className="eyebrow">2025 송년회</p>
        <h1>누가 오나요?</h1>
        <div className="member-count">
          <span className="count-number">{profileCount}</span>
          <span className="count-label">명이 참여 중</span>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">프로필 불러오는 중...</div>
      ) : publicProfiles.length > 0 ? (
        <div className="profile-carousel">
          <div className="carousel-counter">
            {currentIndex + 1} / {publicProfiles.length}
          </div>
          
          <div className="carousel-card">
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

          <div className="carousel-nav">
            <button 
              className="nav-btn prev" 
              onClick={goPrev}
              disabled={currentIndex === 0}
            >
              ← 이전
            </button>
            <button 
              className="nav-btn next" 
              onClick={goNext}
              disabled={currentIndex === publicProfiles.length - 1}
            >
              다음 →
            </button>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <p>아직 공개된 프로필이 없어요</p>
          <p className="muted">첫 번째로 등록해보세요!</p>
        </div>
      )}

      <div className="landing-actions">
        {isLoggedIn ? (
          <>
            <Link className="btn-primary" to="/my-profile">
              내 프로필 보기
            </Link>
            <Link className="btn-secondary" to="/others">
              나와 비슷한 사람 찾기
            </Link>
          </>
        ) : (
          <button className="btn-primary" onClick={onLogin}>
            카카오로 참여하기
          </button>
        )}
        <Link className="btn-tertiary" to="/info">
          행사 정보
        </Link>
      </div>
    </div>
  );
}
