"use client"

// From chatcn, chat, voice and agent UI for shadcn: https://chatcn.dev

import * as React from "react"
import { forwardRef, createElement, type SVGAttributes, type ForwardRefExoticComponent, type RefAttributes } from "react"
import { cn } from "../../../shared/utils"
import { Collapsible } from "@base-ui/react/collapsible"

/** chatcn theme variables and utilities this file uses, light and dark. */
const CHATCN_CSS = ":root{--chatcn-accent:var(--chatcn-gray-1000);--chatcn-alpha-500:oklch(0 0 0 / 0.14);--chatcn-alpha-600:oklch(0 0 0 / 0.2);--chatcn-bg:oklch(1 0 0);--chatcn-card:oklch(1 0 0);--chatcn-ease-out:cubic-bezier(0.23, 1, 0.32, 1);--chatcn-ease-standard:ease;--chatcn-fg:var(--chatcn-gray-1000);--chatcn-fg-faint:var(--chatcn-gray-700);--chatcn-fg-muted:var(--chatcn-gray-900);--chatcn-fg-subtle:var(--chatcn-gray-800);--chatcn-fill:var(--chatcn-gray-100);--chatcn-fill-active:var(--chatcn-gray-300);--chatcn-fill-hover:var(--chatcn-gray-200);--chatcn-gray-100:oklch(0.970 0 0);--chatcn-gray-1000:oklch(0.145 0 0);--chatcn-gray-200:oklch(0.950 0 0);--chatcn-gray-300:oklch(0.930 0 0);--chatcn-gray-700:oklch(0.700 0 0);--chatcn-gray-800:oklch(0.525 0 0);--chatcn-gray-900:oklch(0.440 0 0);--chatcn-press-scale:0.97;--chatcn-press-scale-icon:0.94;--chatcn-primary:var(--chatcn-gray-1000);--chatcn-primary-fg:var(--chatcn-bg);--chatcn-primary-hover:var(--chatcn-gray-900);--chatcn-radius-md:8px;--chatcn-radius-sm:6px;--chatcn-radius-xl:16px;--chatcn-radius-xs:4px;--chatcn-red:oklch(0.560 0.200 27);--chatcn-scrollbar:var(--chatcn-alpha-500);--chatcn-scrollbar-hover:var(--chatcn-alpha-600);--chatcn-shadow-sm:0 0 0 1px oklch(0 0 0 / 0.06), 0 1px 2px -1px oklch(0 0 0 / 0.06), 0 2px 4px oklch(0 0 0 / 0.04);--chatcn-shadow-xs:0 0 0 1px oklch(0 0 0 / 0.08), 0 1px 2px oklch(0 0 0 / 0.04)}.dark{--chatcn-accent:var(--chatcn-gray-1000);--chatcn-alpha-500:oklch(1 0 0 / 0.16);--chatcn-alpha-600:oklch(1 0 0 / 0.24);--chatcn-bg:oklch(0.145 0 0);--chatcn-card:oklch(0.175 0 0);--chatcn-fg:var(--chatcn-gray-1000);--chatcn-fg-faint:var(--chatcn-gray-700);--chatcn-fg-muted:var(--chatcn-gray-900);--chatcn-fg-subtle:var(--chatcn-gray-800);--chatcn-fill:var(--chatcn-gray-100);--chatcn-fill-active:var(--chatcn-gray-300);--chatcn-fill-hover:var(--chatcn-gray-200);--chatcn-gray-100:oklch(0.195 0 0);--chatcn-gray-1000:oklch(0.970 0 0);--chatcn-gray-200:oklch(0.225 0 0);--chatcn-gray-300:oklch(0.255 0 0);--chatcn-gray-700:oklch(0.500 0 0);--chatcn-gray-800:oklch(0.620 0 0);--chatcn-gray-900:oklch(0.720 0 0);--chatcn-primary:var(--chatcn-gray-1000);--chatcn-primary-fg:var(--chatcn-bg);--chatcn-primary-hover:var(--chatcn-gray-900);--chatcn-red:oklch(0.700 0.175 22);--chatcn-scrollbar:var(--chatcn-alpha-500);--chatcn-scrollbar-hover:var(--chatcn-alpha-600);--chatcn-shadow-sm:0 0 0 1px oklch(1 0 0 / 0.08), inset 0 1px 0 oklch(1 0 0 / 0.03), 0 2px 4px oklch(0 0 0 / 0.4);--chatcn-shadow-xs:0 0 0 1px oklch(1 0 0 / 0.08), 0 1px 2px oklch(0 0 0 / 0.4)}.chatcn-focus{}.chatcn-focus:focus-visible{outline: 2px solid var(--chatcn-accent); outline-offset: 2px;}.chatcn-shimmer{color: transparent; background-image: linear-gradient(90deg, var(--chatcn-fg-subtle) 0%, var(--chatcn-fg-subtle) 40%, var(--chatcn-fg) 50%, var(--chatcn-fg-subtle) 60%, var(--chatcn-fg-subtle) 100%); background-size: 250% 100%; background-clip: text; -webkit-background-clip: text; animation: chatcn-shimmer 1.6s linear infinite;}.chatcn-spin{animation: chatcn-spin 0.8s linear infinite;}.chatcn-scroll{scrollbar-width: thin; scrollbar-color: var(--chatcn-scrollbar) transparent;}.chatcn-scroll:hover{scrollbar-color: var(--chatcn-scrollbar-hover) transparent;}.chatcn-scroll::-webkit-scrollbar{width: 10px; height: 10px;}.chatcn-scroll::-webkit-scrollbar-track, .chatcn-scroll::-webkit-scrollbar-corner{background: transparent;}.chatcn-scroll::-webkit-scrollbar-thumb{background-color: var(--chatcn-scrollbar); background-clip: content-box; border: 3px solid transparent; border-radius: 9999px;}.chatcn-scroll::-webkit-scrollbar-thumb:hover{background-color: var(--chatcn-scrollbar-hover);}@keyframes chatcn-spin { to { transform: rotate(360deg); } }@keyframes chatcn-shimmer { from { background-position: 100% 0; } to { background-position: 0% 0; } }@media (prefers-reduced-motion: reduce){.chatcn-shimmer{animation:none;color:var(--chatcn-fg-subtle);background-image:none}}@media (prefers-reduced-motion: reduce){:root{--chatcn-press-scale:1;--chatcn-press-scale-icon:1;--chatcn-enter-scale:1}}"
if (typeof document !== "undefined" && !document.getElementById("chatcn-research-progress")) {
  const style = document.createElement("style")
  style.id = "chatcn-research-progress"
  style.textContent = CHATCN_CSS
  document.head.appendChild(style)
}

