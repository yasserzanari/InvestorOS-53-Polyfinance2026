"use client"

// From chatcn, chat, voice and agent UI for shadcn: https://chatcn.dev

import * as React from "react"
import { forwardRef, createElement, type SVGAttributes, type ForwardRefExoticComponent, type RefAttributes } from "react"
import { cn } from "../../../shared/utils"
import { Collapsible } from "@base-ui/react/collapsible"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

/** chatcn theme variables and utilities this file uses, light and dark. */
const CHATCN_CSS = ":root{--chatcn-accent:var(--chatcn-gray-1000);--chatcn-accent-fg:var(--chatcn-bg);--chatcn-alpha-100:oklch(0 0 0 / 0.03);--chatcn-alpha-300:oklch(0 0 0 / 0.08);--chatcn-alpha-500:oklch(0 0 0 / 0.14);--chatcn-alpha-600:oklch(0 0 0 / 0.2);--chatcn-amber:oklch(0.555 0.125 60);--chatcn-bg:oklch(1 0 0);--chatcn-bg-subtle:oklch(0.985 0 0);--chatcn-blue:oklch(0.550 0.180 258);--chatcn-border:var(--chatcn-gray-400);--chatcn-border-strong:var(--chatcn-gray-600);--chatcn-card:oklch(1 0 0);--chatcn-ease-in-out:cubic-bezier(0.77, 0, 0.175, 1);--chatcn-ease-out:cubic-bezier(0.23, 1, 0.32, 1);--chatcn-ease-standard:ease;--chatcn-enter-scale:0.96;--chatcn-exit-scale:0.98;--chatcn-fg:var(--chatcn-gray-1000);--chatcn-fg-faint:var(--chatcn-gray-700);--chatcn-fg-muted:var(--chatcn-gray-900);--chatcn-fg-subtle:var(--chatcn-gray-800);--chatcn-fill:var(--chatcn-gray-100);--chatcn-fill-hover:var(--chatcn-gray-200);--chatcn-gray-100:oklch(0.970 0 0);--chatcn-gray-1000:oklch(0.145 0 0);--chatcn-gray-200:oklch(0.950 0 0);--chatcn-gray-400:oklch(0.910 0 0);--chatcn-gray-600:oklch(0.800 0 0);--chatcn-gray-700:oklch(0.700 0 0);--chatcn-gray-800:oklch(0.525 0 0);--chatcn-gray-900:oklch(0.440 0 0);--chatcn-inset:oklch(0.975 0 0);--chatcn-press-scale:0.97;--chatcn-press-scale-icon:0.94;--chatcn-primary:var(--chatcn-gray-1000);--chatcn-primary-fg:var(--chatcn-bg);--chatcn-primary-hover:var(--chatcn-gray-900);--chatcn-radius-lg:12px;--chatcn-radius-md:8px;--chatcn-radius-sm:6px;--chatcn-radius-xl:16px;--chatcn-radius-xs:4px;--chatcn-red:oklch(0.560 0.200 27);--chatcn-scrim:oklch(0 0 0 / 0.32);--chatcn-scrollbar:var(--chatcn-alpha-500);--chatcn-scrollbar-hover:var(--chatcn-alpha-600);--chatcn-shadow-border:0 0 0 1px oklch(0 0 0 / 0.08);--chatcn-shadow-sm:0 0 0 1px oklch(0 0 0 / 0.06), 0 1px 2px -1px oklch(0 0 0 / 0.06), 0 2px 4px oklch(0 0 0 / 0.04);--chatcn-shadow-xl:0 0 0 1px oklch(0 0 0 / 0.06), 0 8px 16px -4px oklch(0 0 0 / 0.08), 0 32px 64px -12px oklch(0 0 0 / 0.18);--chatcn-shadow-xs:0 0 0 1px oklch(0 0 0 / 0.08), 0 1px 2px oklch(0 0 0 / 0.04);--chatcn-surface:oklch(1 0 0)}.dark{--chatcn-accent:var(--chatcn-gray-1000);--chatcn-accent-fg:var(--chatcn-bg);--chatcn-alpha-100:oklch(1 0 0 / 0.04);--chatcn-alpha-300:oklch(1 0 0 / 0.09);--chatcn-alpha-500:oklch(1 0 0 / 0.16);--chatcn-alpha-600:oklch(1 0 0 / 0.24);--chatcn-amber:oklch(0.800 0.140 74);--chatcn-bg:oklch(0.145 0 0);--chatcn-bg-subtle:oklch(0.178 0 0);--chatcn-blue:oklch(0.710 0.140 252);--chatcn-border:var(--chatcn-gray-400);--chatcn-border-strong:var(--chatcn-gray-600);--chatcn-card:oklch(0.175 0 0);--chatcn-fg:var(--chatcn-gray-1000);--chatcn-fg-faint:var(--chatcn-gray-700);--chatcn-fg-muted:var(--chatcn-gray-900);--chatcn-fg-subtle:var(--chatcn-gray-800);--chatcn-fill:var(--chatcn-gray-100);--chatcn-fill-hover:var(--chatcn-gray-200);--chatcn-gray-100:oklch(0.195 0 0);--chatcn-gray-1000:oklch(0.970 0 0);--chatcn-gray-200:oklch(0.225 0 0);--chatcn-gray-400:oklch(0.285 0 0);--chatcn-gray-600:oklch(0.410 0 0);--chatcn-gray-700:oklch(0.500 0 0);--chatcn-gray-800:oklch(0.620 0 0);--chatcn-gray-900:oklch(0.720 0 0);--chatcn-inset:oklch(0.155 0 0);--chatcn-primary:var(--chatcn-gray-1000);--chatcn-primary-fg:var(--chatcn-bg);--chatcn-primary-hover:var(--chatcn-gray-900);--chatcn-red:oklch(0.700 0.175 22);--chatcn-scrim:oklch(0 0 0 / 0.6);--chatcn-scrollbar:var(--chatcn-alpha-500);--chatcn-scrollbar-hover:var(--chatcn-alpha-600);--chatcn-shadow-border:0 0 0 1px oklch(1 0 0 / 0.08);--chatcn-shadow-sm:0 0 0 1px oklch(1 0 0 / 0.08), inset 0 1px 0 oklch(1 0 0 / 0.03), 0 2px 4px oklch(0 0 0 / 0.4);--chatcn-shadow-xl:0 0 0 1px oklch(1 0 0 / 0.1), inset 0 1px 0 oklch(1 0 0 / 0.05), 0 32px 64px -12px oklch(0 0 0 / 0.7);--chatcn-shadow-xs:0 0 0 1px oklch(1 0 0 / 0.08), 0 1px 2px oklch(0 0 0 / 0.4);--chatcn-surface:oklch(0.205 0 0)}.chatcn-focus{}.chatcn-focus:focus-visible{outline: 2px solid var(--chatcn-accent); outline-offset: 2px;}.chatcn-shimmer{color: transparent; background-image: linear-gradient(90deg, var(--chatcn-fg-subtle) 0%, var(--chatcn-fg-subtle) 40%, var(--chatcn-fg) 50%, var(--chatcn-fg-subtle) 60%, var(--chatcn-fg-subtle) 100%); background-size: 250% 100%; background-clip: text; -webkit-background-clip: text; animation: chatcn-shimmer 1.6s linear infinite;}.chatcn-spin{animation: chatcn-spin 0.8s linear infinite;}.chatcn-scroll{scrollbar-width: thin; scrollbar-color: var(--chatcn-scrollbar) transparent;}.chatcn-scroll:hover{scrollbar-color: var(--chatcn-scrollbar-hover) transparent;}.chatcn-scroll::-webkit-scrollbar{width: 10px; height: 10px;}.chatcn-scroll::-webkit-scrollbar-track, .chatcn-scroll::-webkit-scrollbar-corner{background: transparent;}.chatcn-scroll::-webkit-scrollbar-thumb{background-color: var(--chatcn-scrollbar); background-clip: content-box; border: 3px solid transparent; border-radius: 9999px;}.chatcn-scroll::-webkit-scrollbar-thumb:hover{background-color: var(--chatcn-scrollbar-hover);}@keyframes chatcn-spin { to { transform: rotate(360deg); } }@keyframes chatcn-shimmer { from { background-position: 100% 0; } to { background-position: 0% 0; } }@keyframes chatcn-enter { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }@media (prefers-reduced-motion: reduce){.chatcn-shimmer{animation:none;color:var(--chatcn-fg-subtle);background-image:none}}@media (prefers-reduced-motion: reduce){:root{--chatcn-press-scale:1;--chatcn-press-scale-icon:1;--chatcn-enter-scale:1}}"
if (typeof document !== "undefined" && !document.getElementById("chatcn-tool-browser")) {
  const style = document.createElement("style")
  style.id = "chatcn-tool-browser"
  style.textContent = CHATCN_CSS
  document.head.appendChild(style)
}

/**
 * chatcn message contract.
 *
 * A structural mirror of AI SDK 7 `UIMessage` parts with no runtime import, so an AI SDK message
 * can be passed straight in while assistant-ui, LangGraph, AG-UI or a static mock can be adapted
 * to the same shape. A type test pins this file to the installed `ai` package.
 */

/** Lifecycle of a tool call, identical to AI SDK 7 tool part states. */
type ToolState =
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-error"
  | "output-denied"

/** Human approval attached to a tool call. */
interface ChatcnApproval {
  id: string
  approved?: boolean
  /** Reason the user gave when responding (usually a denial). */
  reason?: string
  /** Reason the agent gave when asking. */
  requestReason?: string
}

/** A tool call: static (`tool-${name}`) or dynamic (`dynamic-tool` with `toolName`). */
export type ChatcnToolPart = {
  type: `tool-${string}` | "dynamic-tool"
  toolCallId: string
  /** Present on `dynamic-tool` parts. Use `getToolName` to read the name of any tool part. */
  toolName?: string
  state: ToolState
  title?: string
  /** Partial while `input-streaming`, complete afterwards. */
  input?: unknown
  /** Raw input text received so far: a string while `input-streaming` (AI SDK types it loosely). */
  rawInput?: unknown
  output?: unknown
  errorText?: string
  approval?: ChatcnApproval
  providerExecuted?: boolean
  /** True while an `output-available` result is still being refined. */
  preliminary?: boolean
}

/** Tool state as shown in the UI: adds `cancelled` for calls left unfinished by a stop. */
type ToolDisplayState = ToolState | "cancelled"

interface ToolCallApprovalRequest {
  /** Approval id from the runtime, passed back to `onApprove` and `onDeny`. */
  id: string
  /** Why the agent wants to run this tool. Shown above the actions. */
  reason?: React.ReactNode
}

/* -------------------------------------------------------------------------------------------------
 * Types
 * -----------------------------------------------------------------------------------------------*/

type ApprovalScope = "once" | "always"

