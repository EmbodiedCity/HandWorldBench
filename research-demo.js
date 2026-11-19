'use strict';

async function startControlDemo() {
  const section = document.querySelector('#unified-control');
  const tabs = section.querySelector('#control-case-tabs');
  const gallery = section.querySelector('#control-gallery');
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const response = await fetch('assets/unified/gallery.json?v=manuscript14');
  if (!response.ok) throw new Error('The control examples could not be loaded.');
  const examples = await response.json();

  let selectedIndex = -1;
  let videos = [];
  let reference;
  let visible = false;
  let near = false;
  let playRequest = 0;
  let userPlaying = false;
  let mediaSession = new AbortController();
  const automatic = () => !motionPreference.matches && !navigator.connection?.saveData;

  function prepare(video) {
    if (video.getAttribute('src')) return;
    video.preload = 'auto';
    video.src = video.dataset.source;
  }

  function waitForFrames(video, signal) {
    if (video.error || video.readyState >= 2 || signal.aborted) return Promise.resolve();
    return new Promise(resolve => {
      const listeners = new AbortController();
      function done() {
        listeners.abort();
        signal.removeEventListener('abort', done);
        resolve();
      }
      const options = { once: true, signal: listeners.signal };
      video.addEventListener('loadeddata', done, options);
      video.addEventListener('error', done, options);
      signal.addEventListener('abort', done, { once: true });
    });
  }

  async function syncPlayback() {
    const request = ++playRequest;
    if (!reference) return;
    const shouldPlay = visible && !document.hidden && !document.querySelector('dialog[open]') &&
      (automatic() || userPlaying);
    if (!shouldPlay) {
      videos.forEach(video => video.pause());
      return;
    }
    videos.forEach(prepare);
    await Promise.all(videos.map(video => waitForFrames(video, mediaSession.signal)));
    if (request !== playRequest) return;
    for (const video of videos) {
      if (video.error) continue;
      if (video !== reference) video.currentTime = reference.currentTime;
      video.play().catch(() => {});
    }
  }

  function createVideo(path, label, query = '') {
    const video = document.createElement('video');
    video.poster = path + '.jpg' + query;
    video.dataset.source = path + '.mp4' + query;
    video.muted = true;
    video.playsInline = true;
    video.loop = true;
    video.preload = 'none';
    video.setAttribute('aria-label', label);
    videos.push(video);
    return video;
  }

  function makeTile(className, title, detail, visual) {
    const tile = document.createElement('figure');
    tile.className = className;
    const caption = document.createElement('figcaption');
    const name = document.createElement('strong');
    name.textContent = title;
    caption.append(name);
    if (detail) {
      const subtitle = document.createElement('span');
      subtitle.textContent = detail;
      caption.append(subtitle);
    }
    const frame = document.createElement('div');
    frame.className = 'control-preview';
    frame.append(visual);
    tile.append(caption, frame);
    return tile;
  }

  function createPrompt(example) {
    const prompt = document.createElement('details');
    prompt.className = 'control-prompt';
    const toggle = document.createElement('summary');
    const title = document.createElement('strong');
    title.textContent = 'Text prompt';
    const excerpt = document.createElement('span');
    excerpt.textContent = example.excerpt;
    toggle.append(title, excerpt);
    const full = document.createElement('p');
    full.textContent = example.prompt;
    prompt.append(toggle, full);
    return prompt;
  }

  function select(index, focus = false) {
    if (index === selectedIndex) return;
    selectedIndex = index;
    ++playRequest;
    mediaSession.abort();
    mediaSession = new AbortController();
    for (const video of gallery.querySelectorAll('video')) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    videos = [];
    userPlaying = false;
    const example = examples[index];
    const path = 'assets/unified/' + example.folder;
    const caseReference = createVideo(path + 'reference', example.name + ' reference video');
    reference = caseReference;
    caseReference.controls = !automatic();
    if (caseReference.controls) caseReference.src = caseReference.dataset.source;
    caseReference.addEventListener('play', () => {
      if (reference === caseReference && !automatic() && !userPlaying) {
        userPlaying = true;
        syncPlayback();
      }
    });
    caseReference.addEventListener('pause', () => {
      if (reference === caseReference && !automatic()) {
        userPlaying = false;
        videos.slice(1).forEach(video => video.pause());
      }
    });
    const playbackMeter = document.createElement('progress');
    playbackMeter.className = 'context-playback';
    playbackMeter.value = 0;
    playbackMeter.max = 1;
    playbackMeter.setAttribute('aria-label', 'Scene signal playback progress');

    caseReference.addEventListener('timeupdate', () => {
      if (reference !== caseReference) return;
      if (Number.isFinite(caseReference.duration) && caseReference.duration > 0) {
        playbackMeter.value = caseReference.currentTime / caseReference.duration;
      }
      if (caseReference.paused) return;
      for (const video of videos.slice(1)) {
        if (video.readyState >= 2 && Math.abs(video.currentTime - reference.currentTime) > 0.16) {
          video.currentTime = reference.currentTime;
        }
      }
    });

    function renderSignal(signal) {
      if (signal.clip) {
        const tile = makeTile('signal-tile', signal.label, signal.detail,
          createVideo(path + signal.clip, signal.label));
        if (signal.links?.length) {
          const links = document.createElement('div');
          links.className = 'signal-links';
          for (const item of signal.links) {
            const link = document.createElement('a');
            link.className = 'signal-source';
            link.href = path + item.clip;
            link.target = '_blank';
            link.rel = 'noopener';
            link.textContent = item.label;
            links.append(link);
          }
          tile.append(links);
        }
        return tile;
      }
      const image = document.createElement('img');
      image.src = path + signal.image;
      image.alt = 'Binary object mask beside its masked RGB image';
      image.width = 640;
      image.height = 360;
      return makeTile('signal-tile', signal.label, signal.detail, image);
    }

    function makeColumn(className, title, children) {
      const column = document.createElement('section');
      column.className = 'control-column ' + className;
      const heading = document.createElement('h3');
      heading.textContent = title;
      column.append(heading, ...children);
      return column;
    }

    const prediction = makeTile('control-comparison-tile prediction-tile', 'Model prediction', example.model,
      createVideo(path + 'prediction', example.model + ' generated video', '?v=unpadded'));
    prediction.style.setProperty('--prediction-aspect', (example.predictionWidth ?? 640) / 360);
    const comparison = makeColumn('control-comparison', 'Video', [
      makeTile('control-comparison-tile reference-tile', 'Reference video', example.domain, reference),
      prediction,
    ]);
    const hands = makeColumn('control-hands', 'Hand controls', example.hands.map(renderSignal));
    const sceneStatus = document.createElement('div');
    sceneStatus.className = 'scene-status';
    const sceneMode = document.createElement('span');
    sceneMode.textContent = example.sceneMode;
    sceneStatus.append(sceneMode, playbackMeter);
    const contextTiles = [sceneStatus, createPrompt(example), ...example.context.map(renderSignal)];
    if (example.objectMask) {
      const mask = document.createElement('details');
      mask.className = 'control-object-mask';
      const summary = document.createElement('summary');
      summary.textContent = example.objectMask.label;
      mask.append(summary, renderSignal(example.objectMask));
      contextTiles.push(mask);
    }
    const context = makeColumn('control-context', 'Prompt & scene', contextTiles);
    gallery.replaceChildren(comparison, hands, context);
    gallery.setAttribute('aria-labelledby', buttons[index].id);
    buttons.forEach((button, i) => {
      button.setAttribute('aria-selected', String(i === index));
      button.tabIndex = i === index ? 0 : -1;
    });
    if (focus) buttons[index].focus();
    if (near && automatic()) videos.forEach(prepare);
    syncPlayback();
  }

  const buttons = examples.map((example, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'control-case-tab';
    button.id = 'control-case-' + index;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', gallery.id);
    const thumbnail = document.createElement('img');
    thumbnail.src = 'assets/unified/' + example.folder + 'reference.jpg';
    thumbnail.alt = '';
    thumbnail.loading = 'lazy';
    const name = document.createElement('strong');
    name.textContent = example.name;
    const domain = document.createElement('small');
    domain.textContent = example.domain;
    const text = document.createElement('span');
    text.append(name, domain);
    button.append(thumbnail, text);
    button.addEventListener('click', () => select(index));
    button.addEventListener('keydown', event => {
      const directions = { ArrowLeft: -1, ArrowRight: 1 };
      if (!(event.key in directions) && event.key !== 'Home' && event.key !== 'End') return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? examples.length - 1 :
        (index + directions[event.key] + examples.length) % examples.length;
      select(next, true);
    });
    return button;
  });
  tabs.replaceChildren(...buttons);
  select(0);

  document.addEventListener('visibilitychange', syncPlayback);
  const dialogObserver = new MutationObserver(syncPlayback);
  document.querySelectorAll('dialog').forEach(dialog => {
    dialogObserver.observe(dialog, { attributes: true, attributeFilter: ['open'] });
  });
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    syncPlayback();
  });
  observer.observe(gallery);
  const preloader = new IntersectionObserver(([entry]) => {
    near = entry.isIntersecting;
    if (near && automatic()) videos.forEach(prepare);
  }, { rootMargin: '250px 0px' });
  preloader.observe(gallery);
  motionPreference.addEventListener('change', () => {
    userPlaying = false;
    reference.controls = !automatic();
    if (reference.controls && !reference.src) reference.src = reference.dataset.source;
    syncPlayback();
  });
}

