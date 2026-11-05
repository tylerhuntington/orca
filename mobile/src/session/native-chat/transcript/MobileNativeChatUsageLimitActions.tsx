import { useContext } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import {
  colors,
  feedback,
  pressedStyle,
  radii,
  spacing,
  typography
} from '../../../theme/mobile-theme'
import { themedStyleSheet } from '../../../theme/themed-styles'
import { useMobileColorScheme } from '../../../theme/use-mobile-color-scheme'
import { useMobileTranslation } from '../../../i18n/use-mobile-translation'
import { INLINE_TEXT_SELECTION } from '../../../components/inline-text-selection'
import { scaledType } from './mobile-native-chat-message-styles'
import { usageLimitResetClock } from './native-chat-usage-limit-copy'
import { MobileNativeChatUsageLimitContext } from './mobile-native-chat-usage-limit-context'

/** Desktop's usage-limit row actions: move the chat to another account, and the host's automatic continue. */
export function MobileNativeChatUsageLimitActions({
  turnItemId,
  fontScale
}: {
  turnItemId: string
  fontScale: number
}): React.JSX.Element | null {
  useMobileColorScheme()
  const t = useMobileTranslation()
  const { usageLimit, openAccounts } = useContext(MobileNativeChatUsageLimitContext)
  if (usageLimit?.turnItemId !== turnItemId) {
    return null
  }
  const { autoContinue } = usageLimit
  const switchAccount = usageLimit.canSwitchAccount ? openAccounts : null
  const meta = [styles.meta, scaledType(typography.metaSize, fontScale)]
  const switchLabel = t('chat.usageLimit.switchAccount', 'Switch Account')
  if (!switchAccount && !autoContinue) {
    return null
  }
  return (
    <View style={styles.actions}>
      {switchAccount ? (
        <View style={styles.row}>
          <Text style={meta}>
            {t('chat.usageLimit.continueWithoutWaiting', 'Continue this chat without waiting:')}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={switchLabel}
            onPress={switchAccount}
            style={({ pressed }) => [styles.button, pressed && pressedStyle]}
          >
            <Text style={[styles.buttonText, scaledType(typography.bodySize, fontScale)]}>
              {switchLabel}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {autoContinue?.kind === 'cancelled' ? (
        <Text selectable={INLINE_TEXT_SELECTION} style={meta}>
          {t(
            'chat.usageLimit.autoContinueCancelled',
            "Orca won't continue this chat automatically."
          )}
        </Text>
      ) : autoContinue ? (
        <View style={styles.row}>
          <Text selectable={INLINE_TEXT_SELECTION} style={meta}>
            {autoContinue.cancelFailed
              ? t(
                  'chat.usageLimit.autoContinueCancelFailed',
                  "Couldn't cancel automatic continuation. Try again."
                )
              : t(
                  'chat.usageLimit.autoContinueScheduled',
                  'Orca will continue this chat at {{time}}.',
                  {
                    time: usageLimitResetClock(autoContinue.resetsAt)
                  }
                )}
          </Text>
          {autoContinue.cancel ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: autoContinue.cancelling }}
              disabled={autoContinue.cancelling}
              hitSlop={spacing.sm}
              onPress={autoContinue.cancel}
              style={({ pressed }) => [
                autoContinue.cancelling && styles.disabled,
                pressed && pressedStyle
              ]}
            >
              <Text style={[styles.link, scaledType(typography.metaSize, fontScale)]}>
                {t('chat.usageLimit.autoContinueCancel', "Don't continue")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = themedStyleSheet(() => ({
  actions: {
    marginTop: spacing.sm,
    gap: spacing.sm
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.sm,
    rowGap: spacing.xs
  },
  meta: {
    color: colors.textMuted
  },
  link: {
    color: colors.textSecondary,
    textDecorationLine: 'underline'
  },
  button: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    justifyContent: 'center',
    backgroundColor: colors.bgRaised,
    borderRadius: radii.control,
    paddingHorizontal: spacing.md
  },
  buttonText: {
    color: colors.textPrimary,
    fontWeight: '600'
  },
  disabled: {
    opacity: feedback.disabledOpacity
  }
}))
