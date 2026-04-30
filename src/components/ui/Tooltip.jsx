import * as RadixTooltip from '@radix-ui/react-tooltip'

export const TooltipProvider = RadixTooltip.Provider
export const Tooltip = RadixTooltip.Root
export const TooltipTrigger = RadixTooltip.Trigger

export function TooltipContent({ className = '', children, sideOffset = 6, ...props }) {
  return (
    <RadixTooltip.Portal>
      <RadixTooltip.Content
        sideOffset={sideOffset}
        className={`z-50 max-w-[280px] rounded-lg px-3 py-2 text-xs leading-relaxed text-white shadow-lg outline-hidden data-[state=delayed-open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0 ${className}`}
        style={{ background: '#0A1828', border: '1px solid #14B8A6' }}
        {...props}
      >
        {children}
        <RadixTooltip.Arrow style={{ fill: '#0A1828' }} />
      </RadixTooltip.Content>
    </RadixTooltip.Portal>
  )
}
