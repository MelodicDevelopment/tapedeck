import { useEffect, useRef } from 'react'

type YouTubePlayerProps = {
  videoId: string
  playing: boolean
  volume: number
  seekTo: { seconds: number; requestId: number } | null
  onPlayingChange: (playing: boolean) => void
  onProgress: (elapsed: number, duration: number) => void
  onEnded: () => void
  onUnavailable: () => void
}

let playerSequence = 0

export function YouTubePlayer({
  videoId,
  playing,
  volume,
  seekTo,
  onPlayingChange,
  onProgress,
  onEnded,
  onUnavailable,
}: YouTubePlayerProps) {
  const elementId = useRef(`youtube-player-${++playerSequence}`)
  const playerRef = useRef<YT.Player | null>(null)
  const readyRef = useRef(false)
  const callbacksRef = useRef({ onPlayingChange, onProgress, onEnded, onUnavailable })
  callbacksRef.current = { onPlayingChange, onProgress, onEnded, onUnavailable }

  useEffect(() => {
    let disposed = false

    const createPlayer = () => {
      if (disposed || playerRef.current) return
      playerRef.current = new window.YT.Player(elementId.current, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 0,
          controls: 1,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          ...(window.location.protocol === 'http:' || window.location.protocol === 'https:'
            ? { origin: window.location.origin }
            : {}),
        },
        events: {
          onReady: (event) => {
            readyRef.current = true
            event.target.setVolume(volume)
            if (playing) event.target.playVideo()
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              callbacksRef.current.onPlayingChange(true)
            }
            if (event.data === window.YT.PlayerState.PAUSED) {
              callbacksRef.current.onPlayingChange(false)
            }
            if (event.data === window.YT.PlayerState.ENDED) {
              callbacksRef.current.onEnded()
            }
          },
          onError: () => callbacksRef.current.onUnavailable(),
        },
      })
    }

    if (window.YT?.Player) {
      createPlayer()
    } else {
      const previousReady = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        previousReady?.()
        createPlayer()
      }

      if (!document.querySelector('script[data-tapedeck-youtube-api]')) {
        const script = document.createElement('script')
        script.src = 'https://www.youtube.com/iframe_api'
        script.dataset.tapedeckYoutubeApi = 'true'
        document.head.appendChild(script)
      }
    }

    const progressTimer = window.setInterval(() => {
      if (!readyRef.current || !playerRef.current) return
      const elapsed = playerRef.current.getCurrentTime()
      const duration = playerRef.current.getDuration()
      callbacksRef.current.onProgress(elapsed, duration)
    }, 500)

    return () => {
      disposed = true
      window.clearInterval(progressTimer)
      playerRef.current?.destroy()
      playerRef.current = null
      readyRef.current = false
    }
    // The player is recreated when the selected video changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId])

  useEffect(() => {
    if (!readyRef.current || !playerRef.current) return
    if (playing) playerRef.current.playVideo()
    else playerRef.current.pauseVideo()
  }, [playing])

  useEffect(() => {
    if (readyRef.current) playerRef.current?.setVolume(volume)
  }, [volume])

  useEffect(() => {
    if (seekTo && readyRef.current) {
      playerRef.current?.seekTo(seekTo.seconds, true)
    }
  }, [seekTo])

  return (
    <div className="youtube-player">
      <div id={elementId.current} />
    </div>
  )
}