export type ResearchStatus = "queued" | "running" | "complete" | "failed" | "cancelled"

/* -------------------------------------------------------------------------------------------------
 * Types
 * -----------------------------------------------------------------------------------------------*/

export type ResearchPhase = "planning" | "searching" | "reading" | "writing"

export type ResearchStepStatus = "pending" | "active" | "done" | "skipped"

export interface ResearchPlanStep {
  id: string
  title: React.ReactNode
  status?: ResearchStepStatus
}

export type ResearchActivityKind = "plan" | "search" | "read" | "write"

/** What the agent is doing right now, shown on the live line. */
export interface ResearchCurrent {
  kind: ResearchActivityKind
  /** A search query, a page title or the section being written. */
  text: string
  /** For reads: the page URL, which also gives the site. */
  url?: string
  favicon?: string
}

export interface ResearchActivity extends ResearchCurrent {
  id: string
}

export interface ResearchProgressProps extends Omit<React.ComponentProps<"section">, "title"> {
  /** The question or topic being researched. */
  title: React.ReactNode
  status: ResearchStatus
  /** Current phase while running. Phases before it read as done. */
  phase?: ResearchPhase
  /** Rename the four phases, for example for a localized UI. */
  phaseLabels?: Partial<Record<ResearchPhase, string>>
  plan?: ResearchPlanStep[]
  /** Sources the agent has finished reading. Renders as is, once per update: no count-up. */
  sourcesRead?: number
  /** Sources found by searches so far. */
  sourcesFound?: number
  current?: ResearchCurrent
  /** Recent searches and reads, oldest first. Shown in a collapsed log. */
  activity?: ResearchActivity[]
  /** Epoch ms when the run started. Drives the elapsed counter. */
  startedAt?: number
  /** Final duration. Measured automatically when omitted. */
  durationMs?: number
  /** Shown on `failed`. Say what to do about it. */
  error?: React.ReactNode
  /** One line under the title once the run is complete, for example the word count. */
  summary?: React.ReactNode
  onCancel?: () => void
  onRetry?: () => void
  /** Shows the report button on `complete`, and on `cancelled` for a partial report. */
  onOpenReport?: () => void
  reportLabel?: React.ReactNode
  /**
   * `card` (default) draws its own surface. `plain` drops the surface and padding, for a side
   * panel or any container that already frames it, so it never reads as a card inside a card.
   */
  variant?: "card" | "plain"
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

const DEFAULT_LABELS: Record<ResearchPhase, string> = {
  planning: "Planning",
  searching: "Searching",
  reading: "Reading",
  writing: "Writing",
}

const LIVE_VERB: Record<ResearchPhase, string> = {
  planning: "Planning the research",
  searching: "Searching the web",
  reading: "Reading sources",
  writing: "Writing the report",
}

/** Spoken form for live regions: "12 seconds", "2 minutes 4 seconds". */
function speakChatcnDuration(ms: number) {
  const totalS = Math.max(1, Math.round(ms / 1000))
  const m = Math.floor(totalS / 60)
  const s = totalS % 60
  const part = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`
  if (m === 0) return part(s, "second")
  return s === 0 ? part(m, "minute") : `${part(m, "minute")} ${part(s, "second")}`
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

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
  ["path", {"d":"M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0"}],
]

const CircleIcon: Icon = /* @__PURE__ */ createIcon("circle", iconNode)

const iconNode2: IconNode = [
  ["path", {"d":"M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0"}],
  ["path", {"d":"m8 12.25 1.51 1.51a1.75 1.75 0 0 0 2.48 0l4.26-4.26"}],
]

const CircleCheckIcon: Icon = /* @__PURE__ */ createIcon("circle-check", iconNode2)

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

/* -------------------------------------------------------------------------------------------------
 * Helpers
 * -----------------------------------------------------------------------------------------------*/

const PHASES: ResearchPhase[] = ["planning", "searching", "reading", "writing"]

type PhaseState = "done" | "current" | "upcoming"

function phaseStateOf(phase: ResearchPhase, status: ResearchStatus, current?: ResearchPhase) {
  if (status === "complete") return "done"
  if (status === "queued" || !current) return "upcoming"
  const at = PHASES.indexOf(current)
  const i = PHASES.indexOf(phase)
  if (i < at) return "done"
  if (i === at) return "current"
  return "upcoming"
}

const iconNode5: IconNode = [
  ["path", {"d":"m4.5 12.75 3.23 3.23a2.5 2.5 0 0 0 3.54 0l8.48-8.48"}],
]

const CheckIcon: Icon = /* @__PURE__ */ createIcon("check", iconNode5)

/* -------------------------------------------------------------------------------------------------
 * Phase rail
 * -----------------------------------------------------------------------------------------------*/

function ResearchPhases({
  status,
  phase,
  labels,
  readFraction,
}: {
  status: ResearchStatus
  phase?: ResearchPhase
  labels: Record<ResearchPhase, string>
  /** Sources read over sources found while reading: the reading segment fills to the real count. */
  readFraction?: number
}) {
  const stopped = status === "failed" || status === "cancelled"
  return (
    <ol
      data-slot="research-phases"
      aria-label="Research phases"
      className="grid grid-cols-4 gap-1.5"
    >
      {PHASES.map((p) => {
        const state: PhaseState = phaseStateOf(p, status, phase)
        return (
          <li
            key={p}
            aria-current={state === "current" ? "step" : undefined}
            data-phase-state={state}
            className="flex min-w-0 flex-col gap-2"
          >
            {state === "current" && p === "reading" && !stopped && readFraction !== undefined ? (
              // The one segment that knows how far along it is: ink fills to sources read.
              <span
                aria-hidden="true"
                data-slot="research-phase-fill"
                className="bg-(color:--chatcn-fill) block h-0.5 overflow-hidden rounded-full"
              >
                <span
                  className="bg-(color:--chatcn-fg) ease-(--chatcn-ease-out) block h-full origin-left rounded-full transition-transform duration-300 motion-reduce:transition-none rtl:origin-right"
                  style={{ transform: `scaleX(${Math.min(1, Math.max(0.04, readFraction))})` }}
                />
              </span>
            ) : (
              <span
                aria-hidden="true"
                className={cn(
                  "block h-0.5 rounded-full",
                  "ease-(--chatcn-ease-standard) transition-[background-color] duration-150",
                  state === "done" && "bg-(color:--chatcn-fg-subtle)",
                  state === "current" && (stopped ? "bg-(color:--chatcn-fg-subtle)" : "bg-(color:--chatcn-fg)"),
                  state === "upcoming" && "bg-(color:--chatcn-fill)",
                )}
              />
            )}
            <span
              className={cn(
                "text-[0.75rem]/[1rem] flex min-w-0 items-center gap-1",
                state === "current" && "text-(color:--chatcn-fg) font-medium",
                state === "done" && "text-(color:--chatcn-fg-muted)",
                state === "upcoming" && "text-(color:--chatcn-fg-subtle)",
              )}
            >
              <span className="truncate">{labels[p]}</span>
              {state === "done" ? (
                <>
                  <CheckIcon
                    aria-hidden="true"
                    className="text-(color:--chatcn-fg-subtle) size-3 shrink-0 @max-sm:hidden"
                  />
                  <span className="sr-only">, done</span>
                </>
              ) : null}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/** Host of a URL without `www.`, or the input when it is not a URL. */
function getSourceDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
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
 * Types and helpers
 * -----------------------------------------------------------------------------------------------*/

interface Source {
  /** Stable id, for example the AI SDK `sourceId`. Defaults to the URL. */
  id?: string
  url: string
  title?: string
  snippet?: string
  /** Defaults to the URL host without `www.`. */
  domain?: string
  /** Optional favicon URL. Falls back to a monochrome letter tile when missing or broken. */
  favicon?: string
}

/* -------------------------------------------------------------------------------------------------
 * SourceTile
 * -----------------------------------------------------------------------------------------------*/

interface SourceTileProps extends React.ComponentProps<"span"> {
  source: Pick<Source, "url" | "domain" | "favicon">
}

/**
 * A favicon slot. Without a favicon it shows the domain's first letter on a gray tile: no brand
 * colors, so a row of sources stays as calm as the text around it.
 */
function SourceTile({ source, className, ...props }: SourceTileProps) {
  const [broken, setBroken] = React.useState(false)
  const domain = source.domain ?? getSourceDomain(source.url)
  const letter =
    domain
      .replace(/^[^a-z0-9]+/i, "")
      .charAt(0)
      .toUpperCase() || "?"
  return (
    <span
      data-slot="source-tile"
      aria-hidden="true"
      className={cn(
        "bg-(color:--chatcn-fill-active) text-(color:--chatcn-fg-muted) rounded-(--chatcn-radius-xs) relative grid size-[1.125rem] shrink-0 place-items-center overflow-hidden",
        "text-[0.75rem]/[1rem] leading-none font-medium select-none",
        className,
      )}
      {...props}
    >
      {source.favicon && !broken ? (
        <img
          src={source.favicon}
          alt=""
          width={18}
          height={18}
          loading="lazy"
          onError={() => setBroken(true)}
          className="size-full object-cover"
        />
      ) : (
        letter
      )}
    </span>
  )
}

const iconNode6: IconNode = [
  ["path", {"d":"M7 2.5h5.88a1.5 1.5 0 0 1 1.06.44l5.12 5.12a1.5 1.5 0 0 1 .44 1.06V19a2.5 2.5 0 0 1-2.5 2.5H7A2.5 2.5 0 0 1 4.5 19V5A2.5 2.5 0 0 1 7 2.5"}],
  ["path", {"d":"M13.5 3.25v3.5a1.75 1.75 0 0 0 1.75 1.75h3.5"}],
  ["path", {"d":"M8.25 12.5h7.5"}],
  ["path", {"d":"M8.25 16.5h7.5"}],
  ["path", {"d":"M8.25 8.5H10"}],
]

const FileTextIcon: Icon = /* @__PURE__ */ createIcon("file-text", iconNode6)

const iconNode7: IconNode = [
  ["path", {"d":"M4 10.75a6.75 6.75 0 1 0 13.5 0 6.75 6.75 0 1 0-13.5 0"}],
  ["path", {"d":"m15.75 15.75 4.5 4.5"}],
]

const SearchIcon: Icon = /* @__PURE__ */ createIcon("search", iconNode7)

const iconNode8: IconNode = [
  ["path", {"d":"M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0"}],
  ["path", {"d":"M12.72 3.8a11.9 11.9 0 0 1 0 16.4 1 1 0 0 1-1.44 0 11.9 11.9 0 0 1 0-16.4 1 1 0 0 1 1.44 0"}],
  ["path", {"d":"M3 12h2.25"}],
  ["path", {"d":"M10.75 12h2.5"}],
  ["path", {"d":"M18.75 12H21"}],
]

const GlobeIcon: Icon = /* @__PURE__ */ createIcon("globe", iconNode8)

const iconNode9: IconNode = [
  ["path", {"d":"m3.79 18.63.87-2.6a1.5 1.5 0 0 1 .36-.58l7.88-7.89a2.5 2.5 0 0 1 3.54 0 2.5 2.5 0 0 1 0 3.54l-7.89 7.88a1.5 1.5 0 0 1-.58.36l-2.6.87a1.25 1.25 0 0 1-1.58-1.58"}],
  ["path", {"d":"m11.49 8.98 3.53 3.53"}],
  ["path", {"d":"M13.5 20.75h7"}],
]

const PenLineIcon: Icon = /* @__PURE__ */ createIcon("pen-line", iconNode9)

const KIND_ICON: Record<ResearchActivityKind, React.ReactNode> = {
  plan: <FileTextIcon />,
  search: <SearchIcon />,
  read: <GlobeIcon />,
  write: <PenLineIcon />,
}

/* -------------------------------------------------------------------------------------------------
 * Live line
 * -----------------------------------------------------------------------------------------------*/

function ResearchLiveLine({ phase, current }: { phase: ResearchPhase; current?: ResearchCurrent }) {
  const domain = current?.url ? getSourceDomain(current.url) : undefined
  // Re-keyed per item, so each new page crossfades in from a 2 px blur: one line changing, not
  // a list scrolling past. Opacity only under reduced motion.
  const key = current ? `${current.kind}:${current.url ?? current.text}` : phase
  return (
    <div data-slot="research-live" className="flex h-6 min-w-0 items-center gap-2">
      <ShimmerText className="text-[0.8125rem]/[1.25rem] shrink-0">{LIVE_VERB[phase]}</ShimmerText>
      {current ? (
        <span
          key={key}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2",
            "ease-(--chatcn-ease-out) transition-[opacity,filter] duration-150",
            "starting:opacity-0 starting:blur-[2px] motion-reduce:starting:blur-none",
          )}
        >
          {current.kind === "read" && current.url ? (
            <SourceTile
              source={{ url: current.url, favicon: current.favicon }}
              className="size-4"
            />
          ) : (
            <span aria-hidden="true" className="text-(color:--chatcn-fg-subtle) shrink-0 [&_svg]:size-3.5">
              {KIND_ICON[current.kind]}
            </span>
          )}
          <span className="text-[0.8125rem]/[1.25rem] text-(color:--chatcn-fg) min-w-0 truncate">{current.text}</span>
          {domain ? (
            <span
              className="text-[0.75rem]/[1rem] text-(color:--chatcn-fg-subtle) hidden shrink-0 sm:inline"
              dir="ltr"
            >
              {domain}
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  )
}

const iconNode10: IconNode = [
  ["path", {"d":"M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0"}],
  ["path", {"d":"M10.75 12a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 1 0-2.5 0"}],
]

const CircleDotIcon: Icon = /* @__PURE__ */ createIcon("circle-dot", iconNode10)

/* -------------------------------------------------------------------------------------------------
 * Plan and activity
 * -----------------------------------------------------------------------------------------------*/

function ResearchPlan({ steps, stopped }: { steps: ResearchPlanStep[]; stopped: boolean }) {
  return (
    <ol data-slot="research-plan" aria-label="Research plan" className="flex flex-col gap-0.5">
      {steps.map((step) => {
        const status = step.status ?? "pending"
        return (
          <li
            key={step.id}
            data-step-status={status}
            aria-current={status === "active" ? "step" : undefined}
            className="flex min-h-7 items-start gap-2.5 py-1"
          >
            <span
              aria-hidden="true"
              className={cn(
                "grid h-5 shrink-0 place-items-center [&_svg]:size-4",
                status === "done" && "text-(color:--chatcn-fg-subtle)",
                status === "active" && (stopped ? "text-(color:--chatcn-fg-subtle)" : "text-(color:--chatcn-fg)"),
                (status === "pending" || status === "skipped") && "text-(color:--chatcn-fg-faint)",
              )}
            >
              <span
                key={status}
                className="grid motion-safe:animate-[chatcn-swap_150ms_var(--chatcn-ease-out)]"
              >
                {status === "done" ? (
                  <CircleCheckIcon />
                ) : status === "active" ? (
                  <CircleDotIcon />
                ) : (
                  <CircleIcon />
                )}
              </span>
            </span>
            <span
              className={cn(
                "text-[0.8125rem]/[1.25rem] min-w-0 text-pretty",
                status === "active" && "text-(color:--chatcn-fg) font-medium",
                status === "done" && "text-(color:--chatcn-fg-muted)",
                status === "pending" && "text-(color:--chatcn-fg-subtle)",
                status === "skipped" && "text-(color:--chatcn-fg-subtle) line-through",
              )}
            >
              {step.title}
              <span className="sr-only">
                {status === "done" ? ", done" : status === "active" ? ", in progress" : ""}
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

const iconNode11: IconNode = [
  ["path", {"d":"M5.49 17.46A8.5 8.5 0 1 0 6.54 5.49"}],
  ["path", {"d":"m8.21 8.65-2.94-.26a2 2 0 0 1-1.82-2.16l.26-2.94"}],
]

const RotateCcwIcon: Icon = /* @__PURE__ */ createIcon("rotate-ccw", iconNode11)

const iconNode12: IconNode = [
  ["path", {"d":"m12.5 18.5 4.73-4.73a2.5 2.5 0 0 0 0-3.54L12.5 5.5"}],
  ["path", {"d":"M5 12h9"}],
]

const ArrowRightIcon: Icon = /* @__PURE__ */ createIcon("arrow-right", iconNode12)

const iconNode13: IconNode = [
  ["path", {"d":"m6 9.25 4.23 4.23a2.5 2.5 0 0 0 3.54 0L18 9.25"}],
]

const ChevronDownIcon: Icon = /* @__PURE__ */ createIcon("chevron-down", iconNode13)

function ResearchActivityLog({ items }: { items: ResearchActivity[] }) {
  const listRef = React.useRef<HTMLOListElement>(null)
  const stick = React.useRef(true)
  // Follows new entries only while the reader is at the bottom of the log.
  React.useLayoutEffect(() => {
    const el = listRef.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [items.length])

  return (
    <Collapsible.Root render={<div />} className="group/activity min-w-0">
      <Collapsible.Trigger
        className={cn(
          "chatcn-focus rounded-(--chatcn-radius-sm) -ms-1.5 inline-flex h-7 items-center gap-1.5 ps-1.5 pe-2",
          "text-[0.75rem]/[1rem] text-(color:--chatcn-fg-subtle) hover:text-(color:--chatcn-fg) ease-(--chatcn-ease-standard) transition-colors duration-150",
          "pointer-coarse:h-11",
        )}
      >
        Activity
        <span className="tabular-nums">{items.length}</span>
        <ChevronDownIcon
          aria-hidden="true"
          className={cn(
            "ease-(--chatcn-ease-out) size-3.5 transition-[rotate] duration-200 motion-reduce:transition-none",
            "group-data-[open]/activity:rotate-180",
          )}
        />
      </Collapsible.Trigger>
      <Collapsible.Panel
        className={cn(
          "h-(--collapsible-panel-height) overflow-hidden",
          "ease-(--chatcn-ease-out) transition-[height,opacity] duration-200 motion-reduce:transition-none",
          "data-[ending-style]:h-0 data-[ending-style]:opacity-0 data-[ending-style]:duration-150",
          "data-[starting-style]:h-0 data-[starting-style]:opacity-0",
        )}
      >
        <ol
          ref={listRef}
          onScroll={(event) => {
            const el = event.currentTarget
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 16
          }}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: the log scrolls, so it must take focus
          tabIndex={0}
          aria-label="Research activity"
          className="chatcn-focus rounded-(--chatcn-radius-sm) chatcn-scroll flex max-h-44 flex-col overflow-y-auto pt-1 outline-none"
        >
          {items.map((item) => (
            <li key={item.id} className="flex h-7 min-w-0 shrink-0 items-center gap-2">
              {item.kind === "read" && item.url ? (
                <SourceTile
                  source={{ url: item.url, favicon: item.favicon }}
                  className="size-3.5"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="text-(color:--chatcn-fg-subtle) shrink-0 [&_svg]:size-3.5"
                >
                  {KIND_ICON[item.kind]}
                </span>
              )}
              <span className="text-[0.75rem]/[1rem] text-(color:--chatcn-fg-muted) min-w-0 truncate">
                {item.kind === "search" ? `Searched ${item.text}` : item.text}
              </span>
              {item.url ? (
                <span className="text-[0.75rem]/[1rem] text-(color:--chatcn-fg-subtle) ms-auto shrink-0" dir="ltr">
                  {getSourceDomain(item.url)}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </Collapsible.Panel>
    </Collapsible.Root>
  )
}

/* -------------------------------------------------------------------------------------------------
 * ResearchProgress
 * -----------------------------------------------------------------------------------------------*/

/**
 * A deep research run from start to report: the plan, four phases with the current one in ink,
 * a sources-read count that changes once per update, elapsed time, the page being read right
 * now and Cancel. Complete, failed and cancelled runs settle into one line with the next action.
 */
export function ResearchProgress({
  title,
  status,
  phase,
  phaseLabels,
  plan,
  sourcesRead,
  sourcesFound,
  current,
  activity,
  startedAt,
  durationMs,
  error,
  summary,
  onCancel,
  onRetry,
  onOpenReport,
  reportLabel,
  variant = "card",
  className,
  ...props
}: ResearchProgressProps) {
  const running = status === "running"
  const elapsed = useChatcnElapsed({ running, startedAt, durationMs })
  const labels = { ...DEFAULT_LABELS, ...phaseLabels }
  const stopped = status === "failed" || status === "cancelled"
  const livePhase = phase ?? "planning"

  // One polite announcement per phase change and one at the end, never per source.
  const announcement =
    status === "running"
      ? LIVE_VERB[livePhase]
      : status === "complete"
        ? `Research complete${elapsed.ms ? ` in ${speakChatcnDuration(elapsed.ms)}` : ""}${
            sourcesRead !== undefined ? `, ${plural(sourcesRead, "source")} read` : ""
          }`
        : status === "failed"
          ? "Research failed"
          : status === "cancelled"
            ? "Research cancelled"
            : "Research queued"

  const icon =
    status === "running" ? (
      <Spinner className="size-4" />
    ) : status === "queued" ? (
      <CircleIcon className="text-(color:--chatcn-fg-faint)" />
    ) : status === "complete" ? (
      <CircleCheckIcon />
    ) : status === "failed" ? (
      <CircleXIcon className="text-(color:--chatcn-red)" />
    ) : (
      <CircleStopIcon className="text-(color:--chatcn-fg-subtle)" />
    )

  const meta: { key: string; node: React.ReactNode; className?: string }[] = []
  if (status === "queued")
    meta.push({ key: "s", node: "Queued, starts when a research slot frees up" })
  if (status === "complete")
    meta.push({ key: "s", node: "Research complete", className: "text-(color:--chatcn-fg-muted)" })
  if (status === "cancelled")
    meta.push({ key: "s", node: "Cancelled", className: "text-(color:--chatcn-fg-muted)" })
  if (status === "failed") meta.push({ key: "s", node: "Failed", className: "text-(color:--chatcn-red)" })
  if (elapsed.ms !== undefined && status !== "queued") {
    meta.push({ key: "t", node: formatChatcnDuration(elapsed.ms, { precise: false }) })
  }
  // Nothing found yet (still planning) reads as noise, so the count waits for the first source.
  const nothingYet = running && !sourcesRead && !sourcesFound
  if (sourcesRead !== undefined && status !== "queued" && !nothingYet) {
    meta.push({
      key: "n",
      node:
        running && sourcesFound !== undefined
          ? `${sourcesRead} of ${sourcesFound} sources read`
          : `${plural(sourcesRead, "source")} read`,
    })
  }

  return (
    <section
      data-slot="research-progress"
      data-research-status={status}
      data-research-phase={phase}
      data-variant={variant}
      aria-label="Research progress"
      className={cn(
        "text-[0.875rem]/[1.25rem] tracking-[-0.003em] text-(color:--chatcn-fg) @container flex min-w-0 flex-col gap-4",
        variant === "card" &&
          "rounded-(--chatcn-radius-xl) bg-(color:--chatcn-card) shadow-(--chatcn-shadow-sm) p-4 forced-colors:outline-1 forced-colors:outline-solid",
        className,
      )}
      {...props}
    >
      <header className="flex min-w-0 items-start gap-3">
        <span className="grid h-6 shrink-0 place-items-center [&_svg]:size-4">
          <span
            key={status}
            className="grid motion-safe:animate-[chatcn-swap_150ms_var(--chatcn-ease-out)]"
          >
            {icon}
          </span>
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="text-[0.875rem]/[1.25rem] tracking-[-0.003em] text-(color:--chatcn-fg) leading-6 font-medium text-pretty">
            {title}
          </h3>
          <p className="text-[0.75rem]/[1rem] text-(color:--chatcn-fg-subtle) flex flex-wrap gap-x-1.5 tabular-nums">
            {meta.map((m, i) => (
              <React.Fragment key={m.key}>
                {i > 0 ? (
                  <span aria-hidden="true" className="text-(color:--chatcn-fg-faint)">
                    ·
                  </span>
                ) : null}
                <span className={m.className}>{m.node}</span>
              </React.Fragment>
            ))}
          </p>
        </div>
        {running || status === "queued" ? (
          onCancel ? (
            <Button size="sm" onClick={onCancel} className="-me-2 pointer-coarse:h-11">
              Cancel
            </Button>
          ) : null
        ) : null}
      </header>

      <ResearchPhases
        status={status}
        phase={phase}
        labels={labels}
        readFraction={running && sourcesFound ? (sourcesRead ?? 0) / sourcesFound : undefined}
      />

      {running ? <ResearchLiveLine phase={livePhase} current={current} /> : null}

      {status === "failed" && error ? (
        <p className="text-[0.8125rem]/[1.25rem] text-(color:--chatcn-fg-muted) text-pretty">{error}</p>
      ) : null}

      {plan && plan.length > 0 && status !== "complete" ? (
        <ResearchPlan steps={plan} stopped={stopped} />
      ) : null}

      {status === "complete" ||
      (status === "cancelled" && onOpenReport) ||
      (status === "failed" && onRetry) ? (
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          {summary && status === "complete" ? (
            <p className="text-[0.8125rem]/[1.25rem] text-(color:--chatcn-fg-muted) min-w-0 flex-1 text-pretty">
              {summary}
            </p>
          ) : (
            <span className="flex-1" />
          )}
          {status === "failed" && onRetry ? (
            <Button size="sm" variant="outline" onClick={onRetry} className="pointer-coarse:h-11">
              <RotateCcwIcon />
              Retry research
            </Button>
          ) : null}
          {onOpenReport && status !== "failed" ? (
            <Button
              size="sm"
              variant={status === "complete" ? "solid" : "outline"}
              onClick={onOpenReport}
              className="pointer-coarse:h-11"
            >
              {reportLabel ?? (status === "complete" ? "Open report" : "Open partial report")}
              <ArrowRightIcon className="rtl:-scale-x-100" />
            </Button>
          ) : null}
        </div>
      ) : null}

      {activity && activity.length > 0 ? <ResearchActivityLog items={activity} /> : null}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </section>
  )
}

export default ResearchProgress
