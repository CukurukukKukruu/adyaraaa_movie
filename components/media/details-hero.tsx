'use client'

import React from 'react'
import { useRouter } from 'next/navigation'

import { MovieDetails } from '@/types/movie-details'
import { DetailsHero } from '@/components/details-hero'

export const MovieDetailsHero = ({ movie }: { movie: MovieDetails }) => {
  const router = useRouter()

  const playVideo = () => {
    router.push(`/watch/${movie.id}`)
  }

  return (
  <DetailsHero
    movie={movie}
    playVideo={playVideo}
    isIframeShown={false} // ← tambahkan ini
  />
)

}
