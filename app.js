'use strict';document.documentElement.classList.add('js');
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const domainInfo=[{id:'human',tab:'Ego',title:'Egocentric human hands',description:'Everyday interaction through the human perspective.',family:'Shape & Fabricate'},{id:'handson',tab:'Simulated hands',title:'Simulated dexterous hands',description:'Dexterous manipulation in a diverse simulated world.',family:'Operate & Adjust'},{id:'real_robot',tab:'Real robot',title:'Real-world dexterous hands',description:'Physical interaction with real objects and real dynamics.',family:'Transfer & Mix'}];
let cases=[],selected=[],results={},heroIndex=0,subset='all',sortKey='score',sortDesc=true,detailIndex=0;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let paused = reduced.matches || navigator.connection?.saveData === true;
const rowStates = [];
let carouselVisible = false, heroHover = false, lastTime = 0, heroElapsed = 0;
let animation = 0;
const media=(r,e)=>`assets/media/${r.id}.${e}`;
function modalOpen(){return Boolean($('dialog[open]'))}
const reveal=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');reveal.unobserve(e.target)}}),{threshold:.06});$$('.reveal').forEach(e=>reveal.observe(e));
function play(v){if(!v.getAttribute('src')&&v.dataset.src){v.src=v.dataset.src;v.load()}v.play().catch(()=>{})}
const heroCards = $$('.hero-card');
const heroVideos = heroCards.map(card => card.querySelector('video'));

function syncHeroVideos() {
  const active = carouselVisible && !paused && !document.hidden && !modalOpen();
  for (const video of heroVideos) {
    if (active) {
      video.muted = true;
      play(video);
    } else {
      video.pause();
    }
  }
}

const heroObserver = new IntersectionObserver(([entry]) => {
  carouselVisible = entry.isIntersecting;
  syncHeroVideos();
  scheduleAnimation();
}, { threshold: 0 });
heroObserver.observe($('#carousel'));

function syncMotion() {
  syncHeroVideos();
  rowStates.forEach(updateRowMedia);
  scheduleAnimation();
}
document.addEventListener('visibilitychange', () => { lastTime = 0; syncMotion(); });
reduced.addEventListener('change', () => {
  paused = reduced.matches || navigator.connection?.saveData === true;
  syncMotion();
});

function setHero(index) {
  const nextIndex = (index + heroCards.length) % heroCards.length;
  if (nextIndex !== heroIndex && heroVideos[nextIndex].readyState >= 1) {
    heroVideos[nextIndex].currentTime = 0;
  }
  heroIndex = nextIndex;
  heroElapsed = 0;
  heroCards.forEach((card, position) => {
    const isActive = position === heroIndex;
    card.dataset.position = isActive ? 'active' : position === (heroIndex + 2) % 3 ? 'prev' : 'next';
    card.tabIndex = isActive ? 0 : -1;
    card.setAttribute('aria-label', domainInfo[position].title + (isActive ? ' — play reference' : ' — select'));
  });
  $$('[data-hero-index]').forEach((button, position) => {
    const isActive = position === heroIndex;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });
  $('#hero-label').textContent = domainInfo[heroIndex].title;
  $('#hero-description').textContent = domainInfo[heroIndex].description;
}

