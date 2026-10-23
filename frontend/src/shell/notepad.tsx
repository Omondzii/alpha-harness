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
      } ${open ? 'bg-surface-4 font-medium text-ink' : 'text-ink-muted'}`}
    >
      <NotebookPenIcon className="size-4 shrink-0" aria-hidden />
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
    save({ alphaId: id, remark: remark.trim() })
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
      className="fixed bottom-3 left-3 z-50 flex max-h-[min(70vh,36rem)] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-lg border border-hairline-strong bg-surface-2 shadow-float"
    >
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
        <div className="min-w-0">
          <h2 id="alpha-notepad-title" className="text-title font-medium text-ink">
            Alpha notepad
          </h2>
          <p className="text-caption text-ink-subtle">Keep IDs and quick remarks on this device.</p>
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
      <form onSubmit={addNote} className="flex flex-col gap-2 border-b border-hairline p-3">
        <Field label="Alpha ID">
          <Input
            value={alphaId}
            onChange={(event) => setAlphaId(event.target.value)}
            placeholder="Paste an Alpha ID"
            autoComplete="off"
            autoFocus
          />
        </Field>
        <Field label="Remark">
          <Textarea
            value={remark}
            onChange={(event) => setRemark(event.target.value)}
            placeholder="A short note (optional)"
            rows={2}
            className="min-h-16 resize-y"
          />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" variant="primary" size="sm" disabled={!alphaId.trim()}>
            Save Alpha
          </Button>
        </div>
      </form>
      <div className="flex items-center justify-between gap-2 border-b border-hairline px-3 py-2">
        <span className="text-caption text-ink-subtle">
          {entries.length} {entries.length === 1 ? 'Alpha' : 'Alphas'}
        </span>
        <Button
          size="sm"
          disabled={entries.length === 0}
          onClick={() =>
            copy(
              entries.map((entry) => entry.alphaId).join('\n'),
              `Copied ${entries.length} Alpha IDs`,
            )
          }
        >
          <CopyIcon /> Copy all IDs
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <p className="p-4 text-body-compact text-ink-subtle">
            Add an Alpha ID above to start your notepad.
          </p>
        ) : (
          <ul className="divide-y divide-hairline">
            {entries.map((entry) => (
              <li key={entry.alphaId} className="flex min-w-0 items-start gap-2 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="num break-all text-body-compact font-medium text-ink">
                    {entry.alphaId}
                  </p>
                  {entry.remark && (
                    <p className="mt-1 whitespace-pre-wrap break-words text-caption text-ink-muted">
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
