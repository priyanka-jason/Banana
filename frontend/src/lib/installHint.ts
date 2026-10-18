// Whether to suggest installing Banana to the home screen, and how.
// 'prompt': the browser offered its own install dialog (Android Chrome, Edge).
// 'ios': iPhone/iPad Safari, which has no dialog; people use Share → Add to Home Screen.
export type InstallHintKind = 'none' | 'prompt' | 'ios'

export const INSTALL_HINT_DISMISSED_KEY = 'banana.installHintDismissed'

export interface InstallContext {
  /** Already running as an installed app. */
  standalone: boolean
  /** The browser fired beforeinstallprompt. */
  canPrompt: boolean
  userAgent: string
  /** navigator.maxTouchPoints; iPads report a Mac user agent but have touch. */
  maxTouchPoints: number
  /** Touch-first screen; desktops don't get the hint. */
  coarsePointer: boolean
  dismissed: boolean
}

export function isIosSafari(userAgent: string, maxTouchPoints: number) {
  const apple =
    /iPhone|iPad|iPod/.test(userAgent) ||
    (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
  // Other iOS browsers (Chrome, Firefox, Edge) can add to the home screen too,
  // but through different menus, so the Safari wording would be wrong there.
  return apple && !/CriOS|FxiOS|EdgiOS/.test(userAgent)
}

export function installHintKind(context: InstallContext): InstallHintKind {
  if (context.standalone || context.dismissed || !context.coarsePointer)
    return 'none'
  if (context.canPrompt) return 'prompt'
  if (isIosSafari(context.userAgent, context.maxTouchPoints)) return 'ios'
  return 'none'
}
