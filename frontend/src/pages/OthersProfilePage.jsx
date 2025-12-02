import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function OthersProfilePage({ session }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isLoggedIn = Boolean(session?.session_token);

  const fetchProfiles = async (type) => {
    if (!session?.session_token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const endpoint = type === "similar" ? "/similar-profiles" : "/different-profiles";
      const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${session.session_token}`,
        },
      });
      
      if (!res.ok) {
        throw new Error("프로필을 불러오는데 실패했습니다.");
      }
      
      const data = await res.json();
      setProfiles(data.profiles || []);
      
      if (data.message === "no_embedding_found") {
        setError("먼저 자기소개를 작성하고 저장해주세요!");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMode = (type) => {
    setMode(type);
    fetchProfiles(type);
  };

  if (!isLoggedIn) {
    return (
      <div className="page others-page">
        <div className="header">
          <div>
            <p className="eyebrow">다른 사람들</p>
            <h1>자기소개 카드 보기</h1>
          </div>
        </div>
        
        <button className="floating-cta info" onClick={() => navigate("/")}>
          돌아가기
        </button>
        
        <section className="panel">
          <div className="card">
            <p>로그인이 필요합니다.</p>
            <button className="primary" onClick={() => navigate("/")}>
              메인으로 돌아가기
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (!mode) {
    return (
      <div className="page others-page">
        <div className="header">
          <div>
            <p className="eyebrow">다른 사람들</p>
            <h1>
              누구를 찾아볼까요?
            </h1>
          </div>
        </div>
        
        <button className="floating-cta info" onClick={() => navigate("/")}>
          돌아가기
        </button>
        
        <section className="panel mode-selection">
          <button 
            className="mode-btn similar"
            onClick={() => handleSelectMode("similar")}
          >
            <span className="mode-icon">🤝</span>
            <span className="mode-title">나랑 닮은 사람</span>
            <span className="mode-desc">비슷한 관심사와 성향을 가진 분들</span>
          </button>
          
          <button 
            className="mode-btn different"
            onClick={() => handleSelectMode("different")}
          >
            <span className="mode-icon">🌈</span>
            <span className="mode-title">나랑 다른 사람</span>
            <span className="mode-desc">새로운 시각을 가진 분들</span>
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="page others-page">
      <div className="header">
        <div>
          <p className="eyebrow">
            {mode === "similar" ? "나랑 닮은 사람" : "나랑 다른 사람"}
          </p>
          <h1>
            {mode === "similar" ? "비슷한 분들이에요" : "다른 매력의 분들이에요"}
          </h1>
        </div>
      </div>
      
      <button className="floating-cta info" onClick={() => navigate("/")}>
        메인으로
      </button>
      <button className="floating-cta share" onClick={() => setMode(null)}>
        다시 선택
      </button>
      
      {loading ? (
        <section className="panel">
          <div className="card">
            <p className="loading-text">프로필을 찾고 있어요...</p>
          </div>
        </section>
      ) : error ? (
        <section className="panel">
          <div className="card">
            <p className="error-text">{error}</p>
            <button className="primary" onClick={() => navigate("/")}>
              자기소개 작성하러 가기
            </button>
          </div>
        </section>
      ) : profiles.length === 0 ? (
        <section className="panel">
          <div className="card">
            <p>아직 등록된 프로필이 없어요.</p>
          </div>
        </section>
      ) : (
        <section className="panel profiles-grid">
          {profiles.map((profile) => (
            <div key={profile.kakao_id} className="profile-card-mini">
              <div className="profile-header">
                <h3>{profile.name || "이름 미입력"}</h3>
                <span className="match-score">
                  {Math.round((profile.similarity_score || 0) * 100)}% 
                  {mode === "similar" ? " 닮음" : " 다름"}
                </span>
              </div>
              <p className="tagline">{profile.tagline || "한 줄 소개가 없어요"}</p>
              <p className="intro">{profile.intro || "자기소개가 없어요"}</p>
              {profile.interests && profile.interests.length > 0 && (
                <div className="chips">
                  {profile.interests.slice(0, 3).map((chip) => (
                    <span key={chip} className="chip">{chip}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

export default OthersProfilePage;