function renderHero() {
  $('#hero-tabs').innerHTML = domainInfo.map((domain, index) =>
    `<button role="tab" data-hero-index="${index}" aria-controls="carousel">${domain.tab}</button>`
  ).join('');
  $$('[data-hero-index]').forEach(button => {
    button.onclick = () => setHero(Number(button.dataset.heroIndex));
  });
  heroCards.forEach((card, position) => {
    card.onclick = () => {
      if (position !== heroIndex) setHero(position);
      else if (cases.some(record => record.id === card.dataset.caseId)) openCase(card.dataset.caseId);
    };
    card.onkeydown = event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        card.click();
      }
    };
  });
  setHero(0);
}
renderHero();
new MutationObserver(syncHeroVideos).observe($('#case-dialog'), { attributes: true, attributeFilter: ['open'] });
new MutationObserver(syncHeroVideos).observe($('#figure-dialog'), { attributes: true, attributeFilter: ['open'] });
$('#hero-prev').onclick=()=>setHero(heroIndex-1);$('#hero-next').onclick=()=>setHero(heroIndex+1);$('#carousel').onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setHero(heroIndex+(e.key==='ArrowLeft'?-1:1))}};$('#carousel').onpointerenter=()=>heroHover=true;$('#carousel').onpointerleave=()=>heroHover=false;let swipeX=0;$('#carousel').addEventListener('pointerdown',e=>swipeX=e.clientX);$('#carousel').addEventListener('pointerup',e=>{if(Math.abs(e.clientX-swipeX)>45){setHero(heroIndex+(e.clientX<swipeX?1:-1));suppressClickUntil=performance.now()+400}});let suppressClickUntil=0;$('#carousel').addEventListener('click',e=>{if(performance.now()<suppressClickUntil){e.preventDefault();e.stopPropagation()}},true);
function diverse(rows,n){const groups=[...new Set(rows.map(r=>r.operation))].map(op=>rows.filter(r=>r.operation===op));const out=[];while(groups.some(g=>g.length)&&out.length<n)groups.forEach(g=>{if(g.length&&out.length<n)out.push(g.shift())});return out}
function renderRows() {
  const selections = domainInfo.map(domain => diverse(cases.filter(record => record.domain === domain.id), 18));
  selected = selections.flat();
  $('#case-rows').innerHTML = domainInfo.map((domain, index) => `
    <section class="case-row" aria-label="${domain.title} examples">
      <div class="row-heading">
        <h3>${domain.title}</h3>
        <div class="row-controls">
          <button type="button" class="row-motion" aria-label="Pause automatic scrolling" aria-pressed="false" title="Pause automatic scrolling">Ⅱ</button>
          <button type="button" data-dir="-1" aria-label="Previous ${domain.tab} examples">←</button>
          <button type="button" data-dir="1" aria-label="Next ${domain.tab} examples">→</button>
        </div>
      </div>
      <div class="marquee" tabindex="0" role="region" aria-label="${domain.title} video strip">
        <div class="marquee-track">${selections[index].map(record => {
          const source = record.preview ? `assets/case-previews/${record.id}.mp4` : media(record, 'mp4');
          return `
          <button type="button" class="case-card" data-id="${record.id}" aria-label="Play ${esc(record.operation)}">
            <span class="case-visual">
              <img src="${media(record, 'jpg')}" alt="" loading="lazy" decoding="async" draggable="false">
              <video data-src="${source}" muted loop playsinline preload="none" aria-hidden="true"></video>
              <span class="case-play" aria-hidden="true">▶</span>
            </span>
            <span class="case-label">${esc(record.operation)}</span>
          </button>`;
        }).join('')}</div>
      </div>
    </section>`).join('');

  $$('.case-row').forEach(connectRow);
}

const warmRows = new IntersectionObserver(entries => {
  for (const entry of entries) {
    const row = rowStates.find(state => state.viewport === entry.target);
    row.near = entry.isIntersecting;
    updateRowMedia(row);
  }
}, { rootMargin: '420px 0px' });

const visibleRows = new IntersectionObserver(entries => {
  for (const entry of entries) {
    const row = rowStates.find(state => state.viewport === entry.target);
    row.visible = entry.intersectionRatio >= .12;
    updateRowMedia(row);
  }
  scheduleAnimation();
}, { threshold: .12 });

