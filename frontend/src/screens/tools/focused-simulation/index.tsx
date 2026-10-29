import { useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Button, Field, Input, Page, PageHeader, Panel } from '@/ui/kit'

export function FocusedSimulationToolPickerScreen() {
  const navigate = useNavigate()
  const search = useSearch({ from: '/tools/focused-simulation' })
  const [alphaId, setAlphaId] = useState('')

  useEffect(() => setAlphaId(search.alpha ?? ''), [search.alpha])

  const open = (event: React.FormEvent) => {
    event.preventDefault()
    const id = alphaId.trim()
    if (!id) return
    void navigate({ to: '/tools/focused-simulation/$alphaId', params: { alphaId: id } })
  }

  return (
    <Page>
      <PageHeader
        title="Focused Simulation"
        description="Choose an Alpha to edit a private simulation draft and run it with custom settings."
      />
      <Panel title="Choose an Alpha">
        <form onSubmit={open} className="flex flex-wrap items-end gap-3">
          <Field label="Alpha ID" className="min-w-48 flex-1">
            <Input
              autoFocus
              value={alphaId}
              onChange={(event) => setAlphaId(event.target.value)}
              spellCheck={false}
              className="num"
            />
          </Field>
          <Button type="submit" variant="primary" disabled={!alphaId.trim()}>
            Open simulation
          </Button>
        </form>
      </Panel>
    </Page>
  )
}
