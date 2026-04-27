import { useEffect, useRef } from 'react'
import { RGB, getTypeMeta } from '../../lib/graph/nodeTaxonomy.js'

const MUTED = [80, 84, 96]
const CAM_D = 5
const SPRING_K = 80
const DAMP = 7

export default function FlowGraph({
  className = '',
  nodes,
  edges,
  activeNodeIds = [],
  selectedNodeId = null,
  onNodeClick,
  onNodeHover,
}) {
  const canvasRef = useRef(null)
  const propsRef = useRef({ nodes, edges, activeNodeIds, selectedNodeId, onNodeClick, onNodeHover })

  useEffect(() => {
    propsRef.current = { nodes, edges, activeNodeIds, selectedNodeId, onNodeClick, onNodeHover }
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let dpr = window.devicePixelRatio || 1
    let W = 0, H = 0
    function resize() {
      const r = canvas.getBoundingClientRect()
      W = r.width; H = r.height
      canvas.width = Math.floor(W * dpr)
      canvas.height = Math.floor(H * dpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    let rotY = 0, rotX = 0
    let rotYVel = 0, rotXVel = 0
    let panX = 0, panY = 0
    let zoom = 1
    let dragging = false, dragStart = null, dragMode = null, didDrag = false
    let hoverId = null
    let lastInteract = performance.now()

    const bounce = new Map()
    const sigs = []
    let lastSigSpawn = 0
    let focalZ = 0

    function project(x, y, z) {
      const cx = (W / 2) * dpr
      const cy = (H / 2) * dpr
      const unit = Math.min(W, H) * 0.195 * dpr * zoom
      const persp = (CAM_D * unit) / (CAM_D + z)
      return {
        sx: cx + x * persp + panX * dpr,
        sy: cy + y * persp + panY * dpr,
        depth: z,
        persp,
        unit,
      }
    }

    function rotate3D(bx, by, bz, t) {
      const yWobble = Math.sin(t * 0.55 + (bx + bz) * 0.5) * 0.055
      const x0 = bx, y0 = by + yWobble, z0 = bz
      const cy = Math.cos(rotY), sy = Math.sin(rotY)
      const x1 = x0 * cy + z0 * sy
      const z1 = -x0 * sy + z0 * cy
      const cx = Math.cos(rotX), sx = Math.sin(rotX)
      const y2 = y0 * cx - z1 * sx
      const z2 = y0 * sx + z1 * cx
      return { x: x1, y: y2, z: z2 }
    }

    function neighborsOf(id) {
      const out = new Set()
      for (const e of propsRef.current.edges) {
        if (e.from === id) out.add(e.to)
        if (e.to === id) out.add(e.from)
      }
      return out
    }

    function hitTest(mx, my, projected) {
      let best = null, bestDist = 1e9
      for (let i = projected.length - 1; i >= 0; i--) {
        const p = projected[i]
        const dx = (mx * dpr) - p.sx
        const dy = (my * dpr) - p.sy
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d < p.r + 4 * dpr && d < bestDist) { best = p; bestDist = d }
      }
      return best
    }

    function spawnSignal() {
      const { edges } = propsRef.current
      if (!edges.length) return
      const e = edges[Math.floor(Math.random() * edges.length)]
      const fromNode = propsRef.current.nodes.find((n) => n.id === e.from)
      if (!fromNode) return
      const rgb = RGB[fromNode.type] || MUTED
      sigs.push({
        id: Math.random(),
        fromId: e.from,
        toId: e.to,
        progress: 0,
        speed: 3.5 + Math.random() * 1.5,
        rgb,
      })
    }

    function impactBounce(toId, fromId) {
      const t = bounce.get(toId) || { amp: 0, vel: 0 }
      t.vel += 5.0
      bounce.set(toId, t)
      const f = bounce.get(fromId) || { amp: 0, vel: 0 }
      f.vel += 0.4
      bounce.set(fromId, f)
    }

    let raf
    let lastT = performance.now()
    function frame(now) {
      const dt = Math.min(0.05, (now - lastT) / 1000)
      lastT = now
      const t = now / 1000

      if (now - lastInteract > 2500 && !dragging) {
        rotY += dt * 0.07
      }
      rotY += rotYVel * dt
      rotX += rotXVel * dt
      rotX = Math.max(-0.55, Math.min(0.55, rotX))
      rotYVel *= Math.exp(-3.5 * dt)
      rotXVel *= Math.exp(-3.5 * dt)

      if (sigs.length < 18 && now - lastSigSpawn > 900) {
        spawnSignal()
        lastSigSpawn = now
      }

      const { nodes: nodes_, edges: edges_, selectedNodeId: selId, activeNodeIds: actIds } = propsRef.current
      const actSet = new Set(actIds)
      const neighbors = selId ? neighborsOf(selId) : null

      const projected = nodes_.map((n) => {
        const r = rotate3D(n.bx, n.by, n.bz, t + (n.phase || 0))
        const p = project(r.x, r.y, r.z)
        const b = bounce.get(n.id) || { amp: 0, vel: 0 }
        b.vel += -SPRING_K * b.amp * dt
        b.vel *= Math.exp(-DAMP * dt)
        b.amp += b.vel * dt
        bounce.set(n.id, b)
        const baseR = 7.5 * dpr * Math.max(0.65, 1 + r.z * 0.13)
        const r_ = baseR * (1 + b.amp * 0.45)
        const sx = p.sx + (p.sx - (W / 2) * dpr) * b.amp * 0.12
        return { ...n, sx, sy: p.sy, depth: r.z, r: r_, projZ: r.z }
      }).sort((a, b) => a.depth - b.depth)

      const hovered = projected.find((p) => p.id === hoverId)
      const targetFocal = hovered ? hovered.depth : Math.sin(t * 0.4) * 0.4
      focalZ += (targetFocal - focalZ) * 0.055

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const projById = Object.fromEntries(projected.map((p) => [p.id, p]))

      // Advance signal progress + group active signals by edge for wave rendering
      const sigsByEdge = new Map()
      for (let i = sigs.length - 1; i >= 0; i--) {
        const s = sigs[i]
        const a = projById[s.fromId], b = projById[s.toId]
        if (!a || !b) { sigs.splice(i, 1); continue }
        s.progress += dt * s.speed * 0.42
        if (s.progress >= 0.92 && !s.bounced) {
          s.bounced = true
          impactBounce(s.toId, s.fromId)
        }
        if (s.progress >= 1) { sigs.splice(i, 1); continue }
        const key = `${s.fromId}__${s.toId}`
        const list = sigsByEdge.get(key) || []
        list.push(s)
        sigsByEdge.set(key, list)
      }

      function waveAmp(u, edgeSigs) {
        let total = 0
        for (const s of edgeSigs) {
          const peak = Math.exp(-((u - s.progress) ** 2) / 0.025)
          const oscillation = Math.sin(u * 22 + t * 11) + Math.sin(u * 9 + t * 5) * 0.7
          total += peak * oscillation
        }
        return total * 52 * dpr
      }

      const SAMPLES = 40

      for (const e of edges_) {
        const a = projById[e.from], b = projById[e.to]
        if (!a || !b) continue
        const dimA = selId && !(neighbors.has(a.id) || a.id === selId)
        const dimB = selId && !(neighbors.has(b.id) || b.id === selId)
        const muted = dimA || dimB
        const fromRgb = muted ? MUTED : (RGB[a.type] || MUTED)
        const toRgb   = muted ? MUTED : (RGB[b.type] || MUTED)
        const alpha = (a.depth + b.depth) / 2
        const baseAlpha = (muted ? 0.06 : 0.22) * Math.max(0.4, 1 + alpha * 0.2)

        const edgeSigs = sigsByEdge.get(`${e.from}__${e.to}`)
        const isActive = edgeSigs && edgeSigs.length > 0
        const lineAlpha = isActive ? Math.min(1, baseAlpha * 2.2) : baseAlpha

        const grad = ctx.createLinearGradient(a.sx, a.sy, b.sx, b.sy)
        grad.addColorStop(0, `rgba(${fromRgb[0]},${fromRgb[1]},${fromRgb[2]},${lineAlpha})`)
        grad.addColorStop(1, `rgba(${toRgb[0]},${toRgb[1]},${toRgb[2]},${lineAlpha})`)
        ctx.strokeStyle = grad
        ctx.lineWidth = (e.weight ?? 0.5) * (isActive ? 2.6 : 1.4) * dpr
        ctx.beginPath()

        if (isActive) {
          const dx = b.sx - a.sx, dy = b.sy - a.sy
          const len = Math.sqrt(dx * dx + dy * dy) || 1
          const nx = -dy / len, ny = dx / len
          for (let i = 0; i <= SAMPLES; i++) {
            const u = i / SAMPLES
            const amp = waveAmp(u, edgeSigs)
            const x = a.sx + dx * u + nx * amp
            const y = a.sy + dy * u + ny * amp
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          }
        } else {
          ctx.moveTo(a.sx, a.sy)
          ctx.lineTo(b.sx, b.sy)
        }
        ctx.stroke()
      }

      // Draw signal orbs riding the wave
      for (const s of sigs) {
        const a = projById[s.fromId], b = projById[s.toId]
        if (!a || !b) continue
        const dx = b.sx - a.sx, dy = b.sy - a.sy
        const len = Math.sqrt(dx * dx + dy * dy) || 1
        const nx = -dy / len, ny = dx / len
        const edgeSigs = sigsByEdge.get(`${s.fromId}__${s.toId}`) || [s]
        const amp = waveAmp(s.progress, edgeSigs)
        const x = a.sx + dx * s.progress + nx * amp
        const y = a.sy + dy * s.progress + ny * amp
        ctx.fillStyle = `rgba(${s.rgb[0]},${s.rgb[1]},${s.rgb[2]},0.95)`
        ctx.beginPath()
        ctx.arc(x, y, 2.2 * dpr, 0, Math.PI * 2)
        ctx.fill()
      }

      for (const p of projected) {
        const dim = selId && !(neighbors.has(p.id) || p.id === selId)
        const rgb = dim ? MUTED : (RGB[p.type] || MUTED)
        const dof = Math.abs(p.depth - focalZ)
        const blurPx = Math.min(4.0, dof * 3.0) * dpr
        const dofAlpha = Math.max(0.28, 1 - dof * 0.38)
        const isActive = actSet.has(p.id)

        ctx.filter = `blur(${blurPx}px)`
        const haloR = p.r * (3 + dof * 0.75)
        const grad = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, haloR)
        grad.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.5 * dofAlpha})`)
        grad.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`)
        ctx.fillStyle = grad
        ctx.beginPath(); ctx.arc(p.sx, p.sy, haloR, 0, Math.PI * 2); ctx.fill()

        ctx.filter = 'none'
        const core = ctx.createRadialGradient(p.sx - p.r * 0.3, p.sy - p.r * 0.35, 0, p.sx, p.sy, p.r)
        core.addColorStop(0, `rgba(255,255,255,${dim ? 0.15 : 0.55})`)
        core.addColorStop(0.4, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${dofAlpha})`)
        core.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.7 * dofAlpha})`)
        ctx.fillStyle = core
        ctx.beginPath(); ctx.arc(p.sx, p.sy, p.r, 0, Math.PI * 2); ctx.fill()

        if (p.id === selId) {
          ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.95)`
          ctx.lineWidth = 2 * dpr
          ctx.beginPath(); ctx.arc(p.sx, p.sy, p.r + 5 * dpr, 0, Math.PI * 2); ctx.stroke()
          ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.5 + 0.4 * Math.sin(t * 4)})`
          ctx.beginPath(); ctx.arc(p.sx, p.sy, p.r + 8 * dpr, 0, Math.PI * 2); ctx.stroke()
        } else if (p.id === hoverId) {
          ctx.strokeStyle = 'rgba(255,255,255,0.45)'
          ctx.lineWidth = 1 * dpr
          ctx.beginPath(); ctx.arc(p.sx, p.sy, p.r + 3.5 * dpr, 0, Math.PI * 2); ctx.stroke()
        }

        if (isActive) {
          ctx.strokeStyle = `rgba(16,185,129,${0.5 + 0.4 * Math.sin(t * 5)})`
          ctx.lineWidth = 2 * dpr
          ctx.beginPath(); ctx.arc(p.sx, p.sy, p.r + 6 * dpr, 0, Math.PI * 2); ctx.stroke()
        }

        const fs = 9 * Math.max(0.65, 1 + p.depth * 0.13) * dpr
        ctx.fillStyle = dim ? `rgba(${MUTED[0]},${MUTED[1]},${MUTED[2]},0.55)` : `rgba(255,255,255,${0.55 * dofAlpha})`
        ctx.font = `500 ${fs}px Inter, system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(p.label, p.sx, p.sy + p.r + fs * 1.35)
      }

      if (hoverId && !selId) {
        const h = projected.find((p) => p.id === hoverId)
        if (h) {
          const meta = getTypeMeta(h.type)
          const w = 230 * dpr
          let tx = h.sx + h.r + 12 * dpr
          if (tx + w > canvas.width) tx = h.sx - w - h.r - 12 * dpr
          const ty = h.sy - 30 * dpr
          ctx.fillStyle = 'rgba(6,8,18,0.90)'
          ctx.strokeStyle = `rgba(${RGB[h.type]?.join(',') || MUTED.join(',')},0.55)`
          ctx.lineWidth = 1 * dpr
          ctx.beginPath()
          if (ctx.roundRect) ctx.roundRect(tx, ty, w, 60 * dpr, 8 * dpr)
          else ctx.rect(tx, ty, w, 60 * dpr)
          ctx.fill(); ctx.stroke()
          ctx.fillStyle = meta.color
          ctx.font = `600 ${10 * dpr}px Inter`
          ctx.textAlign = 'left'
          ctx.fillText(meta.label.toUpperCase(), tx + 10 * dpr, ty + 16 * dpr)
          ctx.fillStyle = 'rgba(255,255,255,0.95)'
          ctx.font = `600 ${12 * dpr}px Inter`
          ctx.fillText(h.label, tx + 10 * dpr, ty + 32 * dpr)
        }
      }

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    function onDown(e) {
      dragging = true
      didDrag = false
      dragStart = { x: e.clientX, y: e.clientY, rotX, rotY, panX, panY }
      dragMode = e.shiftKey ? 'pan' : 'rotate'
      lastInteract = performance.now()
      canvas.style.cursor = 'grabbing'
    }
    function onMove(e) {
      lastInteract = performance.now()
      const r = canvas.getBoundingClientRect()
      const mx = e.clientX - r.left
      const my = e.clientY - r.top
      if (dragging) {
        const dx = e.clientX - dragStart.x
        const dy = e.clientY - dragStart.y
        if (Math.abs(dx) + Math.abs(dy) > 2) didDrag = true
        if (dragMode === 'pan') {
          panX = dragStart.panX + dx
          panY = dragStart.panY + dy
        } else {
          rotY = dragStart.rotY + dx * 0.005
          rotX = Math.max(-0.55, Math.min(0.55, dragStart.rotX - dy * 0.005))
        }
      } else {
        const proj = []
        for (const n of propsRef.current.nodes) {
          const r3 = rotate3D(n.bx, n.by, n.bz, performance.now() / 1000)
          const p = project(r3.x, r3.y, r3.z)
          const baseR = 7.5 * dpr * Math.max(0.65, 1 + r3.z * 0.13)
          proj.push({ id: n.id, sx: p.sx, sy: p.sy, r: baseR })
        }
        const hit = hitTest(mx, my, proj)
        const newHover = hit?.id || null
        if (newHover !== hoverId) {
          hoverId = newHover
          propsRef.current.onNodeHover?.(newHover)
          canvas.style.cursor = newHover ? 'pointer' : (dragging ? 'grabbing' : 'grab')
        }
      }
    }
    function onUp(e) {
      if (dragging) {
        if (!didDrag) {
          const r = canvas.getBoundingClientRect()
          const mx = e.clientX - r.left
          const my = e.clientY - r.top
          const proj = []
          for (const n of propsRef.current.nodes) {
            const r3 = rotate3D(n.bx, n.by, n.bz, performance.now() / 1000)
            const p = project(r3.x, r3.y, r3.z)
            const baseR = 7.5 * dpr * Math.max(0.65, 1 + r3.z * 0.13)
            proj.push({ id: n.id, sx: p.sx, sy: p.sy, r: baseR })
          }
          const hit = hitTest(mx, my, proj)
          propsRef.current.onNodeClick?.(hit?.id || null)
        } else {
          const dx = (e.clientX - dragStart.x) * 0.005
          const dy = (e.clientY - dragStart.y) * 0.005
          rotYVel = dx * 4
          rotXVel = -dy * 4
        }
      }
      dragging = false
      canvas.style.cursor = 'grab'
    }
    function onWheel(e) {
      e.preventDefault()
      lastInteract = performance.now()
      const factor = Math.exp(-e.deltaY * 0.001)
      zoom = Math.max(0.35, Math.min(3.0, zoom * factor))
    }

    canvas.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.style.cursor = 'grab'

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('mousedown', onDown)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  )
}
