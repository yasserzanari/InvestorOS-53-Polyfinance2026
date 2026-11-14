"use client"

// From chatcn, chat, voice and agent UI for shadcn: https://chatcn.dev

import * as React from "react"
import { forwardRef, createElement, type SVGAttributes, type ForwardRefExoticComponent, type RefAttributes } from "react"
import { cn } from "../../../shared/utils"
import { Collapsible } from "@base-ui/react/collapsible"

/** chatcn theme variables and utilities this file uses, light and dark. */
const CHATCN_CSS = ":root{--chatcn-accent:var(--chatcn-gray-1000);--chatcn-amber:oklch(0.555 0.125 60);--chatcn-bg:oklch(1 0 0);--chatcn-blue:oklch(0.550 0.180 258);--chatcn-border:var(--chatcn-gray-400);--chatcn-border-strong:var(--chatcn-gray-600);--chatcn-card:oklch(1 0 0);--chatcn-ease-out:cubic-bezier(0.23, 1, 0.32, 1);--chatcn-ease-standard:ease;--chatcn-fg:var(--chatcn-gray-1000);--chatcn-fg-faint:var(--chatcn-gray-700);--chatcn-fg-muted:var(--chatcn-gray-900);--chatcn-fg-subtle:var(--chatcn-gray-800);--chatcn-fill:var(--chatcn-gray-100);--chatcn-fill-hover:var(--chatcn-gray-200);--chatcn-gray-100:oklch(0.970 0 0);--chatcn-gray-1000:oklch(0.145 0 0);--chatcn-gray-200:oklch(0.950 0 0);--chatcn-gray-400:oklch(0.910 0 0);--chatcn-gray-600:oklch(0.800 0 0);--chatcn-gray-700:oklch(0.700 0 0);--chatcn-gray-800:oklch(0.525 0 0);--chatcn-gray-900:oklch(0.440 0 0);--chatcn-green:oklch(0.530 0.130 150);--chatcn-press-scale:0.97;--chatcn-press-scale-icon:0.94;--chatcn-primary:var(--chatcn-gray-1000);--chatcn-primary-fg:var(--chatcn-bg);--chatcn-primary-hover:var(--chatcn-gray-900);--chatcn-radius-md:8px;--chatcn-radius-sm:6px;--chatcn-red:oklch(0.560 0.200 27);--chatcn-shadow-xs:0 0 0 1px oklch(0 0 0 / 0.08), 0 1px 2px oklch(0 0 0 / 0.04)}.dark{--chatcn-accent:var(--chatcn-gray-1000);--chatcn-amber:oklch(0.800 0.140 74);--chatcn-bg:oklch(0.145 0 0);--chatcn-blue:oklch(0.710 0.140 252);--chatcn-border:var(--chatcn-gray-400);--chatcn-border-strong:var(--chatcn-gray-600);--chatcn-card:oklch(0.175 0 0);--chatcn-fg:var(--chatcn-gray-1000);--chatcn-fg-faint:var(--chatcn-gray-700);--chatcn-fg-muted:var(--chatcn-gray-900);--chatcn-fg-subtle:var(--chatcn-gray-800);--chatcn-fill:var(--chatcn-gray-100);--chatcn-fill-hover:var(--chatcn-gray-200);--chatcn-gray-100:oklch(0.195 0 0);--chatcn-gray-1000:oklch(0.970 0 0);--chatcn-gray-200:oklch(0.225 0 0);--chatcn-gray-400:oklch(0.285 0 0);--chatcn-gray-600:oklch(0.410 0 0);--chatcn-gray-700:oklch(0.500 0 0);--chatcn-gray-800:oklch(0.620 0 0);--chatcn-gray-900:oklch(0.720 0 0);--chatcn-green:oklch(0.760 0.150 152);--chatcn-primary:var(--chatcn-gray-1000);--chatcn-primary-fg:var(--chatcn-bg);--chatcn-primary-hover:var(--chatcn-gray-900);--chatcn-red:oklch(0.700 0.175 22);--chatcn-shadow-xs:0 0 0 1px oklch(1 0 0 / 0.08), 0 1px 2px oklch(0 0 0 / 0.4)}.chatcn-focus{}.chatcn-focus:focus-visible{outline: 2px solid var(--chatcn-accent); outline-offset: 2px;}.chatcn-shimmer{color: transparent; background-image: linear-gradient(90deg, var(--chatcn-fg-subtle) 0%, var(--chatcn-fg-subtle) 40%, var(--chatcn-fg) 50%, var(--chatcn-fg-subtle) 60%, var(--chatcn-fg-subtle) 100%); background-size: 250% 100%; background-clip: text; -webkit-background-clip: text; animation: chatcn-shimmer 1.6s linear infinite;}.chatcn-spin{animation: chatcn-spin 0.8s linear infinite;}@keyframes chatcn-spin { to { transform: rotate(360deg); } }@keyframes chatcn-shimmer { from { background-position: 100% 0; } to { background-position: 0% 0; } }@media (prefers-reduced-motion: reduce){.chatcn-shimmer{animation:none;color:var(--chatcn-fg-subtle);background-image:none}}@media (prefers-reduced-motion: reduce){:root{--chatcn-press-scale:1;--chatcn-press-scale-icon:1;--chatcn-enter-scale:1}}"
if (typeof document !== "undefined" && !document.getElementById("chatcn-subagent")) {
  const style = document.createElement("style")
  style.id = "chatcn-subagent"
  style.textContent = CHATCN_CSS
  document.head.appendChild(style)
}

