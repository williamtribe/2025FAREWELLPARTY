import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './ConversationPage.css';

const API_BASE = "/api";

function ConversationPage({ session, onLogin, authLoading }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const [conversation, setConversation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({ title: "", content: "" });
    const [status, setStatus] = useState("");

    const authHeaders = {
        Authorization: `Bearer ${session?.session_token}`,
        "Content-Type": "application/json",
    };

    useEffect(() => {
        fetchConversation();

        // Handle auto-join from URL query params
        const params = new URLSearchParams(window.location.search);
        const joinRole = params.get('join');
        if (joinRole && session) {
            handleJoin(joinRole);
            // URL 파라미터 제거
            navigate(`/conversation/${id}`, { replace: true });
        }
    }, [id, session]);

    const fetchConversation = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/conversations/${id}`);
            if (!res.ok) throw new Error("대화를 불러올 수 없습니다.");
            const data = await res.json();
            setConversation(data.conversation);
            setEditData({
                title: data.conversation.title,
                content: data.conversation.content
            });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async (role) => {
        if (!session) {
            // Store pending join in sessionStorage and trigger login
            sessionStorage.setItem('pending-conv-join', JSON.stringify({ id, role }));
            if (onLogin) {
                onLogin();
            } else {
                alert("로그인이 필요합니다.");
            }
            return;
        }
        setStatus(role === 'speaker' ? "화자로 참여 중..." : "청중으로 참여 중...");
        try {
            const res = await fetch(`${API_BASE}/conversations/${id}/join`, {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({ role })
            });
            if (!res.ok) throw new Error("참여 실패");
            await fetchConversation();
            setStatus("참여 완료!");
            setTimeout(() => setStatus(""), 2000);
        } catch (err) {
            setStatus(`오류: ${err.message}`);
        }
    };

    const handleSave = async () => {
        setStatus("저장 중...");
        try {
            const res = await fetch(`${API_BASE}/conversations/${id}`, {
                method: "PUT",
                headers: authHeaders,
                body: JSON.stringify(editData)
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || "저장 실패");
            }
            await fetchConversation();
            setIsEditing(false);
            setStatus("저장 완료!");
            setTimeout(() => setStatus(""), 2000);
        } catch (err) {
            setStatus(`오류: ${err.message}`);
        }
    };

    const copyJoinLink = (role) => {
        const url = `${window.location.origin}/conversation/${id}?join=${role}`;
        navigator.clipboard.writeText(url);
        setStatus(`${role === 'speaker' ? '화자' : '청중'} 초대 링크가 복사되었습니다!`);
        setTimeout(() => setStatus(""), 2000);
    };

    if (loading) return <div className="loading">로딩 중...</div>;
    if (error) return <div className="error-page"><h2>오류</h2><p>{error}</p></div>;

    const isSpeaker = session && conversation.speakers.includes(session.kakao_id);
    const isCreator = session && conversation.creator_id === session.kakao_id;
    const canEdit = isSpeaker || isCreator;

    return (
        <div className="conversation-page">
            <header className="conv-header">
                <button className="back-btn" onClick={() => navigate(-1)}>← 뒤로</button>
                <div className="header-center">
                    <h1>{isEditing ? "대화 편집" : conversation.title}</h1>
                </div>
                {session ? (
                    <div className="header-right-placeholder"></div>
                ) : (
                    <button className="login-btn-top" onClick={onLogin} disabled={authLoading}>
                        {authLoading ? "로그인 중..." : "카톡 로그인"}
                    </button>
                )}
            </header>

            <main className="conv-content">
                <section className="roles-section">
                    <div className="role-group">
                        <h3>화자 (Speakers)</h3>
                        <div className="member-list">
                            {conversation.speakers_data.map(m => (
                                <span key={m.kakao_id} className="member-tag speaker">{m.name}</span>
                            ))}
                            {!isSpeaker && (
                                <button className="join-btn speaker" onClick={() => handleJoin('speaker')} disabled={authLoading}>
                                    {authLoading ? "로그인 중..." : "화자로 참여하기"}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="role-group">
                        <h3>청중 (Listeners)</h3>
                        <div className="member-list">
                            {conversation.listeners_data.map(m => (
                                <span key={m.kakao_id} className="member-tag listener">{m.name}</span>
                            ))}
                            {!conversation.listeners.includes(session?.kakao_id) && (
                                <button className="join-btn listener" onClick={() => handleJoin('listener')} disabled={authLoading}>
                                    {authLoading ? "로그인 중..." : "청중으로 참여하기"}
                                </button>
                            )}
                        </div>
                    </div>
                </section>

                <section className="main-text">
                    {isEditing ? (
                        <div className="editor-wrap">
                            <input
                                type="text"
                                value={editData.title}
                                onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                                placeholder="대화 제목"
                                className="edit-title"
                            />
                            <textarea
                                value={editData.content}
                                onChange={(e) => setEditData({ ...editData, content: e.target.value })}
                                placeholder="대화 내용을 입력하세요..."
                                rows={15}
                                className="edit-content"
                            ></textarea>
                            <div className="edit-actions">
                                <button className="save-btn" onClick={handleSave}>저장하기</button>
                                <button className="cancel-btn" onClick={() => setIsEditing(false)}>취소</button>
                            </div>
                        </div>
                    ) : (
                        <div className="display-wrap">
                            <div className="content-box">
                                {conversation.content || "아직 작성된 내용이 없습니다."}
                            </div>
                            {canEdit && (
                                <button className="edit-btn" onClick={() => setIsEditing(true)}>내용 편집하기</button>
                            )}
                        </div>
                    )}
                </section>

                <section className="share-section">
                    <h3>초대하기</h3>
                    <div className="share-btns">
                        <button onClick={() => copyJoinLink('speaker')}>화자 초대 링크 복사</button>
                        <button onClick={() => copyJoinLink('listener')}>청중 초대 링크 복사</button>
                    </div>
                </section>

                {status && <p className="conv-status">{status}</p>}
            </main>
        </div>
    );
}

export default ConversationPage;
