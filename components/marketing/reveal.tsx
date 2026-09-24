"use client"

import {
  useEffect,
  useRef,
  useState,
  type ElementType,
  type ReactNode,
} from "react"
import { cn } from "@/lib/utils"

type RevealTag = "article" | "div" | "section"
type RevealState = "idle" | "pending" | "visible"

type RevealProps = {
  as?: RevealTag
  children: ReactNode
  className?: string
  id?: string
  audience?: "both" | "buyer" | "seller"
  audienceSplit?: boolean
}

export function Reveal({
  as,
  children,
  className,
  id,
  audience,
  audienceSplit,
}: RevealProps) {
  const elementRef = useRef<HTMLElement | null>(null)
  const [revealState, setRevealState] = useState<RevealState>("idle")
  const Tag = as as ElementType

  useEffect(() => {
    const element = elementRef.current

    if (
      !element ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    ) {
      setRevealState("visible")
      return
    }

    setRevealState("pending")

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return

        setRevealState("visible")
        observer.disconnect()
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.15 },
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      ref={elementRef}
      id={id}
      data-audience={audience}
      data-audience-split={audienceSplit}
      data-reveal={revealState}
      className={cn("reveal", className)}
    >
      {children}
    </Tag>
  )
}
