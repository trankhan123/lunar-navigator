import { useEffect, useRef, useState } from 'react'
import {
  AmbientLight, ArrowHelper, CanvasTexture, Color, DirectionalLight, Mesh, MeshStandardMaterial, PCFShadowMap,
  PerspectiveCamera, PlaneGeometry, Scene, SRGBColorSpace, Vector3, WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { loadTerrain, timeAtHour } from '../core/data.js'
import { sunLightDirection } from '../core/terrainLight.js'

const ARROW_COLORS = { sun: '#f0e442', earth: '#56b4e9' }
const TEXTURE_SIZE = 2048
const CELL_SIZE_M = 1000
const CELL_ALPHA = 0.55
const SHADOW_MAP_SIZE = 2048
const MAX_POLAR_ANGLE = 1.45 // radians from straight up: never looks from below the horizon

function loadImage(source) {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null) // the terrain still draws without a hillshade
    image.src = source
  })
}

/** Region hillshade (over the whole-pole one) on a canvas that covers boundsM; null images are skipped. */
function drawBase(canvas, boundsM, images) {
  const context = canvas.getContext('2d')
  const [xMin, yMin, xMax, yMax] = boundsM
  context.fillStyle = '#1e293b'
  context.fillRect(0, 0, canvas.width, canvas.height)
  for (const { image, entry } of images) {
    if (!image) continue
    const [x0, y0, x1, y1] = entry.boundsM
    context.drawImage(image, ((x0 - xMin) / (xMax - xMin)) * canvas.width, ((yMax - y1) / (yMax - yMin)) * canvas.height,
      ((x1 - x0) / (xMax - xMin)) * canvas.width, ((y1 - y0) / (yMax - yMin)) * canvas.height)
  }
}

function disposeScene(scene) {
  scene.traverse((object) => {
    object.geometry?.dispose()
    for (const material of [object.material].flat()) {
      material?.map?.dispose()
      material?.dispose()
    }
  })
}

