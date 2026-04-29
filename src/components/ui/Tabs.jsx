import * as RadixTabs from '@radix-ui/react-tabs'
import { motion } from 'motion/react'

export const Tabs = RadixTabs.Root

export function TabsList({ className = '', ...props }) {
  return (
    <RadixTabs.List
      className={`inline-flex items-center gap-1 border-b ${className}`}
      style={{ borderColor: '#E2E8F0' }}
      {...props}
    />
  )
}

export function TabsTrigger({ className = '', ...props }) {
  return (
    <RadixTabs.Trigger
      className={`relative px-3 py-2 text-[11px] font-mono uppercase tracking-[0.18em] text-ink-muted transition-colors hover:text-ink data-[state=active]:text-ink data-[state=active]:after:absolute data-[state=active]:after:bottom-[-1px] data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-[2px] data-[state=active]:after:bg-[#0F766E] outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6]/40 rounded-sm ${className}`}
      {...props}
    />
  )
}

export function TabsContent({ className = '', children, ...props }) {
  return (
    <RadixTabs.Content className={`pt-4 outline-none ${className}`} {...props}>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </RadixTabs.Content>
  )
}