interface ToolCallProps extends Omit<React.ComponentProps<"div">, "title"> {
  /** Tool name from the model, for example `edit_file`. Picks a default icon and label. */
  name: string
  /** Human label. Defaults to a readable version of `name`. */
  title?: React.ReactNode
  /** Short context next to the title, set in mono. A path, a query or a command. */
  detail?: React.ReactNode
  /** Override the tool icon. */
  icon?: React.ReactNode
  state: ToolDisplayState
  /** Parsed tool input. */
  input?: unknown
  /** Raw input text while it streams. Parsed tolerantly so partial JSON renders as it arrives. */
  inputText?: string
  /** Tool output. Strings render as text, anything else as JSON. Pass a node for a custom view. */
  output?: unknown
  /** What the output copy button copies. Defaults to the output as text; elements are not copied. */
  outputCopyValue?: string
  /** Extra header content before the status label, such as a result count or a +12 -3 summary. */
  meta?: React.ReactNode
  /** Name used in "Always allow …". Defaults to the title with its first letter lowercased. */
  approvalTarget?: string
  /**
   * Replaces the header status label, for example "Blocked by policy" instead of "Failed".
   * A custom label is shown in the neutral tone; the red error tone is only for the default.
   */
  statusLabel?: React.ReactNode
  errorText?: React.ReactNode
  approval?: ToolCallApprovalRequest
  /** The approval decision, shown after the user responds. */
  decision?: { approved: boolean; scope?: ApprovalScope; reason?: string }
  onApprove?: (approvalId: string, scope: ApprovalScope) => void
  onDeny?: (approvalId: string, reason?: string) => void
  onRetry?: () => void
  /** Run time in ms, shown once the tool finishes. */
  durationMs?: number
  /** Epoch ms when the tool started. Drives the live elapsed counter while running. */
  startedAt?: number
  variant?: "card" | "inline"
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

/** What a message renderer passes to any tool renderer. */
interface ToolRendererProps {
  part: ChatcnToolPart
  /** The response was stopped: unfinished calls show as cancelled. */
  stopped?: boolean
  variant?: ToolCallProps["variant"]
  onApprove?: ToolCallProps["onApprove"]
  onDeny?: ToolCallProps["onDeny"]
  onRetry?: ToolCallProps["onRetry"]
  /** Stop a running tool (bash, code execution). */
  onStop?: () => void
  durationMs?: number
  startedAt?: number
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

/** A renderer for one tool, keyed by tool name in a `ToolRendererMap`. */
type ToolRenderer = (props: ToolRendererProps) => React.ReactNode

/** Tool name to renderer. Spread the maps you want: `{ ...toolBashRenderers, ...toolWebSearchRenderers }`. */
type ToolRendererMap = Record<string, ToolRenderer>

/* -------------------------------------------------------------------------------------------------
 * Types
 * -----------------------------------------------------------------------------------------------*/

export type BrowserActionKind =
  | "navigate"
  | "back"
  | "click"
  | "hover"
  | "type"
  | "select"
  | "key"
  | "scroll"
  | "wait"
  | "screenshot"

/* -------------------------------------------------------------------------------------------------
 * From a message part
 * -----------------------------------------------------------------------------------------------*/

const KINDS = new Set<BrowserActionKind>([
  "navigate",
  "back",
  "click",
  "hover",
  "type",
  "select",
  "key",
  "scroll",
  "wait",
  "screenshot",
])

/** Maps common action names (Playwright, browser-use, Stagehand) onto the step kinds. */
const ALIASES: Record<string, BrowserActionKind> = {
  goto: "navigate",
  open: "navigate",
  open_url: "navigate",
  go_to_url: "navigate",
  visit: "navigate",
  go_back: "back",
  navigate_back: "back",
  left_click: "click",
  click_element: "click",
  tap: "click",
  fill: "type",
  input_text: "type",
  type_text: "type",
  select_option: "select",
  press: "key",
  press_key: "key",
  send_keys: "key",
  scroll_down: "scroll",
  scroll_up: "scroll",
  wait_for: "wait",
  take_screenshot: "screenshot",
}

function toKind(value: unknown): BrowserActionKind | undefined {
  if (typeof value !== "string") return undefined
  const v = value.toLowerCase().replace(/^browser_/, "")
  if (KINDS.has(v as BrowserActionKind)) return v as BrowserActionKind
  return ALIASES[v]
}

/** Reads a record from unknown tool input or output. */
export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export type BrowserStepStatus = "pending" | "running" | "done" | "error"

/** One browser action. Only `kind` is required; the label is written from the rest. */
export interface BrowserStep {
  kind: BrowserActionKind
  /** What the action works on, as a person would say it: "Sign in", "Email", "#invoices". */
  target?: string
  /** `navigate`: the address. */
  url?: string
  /** `type`: the text. `select`: the option. */
  text?: string
  /** `type`: hide the text (passwords, tokens). Shown as dots. */
  secret?: boolean
  /** `key`: the key or chord, `Enter` or `Meta+K`. */
  key?: string
  /** `scroll`: the direction. Defaults to down. */
  direction?: "up" | "down"
  /** Where on the page it happened, 0 to 1 from the top left. Moves the cursor marker. */
  x?: number
  y?: number
  /** Defaults from the tool state: earlier steps done, the last one running. */
  status?: BrowserStepStatus
  /** Replace the generated label. */
  label?: React.ReactNode
}

/** First number value found under any of `keys`. */
function pickNumber(value: unknown, ...keys: string[]): number | undefined {
  const record = asRecord(value)
  for (const key of keys) {
    const v = record[key]
    if (typeof v === "number" && Number.isFinite(v)) return v
  }
  return undefined
}

/** First string value found under any of `keys`. */
function pickString(value: unknown, ...keys: string[]): string | undefined {
  const record = asRecord(value)
  for (const key of keys) {
    const v = record[key]
    if (typeof v === "string") return v
  }
  return undefined
}

/** Reads a step from loose JSON: `{ action: "click", element: "Sign in", x, y }`. */
function toStep(value: unknown, fallbackKind?: BrowserActionKind): BrowserStep | undefined {
  const r = asRecord(value)
  const rawKind = r.kind ?? r.action ?? r.type
  const kind = toKind(rawKind) ?? fallbackKind
  if (!kind) return undefined
  const coordinate = Array.isArray(r.coordinate) ? r.coordinate : undefined
  const x = pickNumber(r, "x") ?? (typeof coordinate?.[0] === "number" ? coordinate[0] : undefined)
  const y = pickNumber(r, "y") ?? (typeof coordinate?.[1] === "number" ? coordinate[1] : undefined)
  const status = pickString(r, "status")
  const direction = pickString(r, "direction")
  return {
    kind,
    target: pickString(r, "target", "element", "selector", "label", "description"),
    url: pickString(r, "url", "href"),
    text: pickString(r, "text", "value", "option"),
    secret: r.secret === true || r.sensitive === true,
    key: pickString(r, "key", "keys"),
    direction:
      direction === "up" || rawKind === "scroll_up"
        ? "up"
        : direction === "down"
          ? "down"
          : undefined,
    // Only fractions place the cursor; pixel coordinates need the screen size, which parts lack.
    x: x !== undefined && x >= 0 && x <= 1 ? x : undefined,
    y: y !== undefined && y >= 0 && y <= 1 ? y : undefined,
    status:
      status === "pending" || status === "running" || status === "done" || status === "error"
        ? status
        : undefined,
  }
}

function toSteps(value: unknown, fallbackKind?: BrowserActionKind): BrowserStep[] {
  const record = asRecord(value)
  const list = Array.isArray(value)
    ? value
    : Array.isArray(record.steps)
      ? record.steps
      : Array.isArray(record.actions)
        ? record.actions
        : undefined
  if (list) return list.map((s) => toStep(s)).filter((s): s is BrowserStep => s !== undefined)
  const single = toStep(value, fallbackKind)
  return single ? [single] : []
}

/* -------------------------------------------------------------------------------------------------
 * Shared renderer contract
 * -----------------------------------------------------------------------------------------------*/

/**
 * Props every tool renderer accepts besides its own: the lifecycle that `ToolCall` handles.
 * Each renderer sets `title`, `detail`, `icon` and its own body.
 */
type ToolBaseProps = Omit<
  ToolCallProps,
  "name" | "title" | "detail" | "icon" | "input" | "inputText" | "output" | "children"
> & {
  /** Tool name from the model. Each renderer has a sensible default. */
  name?: string
}

export interface ToolBrowserProps extends ToolBaseProps {
  /** Product label when the frame previews a genuine document rather than browser automation. */
  title?: React.ReactNode
  steps?: BrowserStep[]
  /** The page the browser is on. Defaults to the last `navigate` step. */
  url?: string
  /** Title of that page, shown in the screenshot frame. */
  pageTitle?: string
  /**
   * The latest screenshot: an image URL (or data URL), or any element sized to fill its box,
   * such as an `<img>` or a live `<canvas>`.
   */
  screenshot?: string | React.ReactNode
  /** Alt text for a string screenshot. Defaults to "Screenshot of <url>". */
  screenshotAlt?: string
  /** Cursor marker position, 0 to 1. Defaults to the current step's `x` and `y`. */
  cursor?: { x: number; y: number }
  /** Width over height of the screenshot. Defaults to 16 / 10. */
  aspectRatio?: number
  /** Show the page loading bar. Defaults to true while a `navigate` step runs. */
  loading?: boolean
}

const RUNNING: ToolDisplayState[] = ["input-streaming", "input-available", "approval-responded"]

/** True while the tool is doing work (not waiting on a person, not finished). */
function isToolRunning(state: ToolDisplayState, decision?: ToolCallProps["decision"]) {
  if (state === "approval-responded" && decision?.approved === false) return false
  return RUNNING.includes(state)
}

/** Resolves every step's status from the tool lifecycle when the steps do not carry one. */
function resolveStatuses(
  steps: BrowserStep[],
  state: ToolBrowserProps["state"],
  running: boolean,
): BrowserStepStatus[] {
  const last = steps.length - 1
  return steps.map((step, i) => {
    if (step.status) return step.status
    if (state === "output-available") return "done"
    if (state === "output-error") return i === last ? "error" : "done"
    // The plan is still streaming in: nothing has run yet.
    if (state === "input-streaming") return "pending"
    if (running) return i === last ? "running" : "done"
    // Waiting on approval, denied or cancelled: nothing ran.
    return "pending"
  })
}

/** The step the browser is on: the running one, else the last one that finished. */
function currentIndex(statuses: BrowserStepStatus[]) {
  const running = statuses.indexOf("running")
  if (running !== -1) return running
  for (let i = statuses.length - 1; i >= 0; i--) {
    if (statuses[i] === "done" || statuses[i] === "error") return i
  }
  return -1
}

function hasPoint(step: BrowserStep | undefined): step is BrowserStep & { x: number; y: number } {
  return typeof step?.x === "number" && typeof step?.y === "number"
}

/* -------------------------------------------------------------------------------------------------
 * Helpers
 * -----------------------------------------------------------------------------------------------*/

/** `https://app.palletapp.dev/settings?tab=billing` to `palletapp.dev/settings`. */
function shortUrl(url: string) {
  try {
    const u = new URL(url.includes("://") ? url : `https://${url}`)
    return `${u.hostname.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname}`
  } catch {
    return url
  }
}

interface BrowserScreenProps {
  url?: string
  pageTitle?: string
  screenshot?: React.ReactNode
  screenshotAlt?: string
  point?: { x: number; y: number }
  clickKey?: string
  loading: boolean
  /** Still waiting for the first picture. */
  waiting: boolean
  aspectRatio: number
  size?: "thumbnail" | "full"
}

/** Verb in the present for the running step, past once done: "Clicking" then "Click". */
const VERBS: Record<BrowserActionKind, [string, string]> = {
  navigate: ["Opening", "Open"],
  back: ["Going back", "Go back"],
  click: ["Clicking", "Click"],
  hover: ["Hovering", "Hover"],
  type: ["Typing", "Type"],
  select: ["Selecting", "Select"],
  key: ["Pressing", "Press"],
  scroll: ["Scrolling", "Scroll"],
  wait: ["Waiting", "Wait"],
  screenshot: ["Capturing", "Capture"],
}

interface IconProps extends SVGAttributes<SVGSVGElement> {
  /** Width and height. Number means px. Default 24. */
  size?: number | string
  /** Stroke width in viewBox units (24 grid). Default 1.5. */
  strokeWidth?: number | string
  /** Keep the rendered stroke at `strokeWidth` px at any size. */
  absoluteStrokeWidth?: boolean
  /** Stroke color. Default currentColor. */
  color?: string
  /** Accessible name. Renders <title> and sets role="img"; without it the icon is aria-hidden. */
  title?: string
}

type Icon = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>

/** Shape elements an icon may contain. */
type IconElement = "path" | "circle" | "rect" | "ellipse" | "line" | "polyline" | "polygon"

/** An icon's drawing: a flat list of [element, attributes] pairs, lucide compatible. */
type IconNode = ReadonlyArray<readonly [IconElement, Readonly<Record<string, string>>]>

const toPascal = (name: string): string =>
  name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")

/**
 * Builds a React icon component from an icon node.
 * `name` is the kebab-case icon name, used for the class `chatcn-icon-<name>` and displayName.
 */
function createIcon(name: string, iconNode: IconNode): Icon {
  // biome-ignore lint/correctness/noComponentHookFactories: runs once per icon at module load
  const Component = forwardRef<SVGSVGElement, IconProps>(function ChatcnIcon(
    {
      size = 24,
      strokeWidth = 1.5,
      absoluteStrokeWidth = false,
      color = "currentColor",
      title,
      className,
      children,
      ...rest
    },
    ref,
  ) {
    const stroke = absoluteStrokeWidth
      ? (Number(strokeWidth) * 24) / Number.parseFloat(String(size))
      : strokeWidth
    const labelled = Boolean(title || rest["aria-label"] || rest["aria-labelledby"])
    return createElement(
      "svg",
      {
        ref,
        xmlns: "http://www.w3.org/2000/svg",
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: color,
        strokeWidth: stroke,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "data-slot": "icon",
        className: className
          ? `chatcn-icon chatcn-icon-${name} ${className}`
          : `chatcn-icon chatcn-icon-${name}`,
        ...(labelled ? { role: "img" } : { "aria-hidden": true }),
        ...rest,
      },
      title ? createElement("title", null, title) : null,
      ...iconNode.map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs })),
      children,
    )
  })
  Component.displayName = `${toPascal(name)}Icon`
  return Component
}

