import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const API_BASE = "/api";

export default function PersonalPage({ session }) {
  const { kakaoId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const isLoggedIn = Boolean(session?.session_token);
  const isOwner = session?.kakao_id === kakaoId;

  useEffect(() => {
    if (!isLoggedIn) {
      setError("로그인이 필요합니다.");
      setLoading(false);
      return;
    }

    if (!isOwner) {
      setError("접근 권한이 없습니다.");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const response = await fetch(`${API_BASE}/personal-page/${kakaoId}`, {
          headers: {
            Authorization: `Bearer ${session.session_token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 403) {
            setError("접근 권한이 없습니다.");
          } else {
            setError("페이지를 불러올 수 없습니다.");
          }
          return;
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error("Failed to fetch personal page:", err);
        setError("페이지를 불러올 수 없습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [kakaoId, isLoggedIn, isOwner, session?.session_token]);

  if (loading) {
    return (
      <div className="personal-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="personal-page">
        <div className="error-container">
          <div className="error-icon">🔒</div>
          <h2>{error}</h2>
          <button className="back-btn" onClick={() => navigate("/")}>
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (!data?.has_message) {
    return (
      <div className="personal-page">
        <div className="no-message-container">
          <div className="envelope-icon">💌</div>
          <h2>{data?.profile_name || "회원"}님을 위한 메시지</h2>
          <p className="preparing-text">아직 준비 중이에요...</p>
          <p className="sub-text">곧 특별한 메시지가 도착할 거예요!</p>
          <button className="back-btn" onClick={() => navigate("/")}>
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="personal-page">
      <div className="message-container">
        <div className="message-header">
          {data.profile_image && (
            <img
              src={data.profile_image}
              alt={data.profile_name}
              className="profile-image"
            />
          )}
          <div className="recipient-info">
            <span className="to-text">To.</span>
            <h2 className="recipient-name">{data.profile_name}</h2>
          </div>
        </div>

        <div className="message-content">
          <h1 className="message-title">{data.title}</h1>
          <div className="message-body">
            {data.content.split("\n").map((line, idx) => (
              <p key={idx}>{line || <br />}</p>
            ))}
          </div>
        </div>

        <div className="message-footer">
          <p className="from-text">From. 개발자</p>
        </div>

        <button className="back-btn" onClick={() => navigate("/")}>
          홈으로 돌아가기
        </button>
      </div>
    </div>
  );
}
