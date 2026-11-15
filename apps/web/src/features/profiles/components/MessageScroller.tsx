import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../../shared/utils';

export type MessageScrollerMessage = { id: string; content: string; from?: 'assistant' | 'system' | 'user' };

/** Conversation minimap adapted from the user's MessageScroller, with a rich-message render slot. */
export function MessageScroller({ messages, renderMessage, className, footer, contentMaxWidth = 680 }: {
  messages: MessageScrollerMessage[]; renderMessage?: (message: MessageScrollerMessage) => ReactNode; className?: string; footer?: ReactNode; contentMaxWidth?: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<string>();
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const viewport = useRef<HTMLDivElement>(null);
  const elements = useRef(new Map<string, HTMLDivElement>());
  const stick = useRef(true);
  const users = messages.filter((message) => message.from === 'user');
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    if (stick.current) el.scrollTop = el.scrollHeight;
    let frame = 0;
    const measure = () => {
      const bounds = el.getBoundingClientRect();
      const center = bounds.top + el.clientHeight / 2;
      let nearest: string | undefined;
      let distance = Infinity;
      const visible: string[] = [];
      for (const message of users) {
        const node = elements.current.get(message.id);
        if (!node) continue;
        const rect = node.getBoundingClientRect();
        if (rect.bottom > bounds.top && rect.top < bounds.bottom) visible.push(message.id);
        const delta = Math.abs(rect.top + rect.height / 2 - center);
        if (delta < distance) { distance = delta; nearest = message.id; }
      }
      setSelected(nearest); setVisibleIds(visible);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    observer.observe(el);
    for (const node of elements.current.values()) observer.observe(node);
    el.addEventListener('scroll', schedule, { passive: true });
    measure();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); el.removeEventListener('scroll', schedule); };
  }, [messages]);
  const jump = (id: string) => {
    const el = viewport.current; const node = elements.current.get(id);
    if (!el || !node) return;
    stick.current = false;
    el.scrollTo({ top: el.scrollTop + node.getBoundingClientRect().top - el.getBoundingClientRect().top - el.clientHeight / 2 + node.clientHeight / 2, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    setSelected(id);
  };
  return <section className={cn('relative flex min-h-0 min-w-0 flex-1 overflow-hidden', className)} aria-label="Conversation">
    {users.length > 1 && <nav aria-label="Naviguer dans vos messages" onPointerLeave={() => setHovered(null)} className="absolute inset-y-0 left-2 z-10 flex w-10 flex-col justify-center gap-0.5 py-2">{users.map((message, index) => <div className="relative" key={message.id}><button type="button" onFocus={() => setHovered(index)} onBlur={() => setHovered(null)} onPointerEnter={() => setHovered(index)} onClick={() => jump(message.id)} aria-current={selected === message.id ? 'true' : undefined} aria-label={`Aller au message : ${message.content}`} className="flex h-3 w-full items-center rounded-sm bg-transparent focus-visible:outline-2 focus-visible:outline-blue-500"><span aria-hidden className={cn('block h-0.5 w-3 origin-left rounded-full bg-neutral-300 transition-transform duration-200 motion-reduce:transition-none', (selected === message.id || visibleIds.includes(message.id)) && 'bg-neutral-700')} style={{ transform: `scaleX(${hovered === null ? 1 : [2.8, 2.15, 1.55, 1.2][Math.abs(index - hovered)] ?? 1})` }} /></button>{hovered === index && <div role="tooltip" className="absolute left-12 top-1/2 w-56 -translate-y-1/2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs leading-5 text-neutral-700 shadow-lg">{message.content}</div>}</div>)}</nav>}
    <div ref={viewport} onScroll={(event) => { const el = event.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 70; }} className={cn('min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6 [scrollbar-width:thin]', users.length > 1 && 'pl-16')}>
      <div className="pw-message-stack mx-auto flex w-full flex-col gap-5" style={{maxWidth:contentMaxWidth}}>{messages.map((message) => <div key={message.id} ref={(el) => { if (el) elements.current.set(message.id, el); else elements.current.delete(message.id); }} data-message-id={message.id}>{renderMessage ? renderMessage(message) : <div className={cn('w-fit max-w-[85%] rounded-xl px-3 py-2 text-[13px] leading-6', message.from === 'user' ? 'ml-auto bg-neutral-100 text-neutral-800' : 'text-neutral-700')}>{message.content}</div>}</div>)}{footer}</div>
    </div>
  </section>;
}
export default MessageScroller;