const iconNode: IconNode = [
  ["path", {"d":"m18.5 11.5-4.73-4.73a2.5 2.5 0 0 0-3.54 0L5.5 11.5"}],
  ["path", {"d":"M12 19v-9"}],
]

const ArrowUpIcon: Icon = /* @__PURE__ */ createIcon("arrow-up", iconNode)

const iconNode2: IconNode = [
  ["path", {"d":"M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0"}],
  ["path", {"d":"M12.72 3.8a11.9 11.9 0 0 1 0 16.4 1 1 0 0 1-1.44 0 11.9 11.9 0 0 1 0-16.4 1 1 0 0 1 1.44 0"}],
  ["path", {"d":"M3 12h2.25"}],
  ["path", {"d":"M10.75 12h2.5"}],
  ["path", {"d":"M18.75 12H21"}],
]

const GlobeIcon: Icon = /* @__PURE__ */ createIcon("globe", iconNode2)

const iconNode3: IconNode = [
  ["path", {"d":"m11.5 5.5-4.73 4.73a2.5 2.5 0 0 0 0 3.54l4.73 4.73"}],
  ["path", {"d":"M19 12h-9"}],
]

const ArrowLeftIcon: Icon = /* @__PURE__ */ createIcon("arrow-left", iconNode3)

const iconNode4: IconNode = [
  ["path", {"d":"m7.23 5.6 9.96 4.02a1.25 1.25 0 0 1 .02 2.31l-3.24 1.37a1.25 1.25 0 0 0-.67.67l-1.37 3.24a1.25 1.25 0 0 1-2.31-.02L5.6 7.23A1.25 1.25 0 0 1 7.23 5.6"}],
]

const MousePointer2Icon: Icon = /* @__PURE__ */ createIcon("mouse-pointer-2", iconNode4)

const iconNode5: IconNode = [
  ["path", {"d":"M4.5 7.5v-2A1.5 1.5 0 0 1 6 4h12a1.5 1.5 0 0 1 1.5 1.5v2"}],
  ["path", {"d":"M12 7v13"}],
  ["path", {"d":"M9 20h6"}],
]

const TypeIcon: Icon = /* @__PURE__ */ createIcon("type", iconNode5)

const iconNode6: IconNode = [
  ["path", {"d":"M5.5 5h13a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-13a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3"}],
  ["path", {"d":"M6.5 9.25h.01"}],
  ["path", {"d":"M6.5 12.25h.01"}],
  ["path", {"d":"M10.17 9.25h.01"}],
  ["path", {"d":"M10.17 12.25h.01"}],
  ["path", {"d":"M13.83 9.25h.01"}],
  ["path", {"d":"M13.83 12.25h.01"}],
  ["path", {"d":"M17.5 9.25h.01"}],
  ["path", {"d":"M17.5 12.25h.01"}],
  ["path", {"d":"M8 15.5h8"}],
]

const KeyboardIcon: Icon = /* @__PURE__ */ createIcon("keyboard", iconNode6)

const iconNode7: IconNode = [
  ["path", {"d":"m5.5 12.5 4.73 4.73a2.5 2.5 0 0 0 3.54 0l4.73-4.73"}],
  ["path", {"d":"M12 5v9"}],
]

const ArrowDownIcon: Icon = /* @__PURE__ */ createIcon("arrow-down", iconNode7)

const iconNode8: IconNode = [
  ["path", {"d":"M5.5 2.75h13"}],
  ["path", {"d":"M5.5 21.25h13"}],
  ["path", {"d":"M7.25 5.75v.46a2.5 2.5 0 0 0 .73 1.77l8.04 8.04a2.5 2.5 0 0 1 .73 1.77v.46"}],
  ["path", {"d":"M16.75 5.75v.46a2.5 2.5 0 0 1-.73 1.77l-1.9 1.9"}],
  ["path", {"d":"m9.88 14.12-1.9 1.9a2.5 2.5 0 0 0-.73 1.77v.46"}],
]

const HourglassIcon: Icon = /* @__PURE__ */ createIcon("hourglass", iconNode8)

const iconNode9: IconNode = [
  ["path", {"d":"M5.25 7.5h1.03a1.25 1.25 0 0 0 1.08-.62l1.03-1.76a1.25 1.25 0 0 1 1.08-.62h5.06a1.25 1.25 0 0 1 1.08.62l1.03 1.76a1.25 1.25 0 0 0 1.08.62h1.03a2.5 2.5 0 0 1 2.5 2.5v7a2.5 2.5 0 0 1-2.5 2.5H5.25a2.5 2.5 0 0 1-2.5-2.5v-7a2.5 2.5 0 0 1 2.5-2.5"}],
  ["path", {"d":"M8.5 13.25a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0"}],
]

const CameraIcon: Icon = /* @__PURE__ */ createIcon("camera", iconNode9)

const ICONS: Record<BrowserActionKind, React.ReactNode> = {
  navigate: <GlobeIcon />,
  back: <ArrowLeftIcon />,
  click: <MousePointer2Icon />,
  hover: <MousePointer2Icon />,
  type: <TypeIcon />,
  select: <MousePointer2Icon />,
  key: <KeyboardIcon />,
  scroll: <ArrowDownIcon />,
  wait: <HourglassIcon />,
  screenshot: <CameraIcon />,
}

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "rounded-(--chatcn-radius-xs) bg-(color:--chatcn-fill) text-[0.75rem]/[1rem] text-(color:--chatcn-fg-subtle) inline-flex h-5 min-w-5 items-center justify-center px-1 font-sans tabular-nums shadow-[inset_0_-1px_0_var(--chatcn-alpha-300)]",
        className,
      )}
      {...props}
    />
  )
}

/** The quiet part after the verb: the address, the target or the text typed. */
function stepDetail(step: BrowserStep): React.ReactNode {
  switch (step.kind) {
    case "navigate":
      return step.url ? shortUrl(step.url) : step.target
    case "type": {
      const text = step.text ?? ""
      const shown = step.secret ? "•".repeat(Math.min(12, Math.max(8, text.length))) : text
      return (
        <>
          {shown ? <span className="text-(color:--chatcn-fg)">“{shown}”</span> : null}
          {step.target ? <span> into {step.target}</span> : null}
        </>
      )
    }
    case "select":
      return (
        <>
          {step.text ? <span className="text-(color:--chatcn-fg)">{step.text}</span> : null}
          {step.target ? <span> in {step.target}</span> : null}
        </>
      )
    case "key":
      return step.key ? (
        <span className="inline-flex gap-0.5">
          {step.key.split("+").map((k) => (
            <Kbd key={k} className="h-4.5 min-w-4.5">
              {k}
            </Kbd>
          ))}
        </span>
      ) : undefined
    case "scroll":
      return `${step.direction === "up" ? "up" : "down"}${step.target ? ` to ${step.target}` : ""}`
    case "wait":
      return step.target ?? "for the page"
    case "screenshot":
      return step.target ?? "the page"
    default:
      return step.target
  }
}

const iconNode10: IconNode = [
  ["path", {"d":"M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0"}],
  ["path", {"d":"m9 9 6 6"}],
  ["path", {"d":"m15 9-6 6"}],
]

const CircleXIcon: Icon = /* @__PURE__ */ createIcon("circle-x", iconNode10)

/**
 * The only shimmer in chatcn: a status label such as "Thinking". Static under reduced motion.
 * Pass `active={false}` to settle it into plain subtle text.
 */
function ShimmerText({
  active = true,
  className,
  ...props
}: React.ComponentProps<"span"> & { active?: boolean }) {
  return (
    <span
      data-slot="shimmer-text"
      className={cn("font-medium", active ? "chatcn-shimmer" : "text-(color:--chatcn-fg-subtle)", className)}
      {...props}
    />
  )
}

/** The kit's one spinner. 0.8 s per turn, slowed to 1.2 s under reduced motion. */
function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-slot="spinner"
      className={cn("chatcn-spin size-3.5 shrink-0", className)}
    >
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.5" />
      <path
        d="M8 1.75A6.25 6.25 0 0 1 14.25 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

/* -------------------------------------------------------------------------------------------------
 * Steps
 * -----------------------------------------------------------------------------------------------*/

function BrowserStepRow({ step, status }: { step: BrowserStep; status: BrowserStepStatus }) {
  const running = status === "running"
  const [present, past] = VERBS[step.kind] ?? ["Running", step.kind]
  const icon =
    step.kind === "scroll" && step.direction === "up" ? <ArrowUpIcon /> : ICONS[step.kind]
  const detail = stepDetail(step)

  return (
    <li
      data-slot="tool-browser-step"
      data-step-status={status}
      className={cn(
        "flex h-7 min-w-0 items-center gap-2.5 pointer-coarse:h-8",
        "ease-(--chatcn-ease-out) transition-colors duration-150",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-4 shrink-0 place-items-center [&_svg]:size-3.5",
          status === "error"
            ? "text-(color:--chatcn-red)"
            : running
              ? "text-(color:--chatcn-fg)"
              : "text-(color:--chatcn-fg-subtle)",
        )}
      >
        {status === "error" ? <CircleXIcon /> : icon}
      </span>
      <span className="text-[0.8125rem]/[1.25rem] flex min-w-0 items-baseline gap-1.5">
        {step.label ? (
          <span
            className={cn(
              "min-w-0 truncate",
              status === "pending" ? "text-(color:--chatcn-fg-muted)" : "text-(color:--chatcn-fg)",
            )}
          >
            {step.label}
          </span>
        ) : (
          <>
            {running ? (
              <ShimmerText className="shrink-0">{present}</ShimmerText>
            ) : (
              // Steps still to come step back by gray, not opacity, so their text stays readable.
              <span
                className={cn(
                  "shrink-0 font-medium",
                  status === "pending" ? "text-(color:--chatcn-fg-muted)" : "text-(color:--chatcn-fg)",
                )}
              >
                {past}
              </span>
            )}
            {detail !== undefined && detail !== "" ? (
              <span
                className={cn(
                  "min-w-0 truncate",
                  status === "pending" ? "text-(color:--chatcn-fg-subtle)" : "text-(color:--chatcn-fg-muted)",
                  step.kind === "navigate" && "text-[0.75rem]/[1rem] font-mono",
                )}
              >
                {detail}
              </span>
            ) : null}
          </>
        )}
      </span>
      <span className="sr-only">
        {status === "running"
          ? "In progress"
          : status === "error"
            ? "Failed"
            : status === "pending"
              ? "Not run"
              : "Done"}
      </span>
      {running ? <Spinner className="text-(color:--chatcn-fg-subtle) ms-0.5 size-3" /> : null}
    </li>
  )
}

function isSecure(url: string) {
  return !/^http:\/\//i.test(url)
}

const iconNode11: IconNode = [
  ["path", {"d":"M7 10.5h10a3 3 0 0 1 3 3V18a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-4.5a3 3 0 0 1 3-3"}],
  ["path", {"d":"M8 7.5V7a4 4 0 0 1 4-4 4 4 0 0 1 4 4v.5"}],
]

const LockIcon: Icon = /* @__PURE__ */ createIcon("lock", iconNode11)

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true

/* -------------------------------------------------------------------------------------------------
 * Screen
 * -----------------------------------------------------------------------------------------------*/

/** Cursor marker with a click ring. Moves with transform only, 450 ms in-out, like ComputerView. */
function BrowserCursor({
  point,
  clickKey,
}: {
  point: { x: number; y: number }
  /** Changes on every click, which plays the ring once. */
  clickKey?: string
}) {
  const ring = React.useRef<HTMLSpanElement>(null)
  React.useEffect(() => {
    const el = ring.current
    if (!clickKey || !el || typeof el.animate !== "function" || reducedMotion()) return
    // Plays as the cursor arrives, so the ring marks the moment of the click.
    const animation = el.animate(
      [
        { transform: "translate(-50%, -50%) scale(0.4)", opacity: 0.6 },
        { transform: "translate(-50%, -50%) scale(1.6)", opacity: 0 },
      ],
      { duration: 520, delay: 360, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "both" },
    )
    return () => animation.cancel()
  }, [clickKey])

  return (
    <div
      aria-hidden="true"
      data-slot="tool-browser-cursor"
      // Screenshots are pictures, never mirrored in RTL, so the marker uses physical coordinates.
      className="ease-(--chatcn-ease-in-out) pointer-events-none absolute top-0 left-0 z-10 transition-transform duration-450 motion-reduce:transition-none"
      style={{ transform: `translate(calc(${point.x} * 100cqw), calc(${point.y} * 100cqh))` }}
    >
      <span
        ref={ring}
        className="border-(color:--chatcn-fg) absolute top-0 left-0 size-7 rounded-full border-2 opacity-0"
      />
      <MousePointer2Icon
        strokeWidth={1.5}
        className="fill-(color:--chatcn-fg) text-(color:--chatcn-bg) absolute -top-[2px] -left-[2px] size-4 drop-shadow-[0_1px_1px_var(--chatcn-alpha-500)]"
      />
    </div>
  )
}

