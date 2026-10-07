/* Navegación, esquema geométrico e interacciones. No realiza cálculos estructurales. */
'use strict';
document.documentElement.classList.add('js');

const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#nav-principal');
const closeMenu = () => {
  navigation.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
};
menuButton.addEventListener('click', () => {
  const open = navigation.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
});
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && navigation.classList.contains('open')) {
    closeMenu();
    menuButton.focus();
  }
});
document.addEventListener('click', event => {
  if (!event.target.closest('.site-header')) closeMenu();
});
window.matchMedia('(min-width: 961px)').addEventListener('change', closeMenu);

const progressBar = document.querySelector('.reading-progress');
let scrollQueued = false;
function updateProgress() {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  progressBar.style.transform = `scaleX(${maxScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0})`;
  scrollQueued = false;
}
window.addEventListener('scroll', () => {
  if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(updateProgress); }
}, { passive: true });
window.addEventListener('resize', updateProgress);
updateProgress();

if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(element => {
    if (!motionPreference.matches) element.classList.add('pending');
    revealObserver.observe(element);
  });
  const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      navigation.querySelectorAll('a').forEach(link => {
        if (link.hash === `#${entry.target.id}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-15% 0px -65% 0px', threshold: 0 });
  document.querySelectorAll('main>section[id]').forEach(section => sectionObserver.observe(section));
}

/* Proyección de un prisma: tres barras, dos triángulos de cables y tres cables laterales.
   La representación es visual. No estima esfuerzos, deformaciones ni cargas. */
const SVG_NS = 'http://www.w3.org/2000/svg';
function svgElement(tag, attributes) {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}
function createModel(svg) {
  svg.replaceChildren();
  const ground = svgElement('ellipse', { cx: 300, cy: 425, rx: 145, ry: 31, fill: '#020a0d', opacity: .21 });
  const group = svgElement('g', {});
  svg.append(ground, group);
  const points = [];
  for (let layer = 0; layer < 2; layer++) {
    for (let index = 0; index < 3; index++) {
      const angle = index * 2 * Math.PI / 3 + (layer ? 5 * Math.PI / 6 : 0);
      points.push([Math.cos(angle) * 137, layer ? 138 : -138, Math.sin(angle) * 137]);
    }
  }
  const edges = [];
  for (let i = 0; i < 3; i++) {
    edges.push({ a: i, b: (i + 1) % 3, type: 'cable' });
    edges.push({ a: i + 3, b: (i + 1) % 3 + 3, type: 'cable' });
    edges.push({ a: i, b: (i + 2) % 3 + 3, type: 'cable' });
    edges.push({ a: i, b: i + 3, type: 'strut' });
  }
  edges.forEach(edge => {
    edge.element = svgElement('line', { class: edge.type, stroke: edge.type === 'cable' ? '#f6a084' : '#c6dfd3', 'stroke-width': edge.type === 'cable' ? 1.8 : 10, 'stroke-linecap': 'round' });
    group.append(edge.element);
  });
  const dots = points.map(() => svgElement('circle', { r: 4.5, fill: '#e3ece2', stroke: '#648878', 'stroke-width': 1.5 }));
  dots.forEach(dot => group.append(dot));
  function draw(rotation) {
    const tilt = .29;
    const projected = points.map(([x, y, z]) => {
      const rx = x * Math.cos(rotation) + z * Math.sin(rotation);
      const rz = -x * Math.sin(rotation) + z * Math.cos(rotation);
      const screenY = -y * Math.cos(tilt) + rz * Math.sin(tilt);
      const depth = y * Math.sin(tilt) + rz * Math.cos(tilt);
      const perspective = 950 / (950 + depth);
      return { x: 300 + rx * perspective * 1.18, y: 249 + screenY * perspective * 1.12, z: depth };
    });
    edges.forEach(edge => {
      const a = projected[edge.a], b = projected[edge.b];
      edge.element.setAttribute('x1', a.x.toFixed(2)); edge.element.setAttribute('y1', a.y.toFixed(2));
      edge.element.setAttribute('x2', b.x.toFixed(2)); edge.element.setAttribute('y2', b.y.toFixed(2));
      edge.depth = (a.z + b.z) / 2;
    });
    // Dibuja primero los segmentos lejanos; los cruces no representan uniones.
    [...edges].sort((a, b) => b.depth - a.depth).forEach(edge => group.append(edge.element));
    dots.forEach((dot, i) => {
      dot.setAttribute('cx', projected[i].x.toFixed(2)); dot.setAttribute('cy', projected[i].y.toFixed(2)); group.append(dot);
    });
  }
  draw(.44);
  return draw;
}
const drawHero = createModel(document.querySelector('[data-model="hero"]'));
const labSvg = document.querySelector('[data-model="lab"]');
const drawLab = createModel(labSvg);
const angleInput = document.querySelector('#view-angle');
// Un giro completo tarda aproximadamente tres minutos.
const slowRotationSpeed = .000035;
const labRotationButton = document.querySelector('#lab-rotation-toggle');
let labRotating = !motionPreference.matches;
let labVisible = true;
let labAngle = Number(angleInput.value) * Math.PI / 180;
let labLastTime = 0;
let labFrame = null;
function updateLabRotationButton() {
  labRotationButton.setAttribute('aria-pressed', String(labRotating));
  labRotationButton.setAttribute('aria-label', labRotating ? 'Pausar giro del prisma' : 'Iniciar giro del prisma');
  labRotationButton.textContent = labRotating ? 'Pausar giro' : 'Giro automático';
}
function animateLab(time) {
  labFrame = null;
  if (!labRotating || !labVisible || document.hidden) { labLastTime = 0; return; }
  if (labLastTime) labAngle = (labAngle + Math.min(time - labLastTime, 60) * slowRotationSpeed) % (2 * Math.PI);
  const degrees = Math.round(labAngle * 180 / Math.PI) % 360;
  angleInput.value = String(degrees);
  document.querySelector('#angle-value').textContent = `${degrees}°`;
  drawLab(labAngle); labLastTime = time;
  labFrame = requestAnimationFrame(animateLab);
}
function syncLabAnimation() {
  if (labFrame !== null) cancelAnimationFrame(labFrame);
  labFrame = null; labLastTime = 0;
  if (labRotating && labVisible && !document.hidden) labFrame = requestAnimationFrame(animateLab);
}
labRotationButton.addEventListener('click', () => {
  labRotating = !labRotating; updateLabRotationButton(); syncLabAnimation();
});
angleInput.addEventListener('input', () => {
  labRotating = false; updateLabRotationButton(); syncLabAnimation();
  labAngle = Number(angleInput.value) * Math.PI / 180;
  document.querySelector('#angle-value').textContent = `${angleInput.value}°`;
  drawLab(labAngle);
});
drawLab(labAngle);
updateLabRotationButton(); syncLabAnimation();

let rotating = !motionPreference.matches;
let heroVisible = true;
let lastTime = 0;
let heroAngle = .44;
let animationFrame = null;
const rotationButton = document.querySelector('#rotation-toggle');
function updateRotationButton() {
  rotationButton.setAttribute('aria-pressed', String(rotating));
  rotationButton.setAttribute('aria-label', rotating ? 'Pausar giro del modelo' : 'Iniciar giro del modelo');
  rotationButton.firstElementChild.textContent = rotating ? 'Ⅱ' : '▷';
}
function animate(time) {
  animationFrame = null;
  if (!rotating || !heroVisible || document.hidden) { lastTime = 0; return; }
  if (lastTime) heroAngle += Math.min(time - lastTime, 60) * slowRotationSpeed;
  drawHero(heroAngle); lastTime = time;
  animationFrame = requestAnimationFrame(animate);
}
function syncAnimation() {
  if (animationFrame !== null) cancelAnimationFrame(animationFrame);
  animationFrame = null; lastTime = 0;
  if (rotating && heroVisible && !document.hidden) animationFrame = requestAnimationFrame(animate);
}
rotationButton.addEventListener('click', () => { rotating = !rotating; updateRotationButton(); syncAnimation(); });
motionPreference.addEventListener('change', event => {
  if (event.matches) {
    rotating = false; updateRotationButton(); syncAnimation();
    labRotating = false; updateLabRotationButton(); syncLabAnimation();
    document.querySelectorAll('.reveal.pending').forEach(element => element.classList.add('visible'));
  }
});
document.addEventListener('visibilitychange', syncAnimation);
document.addEventListener('visibilitychange', syncLabAnimation);
if ('IntersectionObserver' in window) {
  new IntersectionObserver(entries => { heroVisible = entries[0].isIntersecting; syncAnimation(); }).observe(document.querySelector('.hero-model'));
  new IntersectionObserver(entries => { labVisible = entries[0].isIntersecting; syncLabAnimation(); }).observe(labSvg);
}
updateRotationButton(); syncAnimation();

const explanations = {
  all: ['EL SISTEMA COMPLETO', 'Cada parte cuenta.', 'Las barras mantienen separados los puntos de unión, mientras los cables restringen sus movimientos. El equilibrio depende de la geometría y de la tensión inicial de la red.'],
  tension: ['TENSIÓN / LOS CABLES', 'Una red que tira.', 'Los nueve cables del esquema forman una red conectada y trabajan a tensión. Aquí aparecen resaltados en coral. Las barras siguen presentes, aunque se muestran atenuadas para facilitar la observación.'],
  compression: ['COMPRESIÓN / LAS BARRAS', 'Separadas, pero conectadas.', 'Las tres barras del esquema trabajan a compresión y no se tocan entre sí. Aquí se resaltan en verde claro. Los cruces que ves son un efecto de la perspectiva, no puntos de unión.']
};
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-view]').forEach(option => { option.classList.toggle('active', option === button); option.setAttribute('aria-pressed', String(option === button)); });
  labSvg.dataset.highlight = button.dataset.view;
  const [kicker, title, description] = explanations[button.dataset.view];
  document.querySelector('#lab-kicker').textContent = kicker;
  document.querySelector('#lab-subtitle').textContent = title;
  document.querySelector('#lab-text').textContent = description;
  labSvg.setAttribute('aria-label', `${title} ${description}`);
}));

const galleryDialog = document.querySelector('#gallery-dialog');
let galleryTrigger = null;
document.querySelectorAll('.gallery-open').forEach(link => link.addEventListener('click', event => {
  if (typeof galleryDialog.showModal !== 'function') return;
  event.preventDefault(); galleryTrigger = link;
  const image = document.querySelector('#gallery-dialog-image');
  image.src = link.getAttribute('href'); image.alt = link.querySelector('img').alt;
  document.querySelector('#gallery-dialog-title').textContent = link.dataset.title;
  document.querySelector('#gallery-dialog-caption').textContent = link.dataset.caption;
  galleryDialog.showModal(); document.body.classList.add('dialog-open');
  document.querySelector('#close-gallery').focus();
}));
document.querySelector('#close-gallery').addEventListener('click', () => galleryDialog.close());
galleryDialog.addEventListener('click', event => {
  const box = galleryDialog.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) galleryDialog.close();
});
galleryDialog.addEventListener('close', () => { document.body.classList.remove('dialog-open'); galleryTrigger?.focus(); });

const quizFeedback = document.querySelector('#quiz-feedback');
document.querySelectorAll('[data-answer]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-answer]').forEach(option => { option.classList.remove('correct', 'incorrect'); option.setAttribute('aria-pressed', String(option === button)); });
  const correct = button.dataset.answer === 'cables';
  button.classList.add(correct ? 'correct' : 'incorrect');
  quizFeedback.textContent = correct ? '¡Correcto! Los cables trabajan a tensión; las barras, principalmente a compresión. Ambas partes se necesitan.' : button.dataset.answer === 'bars' ? 'Casi. En este modelo, las barras trabajan a compresión. Piensa en qué elemento puede tirar de sus extremos y prueba otra vez.' : 'Sí hay tensión: la red de elementos flexibles transmite fuerzas de tracción. Prueba otra vez.';
}));