const corpusEmbodiments = [
  { key: 'ego', label: 'Egocentric human hands', color: '#4168d4' },
  { key: 'handson', label: 'Simulated dexterous hands', color: '#9b67cf' },
  { key: 'ti5', label: 'Real dexterous hands', color: '#d08932' },
];
const lengthLabels = {
  frameBins: ['≤81', '82–161', '162–321', '322–641', '642–1,281', '≥1,282'],
  durationBins: ['<3 s', '3–<6 s', '6–<12 s', '12–<24 s', '24–<48 s', '≥48 s'],
};
const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

function drawDistribution(destination, rows, domains, isScrollable) {
  const maximum = Math.max(1, ...rows.map(row => row.values.reduce((a,b) => a+b, 0)));
  const list = document.createElement('ul');
  list.className = 'chart-bars' + (isScrollable ? ' is-scrollable' : '');
  for (const { label, values } of rows) {
    const row = document.createElement('li');
    row.className = 'chart-bar';
    const name = document.createElement('span');
    name.textContent = label;
    const track = document.createElement('div');
    track.className = 'chart-track';
    track.setAttribute('aria-hidden', 'true');
    values.forEach((count, index) => {
      const segment = document.createElement('span');
      segment.style.width = (count / maximum * 100) + '%';
      segment.style.backgroundColor = domains[index].color;
      segment.title = domains[index].label + ' · ' + decimal.format(count);
      track.append(segment);
    });
    const number = document.createElement('span');
    number.className = 'chart-value';
    number.textContent = decimal.format(values.reduce((a,b) => a+b, 0));
    row.append(name, track, number);
    list.append(row);
  }
  destination.replaceChildren(list);
}

