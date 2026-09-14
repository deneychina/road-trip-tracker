import { useState, useEffect, useRef, useCallback } from 'react';
import { loadAMap } from '../../lib/amap-loader';

interface SearchInputProps {
  value: string;
  placeholder: string;
  onSelect: (name: string, loc: [number, number]) => void;
}

interface PlaceResult {
  name: string;
  address: string;
  location: [number, number];
}

export default function SearchInput({ value, placeholder, onSelect }: SearchInputProps) {
  const [input, setInput] = useState(value);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    setInput(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const search = useCallback(async (keyword: string) => {
    if (!keyword.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }

    const AMap = await loadAMap();
    const autoComplete = new AMap.AutoComplete({ city: '全国' });

    autoComplete.search(keyword, (status: string, result: any) => {
      if (status === 'complete' && result.tips) {
        const tips = result.tips as any[];
        const valid = tips
          .filter((t) => t.name && t.location && t.location.lng)
          .slice(0, 8)
          .map((t) => ({
            name: t.name,
            address: t.district ? `${t.district}${t.address || ''}` : '',
            location: [t.location.lng, t.location.lat] as [number, number],
          }));
        setResults(valid);
        setOpen(valid.length > 0);
      } else {
        setResults([]);
        setOpen(false);
      }
    });
  }, []);

  const handleChange = (val: string) => {
    setInput(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(val), 300);
  };

  const handleSelect = (place: PlaceResult) => {
    setInput(place.name);
    setOpen(false);
    setResults([]);
    onSelect(place.name, place.location);
  };

  return (
    <div className="search-input-wrapper" ref={wrapperRef}>
      <input
        type="text"
        placeholder={placeholder}
        value={input}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
      />
      {open && (
        <div className="search-dropdown">
          {results.map((r, i) => (
            <div key={i} className="search-item" onClick={() => handleSelect(r)}>
              <span className="search-item-name">{r.name}</span>
              {r.address && <span className="search-item-address">{r.address}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
