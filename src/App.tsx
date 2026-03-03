import { useMemo, useState } from 'react'
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
  return raw ? (JSON.parse(raw) as UserProfile) : null
}

function saveUser(user: UserProfile) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

function loadDocs() {
  const raw = localStorage.getItem(DOCS_KEY)
  if (!raw) return defaultDocs()
  try {
    const parsed = JSON.parse(raw) as DocItem[]
    return parsed.length ? parsed : defaultDocs()
  } catch {
    return defaultDocs()
  }
}

function saveDocs(docs: DocItem[]) {
  localStorage.setItem(DOCS_KEY, JSON.stringify(docs))
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
  const [selectedDocId, setSelectedDocId] = useState<string>(() => loadDocs()[0]?.id ?? 'jobhunt-frontend-room')
  const [newTitle, setNewTitle] = useState('')

  const selectedDoc = docs.find((d) => d.id === selectedDocId) ?? docs[0]

  const { ydoc, provider } = useMemo(() => {
    const room = selectedDoc?.id ?? 'jobhunt-frontend-room'
    const ydoc = new Y.Doc()

    new IndexeddbPersistence(`syncscribe-${room}`, ydoc)

    const provider = new WebrtcProvider(room, ydoc)

    if (user) {
      provider.awareness.setLocalStateField('user', { name: user.name, color: user.color })
    }

    return { ydoc, provider }
  }, [selectedDoc?.id, user])

  const editor = useEditor({
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
  })

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
    if (selectedDocId === docId) setSelectedDocId(next[0].id)
  }

  return (
    <main className="container">
      <header className="topbar">
        <div>
          <h1>SyncScribe · Real-time Collaborative Editor</h1>
          <p className="sub">Yjs + Tiptap + WebRTC · 로그인/문서목록/협업 2단계 구현</p>
        </div>
        <div className="profile">
          <span className="dot" style={{ backgroundColor: user.color }} />
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
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="새 문서 제목"
              onKeyDown={(e) => {
                if (e.key === 'Enter') createDoc()
              }}
            />
            <button onClick={createDoc}>생성</button>
          </div>

          <ul className="docList">
            {docs.map((doc) => (
              <li key={doc.id} className={doc.id === selectedDocId ? 'active' : ''}>
                <button className="docBtn" onClick={() => setSelectedDocId(doc.id)}>
                  <span>{doc.title}</span>
                  <small>{new Date(doc.updatedAt).toLocaleDateString()}</small>
                </button>
                <button className="delBtn" onClick={() => deleteDoc(doc.id)} title="문서 삭제">
                  ×
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="editorWrap">
          <section className="toolbar">
            <span>Room ID: <b>{selectedDoc?.id}</b></span>
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
