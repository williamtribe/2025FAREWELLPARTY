import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import ForceGraph2D from "react-force-graph-2d";
import "./App.css";
import IntroPage from "./pages/IntroPage";
import EventInfo from "./pages/EventInfo";
import AIIntroPage from "./pages/AIIntroPage";
import OthersProfilePage from "./pages/OthersProfilePage";
import OnboardingPage from "./pages/OnboardingPage";
import LandingPage from "./pages/LandingPage";
import MafBTIPage from "./pages/MafBTIPage";
import PersonalPage from "./pages/PersonalPage";
import WriteLetterPage from "./pages/WriteLetterPage";
import ConversationPage from "./pages/ConversationPage";
import ConversationListPage from "./pages/ConversationListPage";
import "./pages/PersonalPage.css";
import "./pages/ConversationPage.css";
import "./pages/ConversationListPage.css";

const API_BASE = "/api";
const CALLBACK_PROCESSED_KEY = "kakao-callback-processed";
const KAKAO_JS_KEY =
  import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY ||
  import.meta.env.VITE_KAKAO_JS_KEY;
const SHARE_URL = import.meta.env.VITE_SHARE_URL || window.location.origin;
const KAKAO_TEMPLATE_ID = 126447; // 사용자 정의 템플릿 ID
const HOST_ID = "4609921299";
const LANDING_SEEN_KEY = "farewell-landing-seen";

