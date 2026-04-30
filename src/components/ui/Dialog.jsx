import * as RadixDialog from '@radix-ui/react-dialog'

export const Dialog = RadixDialog.Root
export const DialogTrigger = RadixDialog.Trigger
export const DialogClose = RadixDialog.Close

export function DialogContent({ className = '', children, ...props }) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(10,24,40,0.55)', backdropFilter: 'blur(4px)' }}
      />
      <RadixDialog.Content
        className={`fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white shadow-2xl outline-hidden ${className}`}
        style={{ border: '1px solid #E2E8F0' }}
        {...props}
      >
        <div className="h-[3px] w-full rounded-t-xl" style={{ background: '#14B8A6' }} />
        <div className="p-6">{children}</div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  )
}

export function DialogTitle({ className = '', ...props }) {
  return (
    <RadixDialog.Title
      className={`font-serif text-lg font-semibold text-ink ${className}`}
      {...props}
    />
  )
}

export function DialogDescription({ className = '', ...props }) {
  return (
    <RadixDialog.Description
      className={`mt-2 text-sm leading-relaxed text-ink-muted ${className}`}
      {...props}
    />
  )
}
