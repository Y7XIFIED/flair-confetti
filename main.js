gsap.registerPlugin(
	Observer,
	CustomEase,
	CustomWiggle,
	Physics2DPlugin,
	ScrollTrigger
)

class SoundFX {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.osc = null;
    }
    playStretch(distance) {
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        if (this.osc) {
            this.osc.frequency.setValueAtTime(150 + distance * 0.5, this.ctx.currentTime);
            return;
        }
        this.osc = this.ctx.createOscillator();
        this.gain = this.ctx.createGain();
        this.osc.type = 'triangle';
        this.osc.connect(this.gain);
        this.gain.connect(this.ctx.destination);
        this.osc.frequency.value = 150 + distance * 0.5;
        this.gain.gain.value = 0.03;
        this.osc.start();
    }
    stopStretch() {
        if (this.osc) {
            this.osc.stop();
            this.osc = null;
        }
    }
    playPop() {
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }
}

class confettiCannon {
	constructor(el) {
		this.el = el
	}
	init() {
		const hero = this.el
		this.hero = hero

		const el = {
			hand: hero.querySelector('.pricing-hero__hand'),
			instructions: hero.querySelector('.pricing-hero__hand small'),
			rock: hero.querySelector('.pricing-hero__rock'),
			drag: hero.querySelector('.pricing-hero__drag'),
			handle: hero.querySelector('.pricing-hero__handle'),
			canvas: hero.querySelector('.pricing-hero__canvas'),
			proxy: hero.querySelector('.pricing-hero__proxy'),
			preloadImages: hero.querySelectorAll('.image-preload img'),
			xplodePreloadImages: hero.querySelectorAll('.explosion-preload img'),
		}
		this.el = el
		this.isDrawing = false

		this.imageMap = {}
		this.imageKeys = []

		this.el.preloadImages.forEach(img => {
			const key = img.dataset.key
			this.imageMap[key] = img
			this.imageKeys.push(key)
		})

		this.explosionMap = {}
		this.explosionKeys = []

		this.el.xplodePreloadImages.forEach(img => {
			const key = img.dataset.key
			this.explosionMap[key] = img
			this.explosionKeys.push(key)
		})

		this.currentLine = null
		this.startImage = null
		this.circle = null
		this.startX = 0
		this.startY = 0
		this.lastDistance = 0

		this.animationIsOk = window.matchMedia(
			'(prefers-reduced-motion: no-preference)'
		).matches

		this.wiggle = CustomWiggle.create('myWiggle', { wiggles: 6 })
		this.clamper = gsap.utils.clamp(1, 100)

		this.xSetter = gsap.quickTo(this.el.hand, 'x', { duration: 0.1 })
		this.ySetter = gsap.quickTo(this.el.hand, 'y', { duration: 0.1 })

        this.sfx = new SoundFX();
        this.particles = [];

		this.setpricingMotion()
		this.initObserver()
		this.initEvents()

        gsap.ticker.add(this.updatePhysics.bind(this));
	}

