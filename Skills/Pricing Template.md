You are given a task to integrate an existing React component in the codebase

The codebase should support:
- shadcn project structure  
- Tailwind CSS
- Typescript

If it doesn't, provide instructions on how to setup project via shadcn CLI, install Tailwind or Typescript.

Determine the default path for components and styles. 
If default path for components is not /components/ui, provide instructions on why it's important to create this folder
Copy-paste this component to /components/ui folder:
```tsx
single-pricing-card.tsx
"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { LucideIcon } from "lucide-react"
import { Star } from "lucide-react"
import { motion, useInView, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

export interface Testimonial {
  id: number
  name: string
  role: string
  company?: string
  content: string
  rating: number
  avatar: string
}

export interface Feature {
  text: string
}

export interface Benefit {
  text: string
  icon: LucideIcon
}

export interface SinglePricingCardProps {
  // Header content
  badge?: {
    icon: LucideIcon
    text: string
  }
  title: string
  subtitle: string

  // Pricing info
  price: {
    current: string
    original?: string
    discount?: string
    discountBadgeClassName?: string
  }

  // Benefits
  benefits: Benefit[]

  // Features
  features: Feature[]
  featuresIcon: LucideIcon
  featuresTitle?: string
  featuresBadge?: {
    icon: LucideIcon
    text: string
  }

  // Buttons
  primaryButton: {
    text: string
    icon: LucideIcon
    href?: string
    onClick?: () => void
    chevronIcon?: LucideIcon
  }
  secondaryButton?: {
    text: string
    icon: LucideIcon
    href?: string
    onClick?: () => void
  }

  // Testimonials
  testimonials: Testimonial[]
  testimonialRotationSpeed?: number // in milliseconds

  // Animation
  animationEnabled?: boolean

  // Additional styling
  className?: string
  cardClassName?: string
  maxWidth?: string
}

export function SinglePricingCard({
  badge,
  title,
  subtitle,
  price,
  benefits,
  features,
  featuresIcon,
  featuresTitle = "Included Features",
  featuresBadge,
  primaryButton,
  secondaryButton,
  testimonials,
  testimonialRotationSpeed = 5000,
  animationEnabled = true,
  className,
  cardClassName,
  maxWidth = "max-w-2xl",
}: SinglePricingCardProps) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 })
  const [currentTestimonialIndex, setCurrentTestimonialIndex] = useState(0)

  // Auto-rotate testimonials
  useEffect(() => {
    if (testimonials.length <= 1) return

    const interval = setInterval(() => {
      setCurrentTestimonialIndex((prev) => (prev + 1) % testimonials.length)
    }, testimonialRotationSpeed)

    return () => clearInterval(interval)
  }, [testimonials.length, testimonialRotationSpeed])

  return (
    <div ref={sectionRef} className={`py-12 relative overflow-hidden ${className || ""}`}>
      <div className={`container px-4 md:px-6 relative z-10 mx-auto ${maxWidth}`}>
        {animationEnabled ? (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <SinglePricingCardContent
              badge={badge}
              title={title}
              subtitle={subtitle}
              price={price}
              benefits={benefits}
              features={features}
              featuresIcon={featuresIcon}
              featuresTitle={featuresTitle}
              featuresBadge={featuresBadge}
              primaryButton={primaryButton}
              secondaryButton={secondaryButton}
              testimonials={testimonials}
              currentTestimonialIndex={currentTestimonialIndex}
              isInView={isInView}
              animationEnabled={animationEnabled}
              cardClassName={cardClassName}
            />
          </motion.div>
        ) : (
          <SinglePricingCardContent
            badge={badge}
            title={title}
            subtitle={subtitle}
            price={price}
            benefits={benefits}
            features={features}
            featuresIcon={featuresIcon}
            featuresTitle={featuresTitle}
            featuresBadge={featuresBadge}
            primaryButton={primaryButton}
            secondaryButton={secondaryButton}
            testimonials={testimonials}
            currentTestimonialIndex={currentTestimonialIndex}
            isInView={isInView}
            animationEnabled={animationEnabled}
            cardClassName={cardClassName}
          />
        )}
      </div>
    </div>
  )
}

interface SinglePricingCardContentProps
  extends Omit<SinglePricingCardProps, "className" | "maxWidth" | "testimonialRotationSpeed"> {
  currentTestimonialIndex: number
  isInView: boolean
  cardClassName?: string
}

function SinglePricingCardContent({
  badge,
  title,
  subtitle,
  price,
  benefits,
  features,
  featuresIcon,
  featuresTitle,
  featuresBadge,
  primaryButton,
  secondaryButton,
  testimonials,
  currentTestimonialIndex,
  isInView,
  animationEnabled,
  cardClassName,
}: SinglePricingCardContentProps) {
  const BadgeIcon = badge?.icon
  const FeaturesBadgeIcon = featuresBadge?.icon
  const FeaturesIcon = featuresIcon
  const PrimaryButtonIcon = primaryButton.icon
  const ChevronIcon = primaryButton.chevronIcon
  const SecondaryButtonIcon = secondaryButton?.icon

  return (
    <Card className={`overflow-hidden border border-primary/10 relative group ${cardClassName || ""}`}>
      {animationEnabled && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-r from-primary/5 via-primary/2 to-transparent" />
        </motion.div>
      )}

      <div className="flex flex-col md:flex-row">
        {/* Left column - Pricing details */}
        <div className="p-6 md:p-8 md:w-1/2 flex flex-col">
          {badge && (
            <div className="flex items-center mb-4">
              <Badge className="px-3 py-1 bg-primary/5 border-primary/10 text-primary hover:bg-primary/10">
                {BadgeIcon && <BadgeIcon className="h-3.5 w-3.5 mr-1" />}
                <span>{badge.text}</span>
              </Badge>
            </div>
          )}

          <h3 className="text-2xl font-bold mb-2">{title}</h3>
          <p className="text-muted-foreground mb-4">{subtitle}</p>

          <div className="flex items-baseline mb-6">
            <span className="text-4xl font-bold">{price.current}</span>
            {price.original && <span className="text-muted-foreground ml-2 line-through">{price.original}</span>}
            {price.discount && (
              <Badge
                variant="outline"
                className={`ml-3 border-green-400/30 text-green-500 ${price.discountBadgeClassName || ""}`}
              >
                <span>{price.discount}</span>
              </Badge>
            )}
          </div>

          <div className="space-y-4 mb-6">
            {benefits.map((benefit, index) => {
              const BenefitIcon = benefit.icon

              return (
                <div key={index} className="flex items-center gap-2">
                  <BenefitIcon className="h-4 w-4 text-primary" />
                  <span className="text-sm">{benefit.text}</span>
                </div>
              )
            })}
          </div>

          <div className="mt-auto space-y-3">
            <Button
              className="w-full gap-2 group"
              size="lg"
              onClick={primaryButton.onClick}
              asChild={!!primaryButton.href}
            >
              {primaryButton.href ? (
                <Link href={primaryButton.href}>
                  <PrimaryButtonIcon className="h-4 w-4" />
                  <span>{primaryButton.text}</span>
                  {ChevronIcon && (
                    <ChevronIcon className="h-4 w-4 ml-auto transition-transform group-hover:translate-x-1" />
                  )}
                </Link>
              ) : (
                <>
                  <PrimaryButtonIcon className="h-4 w-4" />
                  <span>{primaryButton.text}</span>
                  {ChevronIcon && (
                    <ChevronIcon className="h-4 w-4 ml-auto transition-transform group-hover:translate-x-1" />
                  )}
                </>
              )}
            </Button>

            {secondaryButton && (
              <Button
                variant="outline"
                className="w-full gap-2"
                size="lg"
                onClick={secondaryButton.onClick}
                asChild={!!secondaryButton.href}
              >
                {secondaryButton.href ? (
                  <Link href={secondaryButton.href} target="_blank">
                    <span>{secondaryButton.text}</span>
                    <SecondaryButtonIcon className="h-4 w-4 ml-auto" />
                  </Link>
                ) : (
                  <>
                    <span>{secondaryButton.text}</span>
                    <SecondaryButtonIcon className="h-4 w-4 ml-auto" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Right column - Features */}
        <div className="p-6 md:p-8 md:w-1/2 md:border-l border-border/50">
          <div className="flex items-center mb-4">
            <h4 className="font-semibold">{featuresTitle}</h4>
          </div>

          <div className="space-y-3 mb-6">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={animationEnabled ? { opacity: 0, x: 20 } : { opacity: 1, x: 0 }}
                animate={animationEnabled && isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.4 + i * 0.05, duration: 0.5 }}
                className="flex items-center gap-3"
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
                  <FeaturesIcon className="h-3 w-3 text-primary" />
                </div>
                <span className="text-sm">{feature.text}</span>
              </motion.div>
            ))}
          </div>

          {testimonials.length > 0 && (
            <>
              <Separator className="my-6" />

              <div className="rounded-lg p-4 border border-border/50 relative overflow-hidden min-h-[140px]">
                <AnimatePresence mode="wait">
                  {testimonials.map(
                    (testimonial, index) =>
                      index === currentTestimonialIndex && (
                        <motion.div
                          key={testimonial.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ duration: 0.5 }}
                          className="absolute inset-0 p-4"
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <div className="h-8 w-8 rounded-full overflow-hidden">
                              <img
                                src={testimonial.avatar || "/placeholder.svg"}
                                alt={`${testimonial.name}'s avatar`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{testimonial.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {testimonial.role}
                                {testimonial.company && ` at ${testimonial.company}`}
                              </p>
                            </div>
                            <div className="ml-auto flex">
                              {[...Array(testimonial.rating)].map((_, i) => (
                                <Star key={i} className="h-3 w-3 fill-primary text-primary" />
                              ))}
                            </div>
                          </div>
                          <p className="text-sm italic">{testimonial.content}</p>
                        </motion.div>
                      ),
                  )}
                </AnimatePresence>
              </div>

              {testimonials.length > 1 && (
                <div className="flex justify-center mt-4 gap-1">
                  {testimonials.map((_, index) => (
                    <button
                      key={index}
                      className={`h-1.5 rounded-full transition-all ${
                        index === currentTestimonialIndex ? "w-4 bg-primary" : "w-1.5 bg-primary/30"
                      }`}
                      onClick={() => setCurrentTestimonialIndex(index)}
                      aria-label={`View testimonial ${index + 1}`}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  )
}


demo.tsx
"use client"

import { Check, ChevronRight, CreditCard, Crown, ExternalLink, Heart, Shield, ShoppingCart, Stars } from "lucide-react"
import { SinglePricingCard, type Testimonial } from "@/components/blocks/single-pricing-card"

export function PricingSectionBasic() {
  const features = [
    "Modern Next.js 14 App Router",
    "TypeScript and Tailwind CSS",
    "Supabase Auth Integration",
    "Database Tables and Schema",
    "Responsive Dashboard Layout",
    "50+ UI Components",
    "Dark Mode Support",
    "Authentication Flows",
    "SEO Optimized",
    "Performance Optimized",
    "Email Templates",
    "Premium Support",
  ].map((text) => ({ text }))

  const testimonials: Testimonial[] = [
    {
      id: 1,
      name: "Alex Johnson",
      role: "Full Stack Developer",
      company: "TechFlow",
      content:
        "This starter template saved me weeks of setup time. The Supabase integration is flawless, and the UI components are beautiful and easy to customize. Worth every penny!",
      rating: 5,
      avatar: "https://randomuser.me/api/portraits/men/32.jpg",
    },
    {
      id: 2,
      name: "Sarah Miller",
      role: "Frontend Engineer",
      company: "DesignHub",
      content:
        "I've used many starter templates, but this one stands out for its clean architecture and attention to detail. The TypeScript support is excellent, and the documentation is comprehensive.",
      rating: 5,
      avatar: "https://randomuser.me/api/portraits/women/44.jpg",
    },
    {
      id: 3,
      name: "Michael Chen",
      role: "Product Manager",
      company: "InnovateLabs",
      content:
        "Our team was able to launch our MVP in record time thanks to this template. The authentication flow and user management features worked right out of the box. Highly recommended!",
      rating: 5,
      avatar: "https://randomuser.me/api/portraits/men/46.jpg",
    },
    {
      id: 4,
      name: "Emily Rodriguez",
      role: "UX Designer",
      company: "CreativeCraft",
      content:
        "The dark mode implementation is perfect, and the components are accessible by default. As a designer, I appreciate the attention to detail and the clean, modern aesthetic.",
      rating: 4,
      avatar: "https://randomuser.me/api/portraits/women/65.jpg",
    },
    {
      id: 5,
      name: "David Park",
      role: "CTO",
      company: "StartupForge",
      content:
        "We evaluated several starter templates for our new project, and this one was by far the most complete. The code quality is excellent, and the structure makes it easy to extend.",
      rating: 5,
      avatar: "https://randomuser.me/api/portraits/men/22.jpg",
    },
    {
      id: 6,
      name: "Olivia Martinez",
      role: "Product Owner",
      company: "InnovateX",
      content:
        "After evaluating several solutions, we chose this one for its flexibility and robust feature set. The onboarding process was smooth, and our team was productive from day one.",
      rating: 5,
      avatar: "https://randomuser.me/api/portraits/women/24.jpg",
    },
  ]

  return (
    <section className="py-24 relative overflow-hidden flex justify-center" id="pricing">
      <div className="container px-4 md:px-6 relative z-10">
        <div className="flex flex-col items-center mb-12 text-center">
          <div className="inline-flex items-center gap-1 px-3 py-1 mb-4 rounded-full border border-primary/20 shadow-sm">
            <CreditCard className="mr-1 h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium">Simple Pricing</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl mb-4">
            One template, endless possibilities
          </h2>
          <p className="max-w-[700px] text-muted-foreground md:text-xl/relaxed">
            Everything you need to build your next great SaaS application
          </p>
        </div>

        <SinglePricingCard
          badge={{
            icon: Crown,
            text: "Premium Template",
          }}
          title="Next.js Starter Template"
          subtitle="Build your next SaaS application with this premium starter template"
          price={{
            current: "$69.99",
            original: "$99.99",
            discount: "30% Off",
          }}
          benefits={[
            {
              text: "One-time payment, lifetime updates",
              icon: Check,
            },
            {
              text: "30-day money-back guarantee",
              icon: Shield,
            },
            {
              text: "Created by developers for developers",
              icon: Heart,
            },
          ]}
          features={features}
          featuresIcon={Check}
          featuresBadge={{
            icon: Stars,
            text: "All Features",
          }}
          primaryButton={{
            text: "Purchase Template",
            icon: ShoppingCart,
            chevronIcon: ChevronRight,
          }}
          secondaryButton={{
            text: "Live Demo",
            icon: ExternalLink,
            href: "#",
          }}
          testimonials={testimonials}
          testimonialRotationSpeed={5000}
        />
      </div>
    </section>
  )
}

```

Copy-paste these files for dependencies:
```tsx
shadcn/button
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }

```
```tsx
shadcn/card
import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className,
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className,
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }

```
```tsx
shadcn/separator
"use client"

import * as React from "react"
import * as SeparatorPrimitive from "@radix-ui/react-separator"

import { cn } from "@/lib/utils"

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(
  (
    { className, orientation = "horizontal", decorative = true, ...props },
    ref
  ) => (
    <SeparatorPrimitive.Root
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
        className
      )}
      {...props}
    />
  )
)
Separator.displayName = SeparatorPrimitive.Root.displayName

export { Separator }

```
```tsx
shadcn/badge
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

```

Install NPM dependencies:
```bash
lucide-react, framer-motion, @radix-ui/react-slot, class-variance-authority, @radix-ui/react-separator
```

Implementation Guidelines
 1. Analyze the component structure and identify all required dependencies
 2. Review the component's argumens and state
 3. Identify any required context providers or hooks and install them
 4. Questions to Ask
 - What data/props will be passed to this component?
 - Are there any specific state management requirements?
 - Are there any required assets (images, icons, etc.)?
 - What is the expected responsive behavior?
 - What is the best place to use this component in the app?

Steps to integrate
 0. Copy paste all the code above in the correct directories
 1. Install external dependencies
 2. Fill image assets with Unsplash stock images you know exist
 3. Use lucide-react icons for svgs or logos if component requires them