async function startCorpusCharts() {
  const response = await fetch('assets/corpus.json');
  if (!response.ok) throw new Error('Could not load the corpus distribution');
  const data = await response.json();
  const embodiment = document.querySelector('#corpus-domain');
  const taxonomy = document.querySelector('#corpus-taxonomy');
  const length = document.querySelector('#corpus-length');
  const overview = document.querySelector('#corpus-overview');
  const buttons = corpusEmbodiments.map(domain => {
    const button = document.createElement('button');
    button.type = 'button';
    button.style.setProperty('--domain-color', domain.color);
    const value = document.createElement('strong');
    value.textContent = decimal.format(data[domain.key].clips);
    const label = document.createElement('span');
    label.textContent = domain.label;
    button.append(value, label);
    button.addEventListener('click', () => {
      embodiment.value = embodiment.value === domain.key ? 'all' : domain.key;
      draw();
    });
    return button;
  });
  overview.replaceChildren(...buttons);

  function draw() {
    const domains = corpusEmbodiments.filter(d => embodiment.value === 'all' || d.key === embodiment.value);
    buttons.forEach((button, index) => {
      button.setAttribute('aria-pressed', String(embodiment.value === corpusEmbodiments[index].key));
    });
    const group = taxonomy.value;
    const labels = new Set(domains.flatMap(d => Object.keys(data[d.key][group])));
    const categories = Array.from(labels, label => ({
      label: label === 'Unknown' ? 'Other' : label,
      values: domains.map(d => data[d.key][group][label] ?? 0)
    }));
    const total = item => item.values.reduce((a,b) => a+b, 0);
    categories.sort((a, b) => {
      if (a.label === 'Other') return 1;
      if (b.label === 'Other') return -1;
      return total(b) - total(a);
    });
    drawDistribution(document.querySelector('#corpus-operations'), categories, domains, group === 'operations');
    const unit = length.value;
    const lengths = lengthLabels[unit].map((label, index) => ({
      label, values: domains.map(d => data[d.key][unit][index])
    }));
    drawDistribution(document.querySelector('#corpus-lengths'), lengths, domains, false);
    const summary = domains.map(domain => {
      const record = data[domain.key];
      const line = document.createElement('span');
      const isFrames = unit === 'frameBins';
      const value = isFrames ? record.medianFrames : record.medianSeconds;
      line.textContent = domain.label + ' · median ' + decimal.format(value) + (isFrames ? ' frames' : ' s');
      return line;
    });
    document.querySelector('#corpus-length-summary').replaceChildren(...summary);
  }
  [embodiment, taxonomy, length].forEach(input => input.addEventListener('change', draw));
  draw();
}

startControlDemo().catch(error => {
  document.querySelector('#control-gallery').textContent = error.message;
});
startCorpusCharts().catch(error => {
  document.querySelector('#corpus-overview').textContent = error.message;
});
