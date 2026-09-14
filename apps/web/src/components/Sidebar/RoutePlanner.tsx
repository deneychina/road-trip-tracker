import { useState } from 'react';
import type { DrivingPolicy, RoadType } from '../../lib/driving';
import { PRESET_ROUTES, type PresetRoute } from '@road-trip/shared';
import SearchInput from './SearchInput';

const POLICY_OPTIONS: { value: DrivingPolicy; label: string }[] = [
  { value: 0, label: '最短距离' },
  { value: 1, label: '最快时间' },
  { value: 2, label: '最少费用' },
  { value: 3, label: '不走高速' },
  { value: 4, label: '躲避拥堵' },
];

const ROAD_TYPE_OPTIONS: { value: RoadType; label: string; icon: string }[] = [
  { value: 'highway', label: '高速优先', icon: '🛣️' },
  { value: 'national', label: '国道优先', icon: '️' },
];

interface Waypoint {
  name: string;
  loc: [number, number];
}

interface RoutePlannerProps {
  originName: string;
  destName: string;
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
  onPresetSelect: (route: PresetRoute) => void;
  onHighwayQuery: (ref: string) => void;
  highwayLoading: boolean;
  waypoints?: Waypoint[];
  onWaypointsChange?: (waypoints: Waypoint[]) => void;
}

export default function RoutePlanner({
  originName,
  destName,
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
  onPresetSelect,
  onHighwayQuery,
  highwayLoading,
  waypoints: externalWaypoints,
  onWaypointsChange,
}: RoutePlannerProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [highwayRef, setHighwayRef] = useState('');
  const [localWaypoints, setLocalWaypoints] = useState<Waypoint[]>([]);

  const waypoints = externalWaypoints ?? localWaypoints;
  const setWaypoints = onWaypointsChange ?? setLocalWaypoints;

  const handlePresetConfirm = () => {
    const preset = PRESET_ROUTES.find((r) => r.id === selectedPresetId);
    if (preset) {
      onPresetSelect(preset);
    }
  };

  const handleHighwaySubmit = () => {
    const trimmed = highwayRef.trim().toUpperCase();
    if (!trimmed) return;
    const ref = trimmed.startsWith('G') ? trimmed : 'G' + trimmed;
    onHighwayQuery(ref);
  };

  const handleAddWaypoint = () => {
    setWaypoints([...waypoints, { name: '', loc: [0, 0] }]);
  };

  const handleRemoveWaypoint = (index: number) => {
    const newWps = waypoints.filter((_, i) => i !== index);
    setWaypoints(newWps);
  };

  const handleWaypointSelect = (index: number, name: string, loc: [number, number]) => {
    const newWps = [...waypoints];
    newWps[index] = { name, loc };
    setWaypoints(newWps);
  };

  return (
    <div className="planner">
      <div className="planner-form">
        <div className="input-group">
          <label>起点</label>
          <SearchInput
            value={originName}
            placeholder="输入地名搜索或点击地图选择"
            onSelect={onOriginSelect}
          />
        </div>
        <div className="input-group">
          <label>终点</label>
          <SearchInput
            value={destName}
            placeholder="输入地名搜索或点击地图选择"
            onSelect={onDestSelect}
          />
        </div>

        {waypoints.length > 0 && (
          <div className="waypoints-section">
            <label className="policy-label">途径点</label>
            {waypoints.map((wp, index) => (
              <div key={index} className="waypoint-item">
                <SearchInput
                  value={wp.name}
                  placeholder={`途径点 ${index + 1}`}
                  onSelect={(name, loc) => handleWaypointSelect(index, name, loc)}
                />
                <button
                  className="waypoint-remove-btn"
                  onClick={() => handleRemoveWaypoint(index)}
                  title="删除"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <button className="btn-add-waypoint" onClick={handleAddWaypoint}>
          + 添加途径点
        </button>

        <button
          className="btn-primary"
          onClick={onPlanRoute}
          disabled={planning}
        >
          {planning ? '规划中...' : '规划路线'}
        </button>

        <div className="highway-query-section">
          <div className="highway-input-row">
            <input
              className="highway-input"
              type="text"
              placeholder="输入国道编号，如 G318"
              value={highwayRef}
              onChange={(e) => setHighwayRef(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleHighwaySubmit()}
            />
            <button
              className="btn-preset-confirm"
              onClick={handleHighwaySubmit}
              disabled={highwayLoading || !highwayRef.trim()}
            >
              {highwayLoading ? '查询中...' : '确定'}
            </button>
          </div>
        </div>

        <div className="policy-selector">
          <label className="policy-label">路线偏好</label>
          <div className="policy-options">
            {POLICY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`policy-btn ${policy === opt.value ? 'active' : ''}`}
                onClick={() => onPolicyChange(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="road-type-selector">
          <label className="policy-label">道路类型</label>
          <div className="road-type-options">
            {ROAD_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`road-type-btn ${roadType === opt.value ? 'active' : ''}`}
                onClick={() => onRoadTypeChange(opt.value)}
              >
                <span className="road-type-icon">{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {distance !== null && (
        <div className="stats">
          <div className="stat-card">
            <span className="stat-value">{(distance / 1000).toFixed(1)}</span>
            <span className="stat-unit">公里</span>
          </div>
          {duration !== null && (
            <div className="stat-card">
              <span className="stat-value">{Math.round(duration / 3600)}</span>
              <span className="stat-unit">小时</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
