import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";

const API_BASE = "/api";

// Render text with *comment styled differently
function renderWithDevComment(text) {
  if (!text) return null;
  const starIndex = text.indexOf("*");
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
  const [myPicks, setMyPicks] = useState(new Set());
  const [pickLoading, setPickLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("intro");
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);

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

        const requests = [
          fetch(`${API_BASE}/profiles/count`),
          fetch(profilesEndpoint, { headers }),
        ];

        if (isLoggedIn) {
          requests.push(fetch(`${API_BASE}/picks`, { headers }));
        }

        const responses = await Promise.all(requests);
        const countData = await responses[0].json();
        const profilesData = await responses[1].json();
        setProfileCount(countData.count || 0);
        setPublicProfiles(profilesData.profiles || []);

        if (isLoggedIn && responses[2]) {
          const picksData = await responses[2].json();
          setMyPicks(new Set(picksData.picks || []));
        }
      } catch (err) {
        console.error("Failed to fetch landing data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isLoggedIn, session?.session_token]);

  const togglePick = async (targetKakaoId) => {
    if (!isLoggedIn || pickLoading) return;
    setPickLoading(true);

    const isPicked = myPicks.has(targetKakaoId);
    const method = isPicked ? "DELETE" : "POST";

    try {
      const res = await fetch(`${API_BASE}/picks/${targetKakaoId}`, {
        method,
        headers: { Authorization: `Bearer ${session.session_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMyPicks(new Set(data.has_picked || []));
      }
    } catch (err) {
      console.error("Failed to toggle pick:", err);
    } finally {
      setPickLoading(false);
    }
  };

  const shuffleProfiles = () => {
    const shuffled = [...publicProfiles];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setPublicProfiles(shuffled);
    setCurrentIndex(0);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      alert("검색어는 2글자 이상 입력해주세요.");
      return;
    }

    setSearchLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/search-profiles?q=${encodeURIComponent(searchQuery)}&search_type=${searchType}&limit=20`,
      );
      const data = await res.json();
      if (res.ok) {
        setSearchResults(data.profiles || []);
      } else {
        alert(data.detail || "검색에 실패했습니다.");
      }
    } catch (err) {
      console.error("Search failed:", err);
      alert("검색 중 오류가 발생했습니다.");
    } finally {
      setSearchLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchResults(null);
    setSearchQuery("");
  };

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

      <div className="search-section">
        <div className="search-type-tabs">
          <button
            className={`search-type-btn ${searchType === "intro" ? "active" : ""}`}
            onClick={() => setSearchType("intro")}
          >
            자기소개로 검색
          </button>
          <button
            className={`search-type-btn ${searchType === "interests" ? "active" : ""}`}
            onClick={() => setSearchType("interests")}
          >
            관심사로 검색
          </button>
        </div>
        <div className="search-input-row">
          <input
            type="text"
            className="search-input"
            placeholder={
              searchType === "intro"
                ? "최대한 자세히 적어주세요!"
                : "최대한 자세히 적어주세요!"
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button
            className="search-btn"
            onClick={handleSearch}
            disabled={searchLoading}
          >
            {searchLoading ? "..." : "🔍"}
          </button>
        </div>
        {searchResults !== null && (
          <button className="clear-search-btn" onClick={clearSearch}>
            ← 전체 목록으로
          </button>
        )}
      </div>

      {searchResults !== null ? (
        <div className="search-results">
          <h3 className="search-results-title">
            "{searchQuery}" 검색 결과 ({searchResults.length}명)
          </h3>
          {searchResults.length > 0 ? (
            <div className="search-results-list">
              {searchResults.map((profile) => (
                <div key={profile.kakao_id} className="search-result-card">
                  <div className="search-result-header">
                    {profile.profile_image && (
                      <img
                        src={profile.profile_image}
                        alt=""
                        className="search-result-avatar"
                      />
                    )}
                    <div className="search-result-info">
                      <span className="search-result-name">{profile.name}</span>
                      {profile.tagline && (
                        <span className="search-result-tagline">
                          {profile.tagline}
                        </span>
                      )}
                    </div>
                    <span className="similarity-score">
                      {Math.round(profile.similarity_score * 100)}%
                    </span>
                  </div>
                  {profile.intro && (
                    <p className="search-result-intro">
                      {renderWithDevComment(profile.intro)}
                    </p>
                  )}
                  {profile.interests?.length > 0 && (
                    <div className="search-result-interests">
                      {profile.interests.slice(0, 5).map((interest, idx) => (
                        <span key={idx} className="interest-chip-small">
                          {interest}
                        </span>
                      ))}
                      {profile.interests.length > 5 && (
                        <span className="interest-chip-small more">
                          +{profile.interests.length - 5}
                        </span>
                      )}
                    </div>
                  )}
                  {isLoggedIn &&
                    String(profile.kakao_id) !== String(session?.kakao_id) && (
                      <button
                        className={`pick-btn-small ${myPicks.has(profile.kakao_id) ? "picked" : ""}`}
                        onClick={() => togglePick(profile.kakao_id)}
                        disabled={pickLoading}
                      >
                        {myPicks.has(profile.kakao_id)
                          ? "💚 찜했어요"
                          : "🤍 찜하기"}
                      </button>
                    )}
                </div>
              ))}
            </div>
          ) : (
            <p className="no-results">검색 결과가 없습니다.</p>
          )}
        </div>
      ) : loading ? (
        <div className="loading-state">프로필 불러오는 중...</div>
      ) : publicProfiles.length > 0 ? (
        <div className="profile-carousel">
          <div className="carousel-header">
            <div className="carousel-counter">
              {currentIndex + 1} / {publicProfiles.length}
            </div>
            <button className="shuffle-btn" onClick={shuffleProfiles}>
              🎲 섞기
            </button>
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
                transition: isAnimating ? "transform 0.2s ease-out" : "none",
              }}
            >
              {currentProfile?.profile_image && (
                <div className="card-avatar">
                  <img
                    src={currentProfile.profile_image}
                    alt={currentProfile?.name || "프로필"}
                    onError={(e) => (e.target.style.display = "none")}
                  />
                </div>
              )}
              <h3 className="card-name">{currentProfile?.name || "익명"}</h3>
              <p className="card-tagline">
                {renderWithDevComment(currentProfile?.tagline) || ""}
              </p>
              <p className="card-intro">
                {renderWithDevComment(currentProfile?.intro) ||
                  "자기소개가 없어요"}
              </p>
              {currentProfile?.interests?.length > 0 && (
                <div className="card-chips">
                  {currentProfile.interests.map((interest, idx) => (
                    <span key={idx} className="chip">
                      {interest}
                    </span>
                  ))}
                </div>
              )}
              {currentProfile?.strengths?.length > 0 && (
                <div className="card-chips subtle">
                  {currentProfile.strengths.map((strength, idx) => (
                    <span key={idx} className="chip">
                      {strength}
                    </span>
                  ))}
                </div>
              )}
              {currentProfile?.visibility === "members" && (
                <span className="visibility-badge">참여자만 볼 수 있음</span>
              )}
              {isLoggedIn &&
                currentProfile?.kakao_id &&
                String(currentProfile.kakao_id) !==
                  String(session?.kakao_id) && (
                  <button
                    className={`pick-btn ${myPicks.has(currentProfile.kakao_id) ? "picked" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePick(currentProfile.kakao_id);
                    }}
                    disabled={pickLoading}
                  >
                    {myPicks.has(currentProfile.kakao_id)
                      ? "💚 찜했어요"
                      : "🤍 찜하기"}
                  </button>
                )}
            </div>

            <div className="swipe-hint">← 슥슥 넘겨보세요 →</div>
          </div>

          <div className="carousel-dots">
            {publicProfiles.slice(0, 10).map((_, idx) => (
              <span
                key={idx}
                className={`dot ${idx === currentIndex ? "active" : ""}`}
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
