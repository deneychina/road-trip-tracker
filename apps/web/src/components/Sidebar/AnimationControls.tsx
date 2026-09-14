interface AnimationControlsProps {
  playing: boolean;
  progress: number;
  speedKmh: number;
  followCamera: boolean;
  hasRoute: boolean;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onSetSpeedKmh: (kmh: number) => void;
  onToggleFollowCamera: () => void;
  onExportVideo: () => void;
  onSeek: (fraction: number) => void;
}

export default function AnimationControls({
  playing,
  progress,
  speedKmh,
  followCamera,
  hasRoute,
  onPlay,
  onPause,
  onResume,
  onReset,
  onSetSpeedKmh,
  onToggleFollowCamera,
  onExportVideo,
  onSeek,
}: AnimationControlsProps) {
  if (!hasRoute) return null;

  return (
    <div className="animation-controls">
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
        <input
          type="range"
          className="progress-scrubber"
          min={0}
          max={1}
          step={0.001}
          value={progress}
          onChange={(e) => onSeek(Number(e.target.value))}
        />
      </div>

      <div className="controls-row">
        {!playing && progress === 0 && (
          <button className="btn-icon" onClick={onPlay} title="播放">
            ▶
          </button>
        )}
        {playing && (
          <button className="btn-icon" onClick={onPause} title="暂停">
            ⏸
          </button>
        )}
        {!playing && progress > 0 && progress < 1 && (
          <button className="btn-icon" onClick={onResume} title="继续">
            ▶
          </button>
        )}
        {progress > 0 && (
          <button className="btn-icon" onClick={onReset} title="重置">
            ⏹
          </button>
        )}

        <button
          className={`btn-follow-camera ${followCamera ? 'active' : ''}`}
          onClick={onToggleFollowCamera}
          title={followCamera ? '关闭3D视角' : '开启3D视角'}
          disabled={playing}
        >
          <span style={{ color: '#fff', fontWeight: 700, fontSize: '12px' }}>3D</span>
        </button>

        <button className="btn-export-video" onClick={onExportVideo} title="导出9:16视频">
          导出视频
        </button>
      </div>

      <div className="speed-row">
        <label className="speed-label">
          行进速度
        </label>
        <input
          type="range"
          className="speed-slider"
          min={10}
          max={150}
          step={10}
          value={speedKmh}
          onChange={(e) => onSetSpeedKmh(Number(e.target.value))}
        />
      </div>
    </div>
  );
}
