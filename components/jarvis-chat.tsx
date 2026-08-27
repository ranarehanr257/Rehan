'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { ArrowUp, Mic, MicOff, Square, Trash2, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ChatMessage } from '@/components/chat-message'
import { Button } from '@/components/ui/button'

const SUGGESTIONS = [
  'What is the latest news in AI?',
  "How's the weather in London right now?",
  'Summarize today’s stock market movement.',
  'What time is it in Tokyo?',
]

export function JarvisChat() {
  const { messages, sendMessage, status, stop, error } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  })
  const [input, setInput] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [voiceFile, setVoiceFile] = useState<File | null>(null)
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null)
  const recognitionRef = useRef<{ start: () => void; stop: () => void } | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const voiceChunksRef = useRef<Blob[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  const isBusy = status === 'submitted' || status === 'streaming'
  const hasMessages = messages.length > 0

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, status])

  useEffect(() => {
    return () => {
      if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl)
    }
  }, [voicePreviewUrl])

  function submit(text: string) {
    const value = text.trim()
    if (!value || isBusy) return
    sendMessage({ text: value })
    setInput('')
  }

  function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop()
      return
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setVoiceError('Audio recording is not supported in this browser.')
      return
    }

    setVoiceError(null)
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const recorder = new MediaRecorder(stream)
      voiceChunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) voiceChunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        const blob = new Blob(voiceChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const file = new File([blob], `jarvis-voice-${Date.now()}.webm`, { type: blob.type })
        setVoiceFile(file)
        setVoicePreviewUrl(URL.createObjectURL(blob))
        setRecording(false)
        recorderRef.current = null
      }
      recorder.start()
      recorderRef.current = recorder
      setRecording(true)
    }).catch(() => setVoiceError('Microphone access was denied. Please allow it and try again.'))
  }

  function clearVoiceFile() {
    setVoiceFile(null)
    setVoicePreviewUrl(null)
  }

  async function sendVoiceFile() {
    if (!voiceFile || isBusy) return
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(voiceFile)
    })
    sendMessage({ files: [{ type: 'file', mediaType: voiceFile.type, url: dataUrl, filename: voiceFile.name }] })
    clearVoiceFile()
  }

  function toggleListening() {
    if (isListening) {
      recognitionRef.current?.stop()
      return
    }

    type Recognition = {
      lang: string
      interimResults: boolean
      continuous: boolean
      onstart: (() => void) | null
      onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
      onerror: (() => void) | null
      onend: (() => void) | null
      start: () => void
      stop: () => void
    }
    type RecognitionConstructor = new () => Recognition
    const browserWindow = window as typeof window & {
      SpeechRecognition?: RecognitionConstructor
      webkitSpeechRecognition?: RecognitionConstructor
    }
    const SpeechRecognition = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setVoiceError('Voice input is not supported in this browser.')
      return
    }

    setVoiceError(null)
    const recognition = new SpeechRecognition()
    recognition.lang = navigator.language || 'en-US'
    recognition.interimResults = false
    recognition.continuous = false
    recognition.onstart = () => setIsListening(true)
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? ''
      setInput(transcript)
      submit(transcript)
    }
    recognition.onerror = () => {
      setIsListening(false)
      setVoiceError('I could not hear that, Sir. Please try again.')
    }
    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
    }
    recognitionRef.current = recognition
    recognition.start()
  }

  return (
    <div className="flex h-dvh flex-col">
      <Header online={!error} />

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6">
          {!hasMessages ? (
            <Welcome onPick={submit} disabled={isBusy} />
          ) : (
            <div className="flex flex-col gap-6">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {error && (
                <p className="text-sm text-destructive">
                  A connection error occurred, Sir. Please try again.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border bg-background/80 backdrop-blur">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit(input)
          }}
          className="mx-auto w-full max-w-3xl px-4 py-4"
        >
          {voicePreviewUrl && voiceFile && (
            <div className="mb-2 flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
              <Volume2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <audio className="h-8 min-w-0 flex-1" controls src={voicePreviewUrl} aria-label="Recorded voice message" />
              <Button type="button" size="icon" variant="ghost" onClick={clearVoiceFile} aria-label="Remove recorded voice message" className="size-8 shrink-0 rounded-lg">
                <Trash2 className="size-4" />
              </Button>
              <Button type="button" size="sm" onClick={sendVoiceFile} disabled={isBusy} className="shrink-0 rounded-lg">
                Send voice
              </Button>
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 focus-within:border-primary/50">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === 'Enter' &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing &&
                  e.keyCode !== 229
                ) {
                  e.preventDefault()
                  submit(input)
                }
              }}
              rows={1}
              placeholder="Command Jarvis…"
              aria-label="Message Jarvis"
              className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2 text-[0.95rem] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={toggleRecording}
              disabled={isBusy || isListening}
              aria-label={recording ? 'Stop recording voice message' : 'Record voice message'}
              aria-pressed={recording}
              className={`size-9 shrink-0 rounded-xl ${recording ? 'bg-destructive/15 text-destructive' : ''}`}
            >
              {recording ? <Square className="size-4" /> : <Volume2 className="size-4" />}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={toggleListening}
              disabled={isBusy}
              aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
              aria-pressed={isListening}
              className={`size-9 shrink-0 rounded-xl ${isListening ? 'bg-primary/15 text-primary' : ''}`}
            >
              {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            </Button>
            {isBusy ? (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={stop}
                aria-label="Stop generating"
                className="size-9 shrink-0 rounded-xl"
              >
                <Square className="size-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim()}
                aria-label="Send message"
                className="size-9 shrink-0 rounded-xl"
              >
                <ArrowUp className="size-4" />
              </Button>
            )}
          </div>
          {voiceError && <p className="mt-2 text-center text-xs text-destructive">{voiceError}</p>}
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Jarvis searches the web live and cites its sources. Verify anything critical.
          </p>
        </form>
      </div>
    </div>
  )
}

function Header({ online }: { online: boolean }) {
  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-3">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex size-9 items-center justify-center rounded-xl border border-primary/40 bg-primary/10">
            <span className="font-mono text-sm font-semibold text-primary">J</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Jarvis</span>
            <span className="text-xs text-muted-foreground">Personal AI Assistant</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`size-2 rounded-full ${online ? 'bg-primary' : 'bg-destructive'}`}
            aria-hidden
          />
          <span className="text-xs text-muted-foreground">{online ? 'Online' : 'Offline'}</span>
        </div>
      </div>
    </header>
  )
}

function Welcome({
  onPick,
  disabled,
}: {
  onPick: (text: string) => void
  disabled: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-10 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10">
        <span className="font-mono text-2xl font-semibold text-primary">J</span>
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-balance">Good day, Sir. Jarvis at your service.</h1>
        <p className="max-w-md text-pretty text-muted-foreground">
          Ask me anything. I answer with speed, accuracy, and live sources — from breaking news to
          weather, markets, and beyond.
        </p>
      </div>
      <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s)}
            className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
