import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./ConversationListPage.css";

const API_BASE = "/api";

export default function ConversationListPage({ session }) {
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (!session?.session_token) {
            navigate("/");
            return;
        }
        fetchConversations();
    }, [session, navigate]);

    const fetchConversations = async () => {
        try {
            const res = await fetch(`${API_BASE}/conversations`, {
                headers: {
                    Authorization: `Bearer ${session.session_token}`,
                },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "대화 목록을 불러오지 못했습니다.");
            setConversations(data.data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
    };

    if (loading) return <div className="conv-list-page loading">대화 목록 불러오는 중...</div>;

    return (
        <div className="conv-list-page">
            <div className="conv-list-header">
                <Link className="back-btn" to="/">← 뒤로가기</Link>
                <h1>내 대화 목록</h1>
                <p className="subtitle">참여 중인 대화들을 확인하고 편집하세요.</p>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="conv-list-container">
                {conversations.length === 0 ? (
                    <div className="empty-conv">
                        <p>아직 참여 중인 대화가 없습니다.</p>
                        <Link className="btn-primary" to="/">대화 찾으러 가기</Link>
                    </div>
                ) : (
                    conversations.map((conv) => (
                        <div
                            key={conv.id}
                            className="conv-card"
                            onClick={() => navigate(`/conversation/${conv.id}`)}
                        >
                            <div className="conv-card-info">
                                <h3 className="conv-card-title">{conv.title || "새로운 대화"}</h3>
                                <span className="conv-card-date">{formatDate(conv.date)}</span>
                            </div>
                            <div className="conv-card-members">
                                {conv.speakers?.length > 0 && (
                                    <div className="member-tags">
                                        {conv.speakers.map((s, idx) => (
                                            <span key={idx} className="speaker-tag">👤 화자</span>
                                        ))}
                                    </div>
                                )}
                                {conv.listeners?.length > 0 && (
                                    <div className="member-tags">
                                        {conv.listeners.map((l, idx) => (
                                            <span key={idx} className="listener-tag">👂 청자</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="arrow-icon">→</div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
