import { useEffect, useMemo, useRef } from 'react'
import Globe from 'globe.gl'
import { resolveCurrentCell, timeAtHour } from '../core/data.js'
import { rayPoints, regionAtPoint, subBodyPoints } from '../core/globeSky.js'
import { bodyDirections, directionText } from '../core/mapSky.js'
import { useI18n } from '../i18n/index.jsx'

const GROUP_COLORS = { 'artemis-region': '#fbbf24', apollo: '#f8fafc', clps: '#38bdf8', international: '#a78bfa' }
const SUN_COLOR = '#f0e442' // same colours as the 2D map
const RAY_LENGTH_RADII = 0.35 // direction rays, in Moon radii
const EARTH_COLOR = '#56b4e9'
const RING_CLICK_RADIUS_DEG = 2.5
const VIEWS = {
  southPole: { lat: -90, lng: 0, altitude: 0.45 },
  nearSide: { lat: 0, lng: 0, altitude: 2.2 },
  farSide: { lat: 0, lng: 180, altitude: 2.2 },
}
// globe.gl centres this element on the point, so it is zero-sized and the dot and name are placed around its origin.
function pinElement({ color, sizePx, text, title, isSelected, open }) {
  const pin = document.createElement('div')
  pin.title = title ?? ''
  pin.style.cssText = `width:0;height:0;pointer-events:${open ? 'auto' : 'none'};cursor:pointer`
  const dot = document.createElement('span')
  dot.style.cssText = `position:absolute;left:${-sizePx / 2}px;top:${-sizePx / 2}px;width:${sizePx}px;height:${sizePx}px;border-radius:50%;background:${color};box-shadow:0 0 0 ${isSelected ? 2 : 1}px #020617${isSelected ? ',0 0 0 3px #fff' : ''}`
  const name = document.createElement('span')
  name.textContent = text
  name.style.cssText = `position:absolute;left:${sizePx / 2 + 5}px;top:-7px;font:600 11px sans-serif;color:${color};text-shadow:0 0 3px #000,0 0 3px #000;white-space:nowrap`
  pin.append(dot, name)
  if (open) pin.addEventListener('click', open)
  return pin
}
const buttonClass = 'rounded bg-slate-900/80 px-2 py-1 text-xs text-slate-100 ring-1 ring-slate-600 hover:bg-slate-700'

