import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import { IndexeddbPersistence } from 'y-indexeddb'
import './App.css'

type UserProfile = {
  id: string
  name: string
  color: string
}

type DocItem = {
  id: string
  title: string
  updatedAt: number
}

const USER_KEY = 'syncscribe-user'
const DOCS_KEY = 'syncscribe-docs'
const LAST_DOC_KEY = 'syncscribe-last-doc-id'
const DOC_UPDATED_AT_THROTTLE_MS = 10_000

function randomName() {
  const names = ['Sky', 'River', 'Nova', 'Mina', 'Joon', 'Luna', 'Theo', 'Hana']
  return names[Math.floor(Math.random() * names.length)] + '-' + Math.floor(Math.random() * 100)
}

function randomColor() {
  const colors = ['#7c3aed', '#2563eb', '#059669', '#dc2626', '#d97706', '#0f766e']
  return colors[Math.floor(Math.random() * colors.length)]
}

function uid() {
  return crypto.randomUUID().slice(0, 8)
}

function defaultDocs(): DocItem[] {
  return [{ id: 'jobhunt-frontend-room', title: '취업 준비 협업 문서', updatedAt: Date.now() }]
}

function loadUser() {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<UserProfile>
    if (typeof parsed.id === 'string' && typeof parsed.name === 'string' && typeof parsed.color === 'string') {
      return { id: parsed.id, name: parsed.name, color: parsed.color }
    }
    return null
  } catch {
    return null
  }
}

function saveUser(user: UserProfile) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

function loadDocs() {
  const raw = localStorage.getItem(DOCS_KEY)
  if (!raw) return defaultDocs()

  try {
    const parsed = JSON.parse(raw) as Partial<DocItem>[]
    const sanitized = parsed
      .filter(
        (doc): doc is Required<Pick<DocItem, 'id' | 'title' | 'updatedAt'>> =>
          typeof doc.id === 'string' && typeof doc.title === 'string' && typeof doc.updatedAt === 'number',
      )
      .map((doc) => ({ id: doc.id, title: doc.title.trim() || 'Untitled', updatedAt: doc.updatedAt }))

    return sanitized.length ? sanitized : defaultDocs()
  } catch {
    return defaultDocs()
  }
}

function saveDocs(docs: DocItem[]) {
  localStorage.setItem(DOCS_KEY, JSON.stringify(docs))
}

function loadLastSelectedDocId() {
  const raw = localStorage.getItem(LAST_DOC_KEY)
  return typeof raw === 'string' && raw.trim() ? raw : null
}

function saveLastSelectedDocId(docId: string) {
  localStorage.setItem(LAST_DOC_KEY, docId)
}

function legacyCopyText(text: string) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()

  try {
    return document.execCommand('copy')
  } finally {
    document.body.removeChild(textarea)
  }
}

function AuthScreen({ onLogin }: { onLogin: (name: string) => void }) {
  const [name, setName] = useState('')

  return (
    <main className="container auth">
      <h1>SyncScribe</h1>
      <p className="sub">로그인 후 문서 협업을 시작하세요.</p>
      <section className="card authCard">
        <label htmlFor="name">Display Name</label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: developjik"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) onLogin(name.trim())
          }}
        />
        <button onClick={() => name.trim() && onLogin(name.trim())}>로그인</button>
      </section>
    </main>
  )
}

