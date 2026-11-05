import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, expect, it, vi } from 'vitest'
import { agentSessionFailureWords } from '../../../../src/shared/agent-session/failures/agent-session-failure-words'
import { agentJournalItemKey } from '../../../../src/shared/agent-session/journal/agent-session-journal-item-key'
import type { AgentJournalRenderItem } from '../../../../src/shared/agent-session/journal/agent-session-journal-types'
import type { RpcClient } from '../../transport/rpc-client'
import { stubRpcClient } from '../../transport/rpc-client-test-stub'
import type { StructuredAgentSessionHostSupport } from '../mobile-structured-agent-session-host-support'
import { useMobileNativeChatUsageLimit } from './use-mobile-native-chat-usage-limit'

vi.mock('../../hooks/use-now', () => ({ useNow: () => Date.now() }))

const TURN = agentJournalItemKey({ provider: 'claude', threadId: 't', turnId: 'cut', ordinal: 1 })
const RESETS_AT = Date.now() + 60 * 60 * 1000

const limitedChat: AgentJournalRenderItem[] = [
  {
    itemId: TURN,
    revision: 2,
    sequence: 1,
    observedAt: 1,
    body: {
      kind: 'turn',
      turnId: 'cut',
      state: 'completed',
      outcome: 'failure',
      startedAt: 1,
      completedAt: 5
    }
  },
  {
    itemId: 'limit-row',
    revision: 1,
    sequence: 2,
    observedAt: 6,
    turnScope: { kind: 'turn', turnItemId: TURN },
    body: {
      kind: 'status',
      ...agentSessionFailureWords(
        { kind: 'usageLimitReached', usageLimit: { window: 'session', resetsAt: RESETS_AT } },
        { surface: 'row' }
      )
    }
  }
]

let latest: ReturnType<typeof useMobileNativeChatUsageLimit> | undefined
let renderer: ReactTestRenderer | undefined
afterEach(() => act(() => renderer?.unmount()))

function mount(client: RpcClient, support: Partial<StructuredAgentSessionHostSupport>) {
  function Probe() {
    latest = useMobileNativeChatUsageLimit(
      {
        client,
        sessionId: 'session-1',
        enabled: true,
        connected: true,
        hostSupport: support as StructuredAgentSessionHostSupport
      },
      { items: limitedChat, submissions: [] },
      { busy: false, canSwitchAccount: true }
    )
    return null
  }
  act(() => {
    renderer = create(createElement(Probe))
  })
}

function hostScheduling() {
  const send = vi.fn<RpcClient['sendRequest']>(async () => ({
    ok: true as const,
    result: { ok: true },
    id: 'r',
    _meta: { runtimeId: 'host' }
  }))
  const client = stubRpcClient({
    sendRequest: send,
    subscribe: (_method, _params, onData) => {
      onData({
        type: 'snapshot',
        sessions: [
          {
            sessionId: 'session-1',
            workspaceId: 'workspace-1',
            agent: 'claude',
            status: 'idle',
            updatedAt: 1,
            usageLimitContinue: { turnItemId: TURN, resetsAt: RESETS_AT, state: 'scheduled' }
          }
        ]
      })
      return () => {}
    }
  })
  return { client, send }
}

it("shows the host's automatic continue and cancels it with the cut's identity", async () => {
  const { client, send } = hostScheduling()
  mount(client, { statusFeed: true, usageLimitAutoContinue: true, usageLimitContinueCancel: true })

  expect(latest).toMatchObject({
    turnItemId: TURN,
    canSwitchAccount: true,
    autoContinue: { kind: 'scheduled', resetsAt: RESETS_AT, cancelling: false }
  })
  const scheduled = latest?.autoContinue
  await act(async () => {
    if (scheduled?.kind === 'scheduled') {
      scheduled.cancel?.()
    }
  })
  expect(send).toHaveBeenCalledWith(
    'agentSession.cancelUsageLimitContinue',
    { sessionId: 'session-1', turnItemId: TURN, resetsAt: RESETS_AT },
    expect.anything()
  )
})

it("offers no Don't continue on a host that refuses it from a phone", () => {
  const { client } = hostScheduling()
  mount(client, { statusFeed: true, usageLimitAutoContinue: true })

  expect(latest?.autoContinue).toMatchObject({ kind: 'scheduled', cancel: null })
})
