import { cn } from '@/lib/utils'

function Brand({ subtitle, className, size = 'default' }) {
  const large = size === 'large'

  return (
    <div className={cn('flex shrink-0 items-center', large ? 'gap-4' : 'gap-3', className)}>
      <span className={cn(
        'grid shrink-0 place-items-center bg-brand-icon text-white shadow-md shadow-primary/15',
        large ? 'size-14 rounded-2xl sm:size-[62px] sm:rounded-[17px]' : 'size-10 rounded-xl',
      )}>
        <svg className={large ? 'size-8 sm:size-[34px]' : 'size-[21px]'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m3 10 9-7 9 7v10H3V10Z" />
          <path d="M9 20v-7h6v7" />
        </svg>
      </span>
      <span className="flex min-w-0 flex-col">
        <strong className={cn('font-heading font-extrabold leading-none tracking-[-1.5px] text-brand', large ? 'text-[32px] sm:text-[34px]' : 'text-[22px]')}>
          hogar<span className="text-brand-accent">+</span>
        </strong>
        {subtitle && <small className={cn('font-bold uppercase text-muted-foreground', large ? 'mt-2 text-[9px] tracking-[1.5px] sm:text-[10px]' : 'mt-1.5 text-[8px] tracking-[1.25px]')}>{subtitle}</small>}
      </span>
    </div>
  )
}

export default Brand