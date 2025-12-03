import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export default function LandingPage({ session, onLogin }) {
  const [profileCount, setProfileCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${API_BASE}/profiles/count`);
        const data = await res.json();
        setProfileCount(data.count || 0);
      } catch (err) {
        console.error("Failed to fetch count:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const isLoggedIn = Boolean(session?.session_token);

  return (
    <div className="landing-page">
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

      <div className="landing-actions">
        <Link className="btn-primary" to="/intro">
          참가자 둘러보기
        </Link>
        
        {isLoggedIn ? (
          <>
            <Link className="btn-secondary" to="/my-profile">
              내 프로필 보기
            </Link>
            <Link className="btn-tertiary" to="/others">
              나와 비슷한 사람 찾기
            </Link>
          </>
        ) : (
          <button className="btn-secondary" onClick={onLogin}>
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
