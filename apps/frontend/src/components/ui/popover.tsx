'use client';
import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';

// Popover — wrapper Radix: Escape, click in afara, focus si revenire pe trigger vin gratis.
// Fara animate-out: Presence asteapta animationend, iar in pane-ul de preview animatiile
// ingheata; panourile se inchid instant (ca inainte).
export const panelClass =
  'z-50 overflow-hidden rounded-xl border border-border bg-surface text-foreground shadow-lg outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95';

const WIDTH = {
  sm: 'w-56',
  md: 'w-64',
  lg: 'w-[22rem] max-w-[calc(100vw-1.5rem)]',
  auto: '',
} as const;

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

export const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & { width?: keyof typeof WIDTH }
>(({ className, align = 'end', sideOffset = 8, collisionPadding = 12, width = 'md', ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      className={cn(panelClass, WIDTH[width], className)}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = 'PopoverContent';
