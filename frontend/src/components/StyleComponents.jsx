import { useEffect, useRef } from 'react'

export function GlitchLogo({ src, alt = "Logo" }) {
    return (
        <div className="logo-glitch">
            <img src={src} alt={alt} />
            {[...Array(10)].map((_, i) => (
                <span key={i} className="spark"></span>
            ))}
        </div>
    )
}

export function StarryBackground() {
    const canvasRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight

        // Create sharper, smaller stars
        const stars = []
        const starCount = 400

        for (let i = 0; i < starCount; i++) {
            stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: Math.random() * 1.2 + 0.3, // Smaller, sharper stars
                brightness: Math.random() * 0.6 + 0.4,
                twinkleSpeed: Math.random() * 0.02 + 0.01
            })
        }

        // Animation loop with better rendering
        const animate = () => {
            // Clear with pure black
            ctx.fillStyle = '#000000'
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            // Enable better rendering
            ctx.imageSmoothingEnabled = false

            stars.forEach(star => {
                ctx.beginPath()
                // Make stars sharper with smaller radius
                ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
                ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`
                ctx.fill()

                // Smoother twinkle
                star.brightness += (Math.random() - 0.5) * star.twinkleSpeed
                star.brightness = Math.max(0.2, Math.min(1, star.brightness))
            })

            requestAnimationFrame(animate)
        }

        animate()

        // Handle resize
        const handleResize = () => {
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight
        }

        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 0
            }}
        />
    )
}

export const animationStyles = `
    @keyframes glitchAnim {
        0%, 100% {
            transform: translate(0) skew(0deg);
            filter: hue-rotate(0deg) brightness(1.5) contrast(1.2);
        }
        10% {
            transform: translate(-2px, 1px) skew(1deg);
            filter: hue-rotate(45deg) brightness(2) contrast(1.8);
        }
        20% {
            transform: translate(-1px, 1px) skew(-1deg);
            filter: hue-rotate(90deg) brightness(1.8) contrast(1.5);
        }
        30% {
            transform: translate(0px, -1px) skew(0.5deg);
            filter: hue-rotate(135deg) brightness(2.2) contrast(1.6);
        }
        40% {
            transform: translate(-1px, -1px) skew(-0.5deg);
            filter: hue-rotate(180deg) brightness(2) contrast(1.3);
        }
        50% {
            transform: translate(1px, 0) skew(0deg);
            filter: hue-rotate(225deg) brightness(1.9) contrast(1.7);
        }
        60% {
            transform: translate(1px, 1px) skew(1deg);
            filter: hue-rotate(270deg) brightness(1.7) contrast(1.4);
        }
        70% {
            transform: translate(0, 1px) skew(-0.5deg);
            filter: hue-rotate(315deg) brightness(2.1) contrast(1.5);
        }
        80% {
            transform: translate(1px, -1px) skew(0.5deg);
            filter: hue-rotate(360deg) brightness(1.9) contrast(1.2);
        }
        90% {
            transform: translate(-1px, 0) skew(-1deg);
            filter: hue-rotate(45deg) brightness(2.3) contrast(1.8);
        }
    }

    @keyframes sparkle {
        0% {
            background-position: 0% 50%;
        }
        50% {
            background-position: 100% 50%;
        }
        100% {
            background-position: 0% 50%;
        }
    }

    @keyframes electricPulse {
        0% {
            opacity: 1;
            filter: brightness(1);
        }
        10% {
            opacity: 0.8;
            filter: brightness(1.5);
        }
        20% {
            opacity: 1;
            filter: brightness(0.8);
        }
        30% {
            opacity: 0.9;
            filter: brightness(1.2);
        }
        40% {
            opacity: 1;
            filter: brightness(1);
        }
        50% {
            opacity: 0.7;
            filter: brightness(1.8);
        }
        60% {
            opacity: 1;
            filter: brightness(0.9);
        }
        70% {
            opacity: 0.85;
            filter: brightness(1.4);
        }
        80% {
            opacity: 1;
            filter: brightness(1.1);
        }
        90% {
            opacity: 0.9;
            filter: brightness(1.3);
        }
        100% {
            opacity: 1;
            filter: brightness(1);
        }
    }

    @keyframes dataGlitch {
        0% {
            clip-path: polygon(0 0, 100% 0, 100% 0%, 0 0%);
        }
        10% {
            clip-path: polygon(0 0, 100% 0, 100% 10%, 0 10%);
        }
        20% {
            clip-path: polygon(0 20%, 100% 20%, 100% 30%, 0 30%);
        }
        30% {
            clip-path: polygon(0 40%, 100% 40%, 100% 50%, 0 50%);
        }
        40% {
            clip-path: polygon(0 60%, 100% 60%, 100% 70%, 0 70%);
        }
        50% {
            clip-path: polygon(0 80%, 100% 80%, 100% 90%, 0 90%);
        }
        60% {
            clip-path: polygon(0 100%, 100% 100%, 100% 100%, 0 100%);
        }
        70% {
            clip-path: polygon(0 70%, 100% 70%, 100% 80%, 0 80%);
        }
        80% {
            clip-path: polygon(0 30%, 100% 30%, 100% 60%, 0 60%);
        }
        90% {
            clip-path: polygon(0 10%, 100% 10%, 100% 40%, 0 40%);
        }
        100% {
            clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
        }
    }

    @keyframes rgbShift {
        0%, 100% {
            text-shadow: 
                0 0 0 transparent;
        }
        25% {
            text-shadow: 
                1px 0 0 rgba(0, 255, 136, 0.5),
                -1px 0 0 rgba(0, 255, 170, 0.5);
        }
        50% {
            text-shadow: 
                0 1px 0 rgba(0, 255, 136, 0.3),
                0 -1px 0 rgba(0, 255, 170, 0.3);
        }
        75% {
            text-shadow: 
                -1px 0 0 rgba(0, 255, 136, 0.5),
                1px 0 0 rgba(0, 255, 170, 0.5);
        }
    }

    .logo-container {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 15px;
        animation: rgbShift 4s infinite;
    }

    .logo-glitch {
        width: 35px;
        height: 35px;
        position: relative;
        display: inline-block;
        filter: 
            brightness(1.8) 
            contrast(1.3) 
            drop-shadow(0 0 10px #00ff88) 
            drop-shadow(0 0 20px #00ff88)
            drop-shadow(0 0 30px #00ff88);
        animation: glitchAnim 0.3s infinite alternate-reverse;
    }

    .logo-glitch::before,
    .logo-glitch::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        opacity: 0.8;
        pointer-events: none;
    }

    .logo-glitch::before {
        animation: dataGlitch 2s infinite;
        background: linear-gradient(45deg, transparent 30%, #00ff88 50%, transparent 70%);
        opacity: 0.6;
        transform: translateX(2px);
        mix-blend-mode: screen;
    }

    .logo-glitch::after {
        animation: dataGlitch 2.5s infinite reverse;
        background: linear-gradient(-45deg, transparent 30%, #00ffaa 50%, transparent 70%);
        opacity: 0.6;
        transform: translateX(-2px);
        mix-blend-mode: screen;
    }

    .logo-glitch img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        filter: 
            sepia(100%) 
            saturate(500%) 
            hue-rotate(90deg) 
            brightness(1.5)
            contrast(1.5);
        animation: electricPulse 0.15s infinite;
        position: relative;
        z-index: 1;
    }

    .logo-glitch:hover {
        animation-duration: 0.1s;
        filter: 
            brightness(2.5) 
            contrast(2) 
            drop-shadow(0 0 20px #00ff88) 
            drop-shadow(0 0 40px #00ff88)
            drop-shadow(0 0 60px #00ffaa)
            drop-shadow(0 0 80px #00ff88);
    }

    .spark {
        position: absolute;
        width: 6px;
        height: 6px;
        background: radial-gradient(circle, #00ff88 0%, #00ffaa 50%, transparent 100%);
        border-radius: 50%;
        opacity: 0;
        animation: spark 0.8s infinite;
        filter: blur(0px);
        box-shadow: 
            0 0 10px #00ff88,
            0 0 20px #00ff88,
            0 0 30px #00ffaa;
    }

    @keyframes spark {
        0% {
            opacity: 0;
            transform: translate(0, 0) scale(0);
            filter: blur(0px);
        }
        20% {
            opacity: 1;
            filter: blur(0px);
        }
        50% {
            opacity: 1;
            transform: translate(var(--x), var(--y)) scale(1.5);
            filter: blur(1px);
        }
        100% {
            opacity: 0;
            transform: translate(calc(var(--x) * 2), calc(var(--y) * 2)) scale(0.5);
            filter: blur(2px);
        }
    }

    .spark:nth-child(1) { --x: -20px; --y: -20px; animation-delay: 0s; }
    .spark:nth-child(2) { --x: 20px; --y: -20px; animation-delay: 0.1s; }
    .spark:nth-child(3) { --x: -20px; --y: 20px; animation-delay: 0.2s; }
    .spark:nth-child(4) { --x: 20px; --y: 20px; animation-delay: 0.3s; }
    .spark:nth-child(5) { --x: 0; --y: -25px; animation-delay: 0.4s; }
    .spark:nth-child(6) { --x: 0; --y: 25px; animation-delay: 0.5s; }
    .spark:nth-child(7) { --x: -25px; --y: 0; animation-delay: 0.15s; }
    .spark:nth-child(8) { --x: 25px; --y: 0; animation-delay: 0.35s; }
    .spark:nth-child(9) { --x: -15px; --y: -15px; animation-delay: 0.25s; }
    .spark:nth-child(10) { --x: 15px; --y: 15px; animation-delay: 0.45s; }

    .pulse {
        animation: pulse 4s ease-in-out infinite;
    }

    @keyframes pulse {
        0%, 100% {
            opacity: 0.8;
        }
        50% {
            opacity: 1;
        }
    }
`