    updatePhysics(time, deltaTime, frame) {
        const dt = deltaTime / 1000;
        const floor = window.innerHeight;
        
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            
            p.vy += 3000 * dt; // gravity
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            
            // Floor bounce
            if (p.y > floor - p.size) {
                p.y = floor - p.size;
                p.vy *= -0.6; // bounce dampening
                p.vx *= 0.8;  // ground friction
            }
            
            p.el.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.rotation}deg)`;
            p.rotation += p.rotSpeed * dt;
            
            p.life -= dt;
            if (p.life <= 0) {
                p.el.remove();
                this.particles.splice(i, 1);
            } else if (p.life < 0.2) {
                p.el.style.opacity = p.life / 0.2;
            }
        }
    }

	initEvents() {
		if (!this.animationIsOk || ScrollTrigger.isTouch === 1) return

		this.hero.style.cursor = 'none'

		this.hero.addEventListener('mouseenter', e => {
			gsap.set(this.el.hand, { opacity: 1 })

			this.xSetter(e.x, e.x)
			this.ySetter(e.y, e.y)
		})

		this.hero.addEventListener('mouseleave', e => {
			gsap.set(this.el.hand, { opacity: 0 })
		})

		this.hero.addEventListener('mousemove', e => {
			this.xSetter(e.x)
			this.ySetter(e.y)
		})

		gsap.delayedCall(1, e => {
			this.createExplosion(window.innerWidth / 2, window.innerHeight / 2, 600)
		})
	}

	setpricingMotion() {
		gsap.set(this.el.hand, { xPercent: -50, yPercent: -50 })
	}

	initObserver() {
		if (!this.animationIsOk) return

		if (ScrollTrigger.isTouch === 1) {
			Observer.create({
				target: this.el.proxy,
				type: 'touch',
				onPress: e => {
					this.createExplosion(e.x, e.y, 400)
				},
			})
		} else {
			Observer.create({
				target: this.el.proxy,
				type: 'pointer',
				onPress: e => this.startDrawing(e),
				onDrag: e => this.isDrawing && this.updateDrawing(e),
				onDragEnd: e => this.clearDrawing(e),
				onRelease: e => this.clearDrawing(e),
			})
		}
	}

	startDrawing(e) {
		this.isDrawing = true

		gsap.set(this.el.instructions, { opacity: 0 })

		this.startX = e.x
		this.startY = e.y + window.scrollY

		// Create line
		this.currentLine = document.createElementNS(
			'http://www.w3.org/2000/svg',
			'line'
		)
		this.currentLine.setAttribute('x1', this.startX)
		this.currentLine.setAttribute('y1', this.startY)
		this.currentLine.setAttribute('x2', this.startX)
		this.currentLine.setAttribute('y2', this.startY)
		this.currentLine.setAttribute('stroke', '#fffce1')
		this.currentLine.setAttribute('stroke-width', '2')
		this.currentLine.setAttribute('stroke-dasharray', '4')

		this.circle = document.createElementNS(
			'http://www.w3.org/2000/svg',
			'circle'
		)
		this.circle.setAttribute('cx', this.startX)
		this.circle.setAttribute('cy', this.startY)
		this.circle.setAttribute('r', '30')
		this.circle.setAttribute('fill', '#0e100f')

		// Create image at start point
		const randomKey = gsap.utils.random(this.imageKeys)
		const original = this.imageMap[randomKey]
		const clone = document.createElementNS(
			'http://www.w3.org/2000/svg',
			'image'
		)

		clone.setAttribute('x', this.startX - 25)
		clone.setAttribute('y', this.startY - 25)
		clone.setAttribute('width', '50')
		clone.setAttribute('height', '50')
		clone.setAttributeNS('http://www.w3.org/1999/xlink', 'href', original.src)

		this.startImage = clone

		this.el.canvas.appendChild(this.currentLine)
		this.el.canvas.appendChild(this.circle)
		this.el.canvas.appendChild(this.startImage)

		gsap.set(this.el.drag, { opacity: 1 })
		gsap.set(this.el.handle, { opacity: 1 })
		gsap.set(this.el.rock, { opacity: 0 })
	}

	updateDrawing(e) {
		if (!this.currentLine || !this.startImage) return

		let cursorX = e.x
		let cursorY = e.y + window.scrollY

		let dx = cursorX - this.startX
		let dy = cursorY - this.startY

		let distance = Math.sqrt(dx * dx + dy * dy)
		let shrink = (distance - 30) / distance

		let x2 = this.startX + dx * shrink
		let y2 = this.startY + dy * shrink

		if (distance < 30) {
			x2 = this.startX
			y2 = this.startY
		}

		let angle = Math.atan2(dy, dx) * (180 / Math.PI)

		gsap.to(this.currentLine, {
			attr: { x2, y2 },
			duration: 0.1,
			ease: 'none',
		})

		// Eased scale (starts fast, slows down)
		let raw = distance / 100
		let eased = Math.pow(raw, 0.5)
		let clamped = this.clamper(eased)

		gsap.set([this.startImage, this.circle], {
			scale: clamped,
			rotation: `${angle + -45}_short`,
			transformOrigin: 'center center',
		})

		// Move & rotate hand
		gsap.to(this.el.hand, {
			rotation: `${angle + -90}_short`,
			duration: 0.1,
			ease: 'none',
		})

		this.lastDistance = distance

        // Play stretch sound
        if (distance > 30) {
            this.sfx.playStretch(distance);
        }
	}

	createExplosion(x, y, distance = 100) {
		const count = Math.round(gsap.utils.clamp(3, 30, distance / 40))
		const angleSpread = Math.PI * 2
		const speed = gsap.utils.mapRange(0, 500, 0.3, 1.5, distance)
		const sizeRange = gsap.utils.mapRange(0, 500, 20, 60, distance)

        // Screen Shake
        gsap.to(this.hero, { x: "random(-10, 10)", y: "random(-10, 10)", duration: 0.05, yoyo: true, repeat: 5, onComplete: () => gsap.set(this.hero, {x:0, y:0}) })

        // Shockwave
        const shockwave = document.createElement('div');
        shockwave.className = 'shockwave';
        shockwave.style.left = `${x}px`;
        shockwave.style.top = `${y}px`;
        this.hero.appendChild(shockwave);
        
        gsap.fromTo(shockwave, 
            { width: 0, height: 0, opacity: 1 }, 
            { width: distance * 2, height: distance * 2, opacity: 0, duration: 0.5, ease: "power2.out", onComplete: () => shockwave.remove() }
        );

		for (let i = 0; i < count; i++) {
			const randomKey = gsap.utils.random(this.explosionKeys)
			const original = this.explosionMap[randomKey]
			const img = original.cloneNode(true)

            const size = gsap.utils.random(20, sizeRange);
			img.className = 'explosion-img'
			img.style.position = 'absolute'
			img.style.pointerEvents = 'none'
			img.style.height = `${size}px`
			img.style.left = `0px`
			img.style.top = `0px`
			img.style.zIndex = 4

			this.hero.appendChild(img)

			const angle = Math.random() * angleSpread
			const velocity = gsap.utils.random(500, 1500) * speed

            this.particles.push({
                el: img,
                x: x,
                y: y,
                vx: Math.cos(angle) * velocity,
                vy: Math.sin(angle) * velocity,
                rotation: gsap.utils.random(-180, 180),
                rotSpeed: gsap.utils.random(-360, 360),
                life: 1 + Math.random() * 1.5,
                size: size
            });
		}
	}

	clearDrawing(e) {
		if (!this.isDrawing) return
		
        this.sfx.stopStretch();
        this.sfx.playPop();

        this.createExplosion(this.startX, this.startY, this.lastDistance)

		gsap.set(this.el.drag, { opacity: 0 })
		gsap.set(this.el.handle, { opacity: 0 })
		gsap.set(this.el.rock, { opacity: 1 })

		gsap.to(this.el.rock, {
			duration: 0.4,
			rotation: '+=30',
			ease: 'myWiggle',
			onComplete: () => {
				gsap.set(this.el.rock, { opacity: 0 })

				gsap.set(this.el.hand, { rotation: 0, overwrite: 'auto' })

				gsap.to(this.el.instructions, { opacity: 1 })
				gsap.set(this.el.drag, { opacity: 1 })
			},
		})

		this.isDrawing = false

		// Clear all elements from SVG and reset references
		this.el.canvas.innerHTML = ''
		this.currentLine = null
		this.startImage = null
	}
}
const cannon = new confettiCannon(document.body)
cannon.init()
