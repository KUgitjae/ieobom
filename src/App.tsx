
import { useEffect, useState } from 'react'
import './App.css'

type Line = {
  id: string
  author: string
  content: string
}

type Comment = {
  id: string
  author: string
  content: string
}

type Story = {
  id: string
  title: string
  genre: string
  target: number
  status: 'writing' | 'completed'
  creator: string
  lines: Line[]
  comments: Comment[]
  ratings: number[]
  createdAt: number
}

const STORAGE_KEY = 'ieobom-stories'
const USER_KEY = 'ieobom-user'

function loadStories(): Story[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

export default function App() {
  const [stories, setStories] = useState<Story[]>(loadStories)
  const [user, setUser] = useState(localStorage.getItem(USER_KEY) || '')
  const [name, setName] = useState('')
  const [auth, setAuth] = useState(false)
  const [create, setCreate] = useState(false)
  const [storyId, setStoryId] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('판타지')
  const [target, setTarget] = useState(6)
  const [sentence, setSentence] = useState('')
  const [comment, setComment] = useState('')

  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('latest')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stories))
  }, [stories])

  useEffect(() => {
    localStorage.setItem(USER_KEY, user)
  }, [user])

  const currentStory = stories.find(s => s.id === storyId) || null

  function login(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setUser(name.trim())
    setAuth(false)
    setName('')
    setError('')
  }

  function logout() {
    setUser('')
    setError('로그아웃되었습니다.')
  }

  function createStory(e: React.FormEvent) {
    e.preventDefault()

    if (!user) {
      setAuth(true)
      return
    }

    const firstLine: Line = {
      id: crypto.randomUUID(),
      author: user,
      content: sentence.trim()
    }

    const newStory: Story = {
      id: crypto.randomUUID(),
      title: title.trim(),
      genre,
      target,
      status: target === 1 ? 'completed' : 'writing',
      creator: user,
      lines: [firstLine],
      comments: [],
      ratings: [],
      createdAt: Date.now()
    }

    setStories(prev => [newStory, ...prev])
    setStoryId(newStory.id)
    setCreate(false)
    setTitle('')
    setSentence('')
    setError('')
  }

  function addSentence(e: React.FormEvent) {
    e.preventDefault()

    if (!user || !currentStory) {
      setAuth(true)
      return
    }

    if (currentStory.lines.at(-1)?.author === user) {
      setError('다른 작가가 먼저 문장을 작성해야 합니다.')
      return
    }

    if (!sentence.trim()) return

    const newLine: Line = {
      id: crypto.randomUUID(),
      author: user,
      content: sentence.trim()
    }

    setStories(prev => prev.map(s => {
      if (s.id !== currentStory.id) return s

      const newLines = [...s.lines, newLine]

      return {
        ...s,
        lines: newLines,
        status: newLines.length >= s.target ? 'completed' : 'writing'
      }
    }))

    setSentence('')
    setError('문장을 추가했습니다!')
  }

  function addComment(e: React.FormEvent) {
    e.preventDefault()

    if (!user) {
      setAuth(true)
      return
    }

    if (!currentStory || !comment.trim()) return

    const newComment: Comment = {
      id: crypto.randomUUID(),
      author: user,
      content: comment.trim()
    }

    setStories(prev => prev.map(s =>
      s.id === currentStory.id
        ? { ...s, comments: [...s.comments, newComment] }
        : s
    ))

    setComment('')
    setError('댓글을 남겼습니다')
  }

  function addRating(score: number) {
    if (!user) {
      setAuth(true)
      return
    }

    if (!currentStory) return

    setStories(prev => prev.map(s => {
      if (s.id !== currentStory.id) return s

      const ratings = [...s.ratings]
      ratings.push(score)

      return { ...s, ratings }
    }))

    setError(`${score}점을 평가했습니다.`)
  }

  const shown = stories
    .filter(s => filter === 'all' || s.status === filter)
    .filter(s => s.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'popular') {
        const avgA = a.ratings.length
          ? a.ratings.reduce((x, y) => x + y, 0) / a.ratings.length : 0
        const avgB = b.ratings.length
          ? b.ratings.reduce((x, y) => x + y, 0) / b.ratings.length : 0
        return avgB - avgA
      }
      return b.createdAt - a.createdAt
    })

  function closeStory() {
    setStoryId(null)
    setSentence('')
    setComment('')
    setError('')
  }

  return (
    <div className="app">
      <aside>
        <a className="logo" href="/">✿ 이어봄</a>
        <p className="muted">한 문장, 함께 쓰는 이야기</p>

        <nav>
          {[
            ['all', '모든 이야기'],
            ['writing', '지금 이어 쓰기'],
            ['completed', '완성된 서재']
          ].map(([value, label]) => (
            <button
              key={value}
              className={filter === value ? 'active' : ''}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="aside-note">
          혼자서는 몰랐을 결말을<br />
          함께 발견하는 곳.
        </div>
      </aside>

      <main>
        <header>
          <span>우리의 작은 창작 서재</span>

          {user ? (
            <div>
              <span>{user} 님</span>
              <button onClick={logout}>로그아웃</button>
            </div>
          ) : (
            <button onClick={() => setAuth(true)}>
              로그인 / 필명 입력
            </button>
          )}
        </header>

        {error && (
          <div className="notice" role="alert">
            {error}
            <button onClick={() => setError('')}>닫기</button>
          </div>
        )}

        <section className="hero">
          <div>
            <span className="eyebrow">A STORY WE WRITE TOGETHER</span>
            <h1>당신의 한 문장이,<br />우리의 이야기가 돼요.</h1>
            <p>
              처음은 누군가의 상상으로, 다음은 당신의 문장으로.<br />
              예상하지 못한 이야기를 함께 완성해요.
            </p>
            <button className="primary" onClick={() => {
              if (!user) setAuth(true)
              else setCreate(true)
            }}>
              새 이야기 시작하기 ＋
            </button>
          </div>

          <div className="book">
            <small>이어봄의 첫 번째 규칙</small>
            <strong>다음 문장은<br />당신에게<br />맡길게요.</strong>
            <span>ONE LINE, MANY VOICES</span>
          </div>
        </section>

        <section className="collection">
          <div className="section-title">
            <div>
              <span className="eyebrow">OUR LITTLE LIBRARY</span>
              <h2>
                {filter === 'completed'
                  ? '함께 완성한 이야기'
                  : '어떤 이야기를 이어 볼까요?'}
              </h2>
            </div>

            <select value={sort} onChange={e => setSort(e.target.value)}>
              <option value="latest">최신순</option>
              <option value="popular">인기순</option>
            </select>
          </div>

          <input
            className="search"
            placeholder="읽고 싶은 이야기 제목을 찾아보세요"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          <div className="grid">
            {shown.map(s => {
              const average = s.ratings.length
                ? s.ratings.reduce((a, b) => a + b, 0) / s.ratings.length
                : 0

              return (
                <button
                  className={`card genre-${s.genre}`}
                  key={s.id}
                  onClick={() => {
                    setStoryId(s.id)
                    setError('')
                  }}
                >
                  <div className="card-top">
                    <span className="tag">{s.genre}</span>
                    <span>{s.status === 'completed' ? '✓ 완성' : '이어 쓰는 중'}</span>
                  </div>

                  <h3>{s.title}</h3>
                  <p>{s.lines.at(-1)?.content}</p>

                  <div className="progress">
                    <i style={{
                      width: `${Math.min(100, s.lines.length / s.target * 100)}%`
                    }} />
                  </div>

                  <div className="card-bottom">
                    <span>{s.lines.length} / {s.target} 문장</span>
                    <span>★ {average.toFixed(1)} ({s.ratings.length})</span>
                  </div>

                  <div className="author">
                    {s.creator} 님이 시작한 이야기 ↗
                  </div>
                </button>
              )
            })}
          </div>

          {!shown.length && (
            <div className="empty">
              아직 비어 있는 페이지예요.<br />
              첫 이야기를 시작해 보세요.
            </div>
          )}
        </section>

        <footer>이어봄 © 2026 · 상상은 각자, 이야기는 함께.</footer>
      </main>

      {auth && (
        <div className="overlay">
          <section className="modal" role="dialog" aria-modal="true">
            <button className="close" onClick={() => setAuth(false)}>✕</button>
            <span className="eyebrow">WELCOME TO IEOBOM</span>
            <h2>어떤 이름으로 이야기를 쓸까요?</h2>

            <form onSubmit={login}>
              <label>
                필명
                <input
                  required
                  maxLength={20}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="사용할 이름을 입력해 주세요"
                />
              </label>
              <button className="primary">시작하기</button>
            </form>

            <p className="muted">
              별도의 회원가입 없이 필명으로 이용할 수 있습니다.
            </p>
          </section>
        </div>
      )}

      {create && (
        <div className="overlay">
          <section className="modal">
            <button className="close" onClick={() => setCreate(false)}>✕</button>
            <span className="eyebrow">THE FIRST PAGE</span>
            <h2>어떤 상상을 시작할까요?</h2>

            <form onSubmit={createStory}>
              <label>
                제목
                <input
                  required
                  minLength={2}
                  maxLength={60}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </label>

              <div className="row">
                <label>
                  장르
                  <select value={genre} onChange={e => setGenre(e.target.value)}>
                    {['판타지', '일상', '미스터리', '로맨스', 'SF', '자유'].map(g =>
                      <option key={g}>{g}</option>
                    )}
                  </select>
                </label>

                <label>
                  완성까지
                  <select
                    value={target}
                    onChange={e => setTarget(Number(e.target.value))}
                  >
                    {[3, 6, 10, 20, 30].map(n =>
                      <option key={n} value={n}>{n}문장</option>
                    )}
                  </select>
                </label>
              </div>

              <label>
                첫 문장
                <input
                  required
                  maxLength={200}
                  value={sentence}
                  onChange={e => setSentence(e.target.value)}
                  placeholder="어느 날, 평범한 일상에 작은 틈이 생겼다."
                />
              </label>

              <button className="primary">첫 페이지 펼치기</button>
            </form>
          </section>
        </div>
      )}

      {currentStory && (
        <div className="overlay">
          <section className="modal reader">
            <button className="close" onClick={closeStory}>✕</button>

            <span className="tag">
              {currentStory.genre} ·
              {currentStory.status === 'completed' ? '완성된 이야기' : '함께 쓰는 중'}
            </span>

            <h2>{currentStory.title}</h2>

            <p className="muted">
              {currentStory.creator} 님의 첫 문장에서 시작된 이야기 ·
              {currentStory.lines.length}/{currentStory.target}문장
            </p>

            <article>
              {currentStory.lines.map((line, index) => (
                <div className="sentence" key={line.id}>
                  <small>
                    {String(index + 1).padStart(2, '0')} · {line.author}
                  </small>
                  <p>{line.content}</p>
                </div>
              ))}
            </article>

            {currentStory.status === 'writing' ? (
              <section className="write-box">
                <h3>이다음은, 당신의 상상.</h3>
                <p>한 번에 한 줄, 최대 200자. 같은 작가는 연속해서 작성할 수 없어요.</p>

                {!user ? (
                  <button className="primary" onClick={() => setAuth(true)}>
                    필명 입력하고 이어 쓰기
                  </button>
                ) : currentStory.lines.at(-1)?.author === user ? (
                  <p>다음 작가의 문장을 기다리고 있어요.</p>
                ) : (
                  <form onSubmit={addSentence}>
                    <input
                      required
                      maxLength={200}
                      value={sentence}
                      onChange={e => setSentence(e.target.value)}
                      placeholder="마지막 문장에 이어 써 주세요"
                    />
                    <button className="primary">내 문장 이어 놓기</button>
                  </form>
                )}
              </section>
            ) : (
              <section className="write-box">
                <h3>함께 만든 결말, 어떠셨나요?</h3>

                <p>
                  ★ {currentStory.ratings.length
                    ? (currentStory.ratings.reduce((a, b) => a + b, 0) /
                      currentStory.ratings.length).toFixed(1)
                    : '0.0'}
                  · {currentStory.ratings.length}명의 평가
                </p>

                <div className="stars">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      aria-label={`${n}점 주기`}
                      onClick={() => addRating(n)}
                    >
                      {n}★
                    </button>
                  ))}
                </div>

                <h3>독자들의 한마디</h3>

                {currentStory.comments.map(c => (
                  <div className="comment" key={c.id}>
                    <strong>{c.author}</strong>
                    <p>{c.content}</p>
                  </div>
                ))}

                <form onSubmit={addComment}>
                  <label>
                    감상 남기기
                    <textarea
                      required
                      maxLength={500}
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                    />
                  </label>
                  <button className="primary">댓글 저장</button>
                </form>
              </section>
            )}

            {error && <p role="alert">{error}</p>}
          </section>
        </div>
      )}
    </div>
  )
}