/** The browser frame: address bar, loading bar, the screenshot and the cursor marker. */
function BrowserScreen({
  url,
  pageTitle,
  screenshot,
  screenshotAlt,
  point,
  clickKey,
  loading,
  waiting,
  aspectRatio,
  size = "thumbnail",
}: BrowserScreenProps) {
  const full = size === "full"
  return (
    <div data-slot="tool-browser-screen" className="flex min-w-0 flex-col">
      <div
        className={cn(
          "border-(color:--chatcn-border) bg-(color:--chatcn-bg-subtle) text-(color:--chatcn-fg-subtle) relative flex shrink-0 items-center gap-1.5 border-b",
          full ? "text-[0.8125rem]/[1.25rem] h-9 px-3" : "text-[0.75rem]/[1rem] h-6 px-2",
        )}
      >
        {url ? (
          isSecure(url) ? (
            <LockIcon aria-hidden="true" className={full ? "size-3.5" : "size-3"} />
          ) : (
            <GlobeIcon aria-hidden="true" className={full ? "size-3.5" : "size-3"} />
          )
        ) : null}
        <span className="min-w-0 truncate font-mono" dir="ltr">
          {url ? shortUrl(url) : "about:blank"}
        </span>
        {full && pageTitle ? (
          <span className="text-(color:--chatcn-fg-subtle) ms-auto min-w-0 truncate ps-3">{pageTitle}</span>
        ) : null}
        {loading ? (
          <span
            aria-hidden="true"
            className="absolute inset-x-0 -bottom-px h-px overflow-hidden"
            data-slot="tool-browser-loading"
          >
            <span className="bg-(color:--chatcn-accent) block h-full w-2/5 animate-[chatcn-indeterminate_1.4s_var(--chatcn-ease-in-out)_infinite] motion-reduce:animate-none motion-reduce:opacity-50" />
          </span>
        ) : null}
      </div>
      <div
        className="bg-(color:--chatcn-bg) [container-type:size] relative w-full overflow-hidden"
        style={{ aspectRatio }}
      >
        {screenshot ?? (
          <div className="bg-(color:--chatcn-bg-subtle) text-(color:--chatcn-fg-subtle) absolute inset-0 grid place-items-center">
            {waiting ? (
              <span className="text-[0.75rem]/[1rem] flex items-center gap-1.5">
                <Spinner className="size-3" />
                Opening the browser
              </span>
            ) : (
              <span className="text-[0.75rem]/[1rem]">No screenshot</span>
            )}
          </div>
        )}
        {screenshot && screenshotAlt ? <span className="sr-only">{screenshotAlt}</span> : null}
        {screenshot && point ? <BrowserCursor point={point} clickKey={clickKey} /> : null}
      </div>
    </div>
  )
}

const iconNode12: IconNode = [
  ["path", {"d":"M14.5 3.5H18A2.5 2.5 0 0 1 20.5 6v3.5"}],
  ["path", {"d":"m13.75 10.25 3.21-3.21"}],
  ["path", {"d":"M9.5 20.5H6A2.5 2.5 0 0 1 3.5 18v-3.5"}],
  ["path", {"d":"m10.25 13.75-3.21 3.21"}],
]

const Maximize2Icon: Icon = /* @__PURE__ */ createIcon("maximize-2", iconNode12)

function ToolCallSection({
  label,
  action,
  children,
}: {
  label: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section data-slot="tool-call-section" className="flex flex-col gap-1.5">
      <div className="flex h-6 items-center justify-between">
        <h4 className="text-[0.75rem]/[1rem] text-(color:--chatcn-fg-subtle) font-medium">{label}</h4>
        {action}
      </div>
      {children}
    </section>
  )
}

type ButtonVariant = "solid" | "outline" | "ghost" | "subtle"

type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon-xs" | "icon-sm" | "icon-md" | "icon-lg"

interface ButtonProps extends React.ComponentProps<"button"> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const base = cn(
  "chatcn-focus inline-flex shrink-0 items-center justify-center gap-1.5 font-medium whitespace-nowrap select-none",
  "ease-(--chatcn-ease-standard) transition-[background-color,color,box-shadow,scale] duration-150",
  "active:scale-(--chatcn-press-scale) active:duration-100 disabled:pointer-events-none disabled:opacity-50",
  "[&_svg]:pointer-events-none [&_svg]:shrink-0",
)

const variants: Record<ButtonVariant, string> = {
  solid: "bg-(color:--chatcn-primary) text-(color:--chatcn-primary-fg) hover:bg-(color:--chatcn-primary-hover)",
  outline: "bg-(color:--chatcn-card) text-(color:--chatcn-fg) shadow-(--chatcn-shadow-xs) hover:bg-(color:--chatcn-fill-hover)",
  ghost: "text-(color:--chatcn-fg-muted) hover:bg-(color:--chatcn-fill-hover) hover:text-(color:--chatcn-fg)",
  subtle: "bg-(color:--chatcn-fill) text-(color:--chatcn-fg) hover:bg-(color:--chatcn-fill-hover)",
}

// Heights follow the control scale: 24, 28, 32, 36. Radii stay concentric inside 12 px surfaces.
const sizes: Record<ButtonSize, string> = {
  xs: "h-6 rounded-(--chatcn-radius-sm) px-2 text-[0.75rem]/[1rem] [&_svg]:size-3.5",
  sm: "h-7 rounded-(--chatcn-radius-sm) px-2.5 text-[0.8125rem]/[1.25rem] [&_svg]:size-3.5",
  md: "h-8 rounded-(--chatcn-radius-md) px-3 text-[0.875rem]/[1.25rem] tracking-[-0.003em] [&_svg]:size-4",
  lg: "h-9 rounded-(--chatcn-radius-md) px-3.5 text-[0.875rem]/[1.25rem] tracking-[-0.003em] [&_svg]:size-4",
  "icon-xs": "size-6 rounded-(--chatcn-radius-sm) active:scale-(--chatcn-press-scale-icon) [&_svg]:size-3.5",
  "icon-sm": "size-7 rounded-(--chatcn-radius-sm) active:scale-(--chatcn-press-scale-icon) [&_svg]:size-3.5",
  "icon-md": "size-8 rounded-(--chatcn-radius-md) active:scale-(--chatcn-press-scale-icon) [&_svg]:size-4",
  "icon-lg": "size-9 rounded-(--chatcn-radius-md) active:scale-(--chatcn-press-scale-icon) [&_svg]:size-4",
}

/** Class names for anything that should look like a button, such as a link. */
function buttonVariants({
  variant = "ghost",
  size = "md",
}: {
  variant?: ButtonVariant
  size?: ButtonSize
} = {}) {
  return cn(base, variants[variant], sizes[size])
}

