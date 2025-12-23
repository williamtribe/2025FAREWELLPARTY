import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./PersonalPage.css";

const API_BASE = "/api";

export default function PersonalPage({ session }) {
  const { kakaoId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [expandedCards, setExpandedCards] = useState(new Set());

  const isLoggedIn = Boolean(session?.session_token);
  const isOwner = session?.kakao_id === kakaoId;

  const toggleCard = (cardId) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

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

  const hasSentLetters = data?.sent_letters?.length > 0;
  const hasReceivedLetters = data?.received_letters?.length > 0;
  const hasDevMessage = data?.has_message;

  return (
    <div className="personal-page">
      <div className="personal-page-header">
        <h1>💌 {data?.profile_name || "나"}의 편지함</h1>
      </div>

      {hasDevMessage && (
        <div className="message-container dev-message">
          <div className="section-title">개발자로부터의 메시지</div>
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
        </div>
      )}

      {hasReceivedLetters && (
        <div className="letters-section">
          <div className="section-title">📬 받은 편지 ({data.received_letters.length})</div>
          {data.received_letters.map((letter, idx) => {
            const cardId = `received-${idx}`;
            const isExpanded = expandedCards.has(cardId);
            return (
              <div
                key={idx}
                className={`letter-card received expandable ${isExpanded ? "open" : ""}`}
                onClick={() => toggleCard(cardId)}
              >
                <div className="letter-header">
                  {letter.sender_image && (
                    <img src={letter.sender_image} alt={letter.sender_name} className="letter-avatar" />
                  )}
                  <div className="letter-meta">
                    <span className="letter-from">From. {letter.sender_name}</span>
                    <span className="letter-date">{new Date(letter.created_at).toLocaleDateString("ko-KR")}</span>
                  </div>
                  <span className="expand-icon">{isExpanded ? "▲" : "▼"}</span>
                </div>
                <h3 className="letter-title">{letter.title}</h3>
                {isExpanded && (
                  <div className="letter-content">
                    {letter.content.split("\n").map((line, i) => (
                      <p key={i}>{line || <br />}</p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {hasSentLetters && (
        <div className="letters-section">
          <div className="section-title">📤 보낸 편지 ({data.sent_letters.length})</div>
          {data.sent_letters.map((letter, idx) => {
            const cardId = `sent-${idx}`;
            const isExpanded = expandedCards.has(cardId);
            return (
              <div
                key={idx}
                className={`letter-card sent expandable ${isExpanded ? "open" : ""}`}
                onClick={() => toggleCard(cardId)}
              >
                <div className="letter-header">
                  {letter.recipient_image && (
                    <img src={letter.recipient_image} alt={letter.recipient_name} className="letter-avatar" />
                  )}
                  <div className="letter-meta">
                    <span className="letter-to">To. {letter.recipient_name}</span>
                    <span className="letter-date">{new Date(letter.created_at).toLocaleDateString("ko-KR")}</span>
                  </div>
                  <span className="expand-icon">{isExpanded ? "▲" : "▼"}</span>
                </div>
                <h3 className="letter-title">{letter.title}</h3>
                {isExpanded && (
                  <div className="letter-content">
                    {letter.content.split("\n").map((line, i) => (
                      <p key={i}>{line || <br />}</p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!hasDevMessage && !hasSentLetters && !hasReceivedLetters && (
        <div className="no-message-container">
          <div className="envelope-icon">💌</div>
          <h2>{data?.profile_name || "회원"}님의 편지함</h2>
          <p className="preparing-text">아직 편지가 없어요</p>
          <p className="sub-text">곧 특별한 메시지가 도착할 거예요!</p>
        </div>
      )}

      <button className="back-btn" onClick={() => navigate("/")}>
        홈으로 돌아가기
      </button>
    </div>
  );
}
