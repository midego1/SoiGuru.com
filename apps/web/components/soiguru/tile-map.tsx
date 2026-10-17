import type { GeoPoint } from '@/lib/soiguru/types';

/**
 * A server-rendered OpenStreetMap view: raster tiles laid out as plain
 * <img> elements with the pins on top. No map library and no script, so it
 * paints with the HTML (ListingPage: "a static map image, no tiles library").
 *
 * The zoom fits every point into a phone-width box; the tile canvas is wider
 * than any screen and centred, so desktop layouts simply see more map.
 * Tile server: NEXT_PUBLIC_MAP_TILE_URL (default tile.openstreetmap.org, which
 * is fine for development and light traffic; use a hosted tile service before
 * launch, per the OSM tile usage policy).
 */

const TILE = 256;
const CANVAS_WIDTH = 1792; // 7 tiles: wider than the widest map panel
const DEFAULT_FIT_WIDTH = 320;
const MAX_ZOOM = 17;
const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export interface MapPin {
	id: string;
	geo: GeoPoint;
	href?: string;
	label: string;
	selected?: boolean;
}

function project(p: GeoPoint, z: number): { x: number; y: number } {
	const n = TILE * 2 ** z;
	const lat = Math.max(-85, Math.min(85, p.lat));
	const s = Math.sin((lat * Math.PI) / 180);
	return { x: ((p.lng + 180) / 360) * n, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n };
}

function fitZoom(points: GeoPoint[], width: number, height: number): number {
	if (points.length < 2) return 16;
	for (let z = MAX_ZOOM; z > 2; z--) {
		const px = points.map((p) => project(p, z));
		const w = Math.max(...px.map((p) => p.x)) - Math.min(...px.map((p) => p.x));
		const h = Math.max(...px.map((p) => p.y)) - Math.min(...px.map((p) => p.y));
		if (w <= width && h <= height - 72) return Math.min(z, 16);
	}
	return 3;
}

const PIN_PATH = 'M0-18a9 9 0 0 1 9 9c0 6-9 15-9 15S-9-3-9-9a9 9 0 0 1 9-9Z';

interface TileMapProps {
	pins: MapPin[];
	height: number;
	/** Centre when there are no pins. */
	fallbackCenter?: GeoPoint;
	/** The visitor or the area centre, drawn as a sun dot. */
	you?: GeoPoint;
	/** Width (px) the pins must fit in; the phone column by default. */
	fitWidth?: number;
	className?: string;
	children?: React.ReactNode;
}

export function TileMap({ pins, height, fallbackCenter, you, fitWidth = DEFAULT_FIT_WIDTH, className, children }: TileMapProps) {
	const points = pins.map((p) => p.geo);
	const center = points.length
		? {
				lat: (Math.max(...points.map((p) => p.lat)) + Math.min(...points.map((p) => p.lat))) / 2,
				lng: (Math.max(...points.map((p) => p.lng)) + Math.min(...points.map((p) => p.lng))) / 2
			}
		: fallbackCenter;
	if (!center) return null;
	const z = fitZoom(points, fitWidth, height);
	const c = project(center, z);
	const left = c.x - CANVAS_WIDTH / 2;
	const top = c.y - height / 2;
	const max = 2 ** z;
	const tiles: { key: string; src: string; x: number; y: number }[] = [];
	for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + height) / TILE); ty++) {
		if (ty < 0 || ty >= max) continue;
		for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + CANVAS_WIDTH) / TILE); tx++) {
			const wx = ((tx % max) + max) % max;
			tiles.push({
				key: `${tx}-${ty}`,
				src: TILE_URL.replace('{z}', String(z)).replace('{x}', String(wx)).replace('{y}', String(ty)),
				x: tx * TILE - left,
				y: ty * TILE - top
			});
		}
	}
	const at = (p: GeoPoint) => {
		const q = project(p, z);
		return { x: q.x - left, y: q.y - top };
	};
	// Selected pin drawn last so it sits on top.
	const ordered = [...pins].sort((a, b) => Number(!!a.selected) - Number(!!b.selected));
	return (
		<div className={`tkg-map sg-tilemap ${className ?? ''}`} style={{ height }}>
			<div className="sg-tilemap-canvas" style={{ width: CANVAS_WIDTH, height, marginLeft: -CANVAS_WIDTH / 2 }}>
				{tiles.map((t) => (
					// Plain <img>: map tiles need no image optimisation.
					<img key={t.key} src={t.src} alt="" width={TILE} height={TILE} loading="lazy" decoding="async" style={{ left: t.x, top: t.y }} />
				))}
				<svg width={CANVAS_WIDTH} height={height} aria-hidden={pins.every((p) => !p.href) ? true : undefined}>
					{you ? <circle className="tkg-m-you" cx={at(you).x} cy={at(you).y} r={7} /> : null}
					{ordered.map((p) => {
						const { x, y } = at(p.geo);
						const pin = (
							<g transform={`translate(${x} ${y})${p.selected ? ' scale(1.25)' : ''}`}>
								<path className={p.selected ? 'tkg-m-pin-on' : 'tkg-m-pin'} d={PIN_PATH} />
								<circle className="tkg-m-pin-dot" cx={0} cy={-9} r={3} />
							</g>
						);
						return p.href ? (
							<a key={p.id} href={p.href} aria-label={p.label}>
								<title>{p.label}</title>
								{pin}
							</a>
						) : (
							<g key={p.id}>
								<title>{p.label}</title>
								{pin}
							</g>
						);
					})}
				</svg>
			</div>
			{children}
		</div>
	);
}