function Button({
  variant = "ghost",
  size = "md",
  type = "button",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      data-slot="button"
      data-variant={variant}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

const iconNode13: IconNode = [
  ["path", {"d":"M5.49 17.46A8.5 8.5 0 1 0 6.54 5.49"}],
  ["path", {"d":"m8.21 8.65-2.94-.26a2 2 0 0 1-1.82-2.16l.26-2.94"}],
]

const RotateCcwIcon: Icon = /* @__PURE__ */ createIcon("rotate-ccw", iconNode13)

type StreamingCaretStatus = "streaming" | "waiting" | "done"

interface StreamingCaretProps extends Omit<React.ComponentProps<"span">, "children"> {
  /**
   * `streaming` is solid, `waiting` blinks slowly, `done` removes the caret. Defaults to
   * `streaming`.
   */
  status?: StreamingCaretStatus
  /**
   * Pass the streamed text (or anything that changes with each token). While it keeps changing
   * the caret stays solid; once it holds still for `idleMs` the caret starts to blink.
   */
  activity?: unknown
  /** Quiet time before the caret switches to blinking. Defaults to 600 ms. */
  idleMs?: number
}

/**
 * The signature mark: a small rounded square that means "the model is writing here". It sits on
 * the text baseline at 0.55em, so it scales with whatever text it follows. Solid while tokens flow,
 * a slow 1.2 s blink only while waiting, gone when done. Static under reduced motion.
 */
function StreamingCaret({
  status = "streaming",
  activity,
  idleMs = 600,
  className,
  ...props
}: StreamingCaretProps) {
  const [idle, setIdle] = React.useState(false)
  const tracking = activity !== undefined && status === "streaming"

  React.useEffect(() => {
    if (!tracking) return
    setIdle(false)
    const id = window.setTimeout(() => setIdle(true), idleMs)
    return () => window.clearTimeout(id)
  }, [activity, tracking, idleMs])

  if (status === "done") return null
  const blinking = status === "waiting" || (tracking && idle)

  return (
    <span
      aria-hidden="true"
      data-slot="streaming-caret"
      data-caret-state={blinking ? "waiting" : "streaming"}
      className={cn(
        "bg-(color:--chatcn-accent) ms-0.5 inline-block size-[0.55em] translate-y-[0.04em] rounded-[0.12em] align-baseline forced-colors:bg-[CanvasText]",
        blinking &&
          "animate-[chatcn-caret-blink_1.2s_steps(1,end)_infinite] motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  )
}

function ToolCallCode({
  children,
  streaming,
  className,
}: {
  children: React.ReactNode
  streaming?: boolean
  className?: string
}) {
  // Long input or output scrolls inside the box, so the box joins the tab order exactly when it
  // overflows: keyboard users can then scroll it, and short payloads add no extra tab stop.
  const ref = React.useRef<HTMLPreElement>(null)
  const [scrolls, setScrolls] = React.useState(false)
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () =>
      setScrolls(el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    if (el.firstElementChild) observer.observe(el.firstElementChild)
    return () => observer.disconnect()
  }, [])
  return (
    <pre
      ref={ref}
      data-slot="tool-call-code"
      tabIndex={scrolls ? 0 : undefined}
      className={cn(
        "rounded-(--chatcn-radius-md) bg-(color:--chatcn-inset) chatcn-scroll chatcn-focus max-h-72 overflow-auto px-3 py-2.5",
        "text-[0.75rem]/[1rem] text-(color:--chatcn-fg-muted) font-mono [overflow-wrap:anywhere] whitespace-pre-wrap",
        className,
      )}
    >
      <code>
        {children}
        {streaming ? <StreamingCaret /> : null}
      </code>
    </pre>
  )
}

type DialogProps = React.ComponentProps<typeof DialogPrimitive.Root>

/* -------------------------------------------------------------------------------------------------
 * Motion
 *
 * Scrim and popup share one duration and curve: 220 ms in, 160 ms out, ease-chatcn-out. The popup
 * grows from 0.96 at the center and leaves at 0.98 (exits travel less). Opened or closed from the
 * keyboard, nothing animates: Enter and Esc should feel instant.
 * -----------------------------------------------------------------------------------------------*/

const InstantContext = React.createContext(false)

/** A keyboard Enter on a button arrives as a click with `detail === 0`. */
function isKeyboardEvent(event: Event | undefined) {
  if (!event) return false
  if (typeof KeyboardEvent !== "undefined" && event instanceof KeyboardEvent) return true
  return event.type === "click" && (event as MouseEvent).detail === 0
}

function Dialog({ onOpenChange, ...props }: DialogProps) {
  const [instant, setInstant] = React.useState(false)
  return (
    <InstantContext.Provider value={instant}>
      <DialogPrimitive.Root
        onOpenChange={(open, details) => {
          setInstant(isKeyboardEvent(details.event))
          onOpenChange?.(open, details)
        }}
        {...props}
      />
    </InstantContext.Provider>
  )
}

type DialogSize = "sm" | "md" | "lg" | "xl" | "full"

interface DialogContentProps extends React.ComponentProps<typeof DialogPrimitive.Popup> {
  size?: DialogSize
  /** Render the close button in the corner. On by default. */
  showClose?: boolean
  /** Classes for the scrim behind the popup. */
  backdropClassName?: string
  container?: React.ComponentProps<typeof DialogPrimitive.Portal>["container"]
}

const sizes2: Record<DialogSize, string> = {
  sm: "w-[min(24rem,calc(100vw-2rem))]",
  md: "w-[min(32rem,calc(100vw-2rem))]",
  lg: "w-[min(44rem,calc(100vw-2rem))]",
  xl: "w-[min(64rem,calc(100vw-2rem))]",
  full: "h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)]",
}

const iconNode14: IconNode = [
  ["path", {"d":"m6 6 12 12"}],
  ["path", {"d":"m18 6-3.88 3.88"}],
  ["path", {"d":"M9.88 14.12 6 18"}],
]

const XIcon: Icon = /* @__PURE__ */ createIcon("x", iconNode14)

function DialogContent({
  size = "md",
  showClose = true,
  backdropClassName,
  container,
  className,
  children,
  ...props
}: DialogContentProps) {
  const instant = React.useContext(InstantContext)
  return (
    <DialogPrimitive.Portal container={container}>
      <DialogPrimitive.Backdrop
        data-slot="dialog-backdrop"
        data-dialog-instant={instant ? "" : undefined}
        className={cn(
          "bg-(color:--chatcn-scrim) fixed inset-0 z-50",
          "ease-(--chatcn-ease-out) transition-opacity duration-220",
          "data-[ending-style]:opacity-0 data-[ending-style]:duration-160 data-[starting-style]:opacity-0",
          "data-[dialog-instant]:transition-none",
          backdropClassName,
        )}
      />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        data-size={size}
        data-dialog-instant={instant ? "" : undefined}
        className={cn(
          "bg-(color:--chatcn-surface) text-(color:--chatcn-fg) shadow-(--chatcn-shadow-xl) rounded-(--chatcn-radius-xl) fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
          "flex max-h-[calc(100dvh-2rem)] origin-center flex-col overflow-hidden outline-none",
          sizes2[size],
          "ease-(--chatcn-ease-out) transition-[opacity,scale] duration-220",
          "data-[starting-style]:scale-(--chatcn-enter-scale) data-[starting-style]:opacity-0",
          "data-[ending-style]:scale-(--chatcn-exit-scale) data-[ending-style]:opacity-0 data-[ending-style]:duration-160",
          "motion-reduce:data-[ending-style]:scale-100",
          "data-[dialog-instant]:transition-none",
          // Forced colors strip shadows, so the hairline needs a real outline.
          "forced-colors:outline-1 forced-colors:outline-solid",
          className,
        )}
        {...props}
      >
        {children}
        {showClose ? (
          <DialogPrimitive.Close
            aria-label="Close"
            data-slot="dialog-close"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon-sm" }),
              "absolute end-3 top-3 pointer-coarse:size-11",
            )}
          >
            <XIcon />
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-[1rem]/[1.5rem] tracking-[-0.01em] text-(color:--chatcn-fg) pe-8 font-semibold text-balance", className)}
      {...props}
    />
  )
}

/** Plural helper for counts in headers: `plural(3, "result")` is "3 results". */
function plural(n: number, word: string, many = `${word}s`) {
  return `${n} ${n === 1 ? word : many}`
}

function humanize(name: string) {
  const words = name
    .replace(/^tool-/, "")
    .replace(/[_-]+/g, " ")
    .trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/* -------------------------------------------------------------------------------------------------
 * Helpers
 * -----------------------------------------------------------------------------------------------*/

const RUNNING2: ToolDisplayState[] = ["input-streaming", "input-available", "approval-responded"]

function isRunning(state: ToolDisplayState, decision?: ToolCallProps["decision"]) {
  if (state === "approval-responded" && decision?.approved === false) return false
  return RUNNING2.includes(state)
}

/** Measures run time itself when the caller passes no timing, so durations show up for free. */
function useAutoTiming(running: boolean, done: boolean) {
  const [startedAt, setStartedAt] = React.useState<number>()
  const [durationMs, setDurationMs] = React.useState<number>()
  React.useEffect(() => {
    if (running && startedAt === undefined) setStartedAt(Date.now())
    if (done && startedAt !== undefined && durationMs === undefined)
      setDurationMs(Date.now() - startedAt)
  }, [running, done, startedAt, durationMs])
  return { startedAt, durationMs }
}

function useElapsed(startedAt: number | undefined, active: boolean) {
  // Starts empty and reads the clock after mount: a render must not read it (Next.js prerender).
  const [now, setNow] = React.useState<number | null>(null)
  React.useEffect(() => {
    if (!active || startedAt === undefined) return
    setNow(Date.now())
    // Ticks once per second: a counter that changes faster only adds noise.
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [active, startedAt])
  if (!active || startedAt === undefined) return undefined
  return Math.max(0, (now ?? startedAt) - startedAt)
}

/**
 * Tolerant JSON parser for streaming tool input.
 *
 * Parses as much of a truncated JSON document as possible: unterminated strings keep their text,
 * open objects and arrays are closed, partial literals (`tr`, `nul`) are completed, partial numbers
 * (`12.`, `3e`) are trimmed and trailing commas are ignored. Keys without a value are dropped.
 * Single pass, no eval, no dependencies.
 */

/** Result of `parsePartialJson`. */
interface PartialJsonResult {
  /** Best-effort value, `undefined` when nothing could be parsed yet. */
  value: unknown
  /** True when the text held one finished JSON value (trailing commas tolerated). */
  complete: boolean
}

const NONE = Symbol("none")

type Parsed = unknown | typeof NONE

const LITERALS: Record<string, [string, unknown]> = {
  t: ["true", true],
  f: ["false", false],
  n: ["null", null],
}

const ESCAPES: Record<string, string> = {
  '"': '"',
  "\\": "\\",
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
}

const NUMBER_CHAR = /[-+.eE0-9]/

class Parser {
  i = 0
  /** Set when input ran out or a syntax error was hit; unwinds every open container. */
  stopped = false

  readonly s: string

  constructor(s: string) {
    this.s = s
  }

  ws(): void {
    const s = this.s
    while (this.i < s.length) {
      const c = s.charCodeAt(this.i)
      if (c !== 32 && c !== 10 && c !== 13 && c !== 9) return
      this.i++
    }
  }

  value(): Parsed {
    this.ws()
    const c = this.s[this.i]
    if (c === undefined) return this.stop()
    if (c === "{") return this.object()
    if (c === "[") return this.array()
    if (c === '"') return this.string()
    if (c === "-" || (c >= "0" && c <= "9")) return this.number()
    if (c in LITERALS) return this.literal(c)
    return this.stop()
  }

  stop(): typeof NONE {
    this.stopped = true
    return NONE
  }

  object(): Record<string, unknown> {
    const obj: Record<string, unknown> = {}
    this.i++
    while (true) {
      this.ws()
      const c = this.s[this.i]
      if (c === "}") {
        this.i++
        return obj
      }
      if (c === ",") {
        this.i++
        continue
      }
      if (c !== '"') {
        this.stop()
        return obj
      }
      const key = this.string()
      if (this.stopped) return obj
      this.ws()
      if (this.s[this.i] !== ":") {
        this.stop()
        return obj
      }
      this.i++
      const v = this.value()
      if (v !== NONE) {
        // defineProperty keeps a "__proto__" key from replacing the prototype.
        Object.defineProperty(obj, key, {
          value: v,
          enumerable: true,
          writable: true,
          configurable: true,
        })
      }
      if (this.stopped) return obj
      this.ws()
      const next = this.s[this.i]
      if (next === ",") this.i++
      else if (next !== "}") {
        this.stop()
        return obj
      }
    }
  }

  array(): unknown[] {
    const arr: unknown[] = []
    this.i++
    while (true) {
      this.ws()
      const c = this.s[this.i]
      if (c === "]") {
        this.i++
        return arr
      }
      if (c === ",") {
        this.i++
        continue
      }
      const v = this.value()
      if (v !== NONE) arr.push(v)
      if (this.stopped) return arr
      this.ws()
      const next = this.s[this.i]
      if (next === ",") this.i++
      else if (next !== "]") {
        this.stop()
        return arr
      }
    }
  }

  string(): string {
    const s = this.s
    let out = ""
    let start = ++this.i
    while (this.i < s.length) {
      const c = s[this.i]
      if (c === '"') {
        out += s.slice(start, this.i++)
        return out
      }
      if (c !== "\\") {
        this.i++
        continue
      }
      out += s.slice(start, this.i)
      start = this.i
      const e = s[this.i + 1]
      if (e === undefined) break
      if (e === "u") {
        const hex = s.slice(this.i + 2, this.i + 6)
        if (hex.length < 4) break
        const code = Number.parseInt(hex, 16)
        out += Number.isNaN(code) ? hex : String.fromCharCode(code)
        this.i += 6
      } else {
        out += ESCAPES[e] ?? e
        this.i += 2
      }
      start = this.i
    }
    // Ran out of input inside the string. A partial escape (start sits on it) is dropped.
    if (s[start] !== "\\") out += s.slice(start)
    this.stopped = true
    const last = out.charCodeAt(out.length - 1)
    return last >= 0xd800 && last <= 0xdbff ? out.slice(0, -1) : out
  }

  number(): Parsed {
    const s = this.s
    const start = this.i
    while (this.i < s.length && NUMBER_CHAR.test(s[this.i] as string)) this.i++
    const token = s.slice(start, this.i)
    // Trim a dangling sign, dot or exponent left by truncation (`12.`, `3e`, `-`).
    const trimmed = token.replace(/[-+.eE]+$/, "")
    if (trimmed !== token) this.stopped = true
    const n = Number(trimmed)
    return trimmed === "" || Number.isNaN(n) ? this.stop() : n
  }

  literal(first: string): Parsed {
    const [word, value] = LITERALS[first] as [string, unknown]
    const rest = this.s.slice(this.i, this.i + word.length)
    if (rest === word) {
      this.i += word.length
      return value
    }
    if (this.i + rest.length === this.s.length && word.startsWith(rest)) {
      this.i += rest.length
      this.stopped = true
      return value
    }
    return this.stop()
  }
}

/** Parse possibly truncated JSON, returning the best-effort value and whether it was complete. */
export function parsePartialJson(text: string): PartialJsonResult {
  const p = new Parser(text)
  const v = p.value()
  if (!p.stopped) p.ws()
  return { value: v === NONE ? undefined : v, complete: !p.stopped && p.i === text.length }
}

const NBSP = "\u00a0"

/** A minute and up: "4 m 12 s", then "2 h 5 m", then "3 d 4 h", never "1 m 60 s". */
function formatLong(seconds: number) {
  const t = Math.round(seconds)
  if (t < 3600) return `${Math.floor(t / 60)}${NBSP}m ${t % 60}${NBSP}s`
  const h = Math.floor(t / 3600)
  if (h < 24) return `${h}${NBSP}h ${Math.floor((t % 3600) / 60)}${NBSP}m`
  return `${Math.floor(h / 24)}${NBSP}d ${h % 24}${NBSP}h`
}

/**
 * Final durations keep a decimal under 10 s. Live counters (`precise: false`) tick in whole
 * seconds, so the figure turns over once a second and never shows a frozen ".0".
 */
function formatDuration(ms: number, precise = true) {
  if (precise && ms < 1000) return `${Math.max(1, Math.round(ms))}${NBSP}ms`
  const s = ms / 1000
  if (precise && s < 10) return `${s.toFixed(1)}${NBSP}s`
  if (s < 60) return `${precise ? Math.round(s) : Math.floor(s)}${NBSP}s`
  return formatLong(precise ? s : Math.floor(s))
}

function statusLabel(props: {
  state: ToolDisplayState
  decision?: ToolCallProps["decision"]
  durationMs?: number
  elapsed?: number
}) {
  const { state, decision, durationMs, elapsed } = props
  switch (state) {
    case "input-streaming":
    case "input-available":
      return elapsed !== undefined && elapsed >= 1000 ? formatDuration(elapsed, false) : "Running"
    case "approval-requested":
      return "Needs approval"
    case "approval-responded":
      if (decision?.approved === false) return "Denied"
      return elapsed !== undefined && elapsed >= 1000 ? formatDuration(elapsed, false) : "Running"
    case "output-available":
      return durationMs !== undefined ? formatDuration(durationMs) : "Done"
    case "output-error":
      return "Failed"
    case "output-denied":
      return "Denied"
    case "cancelled":
      return "Cancelled"
  }
}

const DETAIL_KEYS = [
  "path",
  "file",
  "filePath",
  "query",
  "command",
  "cmd",
  "url",
  "pattern",
  "name",
]

function detailFrom(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined
  for (const key of DETAIL_KEYS) {
    const value = (input as Record<string, unknown>)[key]
    if (typeof value === "string" && value.length > 0) return value
  }
  return undefined
}

const iconNode15: IconNode = [
  ["path", {"d":"M6.25 14.5V8.25A1.75 1.75 0 0 1 8 6.5a1.75 1.75 0 0 1 1.75 1.75v3.25"}],
  ["path", {"d":"M9.75 11V6a1.75 1.75 0 0 1 1.75-1.75A1.75 1.75 0 0 1 13.25 6v5"}],
  ["path", {"d":"M13.25 11V7A1.75 1.75 0 0 1 15 5.25 1.75 1.75 0 0 1 16.75 7v4.5"}],
  ["path", {"d":"M16.75 12v-2a1.75 1.75 0 0 1 1.75-1.75A1.75 1.75 0 0 1 20.25 10v6.75a4.5 4.5 0 0 1-4.5 4.5H10.1a3 3 0 0 1-2.25-1.01l-4.32-4.89a1.25 1.25 0 0 1-.2-1.33l.02-.06a1.25 1.25 0 0 1 1.91-.48l.99.77"}],
]

const HandIcon: Icon = /* @__PURE__ */ createIcon("hand", iconNode15)

const iconNode16: IconNode = [
  ["path", {"d":"M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0"}],
  ["path", {"d":"m7.76 7.76 8.48 8.48"}],
]

const BanIcon: Icon = /* @__PURE__ */ createIcon("ban", iconNode16)

const iconNode17: IconNode = [
  ["path", {"d":"M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0"}],
  ["path", {"d":"M10.75 8.75h2.5a2 2 0 0 1 2 2v2.5a2 2 0 0 1-2 2h-2.5a2 2 0 0 1-2-2v-2.5a2 2 0 0 1 2-2"}],
]

const CircleStopIcon: Icon = /* @__PURE__ */ createIcon("circle-stop", iconNode17)

/* -------------------------------------------------------------------------------------------------
 * Small parts
 * -----------------------------------------------------------------------------------------------*/

/** Status glyph. Swaps with a short blur crossfade so state changes read as one object changing. */
function ToolCallStatus({
  state,
  decision,
  icon,
}: {
  state: ToolDisplayState
  decision?: ToolCallProps["decision"]
  icon: React.ReactNode
}) {
  let glyph: React.ReactNode = icon
  let key = "idle"
  let tone = "text-(color:--chatcn-fg-subtle)"

  if (isRunning(state, decision)) {
    glyph = <Spinner />
    key = "running"
    tone = "text-(color:--chatcn-blue)"
  } else if (state === "approval-requested") {
    glyph = <HandIcon />
    key = "approval"
    tone = "text-(color:--chatcn-amber)"
  } else if (state === "output-error") {
    glyph = <CircleXIcon />
    key = "error"
    tone = "text-(color:--chatcn-red)"
  } else if (
    state === "output-denied" ||
    (state === "approval-responded" && decision?.approved === false)
  ) {
    glyph = <BanIcon />
    key = "denied"
  } else if (state === "cancelled") {
    glyph = <CircleStopIcon />
    key = "cancelled"
  }

  return (
    <span
      data-slot="tool-call-status"
      className={cn("relative grid size-4 shrink-0 place-items-center [&_svg]:size-4", tone)}
    >
      <span
        key={key}
        className="grid place-items-center motion-safe:animate-[chatcn-swap_150ms_var(--chatcn-ease-out)]"
      >
        {glyph}
      </span>
    </span>
  )
}

const iconNode18: IconNode = [
  ["path", {"d":"M4 10.75a6.75 6.75 0 1 0 13.5 0 6.75 6.75 0 1 0-13.5 0"}],
  ["path", {"d":"m15.75 15.75 4.5 4.5"}],
  ["path", {"d":"M10.75 6.25C12 7.5 12.5 9 12.5 10.75s-.5 3.25-1.75 4.5"}],
  ["path", {"d":"M10.75 6.25C9.5 7.5 9 9 9 10.75s.5 3.25 1.75 4.5"}],
  ["path", {"d":"M6.5 10.75H15"}],
]

const WebSearchIcon: Icon = /* @__PURE__ */ createIcon("web-search", iconNode18)

const iconNode19: IconNode = [
  ["path", {"d":"M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3"}],
  ["path", {"d":"m7.5 8.75 1.87 1.87a1.25 1.25 0 0 1 0 1.76L7.5 14.25"}],
  ["path", {"d":"M12.5 15.25h4"}],
]

const SquareTerminalIcon: Icon = /* @__PURE__ */ createIcon("square-terminal", iconNode19)

const iconNode20: IconNode = [
  ["path", {"d":"m3.79 18.63.87-2.6a1.5 1.5 0 0 1 .36-.58l9.65-9.65a2.5 2.5 0 0 1 3.53 0 2.5 2.5 0 0 1 0 3.53l-9.65 9.65a1.5 1.5 0 0 1-.58.36l-2.6.87a1.25 1.25 0 0 1-1.58-1.58"}],
  ["path", {"d":"m13.25 7.21 3.54 3.54"}],
]

const PencilIcon: Icon = /* @__PURE__ */ createIcon("pencil", iconNode20)

const iconNode21: IconNode = [
  ["path", {"d":"M7 2.5h5.88a1.5 1.5 0 0 1 1.06.44l5.12 5.12a1.5 1.5 0 0 1 .44 1.06V19a2.5 2.5 0 0 1-2.5 2.5H7A2.5 2.5 0 0 1 4.5 19V5A2.5 2.5 0 0 1 7 2.5"}],
  ["path", {"d":"M13.5 3.25v3.5a1.75 1.75 0 0 0 1.75 1.75h3.5"}],
  ["path", {"d":"M8.25 12.5h7.5"}],
  ["path", {"d":"M8.25 16.5h7.5"}],
  ["path", {"d":"M8.25 8.5H10"}],
]

const FileTextIcon: Icon = /* @__PURE__ */ createIcon("file-text", iconNode21)

const iconNode22: IconNode = [
  ["path", {"d":"M7.5 8.5h9A1.5 1.5 0 0 1 18 10v1a6 6 0 0 1-6 6 6 6 0 0 1-6-6v-1a1.5 1.5 0 0 1 1.5-1.5"}],
  ["path", {"d":"M9.5 2.75V5.5"}],
  ["path", {"d":"M14.5 2.75V5.5"}],
  ["path", {"d":"M12 17v4.25"}],
]

const PlugIcon: Icon = /* @__PURE__ */ createIcon("plug", iconNode22)

const iconNode23: IconNode = [
  ["path", {"d":"M19.76 6.79a5.25 5.25 0 0 1-7.16 6.88l-6.22 6.21a1.6 1.6 0 0 1-2.26-2.26l6.21-6.22a5.25 5.25 0 0 1 6.88-7.16l-2.42 2.43 2.54 2.54Z"}],
]

const ToolIcon: Icon = /* @__PURE__ */ createIcon("tool", iconNode23)

function iconFor(name: string) {
  const n = name.toLowerCase()
  if (/search|query|lookup/.test(n) && /web|internet|google|bing/.test(n)) return <WebSearchIcon />
  if (/fetch|browse|url|http/.test(n)) return <GlobeIcon />
  if (/bash|shell|command|terminal|exec|run/.test(n)) return <SquareTerminalIcon />
  if (/edit|write|patch|replace|create/.test(n)) return <PencilIcon />
  if (/read|open|view|cat|file/.test(n)) return <FileTextIcon />
  if (/search|grep|glob|find/.test(n)) return <WebSearchIcon />
  if (/mcp|connector|plugin/.test(n)) return <PlugIcon />
  return <ToolIcon />
}

const iconNode24: IconNode = [
  ["path", {"d":"m6 9.25 4.23 4.23a2.5 2.5 0 0 0 3.54 0L18 9.25"}],
]

const ChevronDownIcon: Icon = /* @__PURE__ */ createIcon("chevron-down", iconNode24)

interface CopyButtonProps extends Omit<ButtonProps, "value" | "onCopy"> {
  value: string | (() => string)
  label?: string
  onCopy?: (value: string) => void
}

const iconNode25: IconNode = [
  ["path", {"d":"M11.5 9h7a2.5 2.5 0 0 1 2.5 2.5v7a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 9 18.5v-7A2.5 2.5 0 0 1 11.5 9"}],
  ["path", {"d":"M6 15h-.5A2.5 2.5 0 0 1 3 12.5v-7A2.5 2.5 0 0 1 5.5 3h7A2.5 2.5 0 0 1 15 5.5V6"}],
]

const CopyIcon: Icon = /* @__PURE__ */ createIcon("copy", iconNode25)

const iconNode26: IconNode = [
  ["path", {"d":"m4.5 12.75 3.23 3.23a2.5 2.5 0 0 0 3.54 0l8.48-8.48"}],
]

const CheckIcon: Icon = /* @__PURE__ */ createIcon("check", iconNode26)

/** Copy swaps to a check with a 150 ms blur crossfade, holds for 1.5 s and announces itself. */
function CopyButton({
  value,
  label = "Copy",
  onCopy,
  onClick,
  children,
  size = "icon-sm",
  className,
  ...props
}: CopyButtonProps) {
  // A counter, not a flag: copying again while the check shows restarts the 1.5 s hold.
  const [copies, setCopies] = React.useState(0)
  const [copied, setCopied] = React.useState(false)
  React.useEffect(() => {
    if (!copies) return
    setCopied(true)
    const id = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(id)
  }, [copies])

  // Reduced motion keeps the crossfade and drops the scale and blur.
  const layer = cn(
    "ease-(--chatcn-ease-out) absolute transition-[opacity,scale,filter] duration-150",
    "motion-reduce:scale-100 motion-reduce:blur-none motion-reduce:transition-opacity",
  )
  return (
    <Button
      {...props}
      size={size}
      aria-label={children ? undefined : copied ? "Copied" : label}
      onClick={(event) => {
        // Compose with handlers injected by wrappers such as Tooltip instead of replacing them.
        onClick?.(event)
        if (event.defaultPrevented) return
        const text = typeof value === "function" ? value() : value
        navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setCopies((n) => n + 1)
            onCopy?.(text)
          })
          // Clipboard access can be denied (insecure context, permissions). Stay quiet and unchanged.
          .catch(() => {})
      }}
      className={cn("relative", className)}
    >
      {children ? (
        <>
          <span className="relative grid size-3.5 place-items-center">
            <CopyIcon
              className={cn(
                layer,
                copied ? "scale-75 opacity-0 blur-[2px]" : "scale-100 opacity-100",
              )}
            />
            <CheckIcon
              className={cn(
                layer,
                copied ? "scale-100 opacity-100" : "scale-75 opacity-0 blur-[2px]",
              )}
            />
          </span>
          {children}
        </>
      ) : null}
      {children ? null : (
        <>
          <CopyIcon
            className={cn(
              layer,
              copied ? "scale-75 opacity-0 blur-[2px]" : "scale-100 opacity-100",
            )}
          />
          <CheckIcon
            className={cn(
              layer,
              copied ? "scale-100 opacity-100" : "scale-75 opacity-0 blur-[2px]",
            )}
          />
        </>
      )}
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </Button>
  )
}

function stringify(value: unknown) {
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

/* -------------------------------------------------------------------------------------------------
 * JSON view: monochrome, weight and gray only.
 * -----------------------------------------------------------------------------------------------*/

function JsonValue({ value, depth }: { value: unknown; depth: number }): React.ReactNode {
  const pad = "  ".repeat(depth + 1)
  const close = "  ".repeat(depth)

  if (value === null) return <span className="text-(color:--chatcn-fg-subtle)">null</span>
  if (typeof value === "string") {
    return <span className="text-(color:--chatcn-fg)">{JSON.stringify(value)}</span>
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return <span className="text-(color:--chatcn-fg) font-medium">{String(value)}</span>
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-(color:--chatcn-fg-subtle)">[]</span>
    return (
      <>
        <span className="text-(color:--chatcn-fg-subtle)">[</span>
        {"\n"}
        {value.map((item, i) => (
          <React.Fragment key={i}>
            {pad}
            <JsonValue value={item} depth={depth + 1} />
            {i < value.length - 1 ? <span className="text-(color:--chatcn-fg-subtle)">,</span> : null}
            {"\n"}
          </React.Fragment>
        ))}
        {close}
        <span className="text-(color:--chatcn-fg-subtle)">]</span>
      </>
    )
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return <span className="text-(color:--chatcn-fg-subtle)">{"{}"}</span>
    return (
      <>
        <span className="text-(color:--chatcn-fg-subtle)">{"{"}</span>
        {"\n"}
        {entries.map(([k, v], i) => (
          <React.Fragment key={k}>
            {pad}
            <span className="text-(color:--chatcn-fg-muted)">{JSON.stringify(k)}</span>
            <span className="text-(color:--chatcn-fg-subtle)">: </span>
            <JsonValue value={v} depth={depth + 1} />
            {i < entries.length - 1 ? <span className="text-(color:--chatcn-fg-subtle)">,</span> : null}
            {"\n"}
          </React.Fragment>
        ))}
        {close}
        <span className="text-(color:--chatcn-fg-subtle)">{"}"}</span>
      </>
    )
  }
  return <span className="text-(color:--chatcn-fg)">{String(value)}</span>
}

/* -------------------------------------------------------------------------------------------------
 * Approval
 * -----------------------------------------------------------------------------------------------*/

function ToolCallApproval({
  approval,
  toolLabel,
  onApprove,
  onDeny,
  inline,
}: {
  /** Inline rows continue the body's guide line, so the reason and actions share its left edge. */
  inline?: boolean
  approval: ToolCallApprovalRequest
  toolLabel: string
  onApprove?: ToolCallProps["onApprove"]
  onDeny?: ToolCallProps["onDeny"]
}) {
  const [always, setAlways] = React.useState(false)
  const [denying, setDenying] = React.useState(false)
  const [reason, setReason] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (denying) inputRef.current?.focus({ preventScroll: true })
  }, [denying])

  return (
    <div
      data-slot="tool-call-approval"
      className={cn(
        "flex flex-col gap-2",
        inline
          ? "border-(color:--chatcn-border) ms-[15.5px] mb-2 border-s ps-[17.5px] pt-3"
          : "border-(color:--chatcn-border)/70 border-t p-1.5 pl-3.5",
      )}
    >
      {approval.reason ? (
        <p
          className={cn(
            "text-[0.8125rem]/[1.25rem] text-(color:--chatcn-fg-muted) pr-2 text-pretty",
            !inline && "pt-1.5",
          )}
        >
          {approval.reason}
        </p>
      ) : null}

      {denying ? (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(event) => {
            event.preventDefault()
            onDeny?.(approval.id, reason.trim() || undefined)
          }}
        >
          <input
            ref={inputRef}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation()
                setDenying(false)
              }
            }}
            placeholder="Tell the agent what to do instead…"
            aria-label="Reason for denying"
            className={cn(
              "rounded-(--chatcn-radius-sm) text-[0.8125rem]/[1.25rem] text-(color:--chatcn-fg) h-7 min-w-0 flex-1 bg-transparent px-1",
              "placeholder:text-(color:--chatcn-fg-subtle) focus:outline-none",
            )}
          />
          <Button size="sm" onClick={() => setDenying(false)}>
            Back
          </Button>
          <Button type="submit" size="sm" variant="solid">
            Deny
          </Button>
        </form>
      ) : (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            role="switch"
            aria-checked={always}
            onClick={() => setAlways((v) => !v)}
            className={cn(
              "chatcn-focus group/always rounded-(--chatcn-radius-sm) mr-auto inline-flex h-7 min-w-0 items-center gap-2 pr-2",
              "text-[0.8125rem]/[1.25rem] text-(color:--chatcn-fg-muted) hover:text-(color:--chatcn-fg) transition-colors duration-150",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "grid size-3.5 shrink-0 place-items-center rounded-[4px] shadow-[inset_0_0_0_1px_var(--chatcn-border-strong)]",
                "ease-(--chatcn-ease-out) transition-[background-color,box-shadow] duration-150 [&_svg]:size-3",
                always && "bg-(color:--chatcn-accent) text-(color:--chatcn-accent-fg) shadow-none",
              )}
            >
              <CheckIcon
                strokeWidth={2}
                className={cn(
                  "ease-(--chatcn-ease-out) transition-[opacity,scale] duration-150",
                  always ? "scale-100 opacity-100" : "scale-50 opacity-0",
                )}
              />
            </span>
            <span className="truncate">Always allow {toolLabel}</span>
          </button>
          <Button size="sm" onClick={() => setDenying(true)}>
            Deny
          </Button>
          <Button
            size="sm"
            variant="solid"
            onClick={() => onApprove?.(approval.id, always ? "always" : "once")}
          >
            Allow
          </Button>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------------------------------
 * ToolCall
 * -----------------------------------------------------------------------------------------------*/

function ToolCall({
  name,
  title,
  detail,
  icon,
  state,
  input,
  inputText,
  output,
  outputCopyValue,
  meta: metaSlot,
  approvalTarget,
  statusLabel: statusLabelProp,
  errorText,
  approval,
  decision,
  onApprove,
  onDeny,
  onRetry,
  durationMs,
  startedAt,
  variant = "card",
  open: openProp,
  defaultOpen,
  onOpenChange,
  className,
  children,
  ...props
}: ToolCallProps) {
  const label = typeof title === "string" ? title : humanize(name)
  // Lowercase only the first letter, so "Edit file" reads "edit file" but "GitHub search" keeps its case.
  const target =
    approvalTarget ??
    (/^[A-Z][a-z]*(\s|$)/.test(label) ? label.charAt(0).toLowerCase() + label.slice(1) : label)
  const running = isRunning(state, decision)
  const auto = useAutoTiming(running, state === "output-available")
  const elapsed = useElapsed(startedAt ?? auto.startedAt, running)

  // Uncontrolled open state opens itself when the tool needs the user: approval or failure.
  const [openState, setOpenState] = React.useState(
    defaultOpen ?? (state === "approval-requested" || state === "output-error"),
  )
  const open = openProp ?? openState
  const prevState = React.useRef(state)
  React.useEffect(() => {
    if (prevState.current === state) return
    prevState.current = state
    if (openProp === undefined && (state === "approval-requested" || state === "output-error")) {
      setOpenState(true)
    }
  }, [state, openProp])

  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOpenState(next)
    onOpenChange?.(next)
  }

  const streamingInput = state === "input-streaming"
  const shownInput = React.useMemo(() => {
    if (streamingInput && inputText !== undefined) return parsePartialJson(inputText).value
    return input
  }, [streamingInput, inputText, input])

  const hasInput = shownInput !== undefined && shownInput !== null
  const hasOutput = state === "output-available" && output !== undefined
  const statusText = statusLabel({
    state,
    decision,
    durationMs: durationMs ?? auto.durationMs,
    elapsed,
  })
  const shownDetail = detail ?? detailFrom(shownInput)
  const isCard = variant === "card"

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      render={<div />}
      data-slot="tool-call"
      data-tool-state={state}
      data-variant={variant}
      className={cn(
        "group/tool-call text-[0.875rem]/[1.25rem] tracking-[-0.003em] text-(color:--chatcn-fg)",
        isCard && "rounded-(--chatcn-radius-lg) bg-(color:--chatcn-card) shadow-(--chatcn-shadow-sm) overflow-hidden",
        className,
      )}
      {...props}
    >
      <Collapsible.Trigger
        className={cn(
          "flex w-full min-w-0 items-center gap-2.5 text-left outline-none select-none",
          "ease-(--chatcn-ease-standard) transition-colors duration-150",
          "focus-visible:outline-(color:--chatcn-accent) focus-visible:outline-2 focus-visible:-outline-offset-2",
          isCard
            ? "hover:bg-(color:--chatcn-alpha-100) h-10 px-3.5 pointer-coarse:h-11"
            : "rounded-(--chatcn-radius-md) hover:bg-(color:--chatcn-fill-hover) h-8 px-2 pointer-coarse:h-11",
        )}
      >
        <ToolCallStatus state={state} decision={decision} icon={icon ?? iconFor(name)} />
        <span className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="shrink-0 font-medium">{title ?? label}</span>
          {shownDetail ? (
            <span className="text-[0.75rem]/[1rem] text-(color:--chatcn-fg-subtle) truncate font-mono">
              {shownDetail}
            </span>
          ) : null}
        </span>
        {metaSlot ? (
          <span className="text-[0.75rem]/[1rem] text-(color:--chatcn-fg-subtle) shrink-0 tabular-nums">
            {metaSlot}
          </span>
        ) : null}
        <span
          aria-live="polite"
          className={cn(
            "text-[0.75rem]/[1rem] shrink-0 tabular-nums",
            state === "output-error" && statusLabelProp === undefined
              ? "text-(color:--chatcn-red)"
              : "text-(color:--chatcn-fg-subtle)",
          )}
        >
          {statusLabelProp ?? statusText}
        </span>
        <ChevronDownIcon
          aria-hidden="true"
          className={cn(
            "text-(color:--chatcn-fg-subtle) ease-(--chatcn-ease-out) size-4 shrink-0 transition-transform duration-200",
            "group-data-[open]/tool-call:rotate-180 motion-reduce:transition-none",
          )}
        />
      </Collapsible.Trigger>

      <Collapsible.Panel
        className={cn(
          "h-(--collapsible-panel-height) overflow-hidden",
          // Height is the one layout property we animate: Base UI measures it, and it stays
          // short. During streaming the panel is `auto`, so content grows without a transition.
          "ease-(--chatcn-ease-out) transition-[height,opacity] duration-200 motion-reduce:transition-none",
          "data-[ending-style]:h-0 data-[ending-style]:opacity-0 data-[starting-style]:h-0 data-[starting-style]:opacity-0",
        )}
      >
        <div
          className={cn(
            "flex flex-col gap-3",
            isCard
              ? "px-3.5 pt-1 pb-3.5"
              : cn(
                  "border-(color:--chatcn-border) ms-[15.5px] mt-1 border-s ps-[17.5px] pt-1",
                  // An approval below continues the same guide line without a break.
                  state === "approval-requested" && approval ? "mb-0" : "mb-2",
                ),
          )}
        >
          {children ?? (
            <>
              {hasInput ? (
                <ToolCallSection
                  label="Input"
                  action={
                    streamingInput ? null : (
                      <CopyButton
                        size="icon-xs"
                        value={() => stringify(shownInput)}
                        label="Copy input"
                      />
                    )
                  }
                >
                  <ToolCallCode streaming={streamingInput}>
                    {typeof shownInput === "string" ? (
                      shownInput
                    ) : (
                      <JsonValue value={shownInput} depth={0} />
                    )}
                  </ToolCallCode>
                </ToolCallSection>
              ) : streamingInput ? (
                <ToolCallSection label="Input">
                  <ToolCallCode streaming>{""}</ToolCallCode>
                </ToolCallSection>
              ) : null}

              {hasOutput ? (
                <ToolCallSection
                  label="Output"
                  action={
                    outputCopyValue !== undefined || !React.isValidElement(output) ? (
                      <CopyButton
                        size="icon-xs"
                        value={() => outputCopyValue ?? stringify(output)}
                        label="Copy output"
                      />
                    ) : null
                  }
                >
                  {React.isValidElement(output) ? (
                    output
                  ) : (
                    <ToolCallCode>
                      {typeof output === "string" ? output : <JsonValue value={output} depth={0} />}
                    </ToolCallCode>
                  )}
                </ToolCallSection>
              ) : null}

              {state === "output-error" ? (
                <ToolCallSection
                  label="Error"
                  action={
                    onRetry ? (
                      <Button size="xs" onClick={onRetry}>
                        <RotateCcwIcon />
                        Retry
                      </Button>
                    ) : null
                  }
                >
                  <ToolCallCode className="text-(color:--chatcn-fg)">
                    {errorText ?? "The tool failed without a message."}
                  </ToolCallCode>
                </ToolCallSection>
              ) : null}

              {decision ? (
                <p className="text-[0.75rem]/[1rem] text-(color:--chatcn-fg-subtle)">
                  {decision.approved
                    ? decision.scope === "always"
                      ? `Always allowed for ${target}`
                      : "Allowed once"
                    : decision.reason
                      ? `Denied: ${decision.reason}`
                      : "Denied"}
                </p>
              ) : null}
            </>
          )}
        </div>
      </Collapsible.Panel>

      {state === "approval-requested" && approval ? (
        <ToolCallApproval
          inline={!isCard}
          approval={approval}
          toolLabel={target}
          onApprove={onApprove}
          onDeny={onDeny}
        />
      ) : null}
    </Collapsible.Root>
  )
}

const iconNode27: IconNode = [
  ["path", {"d":"M5.75 3.5h12.5a3 3 0 0 1 3 3v6.75a3 3 0 0 1-3 3H5.75a3 3 0 0 1-3-3V6.5a3 3 0 0 1 3-3"}],
  ["path", {"d":"M8 20.25h8"}],
  ["path", {"d":"m10.1 7.35 4.5 1.8a.75.75 0 0 1 0 1.4l-1.6.65a.75.75 0 0 0-.4.4l-.65 1.6a.75.75 0 0 1-1.4 0l-1.8-4.5a.75.75 0 0 1 1.35-1.35"}],
]

const ComputerUseIcon: Icon = /* @__PURE__ */ createIcon("computer-use", iconNode27)

/* -------------------------------------------------------------------------------------------------
 * Shared pieces for renderers
 * -----------------------------------------------------------------------------------------------*/

/** Header detail with a trailing fact that never truncates: `query` + `8 results`. */
function ToolDetail({ children, meta }: { children?: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <span data-slot="tool-detail" className="inline-flex max-w-full min-w-0 items-baseline gap-2">
      {children ? <span className="min-w-0 truncate">{children}</span> : null}
      {meta !== undefined && meta !== null && meta !== false ? (
        <span className="shrink-0 font-sans tabular-nums">{meta}</span>
      ) : null}
    </span>
  )
}

/* -------------------------------------------------------------------------------------------------
 * ToolBrowser
 * -----------------------------------------------------------------------------------------------*/

/**
 * A browser session from an agent: "Browsing palletapp.dev/settings" in the header, the steps it took
 * (open, click, type, scroll) with the running one live, and a screenshot thumbnail with the
 * cursor where it last acted. Select the thumbnail to see the screenshot full size.
 */
export function ToolBrowser({
  title: titleProp,
  name = "browser",
  steps = [],
  url: urlProp,
  pageTitle,
  screenshot: screenshotProp,
  screenshotAlt,
  cursor,
  aspectRatio = 16 / 10,
  loading: loadingProp,
  ...props
}: ToolBrowserProps) {
  const { state, decision, errorText, onRetry } = props
  const running = isToolRunning(state, decision)
  const statuses = resolveStatuses(steps, state, running)
  const current = currentIndex(statuses)
  const step = steps[current]
  const [zoomed, setZoomed] = React.useState(false)

  const lastNavigate = [...steps].reverse().find((s) => s.kind === "navigate" && s.url)
  const url = urlProp ?? lastNavigate?.url
  // The cursor rests at the last point the agent acted on, so it does not jump between steps.
  const pointStep = cursor
    ? undefined
    : [...steps.slice(0, current + 1)].reverse().find((s) => hasPoint(s))
  const point = cursor ?? (hasPoint(pointStep) ? { x: pointStep.x, y: pointStep.y } : undefined)
  const clickIndex = step?.kind === "click" && hasPoint(step) ? current : -1
  const clickKey = clickIndex >= 0 ? `${clickIndex}-${step?.target ?? ""}` : undefined
  const loading =
    loadingProp ?? (running && step?.kind === "navigate" && statuses[current] === "running")

  const screenshot =
    typeof screenshotProp === "string" ? (
      <img
        src={screenshotProp}
        alt={screenshotAlt ?? (url ? `Screenshot of ${shortUrl(url)}` : "Screenshot")}
        className="absolute inset-0 size-full object-cover object-top"
        draggable={false}
      />
    ) : (
      screenshotProp
    )
  const alt =
    typeof screenshotProp === "string"
      ? undefined
      : (screenshotAlt ?? (url ? `Screenshot of ${shortUrl(url)}` : undefined))

  const hasScreen = screenshot !== undefined && screenshot !== null
  const showScreen = hasScreen || (running && state !== "input-streaming" && steps.length > 0)
  const done = state === "output-available"
  const screenProps: BrowserScreenProps = {
    url,
    pageTitle,
    screenshot,
    screenshotAlt: alt,
    point,
    clickKey,
    loading,
    waiting: running,
    aspectRatio,
  }

  const body =
    steps.length > 0 || hasScreen ? (
      <div data-slot="tool-browser" className="@container/tool-browser flex min-w-0 flex-col gap-3">
        <div
          className={cn(
            "grid min-w-0 gap-3",
            showScreen && "@lg/tool-browser:grid-cols-[minmax(0,1fr)_minmax(0,15rem)]",
          )}
        >
          {steps.length > 0 ? (
            <ol
              aria-label="Browser steps"
              className="order-2 flex min-w-0 flex-col @lg/tool-browser:order-1"
            >
              {steps.map((s, i) => (
                <BrowserStepRow
                  // Steps are append only, so the index is a stable key.
                  key={i}
                  step={s}
                  status={statuses[i] ?? "pending"}
                />
              ))}
            </ol>
          ) : null}
          {showScreen ? (
            // The screen is a picture of a page, so it sits beside the button, not inside it:
            // the button's name stays "Open screenshot of ..." and nothing on the page becomes
            // part of it.
            <div className="relative order-1 w-full max-w-sm min-w-0 @lg/tool-browser:order-2 @lg/tool-browser:max-w-none @lg/tool-browser:self-start">
              <div className="rounded-(--chatcn-radius-md) shadow-(--chatcn-shadow-border) bg-(color:--chatcn-bg) overflow-hidden">
                <BrowserScreen {...screenProps} />
              </div>
              <button
                type="button"
                onClick={() => setZoomed(true)}
                disabled={!hasScreen}
                aria-label={url ? `Open screenshot of ${shortUrl(url)}` : "Open screenshot"}
                className={cn(
                  "group/screen chatcn-focus rounded-(--chatcn-radius-md) absolute inset-0 z-20 block",
                  hasScreen && "cursor-zoom-in",
                )}
              >
                {hasScreen ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "bg-(color:--chatcn-surface) text-(color:--chatcn-fg-muted) shadow-(--chatcn-shadow-sm) rounded-(--chatcn-radius-sm) absolute end-1.5 bottom-1.5 grid size-6 place-items-center [&_svg]:size-3.5",
                      "ease-(--chatcn-ease-out) opacity-0 transition-opacity duration-150 group-hover/screen:opacity-100 group-focus-visible/screen:opacity-100 pointer-coarse:opacity-100",
                    )}
                  >
                    <Maximize2Icon />
                  </span>
                ) : null}
              </button>
            </div>
          ) : null}
        </div>

        {state === "output-error" ? (
          <ToolCallSection
            label="Error"
            action={
              onRetry ? (
                <Button size="xs" onClick={onRetry}>
                  <RotateCcwIcon />
                  Retry
                </Button>
              ) : null
            }
          >
            <ToolCallCode className="text-(color:--chatcn-fg)">
              {errorText ?? "The browser stopped without a message."}
            </ToolCallCode>
          </ToolCallSection>
        ) : null}

        {decision ? (
          <p className="text-[0.75rem]/[1rem] text-(color:--chatcn-fg-subtle)">
            {decision.approved
              ? decision.scope === "always"
                ? "Always allowed for the browser"
                : "Allowed once"
              : decision.reason
                ? `Denied: ${decision.reason}`
                : "Denied"}
          </p>
        ) : null}

        {hasScreen ? (
          <Dialog open={zoomed} onOpenChange={setZoomed}>
            <DialogContent size="xl" className="overflow-hidden p-0" showClose={false}>
              <DialogTitle className="sr-only">
                {url ? `Screenshot of ${shortUrl(url)}` : "Screenshot"}
              </DialogTitle>
              <BrowserScreen {...screenProps} size="full" />
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
    ) : undefined

  const doneCount = statuses.filter((s) => s === "done").length
  const meta =
    steps.length > 1
      ? running && state !== "input-streaming"
        ? `${Math.min(doneCount + 1, steps.length)} of ${steps.length}`
        : plural(steps.length, "step")
      : undefined

  return (
    <ToolCall
      name={name}
      icon={<ComputerUseIcon />}
      title={titleProp ?? (running ? "Browsing" : done ? "Browsed" : "Browse")}
      detail={<ToolDetail meta={meta}>{url ? shortUrl(url) : undefined}</ToolDetail>}
      approvalTarget="the browser"
      defaultOpen={props.defaultOpen ?? (running || state === "output-error")}
      {...props}
    >
      {body}
    </ToolCall>
  )
}

