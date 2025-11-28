import { useEffect, useMemo, useState } from 'react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const CALLBACK_PROCESSED_KEY = 'kakao-callback-processed'
const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY || import.meta.env.VITE_KAKAO_JS_KEY
const SHARE_URL = import.meta.env.VITE_SHARE_URL || window.location.origin

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
  const [preferences, setPreferences] = useState({ answers: {}, mood: '🔥 핫한 네트워킹' })
  const [adminProfiles, setAdminProfiles] = useState([])

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
    } else if (session?.session_token) {
      fetchMyProfile()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const handleKakaoLogin = async () => {
    sessionStorage.removeItem(CALLBACK_PROCESSED_KEY)
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
      return
    }
    const sessionPayload = { ...data.profile, session_token: data.session_token }
    localStorage.setItem('farewell-session', JSON.stringify(sessionPayload))
    setSession(sessionPayload)
    setStatus('로그인 완료! 프로필을 불러오는 중...')
    window.history.replaceState({}, document.title, '/')
    fetchMyProfile()
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
    setProfile((prev) => ({ ...prev, [field]: value.split(',').map((v) => v.trim()).filter(Boolean) }))
  }

  const saveProfile = async () => {
    if (!session?.session_token) return setStatus('로그인이 필요합니다.')
    setLoading(true)
    setStatus('저장하고 임베딩/벡터를 업데이트 중입니다...')
    try {
      const res = await fetch(`${API_BASE}/me`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(profile),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || '저장 실패')
      setStatus('저장 완료! Pinecone에 동기화했습니다.')
      setProfile((prev) => ({ ...prev, ...data.profile }))
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  const submitPreferences = async () => {
    if (!session?.session_token) return setStatus('로그인이 필요합니다.')
    setStatus('취향 데이터를 저장 중입니다...')
    try {
      const res = await fetch(`${API_BASE}/preferences`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(preferences),
      })
      if (!res.ok) throw new Error('저장 실패')
      setStatus('설문 저장 완료!')
    } catch (err) {
      setStatus(err.message)
    }
  }

  const shareToKakao = () => {
    if (!KAKAO_JS_KEY) {
      setStatus('카카오 JS 키가 없습니다. VITE_KAKAO_JAVASCRIPT_KEY를 설정하세요.')
      return
    }
    const { Kakao } = window
    if (!Kakao) {
      setStatus('카카오 SDK 로드 중입니다. 잠시 후 다시 시도하세요.')
      return
    }
    if (!Kakao.isInitialized()) {
      Kakao.init(KAKAO_JS_KEY)
    }
    try {
      Kakao.Share.sendDefault({
        objectType: 'text',
        text: '너, 초대된거야: 12월 20일 오후 6시 잠실 석촌역에서 스테이크와 함께.',
        link: { webUrl: SHARE_URL, mobileWebUrl: SHARE_URL },
        buttonTitle: '페이지 열기',
      })
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

  return (
    <div className="page">
      <div className="header">
        <div>
          <p className="eyebrow">2025 FAREWELL PARTY</p>
          <h1>2025.12.20 송년회</h1>
          <p className="lede">
            카톡으로 로그인 ㄱㄱ
            -김영진-
          </p>
          <div className="cta-row">
            <button className="primary" onClick={handleKakaoLogin}>
              {isLoggedIn ? '다른 계정으로 로그인' : 'Kakao로 시작하기'}
            </button>
            <button className="secondary share-btn" onClick={shareToKakao}>
              카카오톡으로 공유
            </button>
            {isLoggedIn && <span className="muted">환영합니다, {session?.nickname || '친구'}님</span>}
          </div>
          {status && <div className="status">{status}</div>}
        </div>
      </div>

      <button className="floating-cta" onClick={handleKakaoLogin}>
        {isLoggedIn ? '다른 계정으로 로그인' : '카카오로 로그인'}
      </button>
      <button className="floating-cta share" onClick={shareToKakao}>
        카카오톡으로 공유
      </button>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">MY PAGE</p>
            <h2>자기소개 카드</h2>
            <p className="muted">카카오 인증 후 정보를 입력하면 저장과 동시에 임베딩/벡터를 갱신합니다.</p>
          </div>
          <button className="ghost" onClick={fetchMyProfile} disabled={!isLoggedIn || loading}>
            새로고침
          </button>
        </div>

        <div className="grid">
          <div className="card form">
            <label>이름</label>
            <input
              value={profile.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="홍길동"
              disabled={!isLoggedIn}
            />

            <label>한 줄 소개</label>
            <input
              value={profile.tagline}
              onChange={(e) => updateField('tagline', e.target.value)}
              placeholder="데이터와 음악을 사랑하는 PM"
              disabled={!isLoggedIn}
            />

            <label>자세한 소개</label>
            <textarea
              value={profile.intro}
              onChange={(e) => updateField('intro', e.target.value)}
              placeholder="올해 했던 일, 내년 목표, 이번 송년회에서 만나고 싶은 사람..."
              rows={5}
              disabled={!isLoggedIn}
            />

            <div className="two-col">
              <div>
                <label>관심사 (쉼표로 구분)</label>
                <input
                  value={profile.interests.join(', ')}
                  onChange={(e) => updateListField('interests', e.target.value)}
                  placeholder="AI, 음악, 러닝, 와인"
                  disabled={!isLoggedIn}
                />
              </div>
              <div>
                <label>강점/전문분야 (쉼표로 구분)</label>
                <input
                  value={profile.strengths.join(', ')}
                  onChange={(e) => updateListField('strengths', e.target.value)}
                  placeholder="프로덕트 전략, 데이터 분석"
                  disabled={!isLoggedIn}
                />
              </div>
            </div>

            <div className="two-col">
              <div>
                <label>연락처</label>
                <input
                  value={profile.contact}
                  onChange={(e) => updateField('contact', e.target.value)}
                  placeholder="이메일, 인스타, 카톡 오픈채팅 등"
                  disabled={!isLoggedIn}
                />
              </div>
              <div>
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
              </div>
            </div>

            <button className="primary" onClick={saveProfile} disabled={!isLoggedIn || loading}>
              {loading ? '저장 중...' : '프로필 저장 & 벡터 갱신'}
            </button>
          </div>

          <div className="card preview">
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
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">TINDER STYLE SURVEY</p>
            <h2>취향/매칭 설문</h2>
            <p className="muted">이 답변도 프로필과 함께 저장되어 추천에 활용됩니다.</p>
          </div>
        </div>
        <div className="card form">
          <label>오늘의 무드</label>
          <select
            value={preferences.mood}
            onChange={(e) => setPreferences((prev) => ({ ...prev, mood: e.target.value }))}
            disabled={!isLoggedIn}
          >
            <option>🔥 핫한 네트워킹</option>
            <option>🧊 조용한 대화</option>
            <option>🍷 느긋한 시음</option>
            <option>🎧 음악과 함께</option>
          </select>

          <label>요즘 꽂힌 주제</label>
          <input
            placeholder="예) 에이전트, 제로투원 스케일업, 재즈"
            disabled={!isLoggedIn}
            onChange={(e) =>
              setPreferences((prev) => ({ ...prev, answers: { ...prev.answers, topic: e.target.value } }))
            }
          />

          <label>함께 이야기하고 싶은 사람상</label>
          <textarea
            rows={3}
            disabled={!isLoggedIn}
            onChange={(e) =>
              setPreferences((prev) => ({
                ...prev,
                answers: { ...prev.answers, partner: e.target.value },
              }))
            }
          />

          <button className="secondary" onClick={submitPreferences} disabled={!isLoggedIn || loading}>
            설문 저장
          </button>
        </div>
      </section>

      {session?.is_admin && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">ADMIN</p>
              <h2>전체 프로필 보기</h2>
            </div>
            <button className="ghost" onClick={fetchAdminProfiles}>
              불러오기
            </button>
          </div>
          <div className="admin-grid">
            {adminProfiles.map((p) => (
              <div key={p.kakao_id} className="card admin-card">
                <div className="admin-head">
                  <strong>{p.name || '이름 없음'}</strong>
                  <span className="muted">#{p.kakao_id}</span>
                </div>
                <p className="tagline">{p.tagline}</p>
                <p className="intro">{p.intro}</p>
                <div className="chips">
                  {(p.interests || []).map((chip) => (
                    <span className="chip" key={chip}>
                      {chip}
                    </span>
                  ))}
                </div>
                <p className="muted">공개 범위: {p.visibility}</p>
              </div>
            ))}
            {!adminProfiles.length && <p className="muted">아직 불러온 데이터가 없습니다.</p>}
          </div>
        </section>
      )}
    </div>
  )
}

export default App