function updateRowMedia(row) {
  const { viewport, cards, loaded } = row;
  const allowMotion = !paused && !document.hidden && !modalOpen();
  const left = viewport.scrollLeft;
  const right = left + row.width;
  const first = Math.max(0, Math.floor((left - row.inset) / row.step));
  const visible = [];

  if (row.near && row.width && allowMotion) {
    for (let i = first; i < cards.length; i++) {
      const start = row.inset + i * row.step;
      if (start >= right) break;
      const overlap = Math.min(start + row.cardWidth, right) - Math.max(start, left);
      if (overlap >= Math.min(row.cardWidth, row.width) * .4) visible.push(i);
    }
  }

  const center = (left + right) / 2;
  visible.sort((a, b) => {
    const distance = index => Math.abs(row.inset + index * row.step + row.cardWidth / 2 - center);
    return distance(a) - distance(b);
  });
  const hot = visible.slice(0, 3);
  const nextIndex = row.direction > 0 ? Math.max(...hot) + 1 : Math.min(...hot) - 1;
  if (visible.includes(row.hoveredCard) && !hot.includes(row.hoveredCard)) hot[hot.length - 1] = row.hoveredCard;
  const warm = new Set(hot);
  if (nextIndex >= 0 && nextIndex < cards.length) warm.add(nextIndex);
  const playing = new Set(row.visible ? hot : []);

  for (const index of loaded) {
    const video = cards[index].video;
    if (!playing.has(index)) video.pause();
    if (warm.has(index)) continue;
    // Retain nearby previews briefly while the user drags across the row.
    if (row.near && allowMotion && index >= first - 1 && index <= first + Math.ceil(row.width / row.step) + 1) continue;
    video.removeAttribute('src');
    video.load();
    video.classList.remove('has-frame');
    loaded.delete(index);
  }
  for (const index of warm) {
    const video = cards[index].video;
    if (!loaded.has(index)) {
      video.preload = 'auto';
      video.src = video.dataset.src;
      loaded.add(index);
    }
    if (playing.has(index) && video.paused) video.play().catch(() => {});
  }
}