export default function MoonGlobe({ sites, regions, ephemeris, hour, selectedSiteId, onSelectSite, onOpenRegion }) {
  const { t } = useI18n()
  const containerRef = useRef(null)
  const globeRef = useRef(null)
  const handlersRef = useRef({})
  const subPoints = useMemo(() => subBodyPoints(ephemeris, hour), [ephemeris, hour])
  const selectedSite = sites.find((site) => site.id === selectedSiteId) ?? null
  const directions = useMemo(
    () => (selectedSite && subPoints ? bodyDirections(resolveCurrentCell({ type: 'site', siteId: selectedSite.id }, {}, sites), ephemeris, hour) : null),
    [selectedSite, subPoints, sites, ephemeris, hour],
  )

  useEffect(() => {
    handlersRef.current = { onSelectSite, onOpenRegion }
  }, [onSelectSite, onOpenRegion])

  useEffect(() => {
    const container = containerRef.current
    const isNarrow = window.matchMedia('(max-width: 767px)').matches // phones keep the lighter 2k texture
    const globe = new Globe(container)
      .width(container.clientWidth)
      .height(container.clientHeight)
      .backgroundColor('#020617')
      .showAtmosphere(false)
      .globeImageUrl(isNarrow ? '/textures/lroc_color_2k.jpg' : '/textures/lroc_color_4k.jpg') // NASA SVS 4720, CGI Moon Kit
      .bumpImageUrl('/textures/ldem_bump_1440.png') // LOLA elevation from the same kit, shades the relief
      .onGlobeClick(({ lat, lng }) => {
        const region = regionAtPoint(globeRef.current.ringsData(), lat, lng, RING_CLICK_RADIUS_DEG)
        if (region) handlersRef.current.onOpenRegion(region.code)
      })
      .ringLat('lat')
      .ringLng('lon')
      .ringColor(() => () => 'rgba(251,191,36,0.6)')
      .ringMaxRadius(1.6)
      .ringPropagationSpeed(0.6)
      .ringRepeatPeriod(2500)
      .htmlLat('lat')
      .htmlLng('lng')
      .htmlAltitude(0.004)
      .htmlElement((pin) => pinElement(pin))
      .htmlAltitude((pin) => pin.altitude ?? 0.004)
      .pathPoints('points')
      .pathPointLat((point) => point[0])
      .pathPointLng((point) => point[1])
      .pathPointAlt((point) => point[2])
      .pathColor('color')
      .pathStroke(1)
      .pathDashLength('dashLength')
      .pathDashGap('dashGap')
      .pathTransitionDuration(0)
      .pointOfView({ ...VIEWS.southPole })
    globeRef.current = globe
    // Follow the container when the window is resized or a phone is rotated.
    const resizeObserver = new ResizeObserver(() => globe.width(container.clientWidth).height(container.clientHeight))
    resizeObserver.observe(container)
    return () => {
      resizeObserver.disconnect()
      globe.renderer().forceContextLoss() // browsers cap live WebGL contexts; free this one on every tab switch
      globe._destructor()
    }
  }, [])

  useEffect(() => {
    globeRef.current.ringsData(regions)
  }, [regions])

  useEffect(() => {
    const globe = globeRef.current
    // Real day/night: a directional light from the sub-solar point plus a dim ambient light.
    const [ambientLight, sunLight] = globe.lights()
    ambientLight.color.set('#445066')
    ambientLight.intensity = 0.5
    sunLight.intensity = 3.2
    if (!subPoints) return
    const { x, y, z } = globe.getCoords(subPoints.sun.latDeg, subPoints.sun.lonDeg, 5)
    sunLight.position.set(x, y, z)
    const marker = (text, color, { latDeg, lonDeg }) => ({ text, color, lat: latDeg, lng: lonDeg, sizePx: 10 })
    // HTML pins stay bright on the night side (3D labels are lit); the selected site also shows its name.
    const sitePins = sites.map((site) => {
      const isSelected = site.id === selectedSiteId
      const open = () => (site.region ? handlersRef.current.onOpenRegion(site.region) : handlersRef.current.onSelectSite(site))
      return {
        lat: site.lat,
        lng: site.lon,
        color: GROUP_COLORS[site.group] ?? '#f8fafc',
        sizePx: isSelected ? 12 : 7,
        text: isSelected ? site.name : '',
        title: `${site.name}\n${site.group} · ${site.lat.toFixed(2)}°, ${site.lon.toFixed(2)}°`,
        isSelected,
        open,
      }
    })
    const sunMarker = marker(t('globe.sun'), SUN_COLOR, subPoints.sun)
    const earthMarker = marker(t('globe.earth'), EARTH_COLOR, subPoints.earth)
    // Straight rays from the site toward the Sun and Earth; dashed and dim when that body is below the local horizon.
    const rays = selectedSite && directions
      ? [[SUN_COLOR, subPoints.sun, directions[0], 'globe.sun'], [EARTH_COLOR, subPoints.earth, directions[1], 'globe.earth']].map(([color, body, direction, nameKey]) => {
          const points = rayPoints(selectedSite.lat, selectedSite.lon, body.latDeg, body.lonDeg, RAY_LENGTH_RADII)
          const isAbove = direction.elevationDeg >= 0
          const tip = points[points.length - 1]
          const tipPin = { text: `${t(nameKey)} ${isAbove ? '' : '(below horizon)'}`, color, lat: tip[0], lng: tip[1], altitude: tip[2], sizePx: 8 }
          return { path: { points, color: isAbove ? color : `${color}80`, dashLength: isAbove ? 1 : 0.04, dashGap: isAbove ? 0 : 0.03 }, tipPin }
        })
      : []
    globe
      .htmlElementsData([...sitePins, sunMarker, earthMarker, ...rays.map((ray) => ray.tipPin)])
      .pathsData(rays.map((ray) => ray.path))
  }, [subPoints, selectedSite, selectedSiteId, sites, directions, t])

  const showView = (view) => globeRef.current.pointOfView(VIEWS[view], 1200)
  const legendRows = [
    ...Object.keys(GROUP_COLORS).map((group) => [GROUP_COLORS[group], t(`globe.legend.${group}`)]),
    [SUN_COLOR, t('globe.legend.sun')],
    [EARTH_COLOR, t('globe.legend.earth')],
  ]

  return (
    <div className="space-y-2">
      <div className="relative h-96 w-full overflow-hidden rounded-xl sm:h-[34rem]">
        <div ref={containerRef} className="h-full w-full" />
        <div className="absolute left-2 top-2 flex gap-1">
          {Object.keys(VIEWS).map((view) => (
            <button key={view} type="button" className={buttonClass} onClick={() => showView(view)}>
              {t(`globe.${view}`)}
            </button>
          ))}
        </div>
        <ul className="pointer-events-none absolute bottom-2 left-2 right-2 grid grid-cols-2 gap-x-2 gap-y-0.5 rounded sm:right-auto sm:block sm:space-y-0.5 bg-slate-950/75 p-1.5 text-[10px] text-slate-200 sm:text-[11px]">
          {legendRows.map(([color, text]) => (
            <li key={text} className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              {text}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full border border-amber-400" />
            {t('globe.legend.ring')}
          </li>
        </ul>
      </div>
      <p className="text-sm text-slate-200">{subPoints ? t('globe.sunlightAt', { time: timeAtHour(ephemeris, hour).replace('T', ' ') }) : t('globe.noSunlight')}</p>
      <div className="rounded border border-slate-700 bg-slate-900/60 p-2 text-sm">
        {directions ? (
          <>
            <p className="font-medium">{t('globe.skyFrom', { name: selectedSite.name })}</p>
            {directions.map((direction) => (
              <p key={direction.body} style={{ color: direction.body === 'sun' ? SUN_COLOR : EARTH_COLOR }}>
                {directionText(direction)}
              </p>
            ))}
          </>
        ) : (
          <p className="text-slate-400">{t('globe.pickSite')}</p>
        )}
      </div>
      <p className="text-xs text-slate-400">{t('globe.hint')}</p>
    </div>
  )
}
