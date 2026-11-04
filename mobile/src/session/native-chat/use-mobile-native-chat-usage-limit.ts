import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import {
  isNativeChatUsageLimitCutSchedulable,
  latestNativeChatUsageLimitCut
} from '../../../../src/shared/native-chat/native-chat-usage-limit-cut'
import {
  nativeChatUsageLimitAutoContinueKind,
  usageLimitContinueStateForCut
} from '../../../../src/shared/native-chat/native-chat-usage-limit-auto-continue'
import type {
  AgentJournalRenderItem,
  AgentJournalSubmission
} from '../../../../src/shared/agent-session/journal/agent-session-journal-types'
import { useNow } from '../../hooks/use-now'
import { mobileStructuredSessionStatusFeed } from '../mobile-structured-session-status-feed'
import { callAgentSession } from '../mobile-structured-agent-session-rpc'
import type { MobileStructuredAgentSessionArgs } from '../mobile-structured-agent-session-contract'

export type MobileNativeChatUsageLimitAutoContinue =
  | {
      kind: 'scheduled'
      resetsAt: number
      /** Null on a host that refuses "Don't continue" from a phone. */
      cancel: (() => void) | null
      cancelling: boolean
      cancelFailed: boolean
    }
  | { kind: 'cancelled' }

/** The usage-limit row the person can act on: the latest cut while nothing is running or sending. */
export type MobileNativeChatUsageLimit = {
  turnItemId: string
  autoContinue: MobileNativeChatUsageLimitAutoContinue | null
  /** The host says this chat's next turn can run on another of its Claude accounts. */
  canSwitchAccount: boolean
}

const noSubscription = (): (() => void) => () => {}

export function useMobileNativeChatUsageLimit(
  chat: Pick<
    MobileStructuredAgentSessionArgs,
    'client' | 'sessionId' | 'enabled' | 'connected' | 'hostSupport'
  >,
  journal: {
    items: readonly AgentJournalRenderItem[]
    submissions: readonly Pick<AgentJournalSubmission, 'dispatchState'>[]
  },
  /** Busy: working or sending, when the cut is not the chat's last word. */
  turn: { busy: boolean; canSwitchAccount: boolean | undefined }
): MobileNativeChatUsageLimit | null {
  const { client, sessionId, hostSupport } = chat
  const { items, submissions } = journal
  const cut = useMemo(() => latestNativeChatUsageLimitCut(items, submissions), [items, submissions])
  const turnItemId = cut && !turn.busy ? cut.turnItemId : null
  const resetsAt = cut?.resetsAt
  // The host alone continues the chat at its reset; the phone only shows and cancels that.
  const feed =
    chat.enabled &&
    chat.connected &&
    client &&
    sessionId &&
    turnItemId !== null &&
    resetsAt !== undefined &&
    hostSupport?.statusFeed === true &&
    hostSupport.usageLimitAutoContinue === true
      ? mobileStructuredSessionStatusFeed(client)
      : null
  const subscribe = useCallback(
    (listener: () => void) => (feed ? feed.subscribe(listener) : noSubscription()),
    [feed]
  )
  const readState = useCallback(
    () =>
      feed && sessionId
        ? usageLimitContinueStateForCut(feed.getSnapshot().get(sessionId)?.usageLimitContinue, cut)
        : undefined,
    [feed, sessionId, cut]
  )
  const state = useSyncExternalStore(subscribe, readState, readState)
  // A row on screen when its cut ages out hides the automatic line.
  const now = useNow(60_000, state !== undefined)
  const schedulable = cut !== null && isNativeChatUsageLimitCutSchedulable(cut, now)
  const kind = nativeChatUsageLimitAutoContinueKind(state, { schedulable, localHost: false })
  const [cancelling, setCancelling] = useState(false)
  const [failedCut, setFailedCut] = useState<string | null>(null)
  const cancel = useCallback(() => {
    // Read the feed now: the schedule may have changed since this row last rendered.
    if (
      cancelling ||
      !client ||
      !sessionId ||
      cut?.resetsAt === undefined ||
      readState() !== 'scheduled'
    ) {
      return
    }
    const failed = cut.turnItemId
    setCancelling(true)
    setFailedCut(null)
    void callAgentSession(client, 'agentSession.cancelUsageLimitContinue', {
      sessionId,
      turnItemId: cut.turnItemId,
      resetsAt: cut.resetsAt
    })
      .catch(() => setFailedCut(failed))
      .finally(() => setCancelling(false))
  }, [cancelling, client, sessionId, cut, readState])
  const canCancel = hostSupport?.usageLimitContinueCancel === true
  return useMemo(() => {
    if (turnItemId === null) {
      return null
    }
    const autoContinue: MobileNativeChatUsageLimitAutoContinue | null =
      kind === 'scheduled' && resetsAt !== undefined
        ? {
            kind,
            resetsAt,
            cancel: canCancel ? cancel : null,
            cancelling,
            cancelFailed: failedCut === turnItemId
          }
        : kind === 'cancelled'
          ? { kind }
          : null
    return { turnItemId, autoContinue, canSwitchAccount: turn.canSwitchAccount === true }
  }, [turnItemId, kind, resetsAt, canCancel, cancel, cancelling, failedCut, turn.canSwitchAccount])
}
