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
  },
  {
    num: 2,
    image: '/2.png',
    leftLabel: '아니',
    rightLabel: '응',
  },
  {
    num: 3,
    image: '/3.png',
    leftLabel: '아니',
    rightLabel: '응',
  },
  {
    num: 4,
    image: '/4.png',
    leftLabel: '아니',
    rightLabel: '응',
  },
  {
    num: 5,
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
            {cards.map((card) => (
              <div key={card.num} className="response-item">
                <span className="response-label">질문 {card.num}</span>
                <span className={`response-value ${responses[card.num] === 1 ? 'positive' : 'negative'}`}>
                  {responses[card.num] === 1 ? card.rightLabel : card.leftLabel}
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
