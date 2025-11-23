import { useState, useRef, useEffect } from 'react';
import { Button } from '@primer/react';
import { PlayIcon, PauseIcon, UnmuteIcon } from '@primer/octicons-react';
import './AudioPlayer.scss';

interface AudioPlayerProps {
  src: string;
  className?: string;
}

export default function AudioPlayer({ src, className = '' }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      setCurrentTime(audio.currentTime);
    };
    const updateDuration = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const handleEnded = () => setIsPlaying(false);
    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', updateDuration);
    audio.addEventListener('ended', handleEnded);

    // Try to get duration immediately if already loaded
    if (audio.readyState >= 1 && audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
      setDuration(audio.duration);
    }

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [src]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const target = e.target as HTMLInputElement;
    const newTime = parseFloat(target.value);
    if (!isNaN(newTime) && isFinite(newTime) && newTime >= 0) {
      audio.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newVolume = parseFloat(e.target.value);
    audio.volume = newVolume;
    setVolume(newVolume);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`audio-player-custom ${className}`}>
      <audio ref={audioRef} src={src} crossOrigin="anonymous" preload="metadata" />
      
      <div className="audio-player-controls">
        <Button
          onClick={togglePlayPause}
          variant="invisible"
          size="small"
          className="audio-player-play-button"
        >
          {isPlaying ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
        </Button>

        <div className="audio-player-time-display">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        <div className="audio-player-progress-wrapper">
          <input
            type="range"
            min="0"
            max={duration || 0.01}
            step="0.01"
            value={currentTime || 0}
            onChange={handleProgressChange}
            onInput={handleProgressChange}
            className="audio-player-progress"
            style={{
              '--progress': `${progressPercentage}%`
            } as React.CSSProperties}
          />
        </div>

        <div 
          className="audio-player-volume-wrapper"
          onMouseEnter={() => setShowVolumeSlider(true)}
          onMouseLeave={() => setShowVolumeSlider(false)}
        >
          <Button
            variant="invisible"
            size="small"
            aria-label="Volume"
            className="audio-player-volume-icon"
            onClick={(e) => e.preventDefault()}
          >
            <UnmuteIcon size={16} />
          </Button>
          {showVolumeSlider && (
            <div className="audio-player-volume-slider-container">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                className="audio-player-volume"
                orient="vertical"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

