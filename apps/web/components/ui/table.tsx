import * as React from 'react';
import { cn } from '@/lib/utils';
/** shadcn-style semantic table inside a keyboard-scrollable overflow container. */
export function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div className="admin-table-scroll" tabIndex={0}>
      <table data-slot="table" className={cn('admin-table', className)} {...props} />
    </div>
  );
}
