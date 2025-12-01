import { useEffect, useMemo, useState } from 'react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const CALLBACK_PROCESSED_KEY = 'kakao-callback-processed'
const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY || import.meta.env.VITE_KAKAO_JS_KEY
const SHARE_URL = import.meta.env.VITE_SHARE_URL || window.location.origin
const SHARE_IMAGE =
  'https://developers.kakao.com/assets/img/link_sample.jpg' // Kakao feed requires an image; using a docs sample.
const SHARE_TEST_TEXT = '송년회 페이지를 확인해 주세요.'
const KAKAO_TEMPLATE_ID = 126447 // 사용자 정의 템플릿 ID

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
      localStorage.removeItem('kakao-state')
      return
    }
    const sessionPayload = { ...data.profile, session_token: data.session_token }
    localStorage.setItem('farewell-session', JSON.stringify(sessionPayload))
    localStorage.removeItem('kakao-state')
    setSession(sessionPayload)
    setStatus('로그인 완료! 프로필을 불러오는 중...')
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
                    placeholder="홍길동"
                    disabled={!isLoggedIn}
                  />
                </div>
                <div>
                  <label>연락처</label>
                  <input
                    value={profile.contact}
                    onChange={(e) => updateField('contact', e.target.value)}
                    placeholder="이메일, 인스타, 카톡 오픈채팅 등"
                    disabled={!isLoggedIn}
                  />
                </div>
              </div>

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
                rows={4}
                disabled={!isLoggedIn}
              />

              <div className="two-col">
                <div>
                  <label>관심사 (쉼표로 구분)</label>
                  <input
                    value={interestsInput}
                    onChange={(e) => updateListField('interests', e.target.value)}
                    placeholder="AI, 음악, 러닝, 와인"
                    disabled={!isLoggedIn}
                  />
                </div>
                <div>
                  <label>강점/전문분야 (쉼표로 구분)</label>
                  <input
                    value={strengthsInput}
                    onChange={(e) => updateListField('strengths', e.target.value)}
                    placeholder="프로덕트 전략, 데이터 분석"
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

      {/* 설문 및 관리자 프로필 섹션은 별도 페이지로 이동 예정 */}
    </div>
  )
}

export default App
