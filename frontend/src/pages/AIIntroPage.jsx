import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

const questions = [
  {
    id: 'personality',
    label: '나를 한 마디로 표현한다면?',
    placeholder: '예: MBTI, 동물, 캐릭터 등 뭐든지',
  },
  {
    id: 'hobby',
    label: '요즘 빠져있는 것은?',
    placeholder: '예: 넷플릭스 드라마, 러닝, 독서, 게임',
  },
  {
    id: 'skill',
    label: '내가 자신있는 것 하나는?',
    placeholder: '예: 요리, 프로그래밍, 노래, 술게임',
  },
  {
    id: 'goal',
    label: '2025년에 이루고 싶은 것은?',
    placeholder: '예: 이직, 여행, 자격증, 연애',
  },
  {
    id: 'fun_fact',
    label: '사람들이 잘 모르는 나의 TMI는?',
    placeholder: '예: 사실 고양이 알러지가 있다',
  },
]

function AIIntroPage({ session, onIntroGenerated }) {
  const navigate = useNavigate()
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(false)
  const [generatedIntro, setGeneratedIntro] = useState(null)
  const [error, setError] = useState('')

  const handleChange = (id, value) => {
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }

  const handleGenerate = async () => {
    const filledCount = Object.values(answers).filter((v) => v?.trim()).length
    if (filledCount < 3) {
      setError('최소 3개 이상의 질문에 답해주세요!')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${API_BASE}/generate-intro`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.session_token}`,
        },
        body: JSON.stringify({ answers }),
      })

      if (!res.ok) {
        throw new Error('자기소개 생성에 실패했습니다.')
      }

      const data = await res.json()
      setGeneratedIntro(data)
    } catch (err) {
      console.error('AI intro generation error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUseIntro = () => {
    if (generatedIntro && onIntroGenerated) {
      onIntroGenerated(generatedIntro)
      navigate('/')
    }
  }

  const handleRegenerate = () => {
    setGeneratedIntro(null)
    handleGenerate()
  }

  return (
    <div className="page ai-intro-page">
      <div className="header">
        <div>
          <p className="eyebrow">AI 자기소개 생성기</p>
          <h1>몇 가지 질문에 답하면<br/>자기소개가 뚝딱!</h1>
        </div>
      </div>

      <button className="floating-cta info" onClick={() => navigate('/')}>
        돌아가기
      </button>

      {!generatedIntro ? (
        <section className="panel">
          <div className="panel-head">
            <h2>나에 대해 알려주세요</h2>
          </div>

          <div className="ai-questions">
            {questions.map((q) => (
              <div key={q.id} className="question-item">
                <label>{q.label}</label>
                <input
                  type="text"
                  placeholder={q.placeholder}
                  value={answers[q.id] || ''}
                  onChange={(e) => handleChange(q.id, e.target.value)}
                  disabled={loading}
                />
              </div>
            ))}
          </div>

          {error && <p className="error-message">{error}</p>}

          <button
            className="primary full-width"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? '생성 중...' : 'AI로 자기소개 만들기'}
          </button>
        </section>
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h2>AI가 만든 자기소개</h2>
          </div>

          <div className="generated-result">
            <div className="result-item">
              <label>한 줄 소개</label>
              <p className="result-text">{generatedIntro.tagline}</p>
            </div>

            <div className="result-item">
              <label>자세한 소개</label>
              <p className="result-text intro-text">{generatedIntro.intro}</p>
            </div>

            {Array.isArray(generatedIntro.interests) && generatedIntro.interests.length > 0 && (
              <div className="result-item">
                <label>관심사</label>
                <div className="chips">
                  {generatedIntro.interests.map((chip, idx) => (
                    <span key={`interest-${idx}`} className="chip">{String(chip)}</span>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(generatedIntro.strengths) && generatedIntro.strengths.length > 0 && (
              <div className="result-item">
                <label>강점</label>
                <div className="chips">
                  {generatedIntro.strengths.map((chip, idx) => (
                    <span key={`strength-${idx}`} className="chip">{String(chip)}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="button-row">
            <button className="secondary" onClick={handleRegenerate} disabled={loading}>
              {loading ? '생성 중...' : '다시 생성하기'}
            </button>
            <button className="primary" onClick={handleUseIntro}>
              이 소개 사용하기
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

export default AIIntroPage