/** True once a tool call will not change again. */
function isTerminalToolState(state: ToolDisplayState): boolean {
  return (
    state === "output-available" ||
    state === "output-error" ||
    state === "output-denied" ||
    state === "cancelled"
  )
}

/** Display state for a tool part; unfinished calls in a stopped response become `cancelled`. */
function getToolDisplayState(
  part: Pick<ChatcnToolPart, "state">,
  options?: { stopped?: boolean },
): ToolDisplayState {
  return options?.stopped && !isTerminalToolState(part.state) ? "cancelled" : part.state
}

/** Tool name for `tool-${name}` and `dynamic-tool` parts. */
function getToolName(part: Pick<ChatcnToolPart, "type" | "toolName">): string {
  if (part.type === "dynamic-tool") return part.toolName ?? ""
  return part.type.slice("tool-".length)
}

/* -------------------------------------------------------------------------------------------------
 * From a message part
 * -----------------------------------------------------------------------------------------------*/

/**
 * Maps a tool part (chatcn contract or AI SDK `UIMessage` part) to `ToolCall` props.
 * `<ToolCall {...toolCallPropsFromPart(part)} onApprove={...} />`
 */
function toolCallPropsFromPart(
  part: ChatcnToolPart,
  options?: { stopped?: boolean },
): Pick<
  ToolCallProps,
  "name" | "state" | "input" | "inputText" | "output" | "errorText" | "approval" | "decision"
