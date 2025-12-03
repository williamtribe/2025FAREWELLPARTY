import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

const INTEREST_CATEGORIES = {
  "🎬 애니": ["체인소맨", "귀멸의 칼날", "주술회전", "진격의 거인", "그 비스크 돌은 사랑을 한다"],
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

const STEPS = [
  { id: "ai-test", title: "취향 테스트" },
  { id: "name", title: "이름 확인" },
  { id: "tagline", title: "한 줄 소개" },
  { id: "intro", title: "자기소개" },
  { id: "interests", title: "관심사" },
  { id: "strengths", title: "특기" },
  { id: "contact", title: "연락처" },
  { id: "result", title: "결과" },
];

const EXAMPLE_STRENGTHS = [
  "사람을 좋아함",
  "경청 잘함", 
  "분위기 메이커",
  "논리적 사고",
  "창의력",
  "리더십",
  "꼼꼼함",
  "긍정적",
];

const JOB_IMAGE_MAP = {
  "gangster": "/job_images/기본_구버전_건달_스킨_완성.png",
  "scientist": "/job_images/기본_구버전_과학자_스킨_완료.png",
  "fanatic": "/job_images/기본_구버전_광신도_광신도_최종.png",
  "cult_leader": "/job_images/기본_구버전_교주_스킨완성.png",
  "reporter": "/job_images/기본_구버전_기자_기자_완성.png",
  "grave_robber": "/job_images/기본_구버전_도굴꾼_완료.png",
  "thief": "/job_images/기본_구버전_도둑_도둑_완성.png",
  "magician": "/job_images/기본_구버전_마술사_마술사_완.png",
  "mafia": "/job_images/기본_구버전_마피아_마피아_완료.png",
  "priest": "/job_images/기본_구버전_성직자_성직자_완성2.png",
  "spy": "/job_images/기본_구버전_스파이_스파이_완성.png",
  "lover": "/job_images/기본_구버전_연인_완료.png",
  "medium": "/job_images/기본_구버전_영매_영매_완성.png",
  "mercenary": "/job_images/기본_구버전_용병_용병 기본 스킨_최종.png",
  "terrorist": "/job_images/기본_구버전_테러리스트_테러_완성.png",
  "hacker": "/job_images/기본_구버전_해커_해커 스킨_로고추가.png",
  "official": "/job_images/기본_기본스킨_ 공무원_공무원_최종.png",
  "police": "/job_images/기본_기본스킨_경찰_경찰 리뉴얼_최종2.png",
  "soldier": "/job_images/기본_기본스킨_군인_군인 리뉴얼.png",
  "madam": "/job_images/기본_기본스킨_마담_마담 리뉴얼.png",
  "secret_society": "/job_images/기본_기본스킨_비밀결사_비밀결사 최종.png",
  "swindler": "/job_images/기본_기본스킨_사기꾼_사기꾼.png",
  "agent": "/job_images/기본_기본스킨_요원_요원_최종.png",
  "doctor": "/job_images/기본_기본스킨_의사_의사 리뉴얼.png",
  "fortune_teller": "/job_images/기본_기본스킨_점쟁이_점쟁이_기본_최종_오오라.png",
  "politician": "/job_images/기본_기본스킨_정치인_정치 전신_최종2.png",
  "werewolf": "/job_images/기본_기본스킨_짐승인간_psd (작업중)_짐승인간 리터칭2.png",
  "hitman": "/job_images/기본_기본스킨_청부업자_청부업자_완.png",
  "hypnotist": "/job_images/기본_기본스킨_최면술사_마케팅_최면술사_마케팅용_수정이미지.png",
  "paparazzi": "/job_images/기본_기본스킨_파파라치_파파라치_오오라.png",
  "nurse": "/job_images/듀얼_간호사_psd_간호사_완료.png",
  "witch": "/job_images/듀얼_마녀_5.png",
  "psychologist": "/job_images/듀얼_심리학자_심리학자.png",
  "prophet": "/job_images/듀얼_예언가_psd_예언가.png",
  "vigilante": "/job_images/듀얼_자경단_psd_스킨_완료.png",
  "judge": "/job_images/듀얼_판사_psd_판사.png",
  "citizen": "/job_images/이레귤러_시민_시민 스킨.png",
  "villain": "/job_images/저택_저택_악인_악인 스킨.png",
};

export default function OnboardingPage({ session, onComplete }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(null);
  const [customInterest, setCustomInterest] = useState("");
  const [customStrength, setCustomStrength] = useState("");
  const [roleResult, setRoleResult] = useState(null);

  const authHeaders = session?.session_token
    ? {
        Authorization: `Bearer ${session.session_token}`,
        "Content-Type": "application/json",
      }
    : { "Content-Type": "application/json" };
  
  const [draft, setDraft] = useState(() => {
    const saved = localStorage.getItem("onboarding-draft");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [profile, setProfile] = useState({
    name: session?.nickname || "",
    tagline: "",
    intro: "",
    interests: [],
    strengths: [],
    contact: "",
    visibility: "public",
  });

  useEffect(() => {
    const incomingAi = location.state?.aiGenerated;
    const incomingStep = location.state?.step;
    const storedAi = localStorage.getItem("ai-generated-intro");
    
    if (incomingAi) {
      setAiGenerated(incomingAi);
      setProfile(prev => ({
        ...prev,
        name: session?.nickname || prev.name,
        tagline: incomingAi.tagline || prev.tagline,
        intro: incomingAi.intro || prev.intro,
        interests: incomingAi.interests || prev.interests,
      }));
      if (incomingStep) setStep(incomingStep);
      localStorage.removeItem("ai-generated-intro");
    } else if (storedAi) {
      try {
        const parsed = JSON.parse(storedAi);
        setAiGenerated(parsed);
        setProfile(prev => ({
          ...prev,
          name: session?.nickname || prev.name,
          tagline: parsed.tagline || prev.tagline,
          intro: parsed.intro || prev.intro,
          interests: parsed.interests || prev.interests,
        }));
        setStep(1);
        localStorage.removeItem("ai-generated-intro");
      } catch (e) {
        console.error("Failed to parse stored AI intro:", e);
      }
    } else if (draft) {
      setProfile(prev => ({ ...prev, ...draft.profile }));
      setStep(draft.step || 0);
      if (draft.aiGenerated) setAiGenerated(draft.aiGenerated);
    }
  }, [location.state, session?.nickname]);

  useEffect(() => {
    localStorage.setItem("onboarding-draft", JSON.stringify({
      step,
      profile,
      aiGenerated,
    }));
  }, [step, profile, aiGenerated]);

  const updateField = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const toggleInterest = (item) => {
    setProfile(prev => ({
      ...prev,
      interests: prev.interests.includes(item)
        ? prev.interests.filter(i => i !== item)
        : [...prev.interests, item],
    }));
  };

  const toggleStrength = (item) => {
    setProfile(prev => ({
      ...prev,
      strengths: prev.strengths.includes(item)
        ? prev.strengths.filter(i => i !== item)
        : [...prev.strengths, item],
    }));
  };

  const addCustomInterest = () => {
    if (customInterest.trim() && !profile.interests.includes(customInterest.trim())) {
      setProfile(prev => ({
        ...prev,
        interests: [...prev.interests, customInterest.trim()],
      }));
      setCustomInterest("");
    }
  };

  const addCustomStrength = () => {
    if (customStrength.trim() && !profile.strengths.includes(customStrength.trim())) {
      setProfile(prev => ({
        ...prev,
        strengths: [...prev.strengths, customStrength.trim()],
      }));
      setCustomStrength("");
    }
  };

  const nextStep = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const fetchRoleAssignment = async () => {
    if (!session?.session_token) {
      console.error("No session token for role assignment");
      setRoleResult({ error: "로그인이 필요합니다. 다시 로그인해주세요." });
      return;
    }
    setLoading(true);
    try {
      console.log("Fetching role assignment with auth:", !!session?.session_token);
      const res = await fetch(`${API_BASE}/role-assignment`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("Role assignment failed:", res.status, data);
        throw new Error(data.detail || "역할 배정 실패");
      }
      setRoleResult(data);
    } catch (err) {
      console.error("Role assignment error:", err);
      setRoleResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const saveAndFinish = async () => {
    if (!session?.session_token) {
      console.error("No session token for save");
      alert("로그인이 필요합니다. 다시 로그인해주세요.");
      return;
    }
    setLoading(true);
    try {
      console.log("Saving profile with auth:", !!session?.session_token);
      const res = await fetch(`${API_BASE}/me`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({
          ...profile,
          profile_image: session?.profile_image_url || "",
          mafia_role: roleResult?.role,
          mafia_team: roleResult?.team,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("Save failed:", res.status, data);
        throw new Error(data.detail || "저장 실패");
      }
      localStorage.removeItem("onboarding-draft");
      if (onComplete) onComplete(profile);
      navigate("/");
    } catch (err) {
      console.error("Save error:", err);
      alert(`저장 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAiTestComplete = (generated) => {
    setAiGenerated(generated);
    if (generated?.tagline) {
      updateField("tagline", generated.tagline);
    }
    if (generated?.intro) {
      updateField("intro", generated.intro);
    }
    if (generated?.interests) {
      updateField("interests", generated.interests);
    }
    nextStep();
  };

  const renderStep = () => {
    const currentStep = STEPS[step];

    switch (currentStep.id) {
      case "ai-test":
        return (
          <div className="onboarding-step">
            <h2>취향 테스트</h2>
            <p className="step-desc">간단한 질문에 답해주세요. AI가 당신을 분석합니다!</p>
            <button className="primary" onClick={() => navigate("/ai-intro", { state: { fromOnboarding: true } })}>
              테스트 시작하기
            </button>
            {aiGenerated && (
              <div className="ai-generated-preview">
                <p>이미 테스트를 완료하셨네요!</p>
                <button className="secondary" onClick={nextStep}>다음으로</button>
              </div>
            )}
          </div>
        );

      case "name":
        return (
          <div className="onboarding-step">
            <h2>이름 확인</h2>
            <p className="step-desc">카카오톡에서 가져온 이름이에요. 수정할 수 있어요.</p>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="이름을 입력하세요"
              className="onboarding-input"
            />
            <div className="step-actions">
              <button className="secondary" onClick={prevStep}>이전</button>
              <button className="primary" onClick={nextStep} disabled={!profile.name.trim()}>다음</button>
            </div>
          </div>
        );

      case "tagline":
        return (
          <div className="onboarding-step">
            <h2>한 줄 소개</h2>
            <p className="step-desc">AI가 만들어준 한 줄 소개예요. 자유롭게 수정하세요!</p>
            <input
              type="text"
              value={profile.tagline}
              onChange={(e) => updateField("tagline", e.target.value)}
              placeholder="예: 변호사지망 씹덕"
              className="onboarding-input"
            />
            <div className="step-actions">
              <button className="secondary" onClick={prevStep}>이전</button>
              <button className="primary" onClick={nextStep} disabled={!profile.tagline.trim()}>다음</button>
            </div>
          </div>
        );

      case "intro":
        return (
          <div className="onboarding-step">
            <h2>자기소개</h2>
            <p className="step-desc">AI가 작성한 자기소개예요. 마음껏 수정하세요!</p>
            <textarea
              value={profile.intro}
              onChange={(e) => updateField("intro", e.target.value)}
              placeholder="자기소개를 입력하세요"
              className="onboarding-textarea"
              rows={5}
            />
            <div className="step-actions">
              <button className="secondary" onClick={prevStep}>이전</button>
              <button className="primary" onClick={nextStep} disabled={!profile.intro.trim()}>다음</button>
            </div>
          </div>
        );

      case "interests":
        return (
          <div className="onboarding-step">
            <h2>관심사 선택</h2>
            <p className="step-desc">관심 있는 것들을 선택하세요. 직접 추가도 가능해요!</p>
            
            <div className="interest-selector">
              {Object.entries(INTEREST_CATEGORIES).map(([category, items]) => (
                <div key={category} className="interest-category">
                  <div className="category-title">{category}</div>
                  <div className="interest-chips">
                    {items.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={`interest-chip ${profile.interests.includes(item) ? "selected" : ""}`}
                        onClick={() => toggleInterest(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="custom-add-section">
              <input
                type="text"
                value={customInterest}
                onChange={(e) => setCustomInterest(e.target.value)}
                placeholder="직접 입력..."
                className="custom-input"
                onKeyPress={(e) => e.key === "Enter" && addCustomInterest()}
              />
              <button className="add-btn" onClick={addCustomInterest}>추가</button>
            </div>

            {profile.interests.length > 0 && (
              <p className="selected-count">선택됨: {profile.interests.join(", ")}</p>
            )}

            <div className="step-actions">
              <button className="secondary" onClick={prevStep}>이전</button>
              <button className="primary" onClick={nextStep} disabled={profile.interests.length === 0}>다음</button>
            </div>
          </div>
        );

      case "strengths":
        return (
          <div className="onboarding-step">
            <h2>특기</h2>
            <p className="step-desc">다른 사람들이 적은 예시를 참고해보세요!</p>
            
            <div className="example-chips">
              {EXAMPLE_STRENGTHS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`interest-chip ${profile.strengths.includes(item) ? "selected" : ""}`}
                  onClick={() => toggleStrength(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="custom-add-section">
              <input
                type="text"
                value={customStrength}
                onChange={(e) => setCustomStrength(e.target.value)}
                placeholder="직접 입력..."
                className="custom-input"
                onKeyPress={(e) => e.key === "Enter" && addCustomStrength()}
              />
              <button className="add-btn" onClick={addCustomStrength}>추가</button>
            </div>

            {profile.strengths.length > 0 && (
              <p className="selected-count">선택됨: {profile.strengths.join(", ")}</p>
            )}

            <div className="step-actions">
              <button className="secondary" onClick={prevStep}>이전</button>
              <button className="primary" onClick={nextStep}>다음</button>
            </div>
          </div>
        );

      case "contact":
        return (
          <div className="onboarding-step">
            <h2>연락처</h2>
            <p className="step-desc">파티 후에도 연락할 수 있도록! (선택사항)</p>
            <input
              type="text"
              value={profile.contact}
              onChange={(e) => updateField("contact", e.target.value)}
              placeholder="카카오톡 ID 또는 전화번호"
              className="onboarding-input"
            />
            <div className="step-actions">
              <button className="secondary" onClick={prevStep}>이전</button>
              <button className="primary" onClick={() => { nextStep(); fetchRoleAssignment(); }}>결과 보기</button>
            </div>
          </div>
        );

      case "result":
        return (
          <div className="onboarding-step result-step">
            <h2>당신의 마피아42 직업은?</h2>
            
            {loading ? (
              <div className="loading-result">
                <p>AI가 분석 중...</p>
              </div>
            ) : roleResult?.error ? (
              <div className="error-result">
                <p>오류: {roleResult.error}</p>
                <button className="secondary" onClick={fetchRoleAssignment}>다시 시도</button>
              </div>
            ) : roleResult ? (
              <div className="role-result">
                {roleResult.code && JOB_IMAGE_MAP[roleResult.code] && (
                  <div className="role-image-container">
                    <img 
                      src={JOB_IMAGE_MAP[roleResult.code]} 
                      alt={roleResult.role}
                      className="role-image"
                    />
                  </div>
                )}
                <div className={`role-badge team-${roleResult.team}`}>
                  <span className="role-team">{roleResult.team}</span>
                  <span className="role-name">{roleResult.role}</span>
                </div>
                <p className="role-reasoning">{roleResult.reasoning}</p>
              </div>
            ) : null}

            <div className="step-actions">
              <button className="secondary" onClick={prevStep}>이전</button>
              <button className="primary" onClick={saveAndFinish} disabled={loading || !roleResult}>완료하기</button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="onboarding-page">
      <div className="progress-bar">
        {STEPS.map((s, i) => (
          <div
            key={s.id}
            className={`progress-step ${i === step ? "active" : ""} ${i < step ? "completed" : ""}`}
          >
            <span className="step-number">{i + 1}</span>
          </div>
        ))}
      </div>

      <div className="onboarding-content">
        {renderStep()}
      </div>
    </div>
  );
}