const DEFAULT_INTEREST_CATEGORIES = {
  "🎬 애니": [
    "체인소맨",
    "귀멸의 칼날",
    "주술회전",
    "진격의 거인",
    "그 비스크 돌은 사랑을 한다",
  ],
  "🏋️ 운동": ["레슬링", "테니스", "MMA", "배드민턴", "축구", "헬스", "수영"],
  "🎮 게임": ["롤", "마피아42", "오버워치", "발로란트"],
  "🧪 기술": ["AI", "프로그래밍", "데이터"],
  "🎵 음악": ["KPOP", "재즈", "OST", "밴드", "클래식"],
  "🧑‍⚖️ 사회": ["군대", "법", "정치", "경제"],
  "📚 철학": ["니체", "칸트", "스피노자"],
  "📖 책": ["소설", "에세이", "자기계발"],
  "🎨 문화": ["영화", "드라마", "전시회", "공연"],
  "🍜 음식": ["맛집탐방", "요리", "카페"],
};

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
  want_to_talk_to: "",
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
  const [strengthsInput, setStrengthsInput] = useState("");
  const [isEditing, setIsEditing] = useState(true);
  const [hostProfile, setHostProfile] = useState(defaultHostProfile);
  const [reembedStatus, setReembedStatus] = useState("");
  const [jobEmbedStatus, setJobEmbedStatus] = useState("");
  const [roleResult, setRoleResult] = useState(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [orderProfiles, setOrderProfiles] = useState([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderStatus, setOrderStatus] = useState("");
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [fixedRoleProfiles, setFixedRoleProfiles] = useState([]);
  const [availableJobs, setAvailableJobs] = useState([]);
  const [fixedRoleLoading, setFixedRoleLoading] = useState(false);
  const [fixedRoleStatus, setFixedRoleStatus] = useState("");
  const [showFixedRoleModal, setShowFixedRoleModal] = useState(false);
  const [shareEventStatus, setShareEventStatus] = useState("");
  const [clusterK, setClusterK] = useState(3);
  const [clusterNamespace, setClusterNamespace] = useState("intro");
  const [clusterData, setClusterData] = useState(null);
  const [clusterLoading, setClusterLoading] = useState(false);
  const [clusterStatus, setClusterStatus] = useState("");
  const [showClusterModal, setShowClusterModal] = useState(false);
  const [allRolesData, setAllRolesData] = useState(null);
  const [allRolesLoading, setAllRolesLoading] = useState(false);
  const [showAllRolesModal, setShowAllRolesModal] = useState(false);
  const [personalMessages, setPersonalMessages] = useState([]);
  const [personalMsgLoading, setPersonalMsgLoading] = useState(false);
  const [personalMsgStatus, setPersonalMsgStatus] = useState("");
  const [showPersonalMsgModal, setShowPersonalMsgModal] = useState(false);
  const [editingPersonalMsg, setEditingPersonalMsg] = useState(null);
  const [showClaimableLetterModal, setShowClaimableLetterModal] = useState(false);
  const [claimableLetterTitle, setClaimableLetterTitle] = useState("");
  const [claimableLetterContent, setClaimableLetterContent] = useState("");
  const [claimableLetterCode, setClaimableLetterCode] = useState("");
  const [claimableLetterStatus, setClaimableLetterStatus] = useState("");
  const [interestCategories, setInterestCategories] = useState(
    DEFAULT_INTEREST_CATEGORIES,
  );
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newItemInputs, setNewItemInputs] = useState({});
  const [showAddItemInput, setShowAddItemInput] = useState(null); // null or category name

  const authHeaders = useMemo(() => {
    return session?.session_token
      ? {
        Authorization: `Bearer ${session.session_token}`,
        "Content-Type": "application/json",
      }
      : { "Content-Type": "application/json" };
  }, [session]);

  const toggleInterest = (item) => {
    if (!isLoggedIn) return;
    setProfile((prev) => ({
      ...prev,
      interests: prev.interests.includes(item)
        ? prev.interests.filter((i) => i !== item)
        : [...prev.interests, item],
    }));
  };

  const handleNewCategoryChange = (e) => {
    setNewCategoryName(e.target.value);
  };

  const addNewCategory = () => {
    if (newCategoryName.trim() && !interestCategories[newCategoryName.trim()]) {
      setInterestCategories((prev) => ({
        ...prev,
        [newCategoryName.trim()]: [],
      }));
      setNewCategoryName("");
    }
  };

  const handleNewItemInputChange = (category, value) => {
    setNewItemInputs((prev) => ({ ...prev, [category]: value }));
  };

  const addNewItemToCategory = (category) => {
    const newItem = newItemInputs[category]?.trim();
    if (newItem && !interestCategories[category].includes(newItem)) {
      setInterestCategories((prev) => ({
        ...prev,
        [category]: [...prev[category], newItem],
      }));
      toggleInterest(newItem);
      handleNewItemInputChange(category, "");
    }
  };

  useEffect(() => {
    if (location.pathname !== "/auth/kakao/callback") return;
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
    const handleMessage = async (event) => {
      if (event.data?.type === "kakao-login-success") {
        console.log("Login success from popup:", event.data.session);
        setSession(event.data.session);
        setStatus("로그인 완료! 프로필을 불러오는 중...");

        const isSimpleRegister =
          sessionStorage.getItem("simple-register") === "1";
        sessionStorage.removeItem("simple-register");

        if (isSimpleRegister) {
          try {
            await fetch(`${API_BASE}/me`, {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${event.data.session.session_token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                name: event.data.session.nickname || "미등록",
                tagline: "",
                intro: "",
                interests: [],
                strengths: [],
                visibility: "private",
                contact: "",
                profile_image: event.data.session.profile_image_url || "",
              }),
            });
            console.log(
              "Simple registration: minimal profile created with nickname:",
              event.data.session.nickname,
              "image:",
              event.data.session.profile_image_url,
            );
          } catch (err) {
            console.warn("Simple registration profile creation failed:", err);
          }
          navigate("/", { replace: true });
          return;
        }

        try {
          const res = await fetch(`${API_BASE}/me`, {
            headers: {
              Authorization: `Bearer ${event.data.session.session_token}`,
              "Content-Type": "application/json",
            },
          });
          if (res.ok) {
            const data = await res.json();
            const incoming = data.profile || {};
            const hasProfile =
              incoming.intro ||
              incoming.tagline ||
              (incoming.interests && incoming.interests.length > 0);
            if (!hasProfile) {
              navigate("/onboarding", { replace: true });
              return;
            }
          }
        } catch (err) {
          console.warn("Profile check failed:", err);
        }

        // Check for pending conversation join
        const pendingJoin = sessionStorage.getItem('pending-conv-join');
        if (pendingJoin) {
          const { id, role } = JSON.parse(pendingJoin);
          sessionStorage.removeItem('pending-conv-join');
          navigate(`/conversation/${id}?join=${role}`, { replace: true });
          return;
        }

        navigate("/", { replace: true });
      } else if (event.data?.type === "kakao-login-error") {
        console.error("Login error from popup:", event.data.error);
        setStatus(`로그인 오류: ${event.data.error}`);
        setLoading(false);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [navigate]);

  const handleKakaoLogin = async () => {
    if (loading) return;
    sessionStorage.removeItem(CALLBACK_PROCESSED_KEY);
    setLoading(true);
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
      setLoading(false);
    }
  };

  const handleSimpleRegister = async () => {
    if (loading) return;
    sessionStorage.setItem("simple-register", "1");
    sessionStorage.removeItem(CALLBACK_PROCESSED_KEY);
    setLoading(true);
    setStatus("간편등록: 카카오 로그인 페이지로 이동합니다...");
    try {
      const res = await fetch(`${API_BASE}/auth/kakao/login`);
      if (!res.ok) {
        throw new Error(`Login request failed: ${res.status}`);
      }
      const data = await res.json();
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
      console.error("Simple register error:", err);
      sessionStorage.removeItem("simple-register");
      setStatus(`등록 오류: ${err.message}`);
      setLoading(false);
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
      if (res.status === 401) {
        localStorage.removeItem("farewell-session");
        setSession(null);
        setStatus("세션이 만료되었습니다. 다시 로그인해주세요.");
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error("프로필을 불러오지 못했습니다.");
      const data = await res.json();
      const incoming = data.profile || {};
      const baseName = session?.nickname || "";
      setProfile({
        ...emptyProfile,
        name: incoming.name || baseName,
        ...incoming,
      });
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

  const handleReembedAll = async () => {
    if (!session?.is_admin) return;
    setReembedStatus("임베딩 갱신 중...");
    try {
      const res = await fetch(`${API_BASE}/admin/reembed-all`, {
        method: "POST",
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "실패");
      setReembedStatus(
        `완료! 총 ${data.stats.total}명 중 자기소개 ${data.stats.intro_success}개, 관심사 ${data.stats.interests_success}개 임베딩됨`,
      );
    } catch (err) {
      setReembedStatus(`오류: ${err.message}`);
    }
  };

  const handleEmbedJobs = async () => {
    if (!session?.is_admin) return;
    setJobEmbedStatus("직업 스토리 임베딩 중...");
    try {
      const res = await fetch(`${API_BASE}/admin/embed-jobs`, {
        method: "POST",
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "실패");
      setJobEmbedStatus(
        `완료! 총 ${data.total_jobs}개 중 ${data.embedded_count}개 직업 스토리 임베딩됨`,
      );
    } catch (err) {
      setJobEmbedStatus(`오류: ${err.message}`);
    }
  };

  const loadProfileOrder = async () => {
    if (!session?.is_admin) return;
    setOrderLoading(true);
    setOrderStatus("");
    try {
      const res = await fetch(`${API_BASE}/admin/profiles-order`, {
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "불러오기 실패");
      setOrderProfiles(data.profiles || []);
      setShowOrderModal(true);
    } catch (err) {
      setOrderStatus(`오류: ${err.message}`);
    } finally {
      setOrderLoading(false);
    }
  };

  const saveProfileOrder = async () => {
    if (!session?.is_admin || orderProfiles.length === 0) return;
    setOrderLoading(true);
    setOrderStatus("");
    try {
      const orders = orderProfiles.map((p, idx) => ({
        kakao_id: p.kakao_id,
        display_order: idx + 1,
      }));
      const res = await fetch(`${API_BASE}/admin/profiles-order`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ orders }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "저장 실패");
      setOrderStatus("순서 저장 완료!");
      setTimeout(() => setShowOrderModal(false), 1000);
    } catch (err) {
      setOrderStatus(`오류: ${err.message}`);
    } finally {
      setOrderLoading(false);
    }
  };

  const handleDragStart = (idx) => {
    setDraggedIdx(idx);
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    const newProfiles = [...orderProfiles];
    const [dragged] = newProfiles.splice(draggedIdx, 1);
    newProfiles.splice(idx, 0, dragged);
    setOrderProfiles(newProfiles);
    setDraggedIdx(idx);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
  };

  const moveProfile = (idx, direction) => {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= orderProfiles.length) return;
    const newProfiles = [...orderProfiles];
    [newProfiles[idx], newProfiles[newIdx]] = [
      newProfiles[newIdx],
      newProfiles[idx],
    ];
    setOrderProfiles(newProfiles);
  };

  const loadFixedRoles = async () => {
    if (!session?.is_admin) return;
    setFixedRoleLoading(true);
    setFixedRoleStatus("");
    try {
      const res = await fetch(`${API_BASE}/admin/fixed-roles`, {
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "불러오기 실패");
      setFixedRoleProfiles(data.profiles || []);
      setAvailableJobs(data.jobs || []);
      setShowFixedRoleModal(true);
    } catch (err) {
      setFixedRoleStatus(`오류: ${err.message}`);
    } finally {
      setFixedRoleLoading(false);
    }
  };

  const handleShareEvent = () => {
    if (!session?.is_admin) return;

    if (!window.Kakao?.isInitialized()) {
      window.Kakao.init(KAKAO_JS_KEY);
    }

    window.Kakao.Share.sendCustom(
      {
        templateId: 126817,
        templateArgs: {
          link_url: SHARE_URL,
        },
      },
      {
        success: () => {
          setShareEventStatus("행사정보 공유 완료!");
        },
        fail: () => {
          if (navigator?.clipboard?.writeText) {
            navigator.clipboard.writeText(`${SHARE_URL}/info`).then(
              () => setShareEventStatus("카카오톡이 없어 링크를 복사했습니다."),
              () =>
                setShareEventStatus("공유 실패. 링크를 직접 복사해 주세요."),
            );
          } else {
            setShareEventStatus("공유 실패. 링크를 직접 복사해 주세요.");
          }
        },
      },
    );
  };

  const saveFixedRole = async (kakaoId, fixedRole) => {
    if (!session?.is_admin) return;
    setFixedRoleLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/fixed-roles`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          kakao_id: kakaoId,
          fixed_role: fixedRole || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "저장 실패");
      setFixedRoleProfiles((prev) =>
        prev.map((p) =>
          p.kakao_id === kakaoId ? { ...p, fixed_role: fixedRole || null } : p,
        ),
      );
      setFixedRoleStatus(
        `${fixedRole ? fixedRole + " 배정 완료!" : "직업 배정 해제됨"}`,
      );
      setTimeout(() => setFixedRoleStatus(""), 2000);
    } catch (err) {
      setFixedRoleStatus(`오류: ${err.message}`);
    } finally {
      setFixedRoleLoading(false);
    }
  };

  const fetchAllRoles = async () => {
    if (!session?.is_admin) return;
    setAllRolesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/all-roles`, {
        headers: authHeaders,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "직업 조회 실패");
      setAllRolesData(data);
      setShowAllRolesModal(true);
    } catch (err) {
      alert(`오류: ${err.message}`);
    } finally {
      setAllRolesLoading(false);
    }
  };

  const fetchPersonalMessages = async () => {
    if (!session?.is_admin) return;
    setPersonalMsgLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/personal-messages`, {
        headers: authHeaders,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "메시지 조회 실패");
      setPersonalMessages(data.users || []);
      setShowPersonalMsgModal(true);
    } catch (err) {
      alert(`오류: ${err.message}`);
    } finally {
      setPersonalMsgLoading(false);
    }
  };

  const savePersonalMessage = async (kakaoId, title, content) => {
    if (!session?.is_admin) return;
    setPersonalMsgLoading(true);
    setPersonalMsgStatus("저장 중...");
    try {
      const res = await fetch(`${API_BASE}/admin/personal-messages`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          kakao_id: kakaoId,
          title: title,
          content: content,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "저장 실패");
      setPersonalMsgStatus("저장 완료!");
      setEditingPersonalMsg(null);
      setPersonalMessages((prev) =>
        prev.map((p) =>
          p.kakao_id === kakaoId
            ? { ...p, has_message: true, title, content }
            : p
        )
      );
      setTimeout(() => setPersonalMsgStatus(""), 2000);
    } catch (err) {
      setPersonalMsgStatus(`오류: ${err.message}`);
    } finally {
      setPersonalMsgLoading(false);
    }
  };

  const createClaimableLetter = async () => {
    if (!session?.is_admin) return;
    if (!claimableLetterTitle.trim() || !claimableLetterContent.trim()) {
      setClaimableLetterStatus("제목과 내용을 입력해주세요");
      return;
    }
    setClaimableLetterStatus("생성 중...");
    try {
      const res = await fetch(`${API_BASE}/admin/claimable-letters`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          title: claimableLetterTitle,
          content: claimableLetterContent,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "생성 실패");
      setClaimableLetterCode(data.claim_code);
      setClaimableLetterStatus("생성 완료! 코드를 복사하세요.");
    } catch (err) {
      setClaimableLetterStatus(`오류: ${err.message}`);
    }
  };

  const createConversation = async () => {
    if (!session?.session_token) return;
    setLoading(true);
    setStatus("새 대화를 만드는 중...");
    try {
      const res = await fetch(`${API_BASE}/conversations`, {
        method: "POST",
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "생성 실패");
      navigate(`/conversation/${data.data.id}`);
    } catch (err) {
      setStatus(`오류: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const runClustering = async () => {
    if (!session?.is_admin) return;
    setClusterLoading(true);
    setClusterStatus("클러스터링 중...");
    setClusterData(null);
    try {
      const res = await fetch(`${API_BASE}/admin/clusters`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          k: clusterK,
          namespace: clusterNamespace,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "클러스터링 실패");
      setClusterData(data);
      setClusterStatus(`${data.total_profiles}명을 ${data.k}개 그룹으로 분류 완료!`);
      setShowClusterModal(true);
    } catch (err) {
      setClusterStatus(`오류: ${err.message}`);
    } finally {
      setClusterLoading(false);
    }
  };

  const fetchMyRole = async () => {
    if (!session?.session_token) return;
    setRoleLoading(true);
    try {
      const res = await fetch(`${API_BASE}/role-assignment`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          name: profile.name,
          tagline: profile.tagline,
          intro: profile.intro,
          interests: profile.interests,
          strengths: profile.strengths,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "역할 배정 실패");
      setRoleResult(data);
      setShowRoleModal(true);
    } catch (err) {
      setStatus(`역할 확인 오류: ${err.message}`);
    } finally {
      setRoleLoading(false);
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
          <Link className="floating-cta my-intro" to="/">
            {profile.intro ? "전체 멤버" : "전체 멤버"}
          </Link>
          <Link className="floating-cta conv-list-btn" to="/conversations">
            � 내 대화
          </Link>
          <button className="floating-cta conv-btn" onClick={createConversation} disabled={loading}>
            ➕ 대화 추가
          </button>
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

              <label>관심사 선택</label>
              <div className="interest-selector">
                {Object.entries(interestCategories).map(([category, items]) => (
                  <div key={category} className="interest-category">
                    <div className="category-title">{category}</div>
                    <div className="interest-chips">
                      {items.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className={`interest-chip ${profile.interests.includes(item) ? "selected" : ""}`}
                          onClick={() => toggleInterest(item)}
                          disabled={!isLoggedIn}
                        >
                          {item}
                        </button>
                      ))}
                      {showAddItemInput === category ? (
                        <div className="custom-add-inline">
                          <input
                            type="text"
                            value={newItemInputs[category] || ""}
                            onChange={(e) =>
                              handleNewItemInputChange(category, e.target.value)
                            }
                            placeholder="항목 추가..."
                            className="custom-input"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addNewItemToCategory(category);
                                setShowAddItemInput(null);
                              }
                            }}
                            disabled={!isLoggedIn}
                          />
                          <button
                            className="add-btn"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              addNewItemToCategory(category);
                              setShowAddItemInput(null);
                            }}
                            disabled={!isLoggedIn}
                          >
                            ✓
                          </button>
                          <button
                            className="cancel-btn-small"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => setShowAddItemInput(null)}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          className="add-btn-placeholder"
                          onClick={() => setShowAddItemInput(category)}
                          disabled={!isLoggedIn}
                        >
                          +
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="custom-add-section">
                <input
                  value={newCategoryName}
                  onChange={handleNewCategoryChange}
                  placeholder="새 카테고리 추가..."
                  className="custom-input"
                  onKeyPress={(e) => e.key === "Enter" && addNewCategory()}
                  disabled={!isLoggedIn}
                />
                <button
                  className="add-btn"
                  onClick={addNewCategory}
                  disabled={!isLoggedIn}
                >
                  카테고리 추가
                </button>
              </div>
              {profile.interests.length > 0 && (
                <p className="selected-count">
                  선택됨: {profile.interests.join(", ")}
                </p>
              )}

              <label>특기 (쉼표로 구분하여 입력)</label>
              <input
                value={strengthsInput}
                onChange={(e) => updateListField("strengths", e.target.value)}
                placeholder="사람을 좋아함"
                disabled={!isLoggedIn}
              />

              <label>대화해보고 싶은 사람</label>
              <textarea
                value={profile.want_to_talk_to || ""}
                onChange={(e) => updateField("want_to_talk_to", e.target.value)}
                placeholder="특별히 얘기해보고 싶은 사람이 있다면 구체적으로 적어주세요"
                rows={2}
                disabled={!isLoggedIn}
              />

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
                <button
                  className="role-check-btn"
                  onClick={fetchMyRole}
                  disabled={roleLoading}
                >
                  {roleLoading ? "분석 중..." : "🎭 나의 마피아42 직업 확인"}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="center-button-wrap">
        <Link className="btn-others-profiles" to="/others">
          다른 사람들 자기소개 카드 보기
        </Link>
      </div>

      {showRoleModal && roleResult && (
        <div
          className="role-modal-overlay"
          onClick={() => setShowRoleModal(false)}
        >
          <div className="role-modal" onClick={(e) => e.stopPropagation()}>
            <div className="role-modal-header">
              <h2>🎭 마피아42 직업 배정</h2>
              <button
                className="close-btn"
                onClick={() => setShowRoleModal(false)}
              >
                ×
              </button>
            </div>
            <div className="role-modal-body">
              <div className="role-image-container">
                <img
                  src={`/job_images/${roleResult.role}.png`}
                  alt={roleResult.role}
                  className="role-image"
                  onError={(e) => {
                    e.target.src = "/job_images/이레귤러_시민_시민 스킨.png";
                  }}
                />
              </div>
              <div className="role-reveal">
                <p className="role-team">{roleResult.team}</p>
                <h3 className="role-name">{roleResult.role}</h3>
              </div>
              <div className="role-reasoning">
                <p>{roleResult.reasoning}</p>
              </div>
              <button
                className="regenerate-btn"
                onClick={fetchMyRole}
                disabled={roleLoading}
              >
                {roleLoading ? "분석 중..." : "🔄 다시 분석하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {session?.is_admin && (
        <section className="panel admin-panel">
          <div className="panel-head">
            <h2>관리자 도구</h2>
          </div>
          <div className="admin-tools">
            <button className="admin-btn" onClick={handleReembedAll}>
              전체 프로필 임베딩 갱신
            </button>
            <button
              className="admin-btn"
              onClick={() => {
                localStorage.removeItem("onboarding-draft");
                navigate("/onboarding");
              }}
            >
              🔄 온보딩 다시하기 (테스트용)
            </button>
            <button
              className="admin-btn"
              onClick={loadProfileOrder}
              disabled={orderLoading}
            >
              {orderLoading ? "불러오는 중..." : "📋 프로필 순서 관리"}
            </button>
            <button className="admin-btn" onClick={handleEmbedJobs}>
              🎭 직업 스토리 임베딩
            </button>
            <button
              className="admin-btn"
              onClick={loadFixedRoles}
              disabled={fixedRoleLoading}
            >
              {fixedRoleLoading ? "불러오는 중..." : "🎯 직업 고정 배정"}
            </button>
            <button
              className="admin-btn simple-register-btn"
              onClick={handleSimpleRegister}
            >
              ⚡ 간편등록 (자기소개 생략)
            </button>
            <button className="admin-btn" onClick={handleShareEvent}>
              📢 행사정보 공유
            </button>
            <button
              className="admin-btn"
              onClick={fetchAllRoles}
              disabled={allRolesLoading}
            >
              {allRolesLoading ? "불러오는 중..." : "🎭 전체 직업 보기"}
            </button>
            <button
              className="admin-btn"
              onClick={fetchPersonalMessages}
              disabled={personalMsgLoading}
            >
              {personalMsgLoading ? "불러오는 중..." : "💌 개인 메시지 관리"}
            </button>
            <button
              className="admin-btn"
              onClick={() => setShowClaimableLetterModal(true)}
            >
              📝 코드로 편지 만들기
            </button>
            <div className="cluster-controls">
              <label>
                그룹 수:
                <select value={clusterK} onChange={(e) => setClusterK(Number(e.target.value))}>
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n} value={n}>{n}개</option>
                  ))}
                </select>
              </label>
              <label>
                기준:
                <select value={clusterNamespace} onChange={(e) => setClusterNamespace(e.target.value)}>
                  <option value="intro">자기소개</option>
                  <option value="interests">관심사</option>
                </select>
              </label>
              <button
                className="admin-btn"
                onClick={runClustering}
                disabled={clusterLoading}
              >
                {clusterLoading ? "분석 중..." : "📊 클러스터링 실행"}
              </button>
            </div>
            {reembedStatus && <p className="admin-status">{reembedStatus}</p>}
            {jobEmbedStatus && <p className="admin-status">{jobEmbedStatus}</p>}
            {orderStatus && <p className="admin-status">{orderStatus}</p>}
            {fixedRoleStatus && (
              <p className="admin-status">{fixedRoleStatus}</p>
            )}
            {shareEventStatus && (
              <p className="admin-status">{shareEventStatus}</p>
            )}
            {clusterStatus && (
              <p className="admin-status">{clusterStatus}</p>
            )}
          </div>
        </section>
      )}

      {showOrderModal && (
        <div
          className="order-modal-overlay"
          onClick={() => setShowOrderModal(false)}
        >
          <div className="order-modal" onClick={(e) => e.stopPropagation()}>
            <div className="order-modal-header">
              <h2>프로필 순서 관리</h2>
              <button
                className="close-btn"
                onClick={() => setShowOrderModal(false)}
              >
                ×
              </button>
            </div>
            <p className="order-hint">
              드래그하거나 화살표로 순서를 변경하세요
            </p>
            <div className="order-list">
              {orderProfiles.map((p, idx) => (
                <div
                  key={p.kakao_id}
                  className={`order-item ${draggedIdx === idx ? "dragging" : ""} ${p.visibility === "private" ? "private" : ""}`}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                >
                  <span className="order-num">{idx + 1}</span>
                  <span className="order-name">{p.name || "익명"}</span>
                  <span className="order-tagline">{p.tagline || ""}</span>
                  {p.visibility === "private" && (
                    <span className="order-private">비공개</span>
                  )}
                  <div className="order-arrows">
                    <button
                      onClick={() => moveProfile(idx, -1)}
                      disabled={idx === 0}
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveProfile(idx, 1)}
                      disabled={idx === orderProfiles.length - 1}
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="order-modal-footer">
              <button
                className="cancel-btn"
                onClick={() => setShowOrderModal(false)}
              >
                취소
              </button>
              <button
                className="save-btn"
                onClick={saveProfileOrder}
                disabled={orderLoading}
              >
                {orderLoading ? "저장 중..." : "순서 저장"}
              </button>
            </div>
            {orderStatus && <p className="order-status">{orderStatus}</p>}
          </div>
        </div>
      )}

      {showFixedRoleModal && (
        <div
          className="order-modal-overlay"
          onClick={() => setShowFixedRoleModal(false)}
        >
          <div
            className="order-modal fixed-role-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="order-modal-header">
              <h2>🎯 직업 고정 배정</h2>
              <button
                className="close-btn"
                onClick={() => setShowFixedRoleModal(false)}
              >
                ×
              </button>
            </div>
            <p className="order-hint">
              각 사용자에게 고정 직업을 배정하면 RAG 검색을 생략하고 해당 직업을
              바로 보여줍니다.
            </p>
            <div className="order-list fixed-role-list">
              {fixedRoleProfiles.map((p) => (
                <div key={p.kakao_id} className="order-item fixed-role-item">
                  <span className="order-name">{p.name || "익명"}</span>
                  <select
                    value={p.fixed_role || ""}
                    onChange={(e) => saveFixedRole(p.kakao_id, e.target.value)}
                    disabled={fixedRoleLoading}
                    className="fixed-role-select"
                  >
                    <option value="">자동 (RAG)</option>
                    {availableJobs.map((job) => (
                      <option key={job.code} value={job.name}>
                        [{job.team}] {job.name}
                      </option>
                    ))}
                  </select>
                  {p.fixed_role && (
                    <span className="fixed-role-badge">고정</span>
                  )}
                </div>
              ))}
            </div>
            <div className="order-modal-footer">
              <button
                className="cancel-btn"
                onClick={() => setShowFixedRoleModal(false)}
              >
                닫기
              </button>
            </div>
            {fixedRoleStatus && (
              <p className="order-status">{fixedRoleStatus}</p>
            )}
          </div>
        </div>
      )}

      {showClusterModal && clusterData && (
        <div
          className="order-modal-overlay cluster-modal-overlay"
          onClick={() => setShowClusterModal(false)}
        >
          <div className="cluster-modal" onClick={(e) => e.stopPropagation()}>
            <div className="order-modal-header">
              <h2>클러스터링 결과</h2>
              <button
                className="close-btn"
                onClick={() => setShowClusterModal(false)}
              >
                ×
              </button>
            </div>
            <div className="cluster-info">
              <span>{clusterData.total_profiles}명 → {clusterData.k}개 그룹</span>
              <span className="cluster-namespace">
                기준: {clusterData.namespace === "intro" ? "자기소개" : "관심사"}
              </span>
            </div>
            <div className="cluster-graph-container">
              <ForceGraph2D
                graphData={{
                  nodes: clusterData.graph.nodes,
                  links: clusterData.graph.edges,
                }}
                nodeLabel={(node) => node.name}
                nodeColor={(node) => node.color}
                nodeRelSize={8}
                linkColor={() => "rgba(0, 0, 0, 0.1)"}
                linkWidth={1}
                width={500}
                height={350}
                cooldownTicks={100}
                onNodeClick={(node) => {
                  const cluster = clusterData.clusters.find(
                    (c) => c.id === node.cluster
                  );
                  if (cluster) {
                    alert(
                      `${node.name}\n\n그룹 ${cluster.id + 1} (${cluster.member_count}명)\n멤버: ${cluster.members.map((m) => m.name).join(", ")}`
                    );
                  }
                }}
              />
            </div>
            <div className="cluster-list">
              {clusterData.clusters.map((cluster) => (
                <div key={cluster.id} className="cluster-group">
                  <div
                    className="cluster-group-header"
                    style={{ borderLeft: `4px solid ${cluster.color}` }}
                  >
                    그룹 {cluster.id + 1} ({cluster.member_count}명)
                  </div>
                  <div className="cluster-members">
                    {cluster.members.map((m) => (
                      <span key={m.kakao_id} className="cluster-member-chip">
                        {m.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showAllRolesModal && allRolesData && (
        <div
          className="order-modal-overlay"
          onClick={() => setShowAllRolesModal(false)}
        >
          <div className="cluster-modal" onClick={(e) => e.stopPropagation()}>
            <div className="order-modal-header">
              <h2>🎭 전체 직업 목록 ({allRolesData.total}명)</h2>
              <button
                className="close-btn"
                onClick={() => setShowAllRolesModal(false)}
              >
                ×
              </button>
            </div>
            <div className="all-roles-list">
              {["마피아팀", "시민팀", "교주팀"].map((team) => {
                const teamMembers = allRolesData.roles.filter(
                  (r) => r.team === team
                );
                if (teamMembers.length === 0) return null;
                return (
                  <div key={team} className="team-section">
                    <h3 className={`team-header ${team === "마피아팀" ? "mafia" : team === "교주팀" ? "cult" : "citizen"}`}>
                      {team} ({teamMembers.length}명)
                    </h3>
                    <div className="role-cards">
                      {teamMembers.map((r) => (
                        <div key={r.kakao_id} className="role-card">
                          {r.profile_image && (
                            <img
                              src={r.profile_image}
                              alt=""
                              className="role-card-img"
                            />
                          )}
                          <div className="role-card-info">
                            <div className="role-card-name">{r.name}</div>
                            <div className="role-card-role">
                              {r.role || "미배정"}
                              {r.fixed && <span className="fixed-badge">고정</span>}
                            </div>
                            {r.similarity && (
                              <div className="role-card-similarity">
                                유사도: {r.similarity}%
                              </div>
                            )}
                          </div>
                          {r.code && (
                            <img
                              src={`/job_images/${r.code}.png`}
                              alt={r.role}
                              className="role-card-job-img"
                              onError={(e) => (e.target.style.display = "none")}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {allRolesData.roles.filter((r) => !r.role).length > 0 && (
                <div className="team-section">
                  <h3 className="team-header unassigned">미배정 ({allRolesData.roles.filter((r) => !r.role).length}명)</h3>
                  <div className="role-cards">
                    {allRolesData.roles
                      .filter((r) => !r.role)
                      .map((r) => (
                        <div key={r.kakao_id} className="role-card">
                          {r.profile_image && (
                            <img
                              src={r.profile_image}
                              alt=""
                              className="role-card-img"
                            />
                          )}
                          <div className="role-card-info">
                            <div className="role-card-name">{r.name}</div>
                            <div className="role-card-role">미배정</div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showPersonalMsgModal && (
        <div
          className="order-modal-overlay"
          onClick={() => {
            setShowPersonalMsgModal(false);
            setEditingPersonalMsg(null);
          }}
        >
          <div className="cluster-modal personal-msg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="order-modal-header">
              <h2>💌 개인 메시지 관리</h2>
              <button
                className="close-btn"
                onClick={() => {
                  setShowPersonalMsgModal(false);
                  setEditingPersonalMsg(null);
                }}
              >
                ×
              </button>
            </div>
            <p className="order-hint">
              각 사용자에게 보낼 개인 메시지를 작성하세요. 작성된 메시지는 /personal/{'{'}kakao_id{'}'} 에서 본인만 볼 수 있어요.
            </p>
            {personalMsgStatus && <p className="admin-status">{personalMsgStatus}</p>}

            {editingPersonalMsg ? (
              <div className="personal-msg-editor">
                <div className="editor-header">
                  <span>To. {editingPersonalMsg.name}</span>
                  <button
                    className="cancel-btn"
                    onClick={() => setEditingPersonalMsg(null)}
                  >
                    취소
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="제목"
                  value={editingPersonalMsg.title || ""}
                  onChange={(e) =>
                    setEditingPersonalMsg((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                  className="personal-msg-title-input"
                />
                <textarea
                  placeholder="본문 내용을 작성하세요..."
                  value={editingPersonalMsg.content || ""}
                  onChange={(e) =>
                    setEditingPersonalMsg((prev) => ({
                      ...prev,
                      content: e.target.value,
                    }))
                  }
                  className="personal-msg-content-input"
                  rows={8}
                />
                <button
                  className="save-btn"
                  onClick={() =>
                    savePersonalMessage(
                      editingPersonalMsg.kakao_id,
                      editingPersonalMsg.title,
                      editingPersonalMsg.content
                    )
                  }
                  disabled={personalMsgLoading}
                >
                  {personalMsgLoading ? "저장 중..." : "💾 저장"}
                </button>
              </div>
            ) : (
              <div className="personal-msg-list">
                {personalMessages.map((user) => (
                  <div
                    key={user.kakao_id}
                    className={`personal-msg-item ${user.has_message ? "has-message" : ""}`}
                    onClick={() => setEditingPersonalMsg(user)}
                  >
                    {user.profile_image && (
                      <img
                        src={user.profile_image}
                        alt=""
                        className="personal-msg-img"
                      />
                    )}
                    <div className="personal-msg-info">
                      <div className="personal-msg-name">{user.name || "익명"}</div>
                      {user.has_message ? (
                        <div className="personal-msg-preview">
                          {user.title}
                        </div>
                      ) : (
                        <div className="personal-msg-empty">메시지 없음</div>
                      )}
                    </div>
                    <div className="personal-msg-status">
                      {user.has_message ? "✅" : "📝"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showClaimableLetterModal && (
        <div
          className="order-modal-overlay"
          onClick={() => {
            setShowClaimableLetterModal(false);
            setClaimableLetterTitle("");
            setClaimableLetterContent("");
            setClaimableLetterCode("");
            setClaimableLetterStatus("");
          }}
        >
          <div className="cluster-modal" onClick={(e) => e.stopPropagation()}>
            <div className="order-modal-header">
              <h2>📝 코드로 편지 만들기</h2>
              <button
                className="close-btn"
                onClick={() => {
                  setShowClaimableLetterModal(false);
                  setClaimableLetterTitle("");
                  setClaimableLetterContent("");
                  setClaimableLetterCode("");
                  setClaimableLetterStatus("");
                }}
              >
                ×
              </button>
            </div>
            <p className="order-hint">
              편지를 작성하면 고유 코드가 생성돼요. 받는 사람에게 코드를 전달하면 그 사람이 자신의 편지함에서 편지를 받을 수 있어요.
            </p>

            {claimableLetterCode ? (
              <div className="claim-code-result">
                <div className="claim-code-box">
                  <span className="claim-code-label">생성된 코드:</span>
                  <span className="claim-code-value">{claimableLetterCode}</span>
                  <button
                    className="copy-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(claimableLetterCode);
                      setClaimableLetterStatus("코드가 복사되었습니다!");
                    }}
                  >
                    📋 복사
                  </button>
                </div>
                <p className="claim-code-hint">이 코드를 받는 사람에게 알려주세요!</p>
                <button
                  className="save-btn"
                  onClick={() => {
                    setClaimableLetterCode("");
                    setClaimableLetterTitle("");
                    setClaimableLetterContent("");
                    setClaimableLetterStatus("");
                  }}
                >
                  새 편지 작성
                </button>
              </div>
            ) : (
              <div className="personal-msg-editor">
                <input
                  type="text"
                  placeholder="제목"
                  value={claimableLetterTitle}
                  onChange={(e) => setClaimableLetterTitle(e.target.value)}
                  className="personal-msg-title-input"
                />
                <textarea
                  placeholder="본문 내용을 작성하세요..."
                  value={claimableLetterContent}
                  onChange={(e) => setClaimableLetterContent(e.target.value)}
                  className="personal-msg-content-input"
                  rows={8}
                />
                <button
                  className="save-btn"
                  onClick={createClaimableLetter}
                >
                  ✨ 편지 생성하기
                </button>
              </div>
            )}

            {claimableLetterStatus && <p className="admin-status">{claimableLetterStatus}</p>}
          </div>
        </div>
      )}
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

  const handleOnboardingComplete = (completedProfile) => {
    setProfile((prev) => ({ ...prev, ...completedProfile }));
    setIsEditing(false);
    setStatus("프로필이 완성되었습니다!");
  };

  return (
    <Routes>
      <Route
        path="/intro"
        element={
          <IntroPage
            hostProfile={hostProfile}
            session={session}
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
      <Route path="/others" element={<OthersProfilePage session={session} />} />
      <Route
        path="/mafbti"
        element={<MafBTIPage session={session} onLogin={handleKakaoLogin} />}
      />
      <Route
        path="/onboarding"
        element={
          <OnboardingPage
            session={session}
            onComplete={handleOnboardingComplete}
          />
        }
      />
      <Route
        path="/personal/:kakaoId"
        element={<PersonalPage session={session} />}
      />
      <Route
        path="/write-letter"
        element={<WriteLetterPage session={session} />}
      />
      <Route
        path="/conversation/:id"
        element={<ConversationPage session={session} />}
      />
      <Route
        path="/conversations"
        element={<ConversationListPage session={session} />}
      />
      <Route
        path="/"
        element={
          <LandingPage
            session={session}
            onLogin={handleKakaoLogin}
            onShare={shareToKakao}
            onCreateConversation={createConversation}
          />
        }
      />
      <Route path="/my-profile" element={mainPage} />
      <Route path="*" element={mainPage} />
    </Routes>
  );
}

export default App;
