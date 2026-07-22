'use client'

import type { UIMessage } from 'ai'
import { Link2 } from 'lucide-react'
import { Markdown } from '@/components/markdown'
import { cn } from '@/lib/utils'

export function ChatMessage({ message }: { message: UIMessage }) {
  const isUser = message.role === 'user'

  const text = message.parts
    .map((p) => (p.type === 'text' ? p.text : ''))
    .join('')

  const sources = message.parts.filter((p) => p.type === 'source-url')

  // De-duplicate sources by hostname + url.
  const uniqueSources = Array.from(
    new Map(sources.map((s) => [s.url, s])).values(),
  )

  return (
    <div className={cn('flex w-full flex-col gap-2', isUser ? 'items-end' : 'items-start')}>
      <div className="flex items-center gap-2 px-1">
        <span
          className={cn(
            'text-xs font-medium uppercase tracking-wider',
            isUser ? 'text-muted-foreground' : 'text-primary',
          )}
        >
          {isUser ? 'You' : 'Jarvis'}
        </span>
      </div>

      <div
        className={cn(
          'max-w-[90%] rounded-2xl px-4 py-3 text-pretty sm:max-w-[80%]',
          isUser
            ? 'rounded-tr-sm bg-secondary text-secondary-foreground'
            : 'rounded-tl-sm border border-border bg-card',
        )}
      >
        {isUser ? (
          <p className="text-[0.95rem] leading-relaxed whitespace-pre-wrap">{text}</p>
        ) : text ? (
          <Markdown>{text}</Markdown>
        ) : (
          <ThinkingDots />
        )}
      </div>

      {!isUser && uniqueSources.length > 0 && (
        <div className="flex max-w-[90%] flex-col gap-2 sm:max-w-[80%]">
          <span className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Sources
          </span>
          <div className="flex flex-wrap gap-2">
            {uniqueSources.map((source, i) => (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="group inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                <Link2 className="size-3 text-primary" />
                <span className="max-w-[200px] truncate">
                  {source.title || safeHostname(source.url)}
                </span>
                <span className="text-primary/70">{i + 1}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function safeHostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 py-1" aria-label="Jarvis is thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 animate-pulse rounded-full bg-primary"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  )
}