> &
  Partial<Pick<ToolCallProps, "title">> {
  const state = getToolDisplayState(part, options)
  const approval = part.approval
  return {
    name: getToolName(part),
    ...(part.title ? { title: part.title } : {}),
    state,
    input: part.input,
    inputText: typeof part.rawInput === "string" ? part.rawInput : undefined,
    output: part.output,
    errorText: part.errorText,
    approval:
      approval && state === "approval-requested"
        ? { id: approval.id, reason: approval.requestReason }
        : undefined,
    decision:
      approval && approval.approved !== undefined
        ? { approved: approval.approved, reason: approval.reason }
        : undefined,
  }
}

/**
 * Lifecycle props from a tool part. A `preliminary` output (a tool still streaming its result)
 * keeps the call in its running state, so timers keep ticking and output keeps streaming.
 */
export function toolBasePropsFromPart({
  part,
  stopped,
  variant,
  onApprove,
  onDeny,
  onRetry,
  durationMs,
  startedAt,
  open,
  defaultOpen,
  onOpenChange,
  className,
}: ToolRendererProps): ToolBaseProps {
  const { name, state, errorText, approval, decision } = toolCallPropsFromPart(part, { stopped })
  const preliminary = part.preliminary === true && state === "output-available"
  return {
    name,
    state: preliminary ? (stopped ? "cancelled" : "input-available") : state,
    errorText,
    approval,
    decision,
    variant,
    onApprove,
    onDeny,
    onRetry,
    durationMs,
    startedAt,
    open,
    defaultOpen,
    onOpenChange,
    className,
  }
}

