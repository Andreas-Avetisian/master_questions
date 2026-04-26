<script lang="ts">
  import { onMount } from "svelte";

  let { onDone }: { onDone?: () => void } = $props();

  let canvas: HTMLCanvasElement;

  type Particle = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    width: number;
    height: number;
    rotation: number;
    spin: number;
    age: number;
    ttl: number;
    color: string;
  };

  const colors = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#db2777"];
  const durationMs = 2600;
  const particleCount = 150;

  function between(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  function resize(ctx: CanvasRenderingContext2D): { width: number; height: number } {
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width, height };
  }

  function makeParticle(i: number, width: number, height: number): Particle {
    const fromLeft = i % 2 === 0;
    const angle = fromLeft ? between(-1.35, -0.55) : between(-2.6, -1.8);
    const speed = between(7, 15);

    return {
      x: fromLeft ? width * 0.16 : width * 0.84,
      y: height * between(0.58, 0.76),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      width: between(5, 10),
      height: between(8, 16),
      rotation: between(0, Math.PI * 2),
      spin: between(-0.25, 0.25),
      age: 0,
      ttl: between(1700, durationMs),
      color: colors[i % colors.length],
    };
  }

  onMount(() => {
    let finished = false;
    let frame = 0;

    function finish() {
      if (finished) return;
      finished = true;
      onDone?.();
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const timeout = window.setTimeout(finish, 300);
      return () => window.clearTimeout(timeout);
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      finish();
      return;
    }
    const context = ctx;

    let bounds = resize(context);
    const particles = Array.from({ length: particleCount }, (_, i) =>
      makeParticle(i, bounds.width, bounds.height),
    );
    let previous = performance.now();

    function onResize() {
      bounds = resize(context);
    }

    function draw(now: number) {
      const step = Math.min(32, now - previous) / 16.67;
      previous = now;

      context.clearRect(0, 0, bounds.width, bounds.height);

      for (const p of particles) {
        p.age += step * 16.67;
        if (p.age > p.ttl) continue;

        const life = 1 - p.age / p.ttl;
        p.vx *= 0.992 ** step;
        p.vy += 0.18 * step;
        p.x += p.vx * step;
        p.y += p.vy * step;
        p.rotation += p.spin * step;

        context.save();
        context.globalAlpha = Math.max(0, life);
        context.translate(p.x, p.y);
        context.rotate(p.rotation);
        context.fillStyle = p.color;
        context.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
        context.restore();
      }

      const active = particles.some((p) => p.age <= p.ttl && p.y < bounds.height + 40);
      if (active) frame = requestAnimationFrame(draw);
      else finish();
    }

    window.addEventListener("resize", onResize);
    frame = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(frame);
    };
  });
</script>

<canvas bind:this={canvas} class="confetti" aria-hidden="true"></canvas>

<style>
  .confetti {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 1000;
  }

  @media (prefers-reduced-motion: reduce) {
    .confetti {
      display: none;
    }
  }
</style>
