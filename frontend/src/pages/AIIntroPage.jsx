import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import TinderCard from 'react-tinder-card'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

const cards = [
  {
    num: 1,
    image: '/dance.png',
    leftLabel: 'ㅉㅉ',
    rightLabel: '숭배',
    question: '김영진을?',
  },
  {
    num: 2,
    image: '/2.png',
    leftLabel: '싫어',
    rightLabel: '좋아',
    question: '술을?',
  },
  {
    num: 3,
    image: '/3.png',
    leftLabel: '조용히',
    rightLabel: '파티!',
    question: '파티 vs 조용한 분위기',
  },
  {
    num: 4,
    image: '/4.png',
    leftLabel: '기존친구',
    rightLabel: '새친구',
    question: '새로운 만남?',
  },
  {
    num: 5,
    image: '/5.png',
    leftLabel: '아쉬워',
    rightLabel: '기대돼',
    question: '2025년이?',
  },
]

function AIIntroPage({ session, onIntroGenerated }) {
  const navigate = useNavigate()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [responses, setResponses] = useState({})
  const [completed, setCompleted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [generatedIntro, setGeneratedIntro] = useState(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    const loadExistingResponses = async () => {
      if (!session?.session_token) {
        setLoading(false)
        return
      }

      try {
        const res = await fetch(`${API_BASE}/intro-yesorno`, {
          headers: {
            Authorization: `Bearer ${session.session_token}`,
          },
        })

        if (res.ok) {
          const data = await res.json()
          if (data.responses) {
            const existingResponses = {}
            let answeredCount = 0

            for (let i = 1; i <= 5; i++) {
              const val = data.responses[String(i)]
              if (val === -1 || val === 1) {
                existingResponses[i] = val
                answeredCount = i
              }
            }

            setResponses(existingResponses)
            if (answeredCount >= 5) {
              setCompleted(true)
            } else {
              setCurrentIndex(answeredCount)
            }
          }
        }
      } catch (err) {
        console.error('Failed to load existing responses:', err)
      } finally {
        setLoading(false)
      }
    }

    loadExistingResponses()
  }, [session?.session_token])

  const currentCard = cards[currentIndex]

  const saveResponse = async (questionNum, response) => {
    if (!session?.session_token) return false

    try {
      const res = await fetch(`${API_BASE}/intro-yesorno`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.session_token}`,
        },
        body: JSON.stringify({ question_num: questionNum, response }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || '저장에 실패했습니다')
      }
      return true
    } catch (err) {
      console.error('Failed to save response:', err)
      setError('저장에 실패했습니다. 다시 시도해주세요.')
      return false
    }
  }

  const generateIntro = async () => {
    if (!session?.session_token) return

    setGenerating(true)
    setError('')

    try {
      const res = await fetch(`${API_BASE}/generate-intro-from-yesorno`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.session_token}`,
        },
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || '자기소개 생성에 실패했습니다')
      }

      const data = await res.json()
      setGeneratedIntro(data)
    } catch (err) {
      console.error('Failed to generate intro:', err)
      setError('자기소개 생성에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setGenerating(false)
    }
  }

  const handleSwipe = async (direction) => {
    if (!currentCard || saving) return

    const response = direction === 'right' ? 1 : -1
    setError('')
    setSaving(true)

    const success = await saveResponse(currentCard.num, response)

    if (success) {
      setResponses((prev) => ({ ...prev, [currentCard.num]: response }))

      if (currentIndex < cards.length - 1) {
        setCurrentIndex((prev) => prev + 1)
      } else {
        setCompleted(true)
      }
    }

    setSaving(false)
  }

  const handleCardLeftScreen = () => {
  }

  const handleReset = async () => {
    setResponses({})
    setCurrentIndex(0)
    setCompleted(false)
    setGeneratedIntro(null)
    setError('')
  }

  const handleUseIntro = () => {
    if (generatedIntro && onIntroGenerated) {
      onIntroGenerated(generatedIntro)
      navigate('/')
    }
  }

  if (loading) {
    return (
      <div className="page ai-intro-page">
        <div className="header">
          <div>
            <p className="eyebrow">로딩 중...</p>
            <h1>잠시만<br/>기다려주세요</h1>
          </div>
        </div>
      </div>
    )
  }

  if (completed) {
    return (
      <div className="page ai-intro-page">
        <div className="header">
          <div>
            <p className="eyebrow">완료!</p>
            <h1>{generatedIntro ? 'AI가 만든 자기소개' : '모든 카드에 응답했습니다'}</h1>
          </div>
        </div>

        <button className="floating-cta info" onClick={() => navigate('/')}>
          돌아가기
        </button>

        {!generatedIntro ? (
          <section className="panel">
            <div className="panel-head">
              <h2>응답 결과</h2>
            </div>

            <div className="response-summary">
              {cards.map((card) => (
                <div key={card.num} className="response-item">
                  <span className="response-label">{card.question}</span>
                  <span className={`response-value ${responses[card.num] === 1 ? 'positive' : 'negative'}`}>
                    {responses[card.num] === 1 ? card.rightLabel : card.leftLabel}
                  </span>
                </div>
              ))}
            </div>

            {error && <p className="error-message">{error}</p>}

            <div className="button-row">
              <button className="secondary" onClick={handleReset}>
                다시하기
              </button>
              <button className="primary" onClick={generateIntro} disabled={generating}>
                {generating ? '생성 중...' : 'AI 자기소개 만들기'}
              </button>
            </div>
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

            {error && <p className="error-message">{error}</p>}

            <div className="button-row">
              <button className="secondary" onClick={generateIntro} disabled={generating}>
                {generating ? '생성 중...' : '다시 생성'}
              </button>
              <button className="primary" onClick={handleUseIntro}>
                프로필에 적용
              </button>
            </div>
          </section>
        )}
      </div>
    )
  }

  return (
    <div className="page ai-intro-page swipe-mode">
      <div className="header">
        <div>
          <p className="eyebrow">질문 {currentIndex + 1} / {cards.length}</p>
          <h1>카드를 스와이프<br/>해주세요</h1>
        </div>
      </div>

      <button className="floating-cta info" onClick={() => navigate('/')}>
        돌아가기
      </button>

      <div className="swipe-stage">
        <span className="swipe-side-label left">{currentCard?.leftLabel}<br/>← 왼쪽</span>

        {currentCard && (
          <TinderCard
            key={currentCard.num}
            preventSwipe={['up', 'down']}
            onSwipe={handleSwipe}
            onCardLeftScreen={handleCardLeftScreen}
          >
            <div className="swipe-card preview-card">
              <div className="preview-photo-wrap">
                <img
                  src={currentCard.image}
                  alt={`질문 ${currentCard.num}`}
                  className="preview-photo"
                  onError={(e) => {
                    e.target.src = '/dance.png'
                  }}
                />
                <div className="card-question-overlay">
                  {currentCard.question}
                </div>
              </div>
            </div>
          </TinderCard>
        )}

        <span className="swipe-side-label right">{currentCard?.rightLabel}<br/>오른쪽 →</span>
      </div>

      <div className="progress-bar">
        {cards.map((card) => (
          <div
            key={card.num}
            className={`progress-dot ${card.num <= currentIndex ? 'done' : ''} ${card.num === currentIndex + 1 ? 'current' : ''}`}
          />
        ))}
      </div>

      {saving && <p className="saving-indicator">저장 중...</p>}
      {error && <p className="error-message">{error}</p>}
    </div>
  )
}

export default AIIntroPage
