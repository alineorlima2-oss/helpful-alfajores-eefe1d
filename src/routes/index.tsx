import { createFileRoute } from '@tanstack/react-router'
import { Muvpet } from '@/components/muvpet'

export const Route = createFileRoute('/')({
  component: Muvpet,
})