/* -------------------------------------------------------------------------------------------------
 * Types
 * -----------------------------------------------------------------------------------------------*/

export type SubagentStatus = "spawning" | "running" | "waiting" | "done" | "failed" | "cancelled"

/* -------------------------------------------------------------------------------------------------
 * Status
 *
 * One vocabulary for plan steps, todos and tasks. It maps one to one onto Claude Code TodoWrite
 * (`pending`, `in_progress`, `completed`) and adds the states a real run also hits.
 * -----------------------------------------------------------------------------------------------*/

type TaskStatus =
  | "pending"
  | "in-progress"
  | "done"
  | "blocked"
  | "skipped"
  | "failed"
  | "cancelled"

export interface SubagentStep {
  id: string
  /** What the step did: "Read", "Searched". */
  label: string
  /** Mono context: a path, a query, a command. */
  detail?: string
  status: TaskStatus
}

export interface SubagentProps extends Omit<React.ComponentProps<"div">, "title"> {
  /** The subagent's name: "Explore agent". */
  name: React.ReactNode
  status: SubagentStatus
  /** What it was asked to do. Shown at the top of the expanded trace. */
  task?: React.ReactNode
  /**
   * What it is doing right now, one line: "Reading src/app/runs/page.tsx". Changes crossfade in
   * place. While done, the first line of `summary` takes this spot.
   */
  activity?: string
  /** The result it handed back. Shown when done or failed. */
  summary?: React.ReactNode
  /** One-line text for the folded row once done. Defaults to `summary` when it is a string. */
  summaryLine?: string
  /** Its steps, rendered as a compact trace. Pass `children` instead for a full custom trace. */
  steps?: SubagentStep[]
  /** Tool calls so far, shown as "8 tools" next to the timer. */
  toolCount?: number
  durationMs?: number
  startedAt?: number
  /** Replaces the glyph at rest (done). Defaults to the subagent icon. */
  icon?: React.ReactNode
  /** Retry a failed subagent. Shows Retry under its error, in place. */
  onRetry?: () => void
  /** The expanded trace. Nest `Subagent`s inside to show agents that spawn agents. */
  children?: React.ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

function firstLine(node: React.ReactNode) {
  return typeof node === "string" ? (node.split("\n")[0] ?? "") : undefined
}

interface StepTimerProps extends Omit<React.ComponentProps<"span">, "children" | "prefix"> {
  /** True while the step runs. The counter ticks once per second, in whole seconds. */
  running?: boolean
  /** Epoch ms when the step started. Measured from the first running render when omitted. */
  startedAt?: number
  /** Final duration. Shown once `running` is false. */
  durationMs?: number
  /**
   * Hide the live counter until this much time has passed, so quick steps never flash a timer.
   * Defaults to 1000 ms.
   */
  showAfter?: number
  /** Shown while running before `showAfter`, for example "Running". Nothing by default. */
  placeholder?: React.ReactNode
  /** Format for the final duration: `precise` keeps decimals under 10 s. Defaults to true. */
  precise?: boolean
  /** Text before the time, for example "Thought for". */
  prefix?: React.ReactNode
}

interface UseChatcnElapsedOptions {
  /** True while the timed work is happening. */
  running: boolean
  /** Epoch ms when the work started. Measured from the first `running` render when omitted. */
  startedAt?: number
  /** Final duration from the runtime. Wins over the measured one once `running` is false. */
  durationMs?: number
}

interface UseChatcnElapsedResult {
  /** Live elapsed ms while running, the final duration afterwards, `undefined` when unknown. */
  ms: number | undefined
  running: boolean
}

/**
 * Elapsed time for a step, a run or a reasoning block.
 *
 * Ticks once per second, aligned to the start time so the counter turns over exactly at 1 s,
 * 2 s and so on, never at random offsets. A counter that changes faster only adds noise.
 */
function useChatcnElapsed({
  running,
  startedAt,
  durationMs,
}: UseChatcnElapsedOptions): UseChatcnElapsedResult {
  const [autoStart, setAutoStart] = React.useState<number>()
  const [measured, setMeasured] = React.useState<number>()
  // Starts empty and reads the clock after mount: a render must not read it (Next.js prerender).
  const [now, setNow] = React.useState<number | null>(null)
  const start = startedAt ?? autoStart

  // Record our own start when the caller gives none. A new run (running again) starts over.
  React.useEffect(() => {
    if (!running) return
    if (startedAt === undefined) setAutoStart((prev) => prev ?? Date.now())
    setMeasured(undefined)
    setNow(Date.now())
  }, [running, startedAt])

  // Freeze the measured duration when the work stops.
  const wasRunning = React.useRef(running)
  React.useEffect(() => {
    if (wasRunning.current && !running && start !== undefined) {
      setMeasured(Date.now() - start)
      setAutoStart(undefined)
    }
    wasRunning.current = running
  }, [running, start])

  React.useEffect(() => {
    if (!running || start === undefined) return
    let id: number
    const schedule = () => {
      const elapsed = Date.now() - start
      // Next whole-second boundary, plus a few ms so rounding never shows the old second.
      const wait = 1000 - (((elapsed % 1000) + 1000) % 1000) + 8
      id = window.setTimeout(() => {
        setNow(Date.now())
        schedule()
      }, wait)
    }
    schedule()
    return () => window.clearTimeout(id)
  }, [running, start])

  if (running)
    return { ms: start === undefined ? undefined : Math.max(0, (now ?? start) - start), running }
  return { ms: durationMs ?? measured, running }
}

const NBSP = " "

/**
 * Formats a duration the chatcn way: numerals, a non-breaking space before the unit.
 * `precise` (the default) keeps a decimal under 10 s and milliseconds under 1 s, for finished
 * steps. Turn it off for live counters and "Thought for 12 s", which read in whole seconds.
 */
function formatChatcnDuration(ms: number, { precise = true }: { precise?: boolean } = {}) {
  const safe = Math.max(0, ms)
  if (precise && safe < 1000) return `${Math.max(1, Math.round(safe))}${NBSP}ms`
  const s = safe / 1000
  if (precise && s < 10) return `${s.toFixed(1)}${NBSP}s`
  if (s < 60) return `${precise ? Math.round(s) : Math.floor(s)}${NBSP}s`
  const totalS = Math.floor(s)
  const h = Math.floor(totalS / 3600)
  const m = Math.floor((totalS % 3600) / 60)
  const rest = totalS % 60
  if (h > 0) return `${h}${NBSP}h ${m}${NBSP}m`
  return `${m}${NBSP}m ${rest}${NBSP}s`
}

function isoDuration(ms: number) {
  return `PT${Math.max(0, Math.round(ms / 100) / 10)}S`
}

/**
 * Elapsed and final duration for a step, set in tabular figures so the width never jitters.
 * Not a live region: a timer that speaks every second is noise. Announce completion elsewhere.
 */
function StepTimer({
  running = false,
  startedAt,
  durationMs,
  showAfter = 1000,
  placeholder = null,
  precise = true,
  prefix,
  className,
  ...props
}: StepTimerProps) {
  const { ms } = useChatcnElapsed({ running, startedAt, durationMs })

  let time: string | null = null
  if (running && ms !== undefined && ms >= showAfter)
    time = formatChatcnDuration(ms, { precise: false })
  else if (!running && ms !== undefined) time = formatChatcnDuration(ms, { precise })
  const content = time ?? (running ? placeholder : null)

  if (content === null || content === undefined) return null

  return (
    <span
      data-slot="step-timer"
      data-running={running ? "" : undefined}
      role={running ? "timer" : undefined}
      className={cn("text-[0.75rem]/[1rem] text-(color:--chatcn-fg-subtle) tabular-nums", className)}
      {...props}
    >
      {/* The placeholder stands alone; a prefix only reads well in front of a time. */}
      {prefix && time !== null ? <>{prefix} </> : null}
      {time !== null && ms !== undefined ? <time dateTime={isoDuration(ms)}>{time}</time> : content}
    </span>
  )
}

const STATUS_TEXT: Record<SubagentStatus, string> = {
  spawning: "Starting",
  running: "Running",
  waiting: "Waiting for input",
  done: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
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
  ["path", {"d":"M5 3h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2"}],
  ["path", {"d":"M6.5 11.5v4.25a2.5 2.5 0 0 0 2.5 2.5h3.75"}],
  ["path", {"d":"M6.5 12h6.25"}],
  ["path", {"d":"M15.75 9.75h2A1.25 1.25 0 0 1 19 11v2a1.25 1.25 0 0 1-1.25 1.25h-2A1.25 1.25 0 0 1 14.5 13v-2a1.25 1.25 0 0 1 1.25-1.25"}],
  ["path", {"d":"M15.75 16h2A1.25 1.25 0 0 1 19 17.25v2a1.25 1.25 0 0 1-1.25 1.25h-2a1.25 1.25 0 0 1-1.25-1.25v-2A1.25 1.25 0 0 1 15.75 16"}],
]

const SubagentIcon: Icon = /* @__PURE__ */ createIcon("subagent", iconNode)

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

const iconNode2: IconNode = [
  ["path", {"d":"M6.25 14.5V8.25A1.75 1.75 0 0 1 8 6.5a1.75 1.75 0 0 1 1.75 1.75v3.25"}],
  ["path", {"d":"M9.75 11V6a1.75 1.75 0 0 1 1.75-1.75A1.75 1.75 0 0 1 13.25 6v5"}],
  ["path", {"d":"M13.25 11V7A1.75 1.75 0 0 1 15 5.25 1.75 1.75 0 0 1 16.75 7v4.5"}],
  ["path", {"d":"M16.75 12v-2a1.75 1.75 0 0 1 1.75-1.75A1.75 1.75 0 0 1 20.25 10v6.75a4.5 4.5 0 0 1-4.5 4.5H10.1a3 3 0 0 1-2.25-1.01l-4.32-4.89a1.25 1.25 0 0 1-.2-1.33l.02-.06a1.25 1.25 0 0 1 1.91-.48l.99.77"}],
]

const HandIcon: Icon = /* @__PURE__ */ createIcon("hand", iconNode2)

const iconNode3: IconNode = [
  ["path", {"d":"M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0"}],
  ["path", {"d":"m9 9 6 6"}],
  ["path", {"d":"m15 9-6 6"}],
]

const CircleXIcon: Icon = /* @__PURE__ */ createIcon("circle-x", iconNode3)

const iconNode4: IconNode = [
  ["path", {"d":"M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0"}],
  ["path", {"d":"M10.75 8.75h2.5a2 2 0 0 1 2 2v2.5a2 2 0 0 1-2 2h-2.5a2 2 0 0 1-2-2v-2.5a2 2 0 0 1 2-2"}],
]

const CircleStopIcon: Icon = /* @__PURE__ */ createIcon("circle-stop", iconNode4)

/* -------------------------------------------------------------------------------------------------
 * Parts
 * -----------------------------------------------------------------------------------------------*/

function SubagentGlyph({ status, icon }: { status: SubagentStatus; icon?: React.ReactNode }) {
  let glyph: React.ReactNode = icon ?? <SubagentIcon />
  let tone = "text-(color:--chatcn-fg-subtle)"
  if (status === "running" || status === "spawning") {
    glyph = <Spinner />
    tone = "text-(color:--chatcn-blue)"
  } else if (status === "waiting") {
    glyph = <HandIcon />
    tone = "text-(color:--chatcn-amber)"
  } else if (status === "failed") {
    glyph = <CircleXIcon />
    tone = "text-(color:--chatcn-red)"
  } else if (status === "cancelled") {
    glyph = <CircleStopIcon />
  }
  const key = status === "spawning" ? "running" : status
  return (
    <span
      aria-hidden="true"
      data-slot="subagent-status"
      className={cn("grid size-4 shrink-0 place-items-center [&_svg]:size-4", tone)}
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

/* -------------------------------------------------------------------------------------------------
 * Crossfading text
 * -----------------------------------------------------------------------------------------------*/

interface SwapItem {
  key: number
  text: string
  leaving: boolean
}

/**
 * One line of text that crossfades when it changes: the old line fades out over 110 ms while the
 * new one fades in over 150 ms in the same spot. No slide, no ticker, no layout shift.
 */
export function CrossfadeText({ text, className }: { text: string; className?: string }) {
  const [items, setItems] = React.useState<SwapItem[]>(() => [{ key: 0, text, leaving: false }])
  const counter = React.useRef(0)

  React.useEffect(() => {
    setItems((prev) => {
      const current = prev[prev.length - 1]
      if (current && current.text === text && !current.leaving) return prev
      counter.current += 1
      return [
        ...prev.filter((i) => !i.leaving).map((i) => ({ ...i, leaving: true })),
        { key: counter.current, text, leaving: false },
      ]
    })
  }, [text])

  const hasLeaving = items.some((i) => i.leaving)
  React.useEffect(() => {
    if (!hasLeaving) return
    const id = window.setTimeout(() => setItems((prev) => prev.filter((i) => !i.leaving)), 160)
    return () => window.clearTimeout(id)
  }, [hasLeaving])

  return (
    <span data-slot="crossfade-text" className={cn("grid min-w-0", className)}>
      {items.map((item) => (
        <span
          key={item.key}
          aria-hidden={item.leaving || undefined}
          className={cn(
            "col-start-1 row-start-1 min-w-0 truncate",
            "ease-(--chatcn-ease-out) transition-opacity",
            item.leaving ? "opacity-0 duration-110" : "opacity-100 duration-150",
            item.key > 0 && "starting:opacity-0",
          )}
        >
          {item.text}
        </span>
      ))}
    </span>
  )
}

const iconNode5: IconNode = [
  ["path", {"d":"m6 9.25 4.23 4.23a2.5 2.5 0 0 0 3.54 0L18 9.25"}],
]

const ChevronDownIcon: Icon = /* @__PURE__ */ createIcon("chevron-down", iconNode5)

interface TaskStatusGlyphProps {
  status: TaskStatus
  className?: string
}

/**
 * Remembers whether a value has changed since mount, so a list of 40 finished todos mounts still
 * and only a todo that finishes while you watch plays its check.
 */
function useChangedSinceMount<T>(value: T) {
  const first = React.useRef(value)
  const changed = React.useRef(false)
  if (!Object.is(value, first.current)) changed.current = true
  return changed.current
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  )
}

const iconNode6: IconNode = [
  ["path", {"d":"m4.5 12.75 3.23 3.23a2.5 2.5 0 0 0 3.54 0l8.48-8.48"}],
]

const CheckIcon: Icon = /* @__PURE__ */ createIcon("check", iconNode6)

/**
 * The check inside the done disc. When it appears after a real change it draws itself with a
 * 180 ms stroke, the one moment of reward in a plan. Static under reduced motion.
 */
function DrawnCheck({ draw }: { draw: boolean }) {
  const ref = React.useRef<SVGSVGElement>(null)
  React.useLayoutEffect(() => {
    if (!draw || prefersReducedMotion()) return
    const path = ref.current?.querySelector("path")
    if (!path || typeof path.animate !== "function") return
    const length = path.getTotalLength()
    const animation = path.animate(
      [
        { strokeDasharray: `${length}`, strokeDashoffset: `${length}` },
        { strokeDasharray: `${length}`, strokeDashoffset: "0" },
      ],
      { duration: 180, delay: 40, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "backwards" },
    )
    return () => animation.cancel()
  }, [draw])
  return <CheckIcon ref={ref} absoluteStrokeWidth strokeWidth={1.75} className="size-2.5" />
}

const iconNode7: IconNode = [
  ["path", {"d":"M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0"}],
  ["path", {"d":"M8 12h8"}],
]

const CircleMinusIcon: Icon = /* @__PURE__ */ createIcon("circle-minus", iconNode7)

const iconNode8: IconNode = [
  ["path", {"d":"M20.85 13.64a9 9 0 0 1-1.43 3.46"}],
  ["path", {"d":"M17.1 19.42a9 9 0 0 1-3.46 1.43"}],
  ["path", {"d":"M10.36 20.85a9 9 0 0 1-3.46-1.43"}],
  ["path", {"d":"M4.58 17.1a9 9 0 0 1-1.43-3.46"}],
  ["path", {"d":"M3.15 10.36A9 9 0 0 1 4.58 6.9"}],
  ["path", {"d":"M6.9 4.58a9 9 0 0 1 3.46-1.43"}],
  ["path", {"d":"M13.64 3.15a9 9 0 0 1 3.46 1.43"}],
  ["path", {"d":"M19.42 6.9a9 9 0 0 1 1.43 3.46"}],
]

const CircleDashedIcon: Icon = /* @__PURE__ */ createIcon("circle-dashed", iconNode8)

/**
 * A 16 px status glyph built on one 14 px circle: a ring waiting, a spinner working, an ink disc
 * with a check when done. Blocked, skipped, failed and cancelled use circled icons of the same
 * size, so a column of mixed states stays perfectly aligned.
 */
function TaskStatusGlyph({ status, className }: TaskStatusGlyphProps) {
  const changed = useChangedSinceMount(status)
  let glyph: React.ReactNode
  let tone = "text-(color:--chatcn-fg-subtle)"

  switch (status) {
    case "in-progress":
      glyph = <Spinner className="size-3.5" />
      tone = "text-(color:--chatcn-blue)"
      break
    case "done":
      glyph = (
        <span className="bg-(color:--chatcn-green) text-(color:--chatcn-bg) grid size-3.5 place-items-center rounded-full">
          <DrawnCheck draw={changed} />
        </span>
      )
      break
    case "blocked":
      glyph = <CircleMinusIcon className="size-4" />
      tone = "text-(color:--chatcn-amber)"
      break
    case "skipped":
      glyph = <CircleDashedIcon className="size-4" />
      tone = "text-(color:--chatcn-fg-faint)"
      break
    case "failed":
      glyph = <CircleXIcon className="size-4" />
      tone = "text-(color:--chatcn-red)"
      break
    case "cancelled":
      glyph = <CircleStopIcon className="size-4" />
      break
    default:
      glyph = (
        <span className="size-3.5 rounded-full shadow-[inset_0_0_0_1.5px_var(--chatcn-border-strong)]" />
      )
  }

  return (
    <span
      aria-hidden="true"
      data-slot="task-status"
      data-task-status={status}
      className={cn("relative grid size-4 shrink-0 place-items-center", tone, className)}
    >
      <span
        key={status}
        className={cn(
          "grid place-items-center",
          changed && "motion-safe:animate-[chatcn-swap_150ms_var(--chatcn-ease-out)]",
        )}
      >
        {glyph}
      </span>
    </span>
  )
}

/** A compact trace for `steps`: 28 px rows, status glyph, label, mono detail. */
function SubagentSteps({ steps }: { steps: SubagentStep[] }) {
  return (
    <ol data-slot="subagent-steps" className="flex flex-col">
      {steps.map((step) => (
        <li key={step.id} className="flex h-7 min-w-0 items-center gap-2.5">
          <TaskStatusGlyph status={step.status} />
          <span
            className={cn(
              "text-[0.8125rem]/[1.25rem] shrink-0",
              step.status === "pending" ? "text-(color:--chatcn-fg-subtle)" : "text-(color:--chatcn-fg)",
            )}
          >
            {step.label}
          </span>
          {step.detail ? (
            <span className="text-[0.75rem]/[1rem] text-(color:--chatcn-fg-subtle) min-w-0 truncate font-mono">
              {step.detail}
            </span>
          ) : null}
        </li>
      ))}
    </ol>
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

const iconNode9: IconNode = [
  ["path", {"d":"M5.49 17.46A8.5 8.5 0 1 0 6.54 5.49"}],
  ["path", {"d":"m8.21 8.65-2.94-.26a2 2 0 0 1-1.82-2.16l.26-2.94"}],
]

const RotateCcwIcon: Icon = /* @__PURE__ */ createIcon("rotate-ccw", iconNode9)

/* -------------------------------------------------------------------------------------------------
 * Subagent
 * -----------------------------------------------------------------------------------------------*/

/**
 * A subagent, folded to one line that says what it is doing right now. Expand it to see its own
 * trace on a rail, and its result once it is done. Nest them for agents that spawn agents.
 */
export function Subagent({
  name,
  status,
  task,
  activity,
  summary,
  summaryLine,
  steps,
  toolCount,
  durationMs,
  startedAt,
  icon,
  onRetry,
  children,
  open,
  defaultOpen,
  onOpenChange,
  className,
  ...props
}: SubagentProps) {
  const working = status === "running" || status === "spawning"
  // Opened by the status it mounts with (a failure opens it); later status changes do not fight
  // an uncontrolled panel.
  const [initialOpen] = React.useState(
    () => defaultOpen ?? (status === "failed" || status === "waiting"),
  )
  const settled = status === "done" || status === "failed" || status === "cancelled"
  const line =
    status === "spawning"
      ? undefined
      : status === "waiting"
        ? (activity ?? "Waiting for input")
        : settled
          ? (summaryLine ?? firstLine(summary) ?? activity)
          : activity
  const hasTrace =
    (children !== undefined && children !== null && children !== false) ||
    (steps !== undefined && steps.length > 0) ||
    task !== undefined ||
    summary !== undefined ||
    (status === "failed" && onRetry !== undefined)

  let tail: React.ReactNode = null
  if (working || status === "done") {
    tail = (
      <StepTimer
        running={working}
        startedAt={startedAt}
        durationMs={durationMs}
        className="text-inherit"
      />
    )
  } else if (status === "failed") tail = <span className="text-(color:--chatcn-red)">Failed</span>
  else if (status === "cancelled" || status === "waiting") tail = <span>{STATUS_TEXT[status]}</span>

  const meta = (
    <span className="text-[0.75rem]/[1rem] text-(color:--chatcn-fg-subtle) flex shrink-0 items-center gap-1.5 tabular-nums">
      {toolCount !== undefined ? (
        <span>
          {toolCount} {toolCount === 1 ? "tool" : "tools"}
        </span>
      ) : null}
      {toolCount !== undefined && tail ? (
        // Hidden until something follows it: a timer renders nothing in its first second.
        <span aria-hidden="true" className="text-(color:--chatcn-fg-faint) hidden [&:has(+*)]:inline">
          ·
        </span>
      ) : null}
      {tail}
    </span>
  )

  return (
    <Collapsible.Root
      open={open}
      defaultOpen={initialOpen}
      onOpenChange={onOpenChange}
      render={<div />}
      data-slot="subagent"
      data-subagent-status={status}
      data-subagent-expandable={hasTrace ? "" : undefined}
      className={cn("group/subagent text-[0.875rem]/[1.25rem] tracking-[-0.003em] text-(color:--chatcn-fg) min-w-0", className)}
      {...props}
    >
      <Collapsible.Trigger
        disabled={!hasTrace}
        className={cn(
          "rounded-(--chatcn-radius-md) flex h-8 w-full min-w-0 items-center gap-2.5 px-2 text-start outline-none select-none",
          "ease-(--chatcn-ease-standard) transition-colors duration-150",
          "enabled:hover:bg-(color:--chatcn-fill-hover) focus-visible:outline-(color:--chatcn-accent) focus-visible:outline-2 focus-visible:-outline-offset-2",
          "pointer-coarse:h-11",
          // Beside agents that expand, a static row keeps the chevron's slot so meta lines up.
          !hasTrace && "[:has(>[data-subagent-expandable])>*>&]:pe-[2.125rem]",
        )}
      >
        <SubagentGlyph status={status} icon={icon} />
        <span className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="shrink-0 font-medium">{name}</span>
          <span className="sr-only">, {STATUS_TEXT[status]}</span>
          {status === "spawning" ? (
            <ShimmerText className="text-[0.8125rem]/[1.25rem]">Starting</ShimmerText>
          ) : line ? (
            <CrossfadeText
              text={line}
              className={cn(
                "text-[0.8125rem]/[1.25rem] flex-1",
                working ? "text-(color:--chatcn-fg-muted)" : "text-(color:--chatcn-fg-subtle)",
              )}
            />
          ) : null}
        </span>
        {meta}
        {hasTrace ? (
          <ChevronDownIcon
            aria-hidden="true"
            className={cn(
              "text-(color:--chatcn-fg-subtle) ease-(--chatcn-ease-out) size-4 shrink-0 transition-transform duration-200",
              "motion-reduce:transition-none [[data-panel-open]>&]:rotate-180",
            )}
          />
        ) : null}
      </Collapsible.Trigger>

      {hasTrace ? (
        <Collapsible.Panel
          className={cn(
            "h-(--collapsible-panel-height) overflow-hidden",
            "ease-(--chatcn-ease-out) transition-[height,opacity] duration-200 motion-reduce:transition-none",
            "data-[ending-style]:h-0 data-[ending-style]:opacity-0 data-[ending-style]:duration-150",
            "data-[starting-style]:h-0 data-[starting-style]:opacity-0",
          )}
        >
          {/* The rail lines up with the glyph above, so nested agents read as one tree. */}
          <div
            data-slot="subagent-trace"
            className="border-(color:--chatcn-border) ms-[15.5px] mt-0.5 mb-1.5 flex flex-col gap-2 border-s ps-[17.5px] pt-1 pb-1"
          >
            {task ? (
              <div data-slot="subagent-task" className="flex flex-col gap-1">
                <span className="text-[0.75rem]/[1rem] text-(color:--chatcn-fg-subtle) font-medium">Task</span>
                <p className="text-[0.8125rem]/[1.25rem] text-(color:--chatcn-fg-muted) text-pretty">{task}</p>
              </div>
            ) : null}
            {children ?? (steps && steps.length > 0 ? <SubagentSteps steps={steps} /> : null)}
            {settled && summary ? (
              <div data-slot="subagent-result" className="flex flex-col gap-1">
                <span className="text-[0.75rem]/[1rem] text-(color:--chatcn-fg-subtle) font-medium">
                  {status === "failed" ? "Error" : "Result"}
                </span>
                <div
                  className={cn(
                    "text-[0.8125rem]/[1.25rem] text-pretty",
                    status === "failed" ? "text-(color:--chatcn-fg)" : "text-(color:--chatcn-fg-muted)",
                  )}
                >
                  {summary}
                </div>
              </div>
            ) : null}
            {status === "failed" && onRetry ? (
              <div className="-ms-2 flex">
                <Button
                  size="xs"
                  onClick={onRetry}
                  className="relative pointer-coarse:after:absolute pointer-coarse:after:-inset-2.5 pointer-coarse:after:content-['']"
                >
                  <RotateCcwIcon aria-hidden="true" />
                  Retry
                </Button>
              </div>
            ) : null}
          </div>
        </Collapsible.Panel>
      ) : null}
      <span aria-live="polite" className="sr-only">
        {settled
          ? `${typeof name === "string" ? name : "Subagent"} ${STATUS_TEXT[status].toLowerCase()}`
          : ""}
      </span>
    </Collapsible.Root>
  )
}

export default Subagent
