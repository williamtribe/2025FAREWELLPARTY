import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./MafBTIPage.css";

const DEFAULT_JOB_IMAGE = "/job_images/이레귤러_시민_시민 스킨.png";

export default function MafBTIPage({ session, onLogin }) {
  const navigate = useNavigate();
  const [intro, setIntro] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const isLoggedIn = Boolean(session?.session_token);

  const handleSubmit = async () => {
    if (!intro.trim()) {
      setError("자기소개를 입력해주세요!");
      return;
    }
    if (intro.trim().length < 20) {
      setError("조금 더 길게 작성해주세요! (최소 20자)");
      return;
    }

    if (!isLoggedIn) {
      setError("결과를 보려면 로그인이 필요해요!");
      onLogin();
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/mafbti", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session_token}`,
        },
        body: JSON.stringify({ intro: intro.trim() }),
      });

      if (!res.ok) {
        throw new Error("서버 오류가 발생했어요");
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      setError("분석 중 오류가 발생했어요. 다시 시도해주세요!");
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setResult(null);
    setIntro("");
  };

  return (
    <div className="mafbti-page">
      <div className="mafbti-container">
        <Link to="/" className="mafbti-back-link">← 돌아가기</Link>
        <div className="mafbti-header">
          <h1>🎭 맢BTI</h1>
          <p className="mafbti-subtitle">마피아42 직업 테스트</p>
        </div>

        {!isLoggedIn && (
          <p className="mafbti-login-prompt">
            결과를 저장하고 확인하려면 로그인이 필요해요!
          </p>
        )}

        {!result ? (
          <div className="mafbti-form">
            <div className="mafbti-prompt">
              <p>당신은 어떤 사람인가요?</p>
              <span className="mafbti-hint">
                성격, 취미, 관심사, 특기 등을 자유롭게 적어주세요!
              </span>
            </div>

            <textarea
              className="mafbti-input"
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="예: 저는 정의감이 강하고 추리를 좋아해요. 게임할 때 전략적으로 플레이하는 편이고, 사람들의 심리를 읽는 걸 잘해요. 취미는 독서와 영화 감상이에요..."
              rows={6}
              disabled={!isLoggedIn}
              maxLength={500}
            />
            <div className="char-count">{intro.length} / 500</div>

            {error && <p className="mafbti-error">{error}</p>}

            <button
              className="mafbti-submit"
              onClick={handleSubmit}
              disabled={loading || !isLoggedIn}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  분석 중...
                </>
              ) : (
                "🔮 내 직업 알아보기"
              )}
            </button>
          </div>
        ) : (
          <div className="mafbti-result">
            <div className="result-image-container">
              <img
                src={`/job_images/${result.role}.png`}
                alt={result.role}
                className="result-image"
                onError={(e) => { e.target.src = DEFAULT_JOB_IMAGE; }}
              />
            </div>

            <div className={`result-badge team-${result.team}`}>
              <span className="result-team">{result.team}</span>
              <h2 className="result-role">{result.role}</h2>
            </div>

            <div className="result-reasoning">
              <p>{result.reasoning}</p>
            </div>

            <div className="result-actions">
              <button className="retry-btn" onClick={handleRetry}>
                🔄 다시 하기
              </button>
              <Link to="/onboarding" className="home-link">
                🎉 행사 등록하기
              </Link>
            </div>

            <div className="share-section">
              <p className="share-hint">결과가 마음에 드셨나요? 캡처해서 공유해보세요!</p>
            </div>
          </div>
        )}

        <div className="mafbti-footer">
          <p>마피아42 직업 스토리 기반 AI 매칭</p>
        </div>
      </div>

      {!isLoggedIn && (
        <button className="floating-cta login-btn mafbti-login-btn" onClick={onLogin}>
          카톡 로그인 먼저!
        </button>
      )}
    </div>
  );
}
