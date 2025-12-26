import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./WriteLetterPage.css";

const API_BASE = "/api";

export default function WriteLetterPage({ session }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [senderName, setSenderName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !senderName.trim() || !recipientName.trim()) {
      setError("모든 필드를 입력해주세요");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/public-letters`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          sender_name: senderName.trim(),
          recipient_name: recipientName.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError("편지 작성 중 오류가 발생했습니다");
        return;
      }

      setResult(data);
    } catch (err) {
      setError("네트워크 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
  };

  if (result) {
    return (
      <div className="write-letter-page">
        <div className="result-card">
          <div className="result-header">
            <span className="result-icon">🎉</span>
            <h2>편지가 작성되었습니다!</h2>
          </div>

          <div className="code-section">
            <div className="code-row">
              <span className="code-label">화자 코드 (보내는 사람용)</span>
              <div className="code-display">
                <span className="code-value">{result.sender_code}</span>
                <button className="copy-btn" onClick={() => copyCode(result.sender_code)}>복사</button>
              </div>
              <p className="code-hint">이 코드를 화자({senderName})에게 전달하세요</p>
            </div>

            <div className="code-row">
              <span className="code-label">청자 코드 (받는 사람용)</span>
              <div className="code-display">
                <span className="code-value">{result.recipient_code}</span>
                <button className="copy-btn" onClick={() => copyCode(result.recipient_code)}>복사</button>
              </div>
              <p className="code-hint">이 코드를 청자({recipientName})에게 전달하세요</p>
            </div>
          </div>

          <p className="result-instruction">
            각 코드를 해당 사람에게 전달하면, 개인 페이지에서 코드를 입력해 편지와 연결할 수 있습니다.
          </p>

          <div className="result-actions">
            <button className="action-btn primary" onClick={() => {
              setResult(null);
              setTitle("");
              setContent("");
              setSenderName("");
              setRecipientName("");
            }}>
              새 편지 쓰기
            </button>
            <button className="action-btn secondary" onClick={() => navigate("/")}>
              홈으로
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="write-letter-page">
      <div className="write-letter-card">
        <h1>💌 편지 쓰기</h1>
        <p className="subtitle">마음을 담은 편지를 작성해보세요</p>

        <form onSubmit={handleSubmit}>
          <div className="form-row two-col">
            <div className="form-group">
              <label>화자 (보내는 사람)</label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="보내는 사람 이름"
              />
            </div>
            <div className="form-group">
              <label>청자 (받는 사람)</label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="받는 사람 이름"
              />
            </div>
          </div>

          <div className="form-group">
            <label>제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="편지 제목을 입력하세요"
            />
          </div>

          <div className="form-group">
            <label>내용</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="마음을 담아 편지를 작성해보세요..."
              rows={10}
            />
          </div>

          {error && <p className="error-msg">{error}</p>}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? "작성 중..." : "편지 완성하기"}
          </button>
        </form>

        <button className="back-btn" onClick={() => navigate("/")}>
          ← 돌아가기
        </button>
      </div>
    </div>
  );
}
