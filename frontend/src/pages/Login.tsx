import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import * as THREE from "three";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/client";
import "./Login.css";

/** Cursor parallax on the background layers + card tilt + magnetic submit button — all purely
 * decorative, so every listener here is skipped entirely under prefers-reduced-motion. */
function useCursorMotion(refs: {
  bgLayer: React.RefObject<HTMLDivElement | null>;
  machineIcons: React.RefObject<HTMLDivElement | null>;
  overlay: React.RefObject<HTMLDivElement | null>;
  cardWrap: React.RefObject<HTMLDivElement | null>;
  card: React.RefObject<HTMLDivElement | null>;
  submitBtn: React.RefObject<HTMLButtonElement | null>;
}) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let mx = 0,
      my = 0,
      tx = 0,
      ty = 0;
    let raf = 0;

    function onMouseMove(e: MouseEvent) {
      mx = (e.clientX / window.innerWidth) * 2 - 1;
      my = (e.clientY / window.innerHeight) * 2 - 1;
    }
    window.addEventListener("mousemove", onMouseMove);

    function tick() {
      tx += (mx - tx) * 0.06;
      ty += (my - ty) * 0.06;
      if (refs.bgLayer.current) {
        refs.bgLayer.current.style.transform = `translate(${tx * -10}px,${ty * -8}px) rotate(${tx * 0.6}deg)`;
      }
      if (refs.machineIcons.current) {
        refs.machineIcons.current.style.transform = `translate(${tx * -22}px,${ty * -16}px)`;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    const overlay = refs.overlay.current;
    const cardWrap = refs.cardWrap.current;
    const card = refs.card.current;
    function onOverlayMove(e: MouseEvent) {
      if (!cardWrap || !card) return;
      const rect = cardWrap.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      const rotY = Math.max(-6, Math.min(6, dx * 6));
      const rotX = Math.max(-6, Math.min(6, -dy * 6));
      card.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    }
    function onOverlayLeave() {
      if (card) card.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg)";
    }
    overlay?.addEventListener("mousemove", onOverlayMove);
    overlay?.addEventListener("mouseleave", onOverlayLeave);

    const submitBtn = refs.submitBtn.current;
    function onBtnMove(e: MouseEvent) {
      if (!submitBtn) return;
      const r = submitBtn.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      submitBtn.style.transform = `translate(${x * 0.15}px,${y * 0.3}px)`;
    }
    function onBtnLeave() {
      if (submitBtn) submitBtn.style.transform = "translate(0,0)";
    }
    submitBtn?.addEventListener("mousemove", onBtnMove);
    submitBtn?.addEventListener("mouseleave", onBtnLeave);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(raf);
      overlay?.removeEventListener("mousemove", onOverlayMove);
      overlay?.removeEventListener("mouseleave", onOverlayLeave);
      submitBtn?.removeEventListener("mousemove", onBtnMove);
      submitBtn?.removeEventListener("mouseleave", onBtnLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Ambient particle-network background. Best-effort: any WebGL failure just leaves the canvas
 * blank (the gradient/scanline layers underneath still carry the page visually). */
function useParticleBackground(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    camera.position.z = 26;

    function resize() {
      const parent = canvas!.parentElement;
      const w = parent?.clientWidth || window.innerWidth;
      const h = parent?.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    const COUNT = 140;
    const positions = new Float32Array(COUNT * 3);
    const colorArr = new Float32Array(COUNT * 3);
    const cCyan = new THREE.Color(0x4fd8e8);
    const cGreen = new THREE.Color(0x5cc687);

    for (let i = 0; i < COUNT; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 46;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
      const c = Math.random() > 0.5 ? cCyan : cGreen;
      colorArr[i * 3 + 0] = c.r;
      colorArr[i * 3 + 1] = c.g;
      colorArr[i * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colorArr, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.36,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    const linePositions: number[] = [];
    const maxDist = 7;
    for (let a = 0; a < COUNT; a++) {
      for (let b = a + 1; b < COUNT; b++) {
        const dx = positions[a * 3] - positions[b * 3];
        const dy = positions[a * 3 + 1] - positions[b * 3 + 1];
        const dz = positions[a * 3 + 2] - positions[b * 3 + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < maxDist) {
          linePositions.push(positions[a * 3], positions[a * 3 + 1], positions[a * 3 + 2]);
          linePositions.push(positions[b * 3], positions[b * 3 + 1], positions[b * 3 + 2]);
        }
      }
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(linePositions), 3));
    const lineMat = new THREE.LineBasicMaterial({ color: 0x4fd8e8, transparent: true, opacity: 0.12 });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(lines);

    let mx = 0,
      my = 0;
    function onMouseMove(e: MouseEvent) {
      mx = (e.clientX / window.innerWidth) * 2 - 1;
      my = (e.clientY / window.innerHeight) * 2 - 1;
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("resize", resize);
    resize();

    let t = 0;
    let raf = 0;
    function animate() {
      if (!reduceMotion) raf = requestAnimationFrame(animate);
      t += 0.0018;
      points.rotation.y = t + mx * 0.3;
      points.rotation.x = my * 0.15;
      lines.rotation.y = points.rotation.y;
      lines.rotation.x = points.rotation.x;
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", resize);
      geo.dispose();
      lineGeo.dispose();
      mat.dispose();
      lineMat.dispose();
      renderer.dispose();
    };
  }, [canvasRef]);
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [shake, setShake] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgLayerRef = useRef<HTMLDivElement>(null);
  const machineIconsRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardWrapRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const submitBtnRef = useRef<HTMLButtonElement>(null);

  useParticleBackground(canvasRef);
  useCursorMotion({
    bgLayer: bgLayerRef,
    machineIcons: machineIconsRef,
    overlay: overlayRef,
    cardWrap: cardWrapRef,
    card: cardRef,
    submitBtn: submitBtnRef,
  });

  function triggerShake() {
    setShake(false);
    // restart the CSS animation on the next frame
    requestAnimationFrame(() => setShake(true));
  }

  function onSubmitClick(e: React.MouseEvent<HTMLButtonElement>) {
    const btn = e.currentTarget;
    const r = btn.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    ripple.style.left = `${e.clientX - r.left}px`;
    ripple.style.top = `${e.clientY - r.top}px`;
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 650);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting || success) return;
    if (!username.trim() || !password) {
      triggerShake();
      return;
    }
    setError(null);
    setInfoMessage(null);
    setSubmitting(true);
    try {
      await login(username, password);
      setSubmitting(false);
      setSuccess(true);
      const from = (location.state as { from?: string })?.from ?? "/";
      setTimeout(() => navigate(from, { replace: true }), 500);
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof ApiError ? err.message : "Login failed");
      triggerShake();
    }
  }

  return (
    <div className="login-page">
      <div className="stage">
        <div className="hero">
          <div className="bg-layer" ref={bgLayerRef}>
            <canvas className="three-canvas" ref={canvasRef} />

            <div className="machine-icons" ref={machineIconsRef}>
              <div className="tool-icon t3">
                <svg viewBox="0 0 120 140">
                  <path d="M20 120 L45 95" stroke="#8b95a5" strokeWidth="4" strokeLinecap="round" />
                  <g className="spray-drops">
                    <circle className="sd1" cx="50" cy="90" r="3" fill="#4fd8e8" />
                    <circle className="sd2" cx="50" cy="90" r="3" fill="#5cc687" />
                    <circle className="sd3" cx="50" cy="90" r="2.5" fill="#4fd8e8" />
                    <circle className="sd4" cx="50" cy="90" r="2.5" fill="#5cc687" />
                  </g>
                </svg>
              </div>
            </div>

            <svg className="traces" viewBox="0 0 1000 700" preserveAspectRatio="none">
              <path d="M 0 120 L 220 120 L 280 180 L 520 180" />
              <path className="green" d="M 1000 560 L 800 560 L 740 500 L 500 500" />
              <path d="M 60 650 L 60 460 L 140 380 L 140 160" />
              <path className="green" d="M 940 80 L 940 260 L 860 340 L 860 520" />
            </svg>
          </div>

          <div className="scanline" />
          <div className="vignette" />

          <div className="hero-content">
            <div className="brand-row">
              <span className="brand-chip nilfisk">NILFISK</span>
              <span className="brand-x">&times;</span>
              <span className="brand-chip fhcs">FHCS</span>
            </div>

            <div className="hero-foot">SPARE PARTS NETWORK &nbsp;&middot;&nbsp; NILFISK &amp; FHCS PARTNER PORTAL</div>
          </div>
        </div>

        <div className="card-overlay" ref={overlayRef}>
          <div className="card-wrap" ref={cardWrapRef}>
            <div className="corner tl" />
            <div className="corner tr" />
            <div className="corner bl" />
            <div className="corner br" />

            <div className="card" ref={cardRef}>
              <div className="mark">
                <svg viewBox="0 0 44 44" fill="none">
                  <polygon points="22,3 38,12.5 38,31.5 22,41 6,31.5 6,12.5" stroke="#4fd8e8" strokeWidth="1.6" />
                  <polygon points="22,12 31,17 31,27 22,32 13,27 13,17" stroke="#5cc687" strokeWidth="1.4" />
                  <circle cx="22" cy="22" r="3" fill="#4fd8e8" />
                </svg>
              </div>

              <div className="eyebrow">Spare Parts Management</div>
              <h1 className="card-title">เข้าสู่ระบบ</h1>
              <div className="card-sub">NILFISK &amp; FHCS Partner Portal</div>

              <form onSubmit={handleSubmit} noValidate>
                <div className={`field${shake ? " shake" : ""}`} onAnimationEnd={() => setShake(false)}>
                  <label htmlFor="user">ชื่อผู้ใช้</label>
                  <div className="input-shell">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M20 21a8 8 0 0 0-16 0" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <input
                      id="user"
                      type="text"
                      placeholder="username"
                      autoComplete="username"
                      autoFocus
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className={username.trim().length > 2 ? "is-valid" : ""}
                    />
                    <svg className="valid-check" viewBox="0 0 24 24" fill="none" stroke="#5cc687" strokeWidth="2.4">
                      <path d="M4 12l5 5L20 6" />
                    </svg>
                  </div>
                </div>

                <div className={`field${shake ? " shake" : ""}`}>
                  <label htmlFor="pass">รหัสผ่าน</label>
                  <div className="input-shell">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <rect x="4" y="10" width="16" height="10" rx="2" />
                      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                    </svg>
                    <input
                      id="pass"
                      type="password"
                      placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={password.length >= 6 ? "is-valid" : ""}
                    />
                    <svg className="valid-check" viewBox="0 0 24 24" fill="none" stroke="#5cc687" strokeWidth="2.4">
                      <path d="M4 12l5 5L20 6" />
                    </svg>
                  </div>
                </div>

                <div className="row">
                  <label className="remember">
                    <input type="checkbox" />
                    จดจำฉันไว้
                  </label>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setInfoMessage("ระบบยังไม่รองรับการรีเซ็ตรหัสผ่านด้วยตัวเอง กรุณาติดต่อผู้ดูแลระบบ");
                    }}
                  >
                    ลืมรหัสผ่าน?
                  </a>
                </div>

                {infoMessage && <p className="login-info">{infoMessage}</p>}
                {error && <p className="login-error">{error}</p>}

                <button
                  ref={submitBtnRef}
                  type="submit"
                  className={`login-submit${submitting ? " is-loading" : ""}${success ? " is-success" : ""}`}
                  disabled={submitting || success}
                  onClick={onSubmitClick}
                >
                  <span className="btn-label">
                    {success ? "สำเร็จ ✓" : submitting ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}
                  </span>
                </button>
              </form>

              <div className="foot">
                ต้องการสิทธิ์เข้าใช้งาน?{" "}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setInfoMessage("กรุณาติดต่อผู้ดูแลระบบ (แอดมิน) เพื่อขอสิทธิ์เข้าใช้งาน");
                  }}
                >
                  ติดต่อผู้ดูแลระบบ
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
