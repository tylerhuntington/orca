import { createContext } from 'react'
import type { MobileNativeChatUsageLimit } from '../use-mobile-native-chat-usage-limit'

/** What the open chat's usage-limit row can offer; null when no row can be acted on. */
export type MobileNativeChatUsageLimitView = {
  usageLimit: MobileNativeChatUsageLimit | null
  /** Opens the accounts of the host that runs this chat; null when the phone can't reach them. */
  openAccounts: (() => void) | null
}

export const MobileNativeChatUsageLimitContext = createContext<MobileNativeChatUsageLimitView>({
  usageLimit: null,
  openAccounts: null
})
