import { useEffect, useMemo, useState } from "react";
import {
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import "./App.css";
import IntroPage from "./pages/IntroPage";
import EventInfo from "./pages/EventInfo";
import AIIntroPage from "./pages/AIIntroPage";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const CALLBACK_PROCESSED_KEY = "kakao-callback-processed";
const KAKAO_JS_KEY =
  import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY ||
  import.meta.env.VITE_KAKAO_JS_KEY;
const SHARE_URL = import.meta.env.VITE_SHARE_URL || window.location.origin;
const KAKAO_TEMPLATE_ID = 126447; // 사용자 정의 템플릿 ID
const HOST_ID = "4609921299";
const LANDING_SEEN_KEY = "farewell-landing-seen";
const defaultHostProfile = {
  name: "김영진",
  tagline: "변호사지망 씹덕",
  intro:
    "안녕하세요, 25년도도 고생 많으셨고, 미슐랭 쉐프의 스테이크 맛있게 썰어주세요.",
  interests: ["레제", "마피아42", "법", "AI"],
  strengths: ["사람을 좋아함"],
  contact: "@williamkim816",
};
const emptyProfile = {
  name: "",
  intro: "",
  tagline: "",
  interests: [],
  strengths: [],
  contact: "",
  visibility: "public",
};

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState(() => {
    const saved = localStorage.getItem("farewell-session");
    return saved ? JSON.parse(saved) : null;
  });
  const [profile, setProfile] = useState(emptyProfile);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [interestsInput, setInterestsInput] = useState("");
  const [strengthsInput, setStrengthsInput] = useState("");
  const [isEditing, setIsEditing] = useState(true);
  const [hostProfile, setHostProfile] = useState(defaultHostProfile);

  const authHeaders = useMemo(() => {
    return session?.session_token
      ? {
          Authorization: `Bearer ${session.session_token}`,
          "Content-Type": "application/json",
        }
      : { "Content-Type": "application/json" };
  }, [session]);

  useEffect(() => {
    if (location.pathname !== "/api/auth/kakao/callback") return;
    // React StrictMode에서 useEffect가 두 번 실행되어 Kakao code가 재사용되는 것을 방지.
    if (sessionStorage.getItem(CALLBACK_PROCESSED_KEY)) return;
    sessionStorage.setItem(CALLBACK_PROCESSED_KEY, "1");
    handleKakaoCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (session?.session_token) {
      fetchMyProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.session_token]);

  useEffect(() => {
    if (!KAKAO_JS_KEY) return;
    if (window.Kakao && window.Kakao.isInitialized()) return;
    const script = document.createElement("script");
    script.src = "https://developers.kakao.com/sdk/js/kakao.min.js";
    script.async = true;
    script.onload = () => {
      if (window.Kakao && !window.Kakao.isInitialized()) {
        window.Kakao.init(KAKAO_JS_KEY);
      }
    };
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    fetchHostProfile();
  }, []);

  useEffect(() => {
    const seen = localStorage.getItem(LANDING_SEEN_KEY);
    if (!seen && location.pathname === "/") {
      navigate("/intro", { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === "kakao-login-success") {
        console.log("Login success from popup:", event.data.session);
        setSession(event.data.session);
        setStatus("로그인 완료! 프로필을 불러오는 중...");
        navigate("/", { replace: true });
      } else if (event.data?.type === "kakao-login-error") {
        console.error("Login error from popup:", event.data.error);
        setStatus(`로그인 오류: ${event.data.error}`);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [navigate]);

  const handleKakaoLogin = async () => {
    sessionStorage.removeItem(CALLBACK_PROCESSED_KEY);
    setStatus("카카오 로그인 페이지로 이동합니다...");
    try {
      console.log("Fetching login URL from:", `${API_BASE}/auth/kakao/login`);
      const res = await fetch(`${API_BASE}/auth/kakao/login`);
      if (!res.ok) {
        throw new Error(`Login request failed: ${res.status}`);
      }
      const data = await res.json();
      console.log("Login response:", data);
      localStorage.setItem("kakao-state", data.state);
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      window.open(
        data.auth_url,
        "KakaoLogin",
        `width=${width},height=${height},left=${left},top=${top},popup=yes`,
      );
      setStatus(
        "카카오 로그인 창에서 로그인해주세요. 완료되면 자동으로 돌아옵니다.",
      );
    } catch (err) {
      console.error("Kakao login error:", err);
      setStatus(`로그인 오류: ${err.message}`);
    }
  };

  const handleKakaoCallback = async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const savedState = localStorage.getItem("kakao-state");
    if (!code) return;
    setStatus("카카오 인증 처리 중...");
    try {
      const res = await fetch(
        `${API_BASE}/auth/kakao/callback?code=${code}&state=${state}`,
      );
      const data = await res.json();
      if (savedState && state !== savedState) {
        setStatus("state 불일치: 다시 시도해주세요.");
        localStorage.removeItem("kakao-state");
        return;
      }
      const sessionPayload = {
        ...data.profile,
        session_token: data.session_token,
      };
      localStorage.setItem("farewell-session", JSON.stringify(sessionPayload));
      localStorage.removeItem("kakao-state");
      localStorage.setItem(LANDING_SEEN_KEY, "1");
      if (window.opener) {
        window.opener.postMessage(
          { type: "kakao-login-success", session: sessionPayload },
          "*",
        );
        window.close();
      } else {
        setSession(sessionPayload);
        setStatus("로그인 완료! 프로필을 불러오는 중...");
        navigate("/", { replace: true });
      }
    } catch (err) {
      console.error("Kakao callback error:", err);
      setStatus(`인증 오류: ${err.message}`);
      if (window.opener) {
        window.opener.postMessage(
          { type: "kakao-login-error", error: err.message },
          "*",
        );
        window.close();
      }
    }
    sessionStorage.removeItem(CALLBACK_PROCESSED_KEY);
  };

  const fetchMyProfile = async () => {
    if (!session?.session_token) return;
    setStatus("프로필을 불러오는 중...");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/me`, { headers: authHeaders });
      if (!res.ok) throw new Error("프로필을 불러오지 못했습니다.");
      const data = await res.json();
      const incoming = data.profile || {};
      const baseName = session?.nickname || "";
      setProfile({
        ...emptyProfile,
        name: incoming.name || baseName,
        ...incoming,
      });
      setInterestsInput((incoming.interests || []).join(", "));
      setStrengthsInput((incoming.strengths || []).join(", "));
      setIsEditing(false);
      setStatus("");
    } catch (err) {
      setStatus(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const updateListField = (field, value) => {
    const parts = value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    setProfile((prev) => ({ ...prev, [field]: parts }));
    if (field === "interests") setInterestsInput(value);
    if (field === "strengths") setStrengthsInput(value);
  };

  const saveProfile = async () => {
    if (!session?.session_token) return setStatus("로그인이 필요합니다.");
    setLoading(true);
    setStatus("저장하고 있습니다...");
    try {
      const res = await fetch(`${API_BASE}/me`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "저장 실패");
      setStatus("저장 완료!");
      setProfile((prev) => ({ ...prev, ...data.profile }));
      setIsEditing(false);
    } catch (err) {
      setStatus(err.message);
    } finally {
      setLoading(false);
    }
  };

  const shareToKakao = () => {
    const { Kakao } = window;
    if (!KAKAO_JS_KEY)
      return setStatus(
        "카카오 JS 키가 없습니다. VITE_KAKAO_JAVASCRIPT_KEY를 설정하세요.",
      );
    if (!Kakao)
      return setStatus("카카오 SDK 로드 중입니다. 잠시 후 다시 시도하세요.");
    if (!Kakao.isInitialized()) Kakao.init(KAKAO_JS_KEY);

    const title = "2025.12.20 송년회";
    const description =
      profile.tagline ||
      "얘기가 잘 통하는 사람들만 만날겁니다. 12월 20일 잠실에서 함께해요.";
    const name = profile.name || session?.nickname || "친구";

    try {
      Kakao.Share.sendCustom(
        {
          templateId: KAKAO_TEMPLATE_ID,
          templateArgs: {
            title,
            description,
            name,
            link_url: SHARE_URL,
          },
        },
        {
          fail: () => {
            // 카카오톡 미설치 등으로 실패 시 링크 복사/대체 안내
            if (navigator?.clipboard?.writeText) {
              navigator.clipboard.writeText(SHARE_URL).then(
                () =>
                  setStatus(
                    "카카오톡이 없어 링크를 복사했습니다. 붙여넣어 공유하세요.",
                  ),
                () =>
                  setStatus(
                    "카카오톡이 없어 공유를 못했습니다. 링크를 직접 복사해 주세요.",
                  ),
              );
            } else {
              setStatus(
                "카카오톡이 없어 공유를 못했습니다. 링크를 직접 복사해 주세요.",
              );
            }
          },
        },
      );
    } catch (err) {
      setStatus(`카카오 공유 중 오류가 발생했습니다: ${err}`);
    }
  };

  const fetchHostProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/profiles/${HOST_ID}`);
      if (!res.ok) throw new Error("host_profile_unavailable");
      const data = await res.json();
      if (data?.profile)
        setHostProfile((prev) => ({ ...prev, ...data.profile }));
    } catch (err) {
      console.warn("Host profile load failed, using default", err);
    }
  };

  const isLoggedIn = Boolean(session?.session_token);
  const displayName = profile.name || session?.nickname || "이름 미입력";
  const displayTagline = profile.tagline || "한 줄 소개가 여기에 보여요";
  const displayIntro =
    profile.intro || "자기소개를 적으면 바로 여기서 확인할 수 있습니다.";
  const displayContact = profile.contact || "미입력";
  const markIntroSeen = () => localStorage.setItem(LANDING_SEEN_KEY, "1");

  const mainPage = (
    <div className="page">
      <div className="header">
        <div>
          <p className="eyebrow">2025 송년회</p>
          <h1>대화상대 정해주는 GOAT 테크놀로지와 함께</h1>
          {isLoggedIn && (
            <div className="cta-row">
              <span className="muted">
                와주셔서 감사합니다, {session?.nickname || "친구"}님
              </span>
            </div>
          )}
          {status && <div className="status">{status}</div>}
        </div>
      </div>

      {isLoggedIn ? (
        <>
          <button className="floating-cta share" onClick={shareToKakao}>
            카톡 공유
          </button>
          <Link className="floating-cta ai-intro" to="/ai-intro">
            {profile.intro ? "3초 취향확인" : "3초 AI생성 자기소개"}
          </Link>
        </>
      ) : (
        <button className="floating-cta login-btn" onClick={handleKakaoLogin}>
          카톡 로그인 먼저!
        </button>
      )}
      <Link className="floating-cta info" to="/info">
        행사 정보
      </Link>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>자기소개 카드</h2>
          </div>
          {!isEditing && (
            <button
              className="ghost inline"
              onClick={() => setIsEditing(true)}
              disabled={!isLoggedIn}
            >
              편집
            </button>
          )}
        </div>

        <div className="profile-card">
          {isEditing ? (
            <div className="profile-form">
              <div className="two-col">
                <div>
                  <label>이름</label>
                  <input
                    value={profile.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="예시: 김영진"
                    disabled={!isLoggedIn}
                  />
                </div>
                <div>
                  <label>연락처</label>
                  <input
                    value={profile.contact}
                    onChange={(e) => updateField("contact", e.target.value)}
                    placeholder="(비공개) 전화번호/카카오id"
                    disabled={!isLoggedIn}
                  />
                </div>
              </div>

              <label>한 단어 소개 (수식어 많아도 괜찮아요)</label>
              <input
                value={profile.tagline}
                onChange={(e) => updateField("tagline", e.target.value)}
                placeholder="예시: 변호사지망 씹덕"
                disabled={!isLoggedIn}
              />

              <label>자기소개</label>
              <textarea
                value={profile.intro}
                onChange={(e) => updateField("intro", e.target.value)}
                placeholder="예시: 레제를 죽인 마키마를 개싫어하는 법조인 지망생입니다. 마피아42가 너무 재밌어서 그 회사에서 일하는 중입니당."
                rows={4}
                disabled={!isLoggedIn}
              />

              <div className="two-col">
                <div>
                  <label>관심사 (쉼표로 구분)</label>
                  <input
                    value={interestsInput}
                    onChange={(e) =>
                      updateListField("interests", e.target.value)
                    }
                    placeholder="애니, 레제, 게임, 체인소맨, 마피아42, AI, 법"
                    disabled={!isLoggedIn}
                  />
                </div>
                <div>
                  <label>특기 (쉼표로 구분)</label>
                  <input
                    value={strengthsInput}
                    onChange={(e) =>
                      updateListField("strengths", e.target.value)
                    }
                    placeholder="사람을 좋아함"
                    disabled={!isLoggedIn}
                  />
                </div>
              </div>

              <label>공개 범위</label>
              <select
                value={profile.visibility}
                onChange={(e) => updateField("visibility", e.target.value)}
                disabled={!isLoggedIn}
              >
                <option value="public">모두 공개</option>
                <option value="members">참여자에게만</option>
                <option value="private">비공개</option>
              </select>

              <button
                className="primary"
                onClick={saveProfile}
                disabled={!isLoggedIn || loading}
              >
                {loading ? "저장 중..." : "프로필 저장"}
              </button>
            </div>
          ) : (
            <div className="profile-hero">
              <div>
                <h3>{displayName}</h3>
                <p className="tagline">{displayTagline}</p>
                <p className="intro">{displayIntro}</p>
                <div className="chips">
                  {(profile.interests.length
                    ? profile.interests
                    : ["AI", "음악"]
                  ).map((chip) => (
                    <span key={chip} className="chip">
                      {chip}
                    </span>
                  ))}
                </div>
                <div className="chips subtle">
                  {(profile.strengths.length
                    ? profile.strengths
                    : ["전략", "데이터"]
                  ).map((chip) => (
                    <span key={chip} className="chip">
                      {chip}
                    </span>
                  ))}
                </div>
                <p className="muted">연락처: {displayContact}</p>
                <p className="muted">공개 범위: {profile.visibility}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 설문 및 관리자 프로필 섹션은 별도 페이지로 이동 예정 */}
    </div>
  );

  const handleIntroGenerated = (generated) => {
    const safeInterests = Array.isArray(generated?.interests)
      ? generated.interests
      : [];
    const safeStrengths = Array.isArray(generated?.strengths)
      ? generated.strengths
      : [];
    setProfile((prev) => ({
      ...prev,
      tagline: String(generated?.tagline || prev.tagline),
      intro: String(generated?.intro || prev.intro),
      interests: safeInterests.length
        ? safeInterests.map(String)
        : prev.interests,
      strengths: safeStrengths.length
        ? safeStrengths.map(String)
        : prev.strengths,
    }));
    setInterestsInput(safeInterests.map(String).join(", "));
    setStrengthsInput(safeStrengths.map(String).join(", "));
    setStatus("AI가 생성한 자기소개가 적용되었습니다! 저장 버튼을 눌러주세요.");
  };

  return (
    <Routes>
      <Route
        path="/intro"
        element={
          <IntroPage
            hostProfile={hostProfile}
            onLogin={handleKakaoLogin}
            onSeenIntro={markIntroSeen}
          />
        }
      />
      <Route path="/info" element={<EventInfo />} />
      <Route
        path="/ai-intro"
        element={
          <AIIntroPage
            session={session}
            onIntroGenerated={handleIntroGenerated}
          />
        }
      />
      <Route path="*" element={mainPage} />
    </Routes>
  );
}

export default App;
