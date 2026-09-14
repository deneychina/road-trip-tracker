import RoutePlanner from './RoutePlanner';
import AnimationControls from './AnimationControls';
import TripList from './TripList';
import type { Trip } from '@road-trip/shared';
import type { DrivingPolicy, RoadType } from '../../lib/driving';
import type { HighwayRoute } from '@road-trip/shared';

interface Waypoint {
  name: string;
  loc: [number, number];
}

interface SidebarProps {
  trips: Trip[];
  currentId: string | null;
  currentTrip: Trip | undefined;
  onPlanRoute: () => void;
  planning: boolean;
  distance: number | null;
  duration: number | null;
  policy: DrivingPolicy;
  onPolicyChange: (policy: DrivingPolicy) => void;
  roadType: RoadType;
  onRoadTypeChange: (roadType: RoadType) => void;
  onOriginSelect: (name: string, loc: [number, number]) => void;
  onDestSelect: (name: string, loc: [number, number]) => void;
  onHighwayQuery: (ref: string) => void;
  highwayLoading: boolean;
  highwayRoute: HighwayRoute | null;
  originName: string;
  destName: string;
  onExportVideo: () => void;
  animation: {
    playing: boolean;
    progress: number;
    speedKmh: number;
    followCamera: boolean;
    play: () => void;
    pause: () => void;
    resume: () => void;
    reset: () => void;
    setSpeedKmh: (s: number) => void;
    toggleFollowCamera: () => void;
    seekTo: (fraction: number) => void;
  };
  onSelectTrip: (id: string) => void;
  onDeleteTrip: (id: string) => void;
  onNewTrip: () => void;
  plannerWaypoints?: Waypoint[];
  onPlannerWaypointsChange?: (waypoints: Waypoint[]) => void;
}

export default function Sidebar({
  trips,
  currentId,
  currentTrip,
  onPlanRoute,
  planning,
  distance,
  duration,
  policy,
  onPolicyChange,
  roadType,
  onRoadTypeChange,
  onOriginSelect,
  onDestSelect,
  onHighwayQuery,
  highwayLoading,
  highwayRoute,
  originName,
  destName,
  onExportVideo,
  animation,
  onSelectTrip,
  onDeleteTrip,
  onNewTrip,
  plannerWaypoints,
  onPlannerWaypointsChange,
}: SidebarProps) {
  const hasRoute = !!(currentTrip?.route?.path?.length);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>公路旅行</h1>
        <span className="subtitle">轨迹追踪</span>
      </div>

      <RoutePlanner
        originName={originName}
        destName={destName}
        onPlanRoute={onPlanRoute}
        planning={planning}
        distance={distance}
        duration={duration}
        policy={policy}
        onPolicyChange={onPolicyChange}
        roadType={roadType}
        onRoadTypeChange={onRoadTypeChange}
        onOriginSelect={onOriginSelect}
        onDestSelect={onDestSelect}
        onHighwayQuery={onHighwayQuery}
        highwayLoading={highwayLoading}
        waypoints={plannerWaypoints}
        onWaypointsChange={onPlannerWaypointsChange}
      />

      {highwayRoute && (
        <div className="highway-info">
          <div className="highway-info-header">
            <span className="highway-ref">{highwayRoute.ref}</span>
            <span className="highway-name">{highwayRoute.name}</span>
          </div>
          <div className="highway-info-details">
            <div className="highway-info-row">
              <span className="highway-info-label">起点</span>
              <span className="highway-info-value">{highwayRoute.from}</span>
            </div>
            <div className="highway-info-row">
              <span className="highway-info-label">终点</span>
              <span className="highway-info-value">{highwayRoute.to}</span>
            </div>
            <div className="highway-info-row">
              <span className="highway-info-label">全程</span>
              <span className="highway-info-value">{highwayRoute.km.toLocaleString()} 公里</span>
            </div>
          </div>
        </div>
      )}

      <AnimationControls
        playing={animation.playing}
        progress={animation.progress}
        speedKmh={animation.speedKmh}
        followCamera={animation.followCamera}
        hasRoute={hasRoute}
        onPlay={animation.play}
        onPause={animation.pause}
        onResume={animation.resume}
        onReset={animation.reset}
        onSetSpeedKmh={animation.setSpeedKmh}
        onToggleFollowCamera={animation.toggleFollowCamera}
        onExportVideo={onExportVideo}
        onSeek={animation.seekTo}
      />

      <TripList
        trips={trips}
        currentId={currentId}
        onSelect={onSelectTrip}
        onDelete={onDeleteTrip}
        onNewTrip={onNewTrip}
      />
    </aside>
  );
}
