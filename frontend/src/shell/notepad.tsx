import { CopyIcon, NotebookPenIcon, Trash2Icon, XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { errorMessage } from '@/api/http'
import { Button, Field, Input, Textarea } from '@/ui/kit'

interface AlphaNote {
  alphaId: string
  remark: string
  savedAt?: number
}

const CLOCK = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })
const SHORT_DATE = new Intl.DateTimeFormat(undefined, {
  month: 'numeric',
  day: 'numeric',
  year: '2-digit',
})

function timelineLabel(savedAt: number | undefined): string {
  if (savedAt == null || !Number.isFinite(savedAt)) return '—'
  const date = new Date(savedAt)
  if (Number.isNaN(date.getTime())) return '—'
  const now = new Date()
  const age = Date.now() - savedAt
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  return isToday || (age >= 0 && age < 24 * 60 * 60 * 1000)
    ? CLOCK.format(date)
    : SHORT_DATE.format(date)
}

function timelineIso(savedAt: number | undefined): string | undefined {
  if (savedAt == null || !Number.isFinite(savedAt)) return undefined
  const date = new Date(savedAt)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

const useAlphaNotepad = create<{
  open: boolean
  entries: AlphaNote[]
  setOpen: (open: boolean) => void
  save: (note: AlphaNote) => void
  remove: (alphaId: string) => void
}>()(
  persist(
    (set) => ({
      open: false,
      entries: [],
      setOpen: (open) => set({ open }),
      save: (note) =>
        set((state) => {
          const existing = state.entries.findIndex((entry) => entry.alphaId === note.alphaId)
          if (existing < 0) return { entries: [note, ...state.entries] }
          return {
            entries: state.entries.map((entry, index) => (index === existing ? note : entry)),
          }
        }),
      remove: (alphaId) =>
        set((state) => ({ entries: state.entries.filter((entry) => entry.alphaId !== alphaId) })),
    }),
    { name: 'alpha-harness-alpha-notepad', partialize: (state) => ({ entries: state.entries }) },
  ),
)

export function AlphaNotepadToggle({ collapsed }: { collapsed: boolean }) {
  const open = useAlphaNotepad((state) => state.open)
  const setOpen = useAlphaNotepad((state) => state.setOpen)
  const count = useAlphaNotepad((state) => state.entries.length)

  return (
    <button
      type="button"
      aria-label="Alpha notepad"
      aria-expanded={open}
      title="Alpha notepad"
      onClick={() => setOpen(!open)}
      className={`group flex h-8 items-center gap-3 rounded-md text-body transition-colors hover:bg-surface-3 hover:text-ink ${
        collapsed ? 'justify-center' : 'px-2'
      } ${open ? 'bg-primary-subtle font-medium text-primary' : 'text-ink-muted'}`}
    >
      <NotebookPenIcon className={`size-4 shrink-0 ${open ? 'text-primary' : ''}`} aria-hidden />
      {!collapsed && <span className="flex-1 truncate text-left">Alpha notepad</span>}
      {!collapsed && count > 0 && (
        <span className="num rounded-pill border border-hairline bg-surface-2 px-1.5 py-0.5 text-caption text-ink-subtle">
          {count}
        </span>
      )}
    </button>
  )
}

export function AlphaNotepadPanel() {
  const open = useAlphaNotepad((state) => state.open)
  const setOpen = useAlphaNotepad((state) => state.setOpen)
  const entries = useAlphaNotepad((state) => state.entries)
  const save = useAlphaNotepad((state) => state.save)
  const remove = useAlphaNotepad((state) => state.remove)
  const [alphaId, setAlphaId] = useState('')
  const [remark, setRemark] = useState('')

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [open, setOpen])

  if (!open) return null

  const addNote = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const id = alphaId.trim()
    if (!id) return
    save({ alphaId: id, remark: remark.trim(), savedAt: Date.now() })
    setAlphaId('')
    setRemark('')
  }

  const copy = async (text: string, description: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(description)
    } catch (error) {
      toast.error('Could not copy Alpha IDs', { description: errorMessage(error) })
    }
  }

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="alpha-notepad-title"
      className="fixed bottom-3 left-3 z-50 flex max-h-[min(60vh,30rem)] w-[min(22rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-lg border border-hairline-strong bg-surface-1 shadow-float"
    >
      <header className="flex items-center justify-between gap-3 border-b border-hairline bg-surface-2 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-subtle text-primary">
            <NotebookPenIcon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id="alpha-notepad-title" className="text-body font-normal text-ink">
              Alpha notepad
            </h2>
            <p className="text-[10px] font-normal text-ink-subtle">
              Keep IDs and quick remarks on this device.
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close alpha notepad"
          onClick={() => setOpen(false)}
        >
          <XIcon />
        </Button>
      </header>
      <form
        onSubmit={addNote}
        className="flex flex-col gap-1.5 border-b border-hairline bg-surface-2 p-2.5"
      >
        <Field
          label="Alpha ID"
          className="[&>span:first-child]:text-[10px] [&>span:first-child]:font-normal [&>span:first-child]:text-ink-subtle"
        >
          <Input
            value={alphaId}
            onChange={(event) => setAlphaId(event.target.value)}
            placeholder="Paste an Alpha ID"
            autoComplete="off"
            autoFocus
            className="num text-body-compact"
          />
        </Field>
        <Field
          label="Remark"
          className="[&>span:first-child]:text-[10px] [&>span:first-child]:font-normal [&>span:first-child]:text-ink-subtle"
        >
          <Textarea
            value={remark}
            onChange={(event) => setRemark(event.target.value)}
            placeholder="A short note (optional)"
            rows={2}
            className="min-h-12 resize-y text-body-compact"
          />
        </Field>
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!alphaId.trim()}
            className="text-caption font-normal"
          >
            Save Alpha
          </Button>
        </div>
      </form>
      <div className="flex items-center gap-1.5 border-b border-hairline bg-surface-1 px-2.5 py-1.5">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-normal text-ink-subtle">
          <NotebookPenIcon className="size-3 text-primary" aria-hidden />
          {entries.length} {entries.length === 1 ? 'Alpha' : 'Alphas'}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <p className="p-3 text-caption font-normal text-ink-subtle">
            Add an Alpha ID above to start your notepad.
          </p>
        ) : (
          <ul className="flex flex-col px-2 py-1">
            {[...entries]
              .sort((a, b) => (a.savedAt ?? 0) - (b.savedAt ?? 0))
              .map((entry, index, timeline) => (
                <li
                  key={entry.alphaId}
                  className="grid min-w-0 grid-cols-[2.75rem_0.75rem_minmax(0,1fr)] gap-1.5 py-1"
                >
                  <time
                    dateTime={timelineIso(entry.savedAt)}
                    className="num pt-2 text-right text-[10px] font-normal text-ink-subtle"
                  >
                    {timelineLabel(entry.savedAt)}
                  </time>
                  <span className="relative flex justify-center">
                    {index < timeline.length - 1 && (
                      <span className="absolute top-2 bottom-0 w-px bg-hairline-strong" />
                    )}
                    <span className="relative z-10 mt-2 size-2 rounded-pill border border-primary/40 bg-primary-subtle" />
                  </span>
                  <div className="flex min-w-0 items-start gap-1.5 rounded-md border border-hairline bg-surface-2 px-2 py-1.5 transition-colors hover:bg-surface-3">
                    <div className="min-w-0 flex-1">
                      <p className="num break-all text-caption font-normal text-ink-muted">
                        {entry.alphaId}
                      </p>
                      {entry.remark && (
                        <p className="mt-1 whitespace-pre-wrap break-words text-[10px] font-normal text-ink-subtle">
                          {entry.remark}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Copy ${entry.alphaId}`}
                      title="Copy Alpha ID"
                      onClick={() => copy(entry.alphaId, `Copied ${entry.alphaId}`)}
                    >
                      <CopyIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${entry.alphaId}`}
                      title="Remove Alpha"
                      onClick={() => remove(entry.alphaId)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </div>
    </section>
  )
}
