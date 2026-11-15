import type { CSSProperties } from 'react';
import { ChevronDown, FileCode2, Wrench, type LucideIcon } from 'lucide-react';

export const ArrowDown01Icon = ChevronDown;
export const ToolsIcon = Wrench;
export const cn = (...classes: (string | undefined | false)[]) => classes.filter(Boolean).join(' ');
export const formatToolName = (name: string) => name.replace(/_/g, ' ');
export function HugeiconsIcon({ icon: Icon, size = 16, className, style }: { icon: LucideIcon; size?: number; className?: string; style?: CSSProperties }) {
  return <Icon size={size} className={className} style={style} aria-hidden="true"/>;
}
export function getToolCategoryIcon(_category: string, size: { width: number; height: number }, _url?: string) {
  return <span className="ra-tool-icon"><FileCode2 width={size.width} height={size.height}/></span>;
}
export function CompactMarkdown({ content }: { content: unknown }) {
  return <pre className="ra-tool-output">{typeof content === 'string' ? content : JSON.stringify(content, null, 2)}</pre>;
}
