import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = "/api";

function OthersProfilePage({ session }) {
  const navigate = useNavigate();
  const [criteria, setCriteria] = useState(null);
  const [mode, setMode] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isLoggedIn = Boolean(session?.session_token);

  const fetchProfiles = async (type, selectedCriteria) => {
    if (!session?.session_token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const endpoint = type === "similar" ? "/similar-profiles" : "/different-profiles";
      const res = await fetch(`${API_BASE}${endpoint}?criteria=${selectedCriteria}`, {
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
        setError(selectedCriteria === "intro" 
          ? "먼저 자기소개를 작성하고 저장해주세요!" 
          : "먼저 관심사를 입력하고 저장해주세요!");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCriteria = (selectedCriteria) => {
    setCriteria(selectedCriteria);
  };

  const handleSelectMode = (type) => {
    setMode(type);
    fetchProfiles(type, criteria);
  };

  const handleReset = () => {
    setCriteria(null);
    setMode(null);
    setProfiles([]);
    setError(null);
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

  if (!criteria) {
    return (
      <div className="page others-page">
        <div className="header">
          <div>
            <p className="eyebrow">다른 사람들</p>
            <h1>
              어떤 기준으로 찾아볼까요?
            </h1>
          </div>
        </div>
        
        <button className="floating-cta info" onClick={() => navigate("/")}>
          돌아가기
        </button>
        
        <section className="panel mode-selection">
          <button 
            className="mode-btn criteria-intro"
            onClick={() => handleSelectCriteria("intro")}
          >
            <span className="mode-icon">📝</span>
            <span className="mode-title">자기소개 기준</span>
            <span className="mode-desc">자기소개 내용이 비슷하거나 다른 분들</span>
          </button>
          
          <button 
            className="mode-btn criteria-interests"
            onClick={() => handleSelectCriteria("interests")}
          >
            <span className="mode-icon">🎯</span>
            <span className="mode-title">관심사 기준</span>
            <span className="mode-desc">취미와 관심사가 비슷하거나 다른 분들</span>
          </button>
        </section>
      </div>
    );
  }

  if (!mode) {
    return (
      <div className="page others-page">
        <div className="header">
          <div>
            <p className="eyebrow">{criteria === "intro" ? "자기소개 기준" : "관심사 기준"}</p>
            <h1>
              누구를 찾아볼까요?
            </h1>
          </div>
        </div>
        
        <button className="floating-cta info" onClick={() => navigate("/")}>
          메인으로
        </button>
        <button className="floating-cta share" onClick={handleReset}>
          다시 선택
        </button>
        
        <section className="panel mode-selection">
          <button 
            className="mode-btn similar"
            onClick={() => handleSelectMode("similar")}
          >
            <span className="mode-icon">🤝</span>
            <span className="mode-title">나랑 닮은 사람</span>
            <span className="mode-desc">
              {criteria === "intro" 
                ? "비슷한 자기소개를 가진 분들" 
                : "비슷한 관심사를 가진 분들"}
            </span>
          </button>
          
          <button 
            className="mode-btn different"
            onClick={() => handleSelectMode("different")}
          >
            <span className="mode-icon">🌈</span>
            <span className="mode-title">나랑 다른 사람</span>
            <span className="mode-desc">
              {criteria === "intro" 
                ? "다른 스타일의 자기소개를 가진 분들" 
                : "다른 관심사를 가진 분들"}
            </span>
          </button>
        </section>
      </div>
    );
  }

  const criteriaLabel = criteria === "intro" ? "자기소개" : "관심사";
  
  return (
    <div className="page others-page">
      <div className="header">
        <div>
          <p className="eyebrow">
            {criteriaLabel} 기준 | {mode === "similar" ? "나랑 닮은 사람" : "나랑 다른 사람"}
          </p>
          <h1>
            {mode === "similar" ? "비슷한 분들이에요" : "다른 매력의 분들이에요"}
          </h1>
        </div>
      </div>
      
      <button className="floating-cta info" onClick={() => navigate("/")}>
        메인으로
      </button>
      <button className="floating-cta share" onClick={handleReset}>
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
