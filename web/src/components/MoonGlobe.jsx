import { useEffect, useRef } from 'react'
import Globe from 'globe.gl'

export default function MoonGlobe({ sites, onSelectSite }) {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    const globe = new Globe(container)
      .width(container.clientWidth)
      .height(container.clientHeight)
      .backgroundColor('#020617')
      .showAtmosphere(false)
      .pointsData(sites)
      .pointLat('lat')
      .pointLng('lon')
      .pointLabel('name')
      .pointColor(() => '#facc15')
      .pointRadius(1.5)
      .onPointClick(onSelectSite)
      .pointOfView({ lat: -70, lng: 0, altitude: 2.2 })
    globe.globeMaterial().color.set('#9ca3af')
    return () => globe._destructor()
  }, [sites, onSelectSite])

  return <div ref={containerRef} className="h-80 w-full overflow-hidden rounded-xl" />
}