/** docs/technical-reference.md W2 3D view of an open region: LOLA terrain lit by the real Sun at the map hour. */
export default function TerrainView3D({ regionCode, cells, colors, maps, ephemeris, hour, directions, lonDeg, focusCell }) {
  const containerRef = useRef(null)
  const stage = useRef(null) // everything three.js made; touched only by the effects below
  const baseCanvas = useRef(null)
  const [terrain, setTerrain] = useState(null)
  const [error, setError] = useState(null)
  const [baseVersion, setBaseVersion] = useState(0)
  const [exaggeration, setExaggeration] = useState(2)

  useEffect(() => {
    let cancelled = false
    loadTerrain(regionCode).then((loaded) => !cancelled && setTerrain(loaded), (loadError) => !cancelled && setError(loadError.message))
    return () => {
      cancelled = true
    }
  }, [regionCode])

  // Scene, mesh, camera and light are built once per loaded terrain.
  useEffect(() => {
    if (!terrain) return
    const { entry, heights } = terrain
    const container = containerRef.current
    const [xMin, yMin, xMax, yMax] = entry.boundsM
    const widthM = xMax - xMin
    const depthM = yMax - yMin
    const centre = { x: (xMin + xMax) / 2, y: (yMin + yMax) / 2 }
    const reliefM = entry.maxHeightM - entry.minHeightM
    const radiusM = Math.hypot(widthM, depthM) / 2

    const renderer = new WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = PCFShadowMap
    renderer.domElement.className = 'block size-full touch-none'
    renderer.domElement.setAttribute('role', 'img')
    renderer.domElement.setAttribute('aria-label', 'Tilted 3D terrain of the open region; drag to rotate, scroll or pinch to zoom')
    container.appendChild(renderer.domElement)

    const scene = new Scene()
    scene.background = new Color('#0f172a')
    const geometry = new PlaneGeometry(widthM, depthM, entry.width - 1, entry.height - 1).rotateX(-Math.PI / 2)
    const positions = geometry.attributes.position
    for (let index = 0; index < positions.count; index++) positions.setY(index, heights[index])
    geometry.computeVertexNormals()
    const canvas = document.createElement('canvas')
    canvas.width = TEXTURE_SIZE
    canvas.height = Math.round((TEXTURE_SIZE * depthM) / widthM)
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
    const mesh = new Mesh(geometry, new MeshStandardMaterial({ map: texture, roughness: 1, metalness: 0 }))
    mesh.castShadow = mesh.receiveShadow = true
    scene.add(mesh)

    scene.add(new AmbientLight('#ffffff', 0.25))
    const light = new DirectionalLight('#fffbe8', 3)
    light.castShadow = true
    light.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE)
    light.shadow.bias = -0.0004
    light.shadow.normalBias = 15
    scene.add(light, light.target)

    const camera = new PerspectiveCamera(45, 1, 100, radiusM * 20)
    camera.position.set(0, radiusM * 1.1, radiusM * 1.3) // from the south, looking north (map up)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.maxPolarAngle = MAX_POLAR_ANGLE
    controls.maxDistance = radiusM * 4
    controls.minDistance = 500

    const heightAt = (x, z) => {
      const column = Math.min(entry.width - 1, Math.max(0, Math.round(((x + widthM / 2) / widthM) * (entry.width - 1))))
      const row = Math.min(entry.height - 1, Math.max(0, Math.round(((z + depthM / 2) / depthM) * (entry.height - 1))))
      return heights[row * entry.width + column]
    }
    const render = () => renderer.render(scene, camera)
    const keepAboveGround = () => {
      const floor = heightAt(camera.position.x, camera.position.z) * mesh.scale.y + 150
      if (camera.position.y < floor) camera.position.y = floor
      render()
    }
    controls.addEventListener('change', keepAboveGround)
    const resize = () => {
      const { clientWidth, clientHeight } = container
      renderer.setSize(clientWidth, clientHeight, false)
      camera.aspect = clientWidth / clientHeight
      camera.updateProjectionMatrix()
      render()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(container)

    stage.current = { scene, mesh, light, canvas, texture, render, heightAt, centre, widthM, depthM, reliefM, radiusM, controls, arrows: [], entry }
    resize()
    return () => {
      observer.disconnect()
      controls.dispose()
      disposeScene(scene)
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
      stage.current = null
      baseCanvas.current = null
    }
  }, [terrain])

  // Hillshade backgrounds, once per terrain; the cell colours go on top below.
  useEffect(() => {
    if (!terrain) return
    let cancelled = false
    const entries = ['south_pole', regionCode].map((id) => maps.find((entry) => entry.id === id && entry.kind === 'hillshade')).filter(Boolean)
    Promise.all(entries.map((entry) => loadImage(entry.image).then((image) => ({ image, entry })))).then((images) => {
      if (cancelled || !stage.current) return
      baseCanvas.current = document.createElement('canvas')
      baseCanvas.current.width = stage.current.canvas.width
      baseCanvas.current.height = stage.current.canvas.height
      drawBase(baseCanvas.current, terrain.entry.boundsM, images)
      setBaseVersion((version) => version + 1)
    })
    return () => {
      cancelled = true
    }
  }, [terrain, regionCode, maps])

  // Layer colours: redraw the texture only.
  useEffect(() => {
    const current = stage.current
    if (!current || !baseCanvas.current) return
    const { canvas, centre, widthM, depthM } = current
    const context = canvas.getContext('2d')
    context.drawImage(baseCanvas.current, 0, 0)
    context.globalAlpha = CELL_ALPHA
    const pixelsPerMetre = canvas.width / widthM
    cells.forEach((cell, index) => {
      context.fillStyle = colors[index]
      context.fillRect((cell.xM - CELL_SIZE_M / 2 - centre.x + widthM / 2) * pixelsPerMetre, (centre.y - cell.yM - CELL_SIZE_M / 2 + depthM / 2) * pixelsPerMetre,
        CELL_SIZE_M * pixelsPerMetre, CELL_SIZE_M * pixelsPerMetre)
    })
    context.globalAlpha = 1
    current.texture.needsUpdate = true
    current.render()
  }, [colors, cells, baseVersion])

  useEffect(() => {
    const current = stage.current
    if (!current) return
    current.mesh.scale.y = exaggeration
    const { radiusM, reliefM, light } = current
    const shadowReach = radiusM + reliefM * exaggeration
    Object.assign(light.shadow.camera, { left: -shadowReach, right: shadowReach, top: shadowReach, bottom: -shadowReach, near: 1, far: shadowReach * 4 })
    light.shadow.camera.updateProjectionMatrix()
    current.render()
  }, [exaggeration, terrain])

  // A new hour moves only the light and the arrows.
  useEffect(() => {
    const current = stage.current
    if (!current || !directions) return
    const { light, scene, centre, heightAt, mesh, radiusM } = current
    const sun = directions.find((direction) => direction.body === 'sun')
    const sunVector = new Vector3(...sunLightDirection(sun.azimuthDeg, sun.elevationDeg, lonDeg))
    light.intensity = sun.elevationDeg > 0 ? 3 : 0
    light.position.copy(sunVector).multiplyScalar(radiusM * 2)
    current.arrows.forEach((arrow) => {
      scene.remove(arrow)
      arrow.dispose()
    })
    const base = new Vector3(focusCell.xM - centre.x, 0, -(focusCell.yM - centre.y))
    base.y = heightAt(base.x, base.z) * mesh.scale.y + 300
    current.arrows = directions.map((direction) => {
      const arrow = new ArrowHelper(new Vector3(...sunLightDirection(direction.azimuthDeg, direction.elevationDeg, lonDeg)), base, radiusM * 0.35,
        ARROW_COLORS[direction.body], radiusM * 0.08, radiusM * 0.04)
      for (const material of [arrow.line.material, arrow.cone.material]) {
        material.transparent = true
        material.opacity = direction.isVisible ? 1 : 0.35
      }
      scene.add(arrow)
      return arrow
    })
    current.render()
  }, [directions, lonDeg, focusCell, exaggeration, terrain])

  return (
    <div>
      <div ref={containerRef} className="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-900">
        {!terrain && <p className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-slate-400">{error ?? 'Loading 3D terrain…'}</p>}
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs text-slate-300">
        Height exaggeration
        <input type="range" min={1} max={4} step={0.5} value={exaggeration} onChange={(event) => setExaggeration(Number(event.target.value))} className="max-w-48 flex-1" />
        ×{exaggeration}
      </label>
      <p className="mt-1 text-xs text-slate-400">
        3D view: LOLA 80 m terrain, heights ×{exaggeration}; sunlight from the real Sun position at {hour === null || hour === undefined ? 'an unset time' : timeAtHour(ephemeris, hour)}.
      </p>
    </div>
  )
}
