import type { Trip } from '@road-trip/shared';
import dayjs from 'dayjs';

interface TripListProps {
  trips: Trip[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNewTrip: () => void;
}

export default function TripList({
  trips,
  currentId,
  onSelect,
  onDelete,
  onNewTrip,
}: TripListProps) {
  return (
    <div className="trip-list">
      <div className="trip-list-header">
        <h3>历史行程</h3>
        <button className="btn-small" onClick={onNewTrip}>
          + 新建
        </button>
      </div>

      {trips.length === 0 ? (
        <p className="empty-text">暂无行程，开始规划你的第一次旅行吧</p>
      ) : (
        <ul>
          {trips.map((trip) => (
            <li
              key={trip.id}
              className={`trip-item ${trip.id === currentId ? 'active' : ''}`}
              onClick={() => onSelect(trip.id)}
            >
              <div className="trip-item-header">
                <span className="trip-name">{trip.name}</span>
                <button
                  className="btn-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(trip.id);
                  }}
                  title="删除"
                >
                  ×
                </button>
              </div>
              <div className="trip-item-meta">
                <span>
                  {trip.mode === 'planned' ? '规划' : '录制'} ·{' '}
                  {(trip.distance / 1000).toFixed(1)} km
                </span>
                <span>{dayjs(trip.createdAt).format('MM/DD HH:mm')}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
