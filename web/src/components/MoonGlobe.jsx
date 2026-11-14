import { useEffect, useRef } from 'react'
import Globe from 'globe.gl'

const GROUP_COLORS = { 'artemis-region': '#fbbf24', apollo: '#f8fafc', clps: '#38bdf8', international: '#a78bfa' }

export default function MoonGlobe({ sites, onSelectSite }) {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    const globe = new Globe(container)
      .width(container.clientWidth)
      .height(container.clientHeight)
      .backgroundColor('#020617')
      .showAtmosphere(false)
      .globeImageUrl('/textures/lroc_color_2k.jpg') // NASA SVS 4720, CGI Moon Kit
      .pointsData(sites)
      .pointLat('lat')
      .pointLng('lon')
      .pointLabel('name')
      .pointColor((site) => GROUP_COLORS[site.group] ?? '#f8fafc')
      .pointRadius(1.2)
      .onPointClick(onSelectSite)
      .pointOfView({ lat: -70, lng: 0, altitude: 2.2 })
    // Follow the container when the window is resized or a phone is rotated.
    const resizeObserver = new ResizeObserver(() => globe.width(container.clientWidth).height(container.clientHeight))
    resizeObserver.observe(container)
    return () => {
      resizeObserver.disconnect()
      globe.renderer().forceContextLoss() // browsers cap live WebGL contexts; free this one on every tab switch
      globe._destructor()
    }
  }, [sites, onSelectSite])

  return <div ref={containerRef} className="h-80 w-full overflow-hidden rounded-xl sm:h-[28rem]" />
}