/**
 * Reads a browser tool part. Input: a list of `steps` (or `actions`), or one action such as
 * `{ action: "click", element: "Sign in" }`. Output: `url`, `title`, `screenshot` (a URL or a
 * data URL), `cursor`, and `steps` with live statuses. Stream progress as a `preliminary` output.
 */
export function ToolBrowserPart(props: ToolRendererProps) {
  const { part } = props
  const toolKind = toKind(part.type.replace(/^tool-/, "")) ?? toKind(part.toolName)
  const output = asRecord(part.output)
  const outputSteps = toSteps(output.steps ?? output.actions)
  const steps = outputSteps.length ? outputSteps : toSteps(part.input, toolKind)
  const cursor = asRecord(output.cursor)
  const cx = pickNumber(cursor, "x")
  const cy = pickNumber(cursor, "y")
  return (
    <ToolBrowser
      {...toolBasePropsFromPart(props)}
      steps={steps}
      url={pickString(output, "url") ?? pickString(part.input, "url")}
      pageTitle={pickString(output, "title", "pageTitle")}
      screenshot={pickString(output, "screenshot", "screenshotUrl", "image")}
      cursor={cx !== undefined && cy !== undefined ? { x: cx, y: cy } : undefined}
    />
  )
}

/** Tool names this renderer handles. Spread into your renderer map. */
export const toolBrowserRenderers: ToolRendererMap = {
  browser: ToolBrowserPart,
  browser_action: ToolBrowserPart,
  browser_use: ToolBrowserPart,
  use_browser: ToolBrowserPart,
  browser_navigate: ToolBrowserPart,
  browser_click: ToolBrowserPart,
  browser_type: ToolBrowserPart,
  browser_scroll: ToolBrowserPart,
  browser_press_key: ToolBrowserPart,
  browser_take_screenshot: ToolBrowserPart,
}

export default ToolBrowser
