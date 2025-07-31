'use client'

import React, { useState } from 'react'
import { useParams } from 'next/navigation'

export default function WatchPage() {
  const params = useParams()
  const id = params.id as string // atau gunakan String(params.id) jika perlu jaga-jaga

  const [isPlaying, setIsPlaying] = useState(false)

  return (
    <div className="w-full min-h-screen flex flex-col justify-center items-center p-4 gap-4">
      {!isPlaying ? (
        <button
          onClick={() => setIsPlaying(true)}
          className="px-6 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg shadow"
        >
          ▶️ Play
        </button>
      ) : (
        <div className="w-full max-w-4xl aspect-video">
          <iframe
            width="100%"
            height="100%"
            src={`https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1`}
            title={`Video ID ${id}`}
            allow="autoplay; fullscreen"
            allowFullScreen
            className="rounded-xl w-full h-full"
          />
        </div>
      )}
    </div>
  )
}