function connectRow(section, index) {
  const viewport = section.querySelector('.marquee');
  const track = viewport.firstElementChild;
  if (!track.firstElementChild) return;
  const cardCount = track.children.length;
  // Repeat the cards so each strip can wrap without reversing its motion.
  for (const button of Array.from(track.children)) {
    const copy = button.cloneNode(true);
    copy.tabIndex = -1;
    copy.setAttribute('aria-hidden', 'true');
    track.append(copy);
  }
  const motionButton = section.querySelector('.row-motion');
  const cards = Array.from(track.children, (button, index) => {
    const video = button.querySelector('video');
    video.addEventListener('playing', () => video.classList.add('has-frame'));
    button.addEventListener('click', () => openCase(button.dataset.id));
    button.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse') {
        row.hoveredCard = index;
        queueMedia();
      }
    });
    return { button, video };
  });
  const row = {
    viewport, cards, loaded: new Set(), direction: index === 1 ? -1 : 1, fraction: 0,
    near: false, visible: false, hovered: false, hoveredCard: -1,
    pointer: null, stopped: false, resumeAt: 0, width: 0, cycle: 0,
  };
  let mediaTimer, resumeTimer, suppressClick = false;
  rowStates.push(row);

  function queueMedia() {
    if (mediaTimer) return;
    mediaTimer = setTimeout(() => {
      mediaTimer = 0;
      updateRowMedia(row);
    }, 90);
  }

  function measure() {
    row.width = viewport.clientWidth;
    row.cardWidth = cards[0].button.offsetWidth;
    row.inset = cards[0].button.offsetLeft;
    row.step = cards.length > 1 ? cards[1].button.offsetLeft - row.inset : row.cardWidth;
    row.cycle = track.children[cardCount].offsetLeft - row.inset;
    queueMedia();
    scheduleAnimation();
  }
  measure();
  if (row.direction < 0 && !paused) viewport.scrollLeft = row.cycle;
  const resize = new ResizeObserver(measure);
  resize.observe(viewport);
  resize.observe(track);
  warmRows.observe(viewport);
  visibleRows.observe(viewport);

  function hold(duration = 3500) {
    row.resumeAt = performance.now() + duration;
    row.fraction = 0;
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(scheduleAnimation, duration + 25);
  }

  function scrollBy(direction) {
    hold();
    const distance = row.step * Math.max(1, Math.floor((row.width - row.inset) / row.step) - 1);
    viewport.scrollBy({ left: direction * distance, behavior: paused ? 'instant' : 'smooth' });
  }

  section.querySelectorAll('[data-dir]').forEach(button => {
    button.addEventListener('click', () => scrollBy(Number(button.dataset.dir)));
  });
  motionButton.addEventListener('click', () => {
    row.stopped = !row.stopped;
    motionButton.setAttribute('aria-pressed', String(row.stopped));
    motionButton.title = row.stopped ? 'Resume automatic scrolling' : 'Pause automatic scrolling';
    motionButton.textContent = row.stopped ? '▶' : 'Ⅱ';
    if (!row.stopped) row.resumeAt = 0;
    scheduleAnimation();
  });
  section.addEventListener('focusin', scheduleAnimation);
  section.addEventListener('focusout', () => queueMicrotask(scheduleAnimation));
  viewport.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    scrollBy(event.key === 'ArrowLeft' ? -1 : 1);
  });
  viewport.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse') row.hovered = true;
  });
  viewport.addEventListener('pointerleave', () => {
    row.hovered = false;
    row.hoveredCard = -1;
    if (row.pointer && !viewport.hasPointerCapture(row.pointer.id)) row.pointer = null;
    queueMedia();
    scheduleAnimation();
  });
  viewport.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    suppressClick = false;
    hold();
    row.pointer = { id: event.pointerId, x: event.clientX, left: viewport.scrollLeft, dragging: false };
  });
  viewport.addEventListener('pointermove', event => {
    const pointer = row.pointer;
    if (!pointer || event.pointerId !== pointer.id || event.pointerType === 'touch') return;
    const delta = event.clientX - pointer.x;
    if (!pointer.dragging && Math.abs(delta) < 6) return;
    if (!pointer.dragging) {
      pointer.dragging = true;
      viewport.setPointerCapture(pointer.id);
      viewport.classList.add('dragging');
    }
    viewport.scrollLeft = pointer.left - delta;
    event.preventDefault();
  });

  function endPointer(event) {
    if (row.pointer?.id !== event.pointerId) return;
    suppressClick = row.pointer.dragging;
    row.pointer = null;
    viewport.classList.remove('dragging');
    hold();
  }
  viewport.addEventListener('pointerup', endPointer);
  viewport.addEventListener('pointercancel', endPointer);
  viewport.addEventListener('lostpointercapture', endPointer);
  viewport.addEventListener('click', event => {
    if (suppressClick && event.detail) {
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
    }
  }, true);
  viewport.addEventListener('wheel', event => {
    if (event.deltaX) hold();
  }, { passive: true });
  viewport.addEventListener('scroll', () => {
    if (row.pointer || performance.now() < row.resumeAt) hold();
    queueMedia();
  }, { passive: true });
}

function canAutoScroll(row, time) {
  const focused = document.activeElement;
  return row.visible && row.cycle > row.width && !row.stopped && !row.hovered && !row.pointer && time >= row.resumeAt &&
    !(row.viewport.parentElement.contains(focused) && focused.matches(':focus-visible'));
}

function scheduleAnimation() {
  if (!animation && !paused && !document.hidden && !modalOpen() &&
      (carouselVisible || rowStates.some(row => canAutoScroll(row, performance.now())))) {
    animation = requestAnimationFrame(animate);
  }
}

