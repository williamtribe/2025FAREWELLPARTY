import { createRef, useEffect, useMemo, useRef, useState } from 'react'
import TinderCard from 'react-tinder-card'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const CALLBACK_PROCESSED_KEY = 'kakao-callback-processed'
const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY || import.meta.env.VITE_KAKAO_JS_KEY
const SHARE_URL = import.meta.env.VITE_SHARE_URL || window.location.origin
const SHARE_IMAGE =
  'https://developers.kakao.com/assets/img/link_sample.jpg' // Kakao feed requires an image; using a docs sample.
const SHARE_TEST_TEXT = '송년회 페이지를 확인해 주세요.'
const KAKAO_TEMPLATE_ID = 126447 // 사용자 정의 템플릿 ID
const LANDING_SEEN_KEY = 'farewell-landing-seen'
const SWIPE_CANDIDATES = [
  {
    id: 'steak',
    name: '스테이크 러버',
    bio: '스테이크와 감자는 제가 책임질게요. 대화 주제: 고기 굽기 레벨 테스트.',
    vibe: '미식',
    bg: 'linear-gradient(135deg, #ffded9, #ffc4bd)',
  },
  {
    id: 'data',
    name: '데이터 장인',
    bio: '연말에는 통계도 파티처럼. AI, 데이터, 마피아42 공략법까지.',
    vibe: 'AI · 게임',
    bg: 'linear-gradient(135deg, #d4f2e1, #a8e4c4)',
  },
  {
    id: 'dj',
    name: '파티 DJ',
    bio: '춤추는 김영진만큼은 못해도, 분위기 띄우는 건 자신 있어요.',
    vibe: '음악 · 무드',
    bg: 'linear-gradient(135deg, #e1e7ff, #c6d2ff)',
  },
]

const emptyProfile = {
  name: '',
  intro: '',
  tagline: '',
  interests: [],
  strengths: [],
  contact: '',
  visibility: 'public',
}

