import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import TinderCard from 'react-tinder-card'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

const cards = [
  {
    id: 'q1',
    image: '/dance.png',
    leftLabel: 'ㅉㅉ',
    rightLabel: '숭배',
  },
  {
    id: 'q2',
    image: '/2.png',
    leftLabel: '아니',
    rightLabel: '응',
  },
  {
    id: 'q3',
    image: '/3.png',
    leftLabel: '아니',
    rightLabel: '응',
  },
  {
    id: 'q4',
    image: '/4.png',
    leftLabel: '아니',
    rightLabel: '응',
  },
  {
    id: 'q5',
    image: '/5.png',
    leftLabel: '아니',
    rightLabel: '응',
  },
]

function AIIntroPage({ session }) {
  const navigate = useNavigate()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [responses, setResponses] = useState({})
  const [completed, setCompleted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

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
          const existingResponses = {}
          let answeredCount = 0

          if (data.responses && Array.isArray(data.responses)) {
            data.responses.forEach((r) => {
              existingResponses[r.question_id] = r.response
              const cardIndex = cards.findIndex((c) => c.id === r.question_id)
              if (cardIndex !== -1) {
                answeredCount = Math.max(answeredCount, cardIndex + 1)
              }
            })
          }

          setResponses(existingResponses)
          if (answeredCount >= cards.length) {
            setCompleted(true)
          } else {
            setCurrentIndex(answeredCount)
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

  const saveResponse = async (questionId, response) => {
    if (!session?.session_token) return false

    try {
      const res = await fetch(`${API_BASE}/intro-yesorno`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.session_token}`,
        },
        body: JSON.stringify({ question_id: questionId, response }),
      })

      if (!res.ok) {
        throw new Error('저장에 실패했습니다')
      }
      return true
    } catch (err) {
      console.error('Failed to save response:', err)
      setError('저장에 실패했습니다. 다시 시도해주세요.')
      return false
    }
  }

  const handleSwipe = async (direction) => {
    if (!currentCard || saving) return

    const response = direction === 'right' ? 1 : -1
    setError('')
    setSaving(true)

    const success = await saveResponse(currentCard.id, response)

    if (success) {
      setResponses((prev) => ({ ...prev, [currentCard.id]: response }))

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
    setError('')
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
            <h1>모든 카드에<br/>응답했습니다</h1>
          </div>
        </div>

        <section className="panel">
          <div className="panel-head">
            <h2>응답 결과</h2>
          </div>

          <div className="response-summary">
            {cards.map((card, idx) => (
              <div key={card.id} className="response-item">
                <span className="response-label">질문 {idx + 1}</span>
                <span className={`response-value ${responses[card.id] === 1 ? 'positive' : 'negative'}`}>
                  {responses[card.id] === 1 ? card.rightLabel : card.leftLabel}
                </span>
              </div>
            ))}
          </div>

          <div className="button-row">
            <button className="secondary" onClick={handleReset}>
              다시하기
            </button>
            <button className="primary" onClick={() => navigate('/')}>
              홈으로
            </button>
          </div>
        </section>
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
            key={currentCard.id}
            preventSwipe={['up', 'down']}
            onSwipe={handleSwipe}
            onCardLeftScreen={handleCardLeftScreen}
          >
            <div className="swipe-card preview-card">
              <div className="preview-photo-wrap">
                <img
                  src={currentCard.image}
                  alt={`질문 ${currentIndex + 1}`}
                  className="preview-photo"
                  onError={(e) => {
                    e.target.src = '/dance.png'
                  }}
                />
              </div>
            </div>
          </TinderCard>
        )}

        <span className="swipe-side-label right">{currentCard?.rightLabel}<br/>오른쪽 →</span>
      </div>

      <div className="progress-bar">
        {cards.map((_, idx) => (
          <div
            key={idx}
            className={`progress-dot ${idx < currentIndex ? 'done' : ''} ${idx === currentIndex ? 'current' : ''}`}
          />
        ))}
      </div>

      {saving && <p className="saving-indicator">저장 중...</p>}
      {error && <p className="error-message">{error}</p>}
    </div>
  )
}

export default AIIntroPage