function animate(time) {
  animation = 0;
  if (paused || document.hidden || modalOpen()) {
    lastTime = 0;
    return;
  }
  const elapsed = lastTime ? Math.min((time - lastTime) / 1000, .05) : 0;
  lastTime = time;
  for (const row of rowStates) {
    if (!canAutoScroll(row, time)) continue;
    row.fraction += elapsed * 34;
    const pixels = Math.floor(row.fraction);
    if (!pixels) continue;
    row.fraction -= pixels;
    const next = row.viewport.scrollLeft + pixels * row.direction;
    row.viewport.scrollLeft = ((next % row.cycle) + row.cycle) % row.cycle;
  }
  if (carouselVisible && !heroHover && !$('#carousel').contains(document.activeElement)) {
    heroElapsed += elapsed;
    if (heroElapsed > 8) setHero(heroIndex + 1);
  }
  scheduleAnimation();
  if (!animation) lastTime = 0;
}
function openCase(id){const r=cases.find(x=>x.id===id);detailIndex=selected.findIndex(x=>x.id===id);if(detailIndex<0){selected=[r,...selected.filter(x=>x.id!==id)];detailIndex=0}const v=$('#detail-video');v.pause();v.poster=media(r,'jpg');v.src=media(r,'mp4');v.load();$('#dialog-title').textContent=r.operation;$('#dialog-caption').textContent=r.caption;$('#dialog-domain').textContent=domainInfo.find(d=>d.id===r.domain).tab;$('#prev-case').disabled=detailIndex===0;$('#next-case').disabled=detailIndex===selected.length-1;if(!$('#case-dialog').open)$('#case-dialog').showModal();document.body.classList.add('modal-open');syncMotion();v.play().catch(()=>{})}$('#prev-case').onclick=()=>openCase(selected[detailIndex-1].id);$('#next-case').onclick=()=>openCase(selected[detailIndex+1].id);$('#case-dialog .dialog-close').onclick=()=>$('#case-dialog').close();$('#case-dialog').addEventListener('close',()=>{const v=$('#detail-video');v.pause();v.removeAttribute('src');v.load();document.body.classList.remove('modal-open');syncMotion()});
const figureDimensions = {"aggregation_sensitivity":[2200,1540],"data_pipeline":[2200,1100],"human_alignment":[2200,530],"interaction_diagnostics":[2200,2013],"qualitative_cases":[2200,685],"results_overview":[2200,712],"supp_adk_alignment":[2200,675],"supp_adk_applicability":[2200,1285],"supp_adk_hunyuan":[2200,880],"supp_adk_memory_reference":[2200,1328],"supp_adk_metrics":[2200,1663],"supp_adk_pam":[2200,880],"supp_adk_scope":[2200,1064],"supp_bcef_annotation":[2200,1357],"supp_bcef_control":[2200,1229],"teaser":[2200,1100]};
function figureURL(name) {
  return 'assets/figures/' + name + '.webp?v=manuscript4';
}
function figureHTML(name,title){const [width,height]=figureDimensions[name];return `<button data-enlarge="${name}" data-title="${esc(title)}" aria-label="Enlarge ${esc(title)}"><img src="${figureURL(name)}" width="${width}" height="${height}" alt="${esc(title)}" loading="lazy" decoding="async"></button><figcaption>${esc(title)}</figcaption>`}function wireFigures(root){root.querySelectorAll('[data-enlarge]').forEach(b=>b.onclick=()=>{$('#figure-title').textContent=b.dataset.title;$('#figure-full').src=figureURL(b.dataset.enlarge);$('#figure-full').alt=b.dataset.title;$('#figure-dialog').showModal();document.body.classList.add('modal-open');syncMotion()})}$$('[data-figure]').forEach(f=>{f.innerHTML=figureHTML(f.dataset.figure,f.dataset.title);wireFigures(f)});
const figureGroups={evaluation:[['Controls','supp_bcef_control','Aligned control representations across embodiments'],['Annotations','supp_bcef_annotation','Object-state checkpoints and annotation windows'],['Metrics','supp_adk_metrics','Metric examples across generated interactions'],['Memory','supp_adk_memory_reference','Historical attributes across occlusion and reappearance'],['Coverage','supp_adk_applicability','Reference coverage for task and state evaluation']],analysis:[['HunyuanVideo','supp_adk_hunyuan','HunyuanVideo 1.5 across three embodiments'],['PAM','supp_adk_pam','PAM across three embodiments'],['Embodiment','supp_adk_scope','Task completion and embodiment fidelity'],['Rank stability','aggregation_sensitivity','Model rankings across aggregation settings'],['Alignment','supp_adk_alignment','RGB, geometry and camera alignment']]};
$$('[data-figure-group]').forEach(group=>{const options=figureGroups[group.dataset.figureGroup];group.innerHTML=`<div class="tabs" role="tablist" aria-label="${group.dataset.figureGroup} figures">${options.map((o,i)=>`<button role="tab" data-fig-index="${i}">${o[0]}</button>`).join('')}</div><figure class="switcher-figure" role="tabpanel"></figure>`;const buttons=[...group.querySelectorAll('[data-fig-index]')];function set(i){buttons.forEach((b,j)=>{b.classList.toggle('active',i===j);b.setAttribute('aria-selected',String(i===j));b.tabIndex=i===j?0:-1});const f=group.querySelector('figure');f.innerHTML=figureHTML(options[i][1],options[i][2]);wireFigures(f)}buttons.forEach((b,i)=>{b.onclick=()=>set(i);b.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const next=(i+(e.key==='ArrowLeft'?options.length-1:1))%options.length;set(next);buttons[next].focus()}}});set(0)});$('.figure-close').onclick=()=>$('#figure-dialog').close();$('#figure-dialog').addEventListener('close',()=>{document.body.classList.remove('modal-open');syncMotion()});$$('dialog').forEach(d=>d.addEventListener('click',e=>{const r=d.getBoundingClientRect();if(e.target===d&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))d.close()}));
const metrics=[['Visual quality','MUSIQ · Visual Plausibility · JEPA Similarity'],['Hand fidelity','Pose Control · Keypoint Coverage · Hand Morphology'],['Appearance consistency','Entity Consistency · Background Consistency · Photometric Consistency'],['Instruction following','Action Adherence · Event Adherence'],['Physical consistency','Trajectory Accuracy · Causal Plausibility · Evolution Correctness · State Regulation'],['Temporal coherence','State Progression · Memory Consistency']];$('#metric-grid').innerHTML=metrics.map(m=>`<div><h3>${m[0]}</h3><p>${m[1]}</p></div>`).join('');
function renderResults(){const list=[...(results[subset]||[])].sort((a,b)=>{const x=sortKey==='score'?a.score:a.dimensions[Number(sortKey)],y=sortKey==='score'?b.score:b.dimensions[Number(sortKey)];return sortDesc?y-x:x-y});$('#results-table tbody').innerHTML=list.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.name)}</td><td class="score">${r.score.toFixed(2)}</td>${r.dimensions.map(v=>`<td>${v.toFixed(1)}</td>`).join('')}</tr>`).join('');$$('[data-sort]').forEach(b=>{const key=b.dataset.sort;b.textContent=(key==='score'?'HWBScore':metrics[Number(key)][0])+(key===sortKey?(sortDesc?' ↓':' ↑'):'');b.closest('th').setAttribute('aria-sort',key===sortKey?(sortDesc?'descending':'ascending'):'none')});$$('[data-subset]').forEach(b=>{b.classList.toggle('active',b.dataset.subset===subset);b.setAttribute('aria-pressed',String(b.dataset.subset===subset))})}$$('[data-subset]').forEach(b=>b.onclick=()=>{subset=b.dataset.subset;sortKey='score';sortDesc=true;renderResults()});$$('[data-sort]').forEach(b=>b.onclick=()=>{if(sortKey===b.dataset.sort)sortDesc=!sortDesc;else{sortKey=b.dataset.sort;sortDesc=true}renderResults()});
const initialSection = location.hash.slice(1);
Promise.all([fetch('assets/cases.json?v=gallery12').then(r=>r.json()),fetch('assets/leaderboard.json?v=vpp2').then(r=>r.json())]).then(([c,r])=>{cases=c;results=r;renderRows();renderResults();syncMotion();
  // The video rows gain their height when the catalogue arrives.
  document.fonts.ready.then(() => {
    if (initialSection && location.hash === '#' + initialSection) {
      document.getElementById(initialSection)?.scrollIntoView({ behavior: 'instant' });
    }
  });}).catch(e=>console.error(e));