function App() {
  const [session, setSession] = useState(() => {
    const saved = localStorage.getItem('farewell-session')
    return saved ? JSON.parse(saved) : null
  })
  const [profile, setProfile] = useState(emptyProfile)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [adminProfiles, setAdminProfiles] = useState([])
  const [interestsInput, setInterestsInput] = useState('')
  const [strengthsInput, setStrengthsInput] = useState('')
  const [isEditing, setIsEditing] = useState(true)
  const [transitionMessage, setTransitionMessage] = useState('')
  const [lastSwipe, setLastSwipe] = useState('')
  const [currentIndex, setCurrentIndex] = useState(SWIPE_CANDIDATES.length - 1)
  const swipeRefs = useMemo(() => SWIPE_CANDIDATES.map(() => createRef()), [])
  const redirectTimer = useRef(null)
  const [view, setView] = useState(() => {
    if (window.location.pathname === '/api/auth/kakao/callback') return 'main'
    const seen = localStorage.getItem(LANDING_SEEN_KEY)
    return seen ? 'main' : 'landing'
  })

  const authHeaders = useMemo(() => {
    return session?.session_token
      ? { Authorization: `Bearer ${session.session_token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' }
  }, [session])

  useEffect(() => {
    const isCallback = window.location.pathname === '/api/auth/kakao/callback'
    if (isCallback) {
      // React StrictMode에서 useEffect가 두 번 실행되어 Kakao code가 재사용되는 것을 방지.
      if (sessionStorage.getItem(CALLBACK_PROCESSED_KEY)) return
      sessionStorage.setItem(CALLBACK_PROCESSED_KEY, '1')
      handleKakaoCallback()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (session?.session_token) {
      fetchMyProfile()
      localStorage.setItem(LANDING_SEEN_KEY, '1')
      setView('main')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.session_token])

  useEffect(() => {
    if (!KAKAO_JS_KEY) return
    if (window.Kakao && window.Kakao.isInitialized()) return
    const script = document.createElement('script')
    script.src = 'https://developers.kakao.com/sdk/js/kakao.min.js'
    script.async = true
    script.onload = () => {
      if (window.Kakao && !window.Kakao.isInitialized()) {
        window.Kakao.init(KAKAO_JS_KEY)
      }
    }
    document.body.appendChild(script)
  }, [])

  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current)
    }
  }, [])

  const handleKakaoLogin = async () => {
    sessionStorage.removeItem(CALLBACK_PROCESSED_KEY)
    localStorage.setItem(LANDING_SEEN_KEY, '1')
    setView('main')
    setStatus('카카오 로그인 페이지로 이동합니다...')
    const res = await fetch(`${API_BASE}/auth/kakao/login`)
    const data = await res.json()
    localStorage.setItem('kakao-state', data.state)
    window.location.href = data.auth_url
  }

  const handleKakaoCallback = async () => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const savedState = localStorage.getItem('kakao-state')
    if (!code) return
    setStatus('카카오 인증 처리 중...')
    const res = await fetch(`${API_BASE}/auth/kakao/callback?code=${code}&state=${state}`)
    const data = await res.json()
    if (savedState && state !== savedState) {
      setStatus('state 불일치: 다시 시도해주세요.')
      localStorage.removeItem('kakao-state')
      return
    }
    const sessionPayload = { ...data.profile, session_token: data.session_token }
    localStorage.setItem('farewell-session', JSON.stringify(sessionPayload))
    localStorage.removeItem('kakao-state')
    setSession(sessionPayload)
    setStatus('로그인 완료! 프로필을 불러오는 중...')
    localStorage.setItem(LANDING_SEEN_KEY, '1')
    setView('main')
    window.history.replaceState({}, document.title, '/')
    sessionStorage.removeItem(CALLBACK_PROCESSED_KEY)
  }

  const fetchMyProfile = async () => {
    if (!session?.session_token) return
    setStatus('프로필을 불러오는 중...')
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/me`, { headers: authHeaders })
      if (!res.ok) throw new Error('프로필을 불러오지 못했습니다.')
      const data = await res.json()
      const incoming = data.profile || {}
      const baseName = session?.nickname || ''
      setProfile({ ...emptyProfile, name: incoming.name || baseName, ...incoming })
      setInterestsInput((incoming.interests || []).join(', '))
      setStrengthsInput((incoming.strengths || []).join(', '))
      setIsEditing(false)
      setStatus('')
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  const updateField = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: value }))
  }

  const updateListField = (field, value) => {
    const parts = value.split(',').map((v) => v.trim()).filter(Boolean)
    setProfile((prev) => ({ ...prev, [field]: parts }))
    if (field === 'interests') setInterestsInput(value)
    if (field === 'strengths') setStrengthsInput(value)
  }

  const saveProfile = async () => {
    if (!session?.session_token) return setStatus('로그인이 필요합니다.')
    setLoading(true)
    setStatus('저장하고 있습니다...')
    try {
      const res = await fetch(`${API_BASE}/me`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(profile),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || '저장 실패')
      setStatus('저장 완료!')
      setProfile((prev) => ({ ...prev, ...data.profile }))
      setIsEditing(false)
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  const shareToKakao = () => {
    const { Kakao } = window
    if (!KAKAO_JS_KEY) return setStatus('카카오 JS 키가 없습니다. VITE_KAKAO_JAVASCRIPT_KEY를 설정하세요.')
    if (!Kakao) return setStatus('카카오 SDK 로드 중입니다. 잠시 후 다시 시도하세요.')
    if (!Kakao.isInitialized()) Kakao.init(KAKAO_JS_KEY)

    const title = '2025.12.20 송년회'
    const description =
      profile.tagline ||
      '얘기가 잘 통하는 사람들만 만날겁니다. 12월 20일 잠실에서 함께해요.'
    const name = profile.name || session?.nickname || '친구'

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
                () => setStatus('카카오톡이 없어 링크를 복사했습니다. 붙여넣어 공유하세요.'),
                () => setStatus('카카오톡이 없어 공유를 못했습니다. 링크를 직접 복사해 주세요.')
              )
            } else {
              setStatus('카카오톡이 없어 공유를 못했습니다. 링크를 직접 복사해 주세요.')
            }
          },
        }
      )
    } catch (err) {
      setStatus(`카카오 공유 중 오류가 발생했습니다: ${err}`)
    }
  }

  const fetchAdminProfiles = async () => {
    setStatus('전체 프로필을 불러옵니다...')
    try {
      const res = await fetch(`${API_BASE}/admin/profiles`, { headers: authHeaders })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || '불러오기 실패')
      setAdminProfiles(data.profiles || [])
      setStatus('')
    } catch (err) {
      setStatus(err.message)
    }
  }

  const isLoggedIn = Boolean(session?.session_token)
  const displayName = profile.name || session?.nickname || '이름 미입력'
  const displayTagline = profile.tagline || '한 줄 소개가 여기에 보여요'
  const displayIntro = profile.intro || '자기소개를 적으면 바로 여기서 확인할 수 있습니다.'
  const displayContact = profile.contact || '미입력'

  const handleSwipe = (direction, candidate, index) => {
    setLastSwipe(`${candidate.name}에게 ${direction === 'right' ? '좋아요' : '넘김'}!`)
    setCurrentIndex(Math.max(index - 1, -1))
  }

  const startLoginFlow = (message, delayMs) => {
    if (redirectTimer.current) clearTimeout(redirectTimer.current)
    setTransitionMessage(message)
    setView('transition')
    redirectTimer.current = setTimeout(() => {
      localStorage.setItem(LANDING_SEEN_KEY, '1')
      setView('main')
      if (!session?.session_token) {
        handleKakaoLogin()
      }
    }, delayMs)
  }

  if (view !== 'main') {
    return (
      <div className="landing-page">
          <div className="landing-card">
            <div className="landing-image">
              <img
                src="/dance.png"
                alt="춤추는 김영진"
              />
              <div className="image-overlay">*저희 모임은 술을 강제하지 않습니다* <br/> *주최자의 주량은 소주 한병입니다*</div>
            </div>
          <div className="landing-copy">
            <p className="eyebrow">2025 송년회</p>
            <h1>나는 이걸</h1>
            <p className="lede">
            </p>
            {view === 'landing' ? (
              <div className="landing-actions">
                <button className="primary" onClick={() => startLoginFlow('그러면 빨리 로그인 해', 900)}>
                  안다
                </button>
                <button
                  className="secondary"
                  onClick={() =>
                    startLoginFlow(
                      '안녕하세요, 김영진이라고 합니다. 초대에 응해주셔서 감사합니다! 오시면 맛있는 스테이크와 감자는 보장합니다.',
                      3000
                    )
                  }
                >
                  모른다
                </button>
              </div>
            ) : (
              <div className="transition-message">
                <p className="lede">{transitionMessage || '잠시만요...'}</p>
                <p className="muted">로그인 화면으로 이동합니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="header">
        <div>
          <p className="eyebrow">2025 송년회</p>
          <h1>대화상대 정해주는 GOAT 테크놀로지와 함께</h1>
          <div className="cta-row">
            {isLoggedIn && <span className="muted">환영합니다, {session?.nickname || '친구'}님</span>}
          </div>
          {status && <div className="status">{status}</div>}
        </div>
      </div>

      {isLoggedIn ? (
        <button className="floating-cta share" onClick={shareToKakao}>
          카카오톡으로 공유
        </button>
      ) : (
        <button className="floating-cta login-cta" onClick={handleKakaoLogin}>
          카카오톡으로 로그인
        </button>
      )}

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">MY PAGE</p>
            <h2>자기소개 카드</h2>
          </div>
        </div>

        <div className="profile-card">
          {isEditing ? (
            <div className="profile-form">
              <div className="two-col">
                <div>
                  <label>이름</label>
                  <input
                    value={profile.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    placeholder="예시: 김영진"
                    disabled={!isLoggedIn}
                  />
                </div>
                <div>
                  <label>연락처</label>
                  <input
                    value={profile.contact}
                    onChange={(e) => updateField('contact', e.target.value)}
                    placeholder="01073523102, @williamkim816"
                    disabled={!isLoggedIn}
                  />
                </div>
              </div>

              <label>한 줄 소개</label>
              <input
                value={profile.tagline}
                onChange={(e) => updateField('tagline', e.target.value)}
                placeholder="안녕하세요, 오늘 초대한 김영진입니다. 예시: 검사지망 통계싸게"
                disabled={!isLoggedIn}
              />

              <label>자세한 소개</label>
              <textarea
                value={profile.intro}
                onChange={(e) => updateField('intro', e.target.value)}
                placeholder="예시: 레제를 죽인 마키마를 죽이고 싶은 검사지망생입니다. 마피아42가 너무 재밌어서 그 회사에서 일하는 중입니당."
                rows={4}
                disabled={!isLoggedIn}
              />

              <div className="two-col">
                <div>
                  <label>관심사 (쉼표로 구분)</label>
                  <input
                    value={interestsInput}
                    onChange={(e) => updateListField('interests', e.target.value)}
                    placeholder="애니, 레제, 게임, 체인소맨, 마피아42, AI, 법"
                    disabled={!isLoggedIn}
                  />
                </div>
                <div>
                  <label>특기 (쉼표로 구분)</label>
                  <input
                    value={strengthsInput}
                    onChange={(e) => updateListField('strengths', e.target.value)}
                    placeholder="사람을 좋아함"
                    disabled={!isLoggedIn}
                  />
                </div>
              </div>

              <label>공개 범위</label>
              <select
                value={profile.visibility}
                onChange={(e) => updateField('visibility', e.target.value)}
                disabled={!isLoggedIn}
              >
                <option value="public">모두 공개</option>
                <option value="members">참여자에게만</option>
                <option value="private">비공개</option>
              </select>

              <button className="primary" onClick={saveProfile} disabled={!isLoggedIn || loading}>
                {loading ? '저장 중...' : '프로필 저장'}
              </button>
            </div>
          ) : (
            <div className="profile-hero">
              <div>
                <p className="eyebrow">PREVIEW</p>
                <h3>{displayName}</h3>
                <p className="tagline">{displayTagline}</p>
                <p className="intro">{displayIntro}</p>
                <div className="chips">
                  {(profile.interests.length ? profile.interests : ['AI', '음악']).map((chip) => (
                    <span key={chip} className="chip">
                      {chip}
                    </span>
                  ))}
                </div>
                <div className="chips subtle">
                  {(profile.strengths.length ? profile.strengths : ['전략', '데이터']).map((chip) => (
                    <span key={chip} className="chip">
                      {chip}
                    </span>
                  ))}
                </div>
                <p className="muted">연락처: {displayContact}</p>
                <p className="muted">공개 범위: {profile.visibility}</p>
              </div>
              <div className="profile-badge">
                <button className="ghost inline" onClick={() => setIsEditing(true)} disabled={!isLoggedIn}>
                  편집
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="panel swipe-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">SWIPE</p>
            <h2>누구와 먼저 얘기해볼까요?</h2>
          </div>
          <p className="muted small">카드를 좌우로 스와이프하세요.</p>
        </div>
        <div className="swipe-layout">
          <div className="swipe-deck">
            {SWIPE_CANDIDATES.map((person, idx) => (
              <TinderCard
                key={person.id}
                className="swipe"
                ref={swipeRefs[idx]}
                onSwipe={(dir) => handleSwipe(dir, person, idx)}
                preventSwipe={['up', 'down']}
              >
                <div className="swipe-card" style={{ background: person.bg, zIndex: SWIPE_CANDIDATES.length - idx }}>
                  <div className="swipe-pill">{person.vibe}</div>
                  <h3>{person.name}</h3>
                  <p className="intro">{person.bio}</p>
                  <p className="muted small">스와이프해서 선택하거나 넘겨보세요.</p>
                </div>
              </TinderCard>
            ))}
          </div>
          <div className="swipe-hint">
            <p className="lede">{lastSwipe || '오른쪽은 좋아요, 왼쪽은 패스!'}</p>
            <div className="swipe-controls">
              <button
                className="ghost"
                onClick={() => {
                  const ref = swipeRefs[currentIndex]?.current
                  if (ref) ref.swipe('left')
                }}
                disabled={currentIndex < 0}
              >
                패스
              </button>
              <button
                className="primary"
                onClick={() => {
                  const ref = swipeRefs[currentIndex]?.current
                  if (ref) ref.swipe('right')
                }}
                disabled={currentIndex < 0}
              >
                좋아요
              </button>
            </div>
            {!session?.session_token && (
              <button className="primary" onClick={handleKakaoLogin}>
                스와이프 후 로그인하기
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 설문 및 관리자 프로필 섹션은 별도 페이지로 이동 예정 */}
    </div>
  )
}

export default App