function App() {
  const [user, setUser] = useState<UserProfile | null>(() => loadUser())
  const [docs, setDocs] = useState<DocItem[]>(() => loadDocs())
  const [selectedDocId, setSelectedDocId] = useState<string>(() => {
    const docs = loadDocs()
    const lastSelectedDocId = loadLastSelectedDocId()

    if (lastSelectedDocId && docs.some((doc) => doc.id === lastSelectedDocId)) {
      return lastSelectedDocId
    }

    return docs[0]?.id ?? 'jobhunt-frontend-room'
  })
  const [newTitle, setNewTitle] = useState('')
  const [collaboratorCount, setCollaboratorCount] = useState(1)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [pendingDeleteDocId, setPendingDeleteDocId] = useState<string | null>(null)
  const updateTimestampTimer = useRef<number | null>(null)
  const copyStatusTimer = useRef<number | null>(null)
  const deleteConfirmTimer = useRef<number | null>(null)

  const selectedDoc = docs.find((d) => d.id === selectedDocId) ?? docs[0]

  useEffect(() => {
    if (!selectedDoc && docs.length === 0) return

    if (selectedDoc && selectedDoc.id !== selectedDocId) {
      setSelectedDocId(selectedDoc.id)
      return
    }

    if (selectedDoc) {
      saveLastSelectedDocId(selectedDoc.id)
    }
  }, [selectedDoc, selectedDocId, docs.length])

  useEffect(() => {
    return () => {
      if (copyStatusTimer.current) window.clearTimeout(copyStatusTimer.current)
      if (deleteConfirmTimer.current) window.clearTimeout(deleteConfirmTimer.current)
    }
  }, [])

  const { ydoc, provider, persistence } = useMemo(() => {
    const room = selectedDoc?.id ?? 'jobhunt-frontend-room'
    const ydoc = new Y.Doc()
    const persistence = new IndexeddbPersistence(`syncscribe-${room}`, ydoc)
    const provider = new WebrtcProvider(room, ydoc)

    if (user) {
      provider.awareness.setLocalStateField('user', { name: user.name, color: user.color })
    }

    return { ydoc, provider, persistence }
  }, [selectedDoc?.id, user])

  useEffect(() => {
    return () => {
      provider.destroy()
      ydoc.destroy()
      persistence.destroy()
    }
  }, [provider, ydoc, persistence])

  useEffect(() => {
    const refreshUpdatedAt = () => {
      if (updateTimestampTimer.current) window.clearTimeout(updateTimestampTimer.current)
      updateTimestampTimer.current = window.setTimeout(() => {
        const now = Date.now()

        setDocs((prev) => {
          const targetDoc = prev.find((doc) => doc.id === selectedDocId)
          if (!targetDoc || now - targetDoc.updatedAt < DOC_UPDATED_AT_THROTTLE_MS) {
            return prev
          }

          const next = prev
            .map((doc) => (doc.id === selectedDocId ? { ...doc, updatedAt: now } : doc))
            .sort((a, b) => b.updatedAt - a.updatedAt)

          saveDocs(next)
          return next
        })
      }, 800)
    }

    ydoc.on('update', refreshUpdatedAt)

    return () => {
      ydoc.off('update', refreshUpdatedAt)
      if (updateTimestampTimer.current) window.clearTimeout(updateTimestampTimer.current)
      updateTimestampTimer.current = null
    }
  }, [ydoc, selectedDocId])

  useEffect(() => {
    const syncCollaboratorCount = () => {
      setCollaboratorCount(provider.awareness.getStates().size)
    }

    syncCollaboratorCount()
    provider.awareness.on('change', syncCollaboratorCount)

    return () => {
      provider.awareness.off('change', syncCollaboratorCount)
    }
  }, [provider])

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ history: false }),
        Collaboration.configure({ document: ydoc }),
        CollaborationCursor.configure({ provider, user: user ? { name: user.name, color: user.color } : { name: randomName(), color: randomColor() } }),
      ],
      editorProps: {
        attributes: {
          class: 'editor',
        },
      },
    },
    [ydoc, provider, user?.name, user?.color],
  )

  if (!user) {
    return (
      <AuthScreen
        onLogin={(name) => {
          const next = { id: uid(), name, color: randomColor() }
          saveUser(next)
          setUser(next)
        }}
      />
    )
  }

  const createDoc = () => {
    if (!newTitle.trim()) return
    const doc: DocItem = {
      id: `${newTitle.toLowerCase().replace(/\s+/g, '-')}-${uid()}`,
      title: newTitle.trim(),
      updatedAt: Date.now(),
    }
    const next = [doc, ...docs]
    setDocs(next)
    saveDocs(next)
    setSelectedDocId(doc.id)
    setNewTitle('')
  }

  const deleteDoc = (docId: string) => {
    if (docs.length === 1) return
    const next = docs.filter((d) => d.id !== docId)
    setDocs(next)
    saveDocs(next)
    setPendingDeleteDocId(null)
    if (selectedDocId === docId) setSelectedDocId(next[0].id)
  }

  const requestDeleteDoc = (docId: string) => {
    if (docs.length === 1) return

    if (pendingDeleteDocId === docId) {
      deleteDoc(docId)
      return
    }

    setPendingDeleteDocId(docId)

    if (deleteConfirmTimer.current) window.clearTimeout(deleteConfirmTimer.current)
    deleteConfirmTimer.current = window.setTimeout(() => {
      setPendingDeleteDocId(null)
    }, 2500)
  }

  const copyRoomId = async () => {
    if (!selectedDoc?.id) return

    let copied = false

    if (window.isSecureContext && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(selectedDoc.id)
        copied = true
      } catch {
        copied = false
      }
    }

    if (!copied) {
      copied = legacyCopyText(selectedDoc.id)
    }

    setCopyStatus(copied ? 'success' : 'error')

    if (copyStatusTimer.current) window.clearTimeout(copyStatusTimer.current)
    copyStatusTimer.current = window.setTimeout(() => setCopyStatus('idle'), 1800)
  }

  return (
    <main className="container">
      <header className="topbar">
        <div>
          <h1>SyncScribe · Real-time Collaborative Editor</h1>
          <p className="sub">Yjs + Tiptap + WebRTC · 로그인/문서목록/협업 2단계 구현</p>
        </div>
        <div className="profile">
          <span className="dot" style={{ backgroundColor: user.color }} aria-hidden="true" />
          <strong>{user.name}</strong>
          <button
            className="ghost"
            onClick={() => {
              localStorage.removeItem(USER_KEY)
              setUser(null)
            }}
          >
            로그아웃
          </button>
        </div>
      </header>

      <section className="layout">
        <aside className="sidebar card">
          <h3>Documents</h3>
          <div className="createDoc">
            <label htmlFor="new-doc-title" className="srOnly">새 문서 제목</label>
            <input
              id="new-doc-title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="새 문서 제목"
              aria-label="새 문서 제목"
              onKeyDown={(e) => {
                if (e.key === 'Enter') createDoc()
              }}
            />
            <button onClick={createDoc} aria-label="새 문서 생성">생성</button>
          </div>

          <ul className="docList">
            {docs.map((doc) => (
              <li key={doc.id} className={doc.id === selectedDocId ? 'active' : ''}>
                <button
                  className="docBtn"
                  onClick={() => setSelectedDocId(doc.id)}
                  aria-current={doc.id === selectedDocId ? 'true' : undefined}
                  aria-label={`${doc.title} 문서 열기`}
                >
                  <span>{doc.title}</span>
                  <small>{new Date(doc.updatedAt).toLocaleDateString()}</small>
                </button>
                <button
                  className={`delBtn ${pendingDeleteDocId === doc.id ? 'confirm' : ''}`}
                  onClick={() => requestDeleteDoc(doc.id)}
                  title={docs.length === 1 ? '최소 1개 문서는 유지해야 합니다.' : pendingDeleteDocId === doc.id ? '한 번 더 누르면 삭제됩니다.' : '문서 삭제'}
                  aria-label={`${doc.title} 문서 ${pendingDeleteDocId === doc.id ? '삭제 확인' : '삭제'}`}
                  disabled={docs.length === 1}
                >
                  {pendingDeleteDocId === doc.id ? '확인' : '×'}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="editorWrap">
          <section className="toolbar" aria-live="polite">
            <div className="roomInfo">
              <label htmlFor="room-id" className="srOnly">현재 Room ID</label>
              <span className="roomIdLabel">Room ID</span>
              <input
                id="room-id"
                className="roomIdInput"
                value={selectedDoc?.id ?? ''}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
                aria-label="현재 Room ID"
              />
              <button className="ghost copyBtn" onClick={copyRoomId} aria-label="Room ID 복사">
                {copyStatus === 'success' ? '복사됨' : 'Room ID 복사'}
              </button>
              <span className={`copyStatus ${copyStatus}`} role="status">
                {copyStatus === 'success'
                  ? '클립보드에 복사되었습니다.'
                  : copyStatus === 'error'
                    ? '복사 권한이 없어 수동 복사가 필요합니다.'
                    : ''}
              </span>
            </div>
            <span className="presence">현재 접속자 {collaboratorCount}명</span>
          </section>

          <section className="card">
            <EditorContent editor={editor} />
          </section>

          <ul className="notes">
            <li>같은 Room ID로 여러 탭/기기에서 접속하면 실시간 동기화됩니다.</li>
            <li>브라우저 저장소(IndexDB)로 오프라인 복구를 지원합니다.</li>
            <li>문서 목록/로그인 상태는 로컬 스토리지에 저장됩니다.</li>
          </ul>
        </section>
      </section>
    </main>
  )
}

export default App
