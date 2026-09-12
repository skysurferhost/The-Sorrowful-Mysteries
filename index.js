/*
 * Copyright 2016 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

(function() {
  var Marzipano = window.Marzipano;
  var bowser = window.bowser;
  var screenfull = window.screenfull;
  var data = window.APP_DATA;

  // Grab elements from DOM.
  var panoElement = document.querySelector('#pano');
  var sceneNameElement = document.querySelector('#titleBar .sceneName');
  var sceneListElement = document.querySelector('#sceneList');
  var sceneElements = document.querySelectorAll('#sceneList .scene');
  var sceneListToggleElement = document.querySelector('#sceneListToggle');
  var autorotateToggleElement = document.querySelector('#autorotateToggle');
  var fullscreenToggleElement = document.querySelector('#fullscreenToggle');

  // SKY SURFER: discourage casual saving/copying of panorama imagery.
  document.addEventListener('contextmenu', function(event) { event.preventDefault(); }, { capture: true });
  document.addEventListener('dragstart', function(event) {
    var tag = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : '';
    if (tag === 'img' || tag === 'canvas' || tag === 'a') event.preventDefault();
  }, { capture: true });

  // Detect desktop or mobile mode.
  if (window.matchMedia) {
    var setMode = function() {
      if (mql.matches) {
        document.body.classList.remove('desktop');
        document.body.classList.add('mobile');
      } else {
        document.body.classList.remove('mobile');
        document.body.classList.add('desktop');
      }
    };
    var mql = matchMedia("(max-width: 500px), (max-height: 500px)");
    setMode();
    mql.addListener(setMode);
  } else {
    document.body.classList.add('desktop');
  }

  // Detect whether we are on a touch device.
  document.body.classList.add('no-touch');
  window.addEventListener('touchstart', function() {
    document.body.classList.remove('no-touch');
    document.body.classList.add('touch');
  });

  // Use tooltip fallback mode on IE < 11.
  if (bowser.msie && parseFloat(bowser.version) < 11) {
    document.body.classList.add('tooltip-fallback');
  }

  // Viewer options.
  var viewerOpts = {
    controls: {
      mouseViewMode: data.settings.mouseViewMode
    }
  };

  // Initialize viewer.
  var viewer = new Marzipano.Viewer(panoElement, viewerOpts);

  // Create scenes.
  var scenes = data.scenes.map(function(data) {
    var urlPrefix = "tiles";
    var source = Marzipano.ImageUrlSource.fromString(
      urlPrefix + "/" + data.id + "/{z}/{f}/{y}/{x}.jpg",
      { cubeMapPreviewUrl: urlPrefix + "/" + data.id + "/preview.jpg" });
    var geometry = new Marzipano.CubeGeometry(data.levels);

    var limiter = Marzipano.RectilinearView.limit.traditional((data.faceSize) * 2.5, 100*Math.PI/180, 120*Math.PI/180);
    var view = new Marzipano.RectilinearView(data.initialViewParameters, limiter);

    var scene = viewer.createScene({
      source: source,
      geometry: geometry,
      view: view,
      pinFirstLevel: true
    });

    // Create link hotspots.
    data.linkHotspots.forEach(function(hotspot) {
      var element = createLinkHotspotElement(hotspot);
      scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

    // Create info hotspots.
    data.infoHotspots.forEach(function(hotspot) {
      var element = createInfoHotspotElement(hotspot);
      scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

    return {
      data: data,
      scene: scene,
      view: view
    };
  });

  // Set up autorotate, if enabled.
  var autorotate = Marzipano.autorotate({
    yawSpeed: 0.03,
    targetPitch: 0,
    targetFov: Math.PI/2
  });
  if (data.settings.autorotateEnabled) {
    autorotateToggleElement.classList.add('enabled');
  }

  // Set handler for autorotate toggle.
  autorotateToggleElement.addEventListener('click', toggleAutorotate);

  // SKY_SURFER_SPACEBAR_AUTOROTATE_V1
  document.addEventListener('keydown', function(event) {
    if (!event || event.repeat || event.defaultPrevented) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    var isSpace = event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar';
    if (!isSpace) return;

    var target = event.target;
    if (target) {
      var tagName = String(target.tagName || '').toUpperCase();
      if (target.isContentEditable ||
          tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' ||
          tagName === 'BUTTON' || tagName === 'A') {
        return;
      }
    }

    event.preventDefault();
    toggleAutorotate();
  });

  // Set up fullscreen mode, if supported.
  if (screenfull.enabled && data.settings.fullscreenButton) {
    document.body.classList.add('fullscreen-enabled');
    fullscreenToggleElement.addEventListener('click', function() {
      screenfull.toggle();
    });
    screenfull.on('change', function() {
      if (screenfull.isFullscreen) {
        fullscreenToggleElement.classList.add('enabled');
      } else {
        fullscreenToggleElement.classList.remove('enabled');
      }
    });
  } else {
    document.body.classList.add('fullscreen-disabled');
  }

  // Set handler for scene list toggle.
  sceneListToggleElement.addEventListener('click', toggleSceneList);

  // SKY SURFER: start with the scene list closed.
  hideSceneList();

  // Set handler for scene switch.
  scenes.forEach(function(scene) {
    var el = document.querySelector('#sceneList .scene[data-id="' + scene.data.id + '"]');
    el.addEventListener('click', function() {
      switchScene(scene);
      // On mobile, hide scene list after selecting a scene.
      if (document.body.classList.contains('mobile')) {
        hideSceneList();
      }
    });
  });

  // DOM elements for view controls.
  var viewUpElement = document.querySelector('#viewUp');
  var viewDownElement = document.querySelector('#viewDown');
  var viewLeftElement = document.querySelector('#viewLeft');
  var viewRightElement = document.querySelector('#viewRight');
  var viewInElement = document.querySelector('#viewIn');
  var viewOutElement = document.querySelector('#viewOut');

  // Dynamic parameters for controls.
  var velocity = 0.7;
  var friction = 3;

  // Associate view controls with elements.
  var controls = viewer.controls();
  controls.registerMethod('upElement',    new Marzipano.ElementPressControlMethod(viewUpElement,     'y', -velocity, friction), true);
  controls.registerMethod('downElement',  new Marzipano.ElementPressControlMethod(viewDownElement,   'y',  velocity, friction), true);
  controls.registerMethod('leftElement',  new Marzipano.ElementPressControlMethod(viewLeftElement,   'x', -velocity, friction), true);
  controls.registerMethod('rightElement', new Marzipano.ElementPressControlMethod(viewRightElement,  'x',  velocity, friction), true);
  controls.registerMethod('inElement',    new Marzipano.ElementPressControlMethod(viewInElement,  'zoom', -velocity, friction), true);
  controls.registerMethod('outElement',   new Marzipano.ElementPressControlMethod(viewOutElement, 'zoom',  velocity, friction), true);

  function sanitize(s) {
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;');
  }

  function switchScene(scene) {
    stopAutorotate();
    scene.view.setParameters(scene.data.initialViewParameters);
    scene.scene.switchTo();
    startAutorotate();
    updateSceneName(scene);
    updateSceneList(scene);
  }

  function updateSceneName(scene) {
    sceneNameElement.innerHTML = sanitize(scene.data.name);
  }

  function updateSceneList(scene) {
    for (var i = 0; i < sceneElements.length; i++) {
      var el = sceneElements[i];
      if (el.getAttribute('data-id') === scene.data.id) {
        el.classList.add('current');
      } else {
        el.classList.remove('current');
      }
    }
  }

  function showSceneList() {
    sceneListElement.classList.add('enabled');
    sceneListToggleElement.classList.add('enabled');
  }

  function hideSceneList() {
    sceneListElement.classList.remove('enabled');
    sceneListToggleElement.classList.remove('enabled');
  }

  function toggleSceneList() {
    sceneListElement.classList.toggle('enabled');
    sceneListToggleElement.classList.toggle('enabled');
  }

  function startAutorotate() {
    if (!autorotateToggleElement.classList.contains('enabled')) {
      return;
    }
    viewer.startMovement(autorotate);
    viewer.setIdleMovement(3000, autorotate);
  }

  function stopAutorotate() {
    viewer.stopMovement();
    viewer.setIdleMovement(Infinity);
  }

  function toggleAutorotate() {
    if (autorotateToggleElement.classList.contains('enabled')) {
      autorotateToggleElement.classList.remove('enabled');
      stopAutorotate();
    } else {
      autorotateToggleElement.classList.add('enabled');
      startAutorotate();
    }
  }

  // SKY_SURFER_TOOLS_BUILD_V8_4
  // SKY_SURFER_PREVIEW_ENHANCER_V33
  // SKY_SURFER_PROJECT_COMPATIBILITY=ST_MATTHEW_HARD_RESET
  // SKY_SURFER_SPECIAL_PREVIEW_MODE=OFF
  // Touch behavior: tap away from a link hotspot to close any open destination preview.
  document.addEventListener('click', function() {
    var openPreviews = document.querySelectorAll('.link-hotspot.preview-visible');
    for (var i = 0; i < openPreviews.length; i++) {
      openPreviews[i].classList.remove('preview-visible');
    }
  });

  // SKY SURFER v7.6: deterministic idle UI monitor.
  var ssNavIdleDelay = 3000;
  var ssNavLastActivityAt = Date.now();
  var ssNavIdleState = false;
  var ssNavLastPointerX = null;
  var ssNavLastPointerY = null;
  var ssNavMoveAccumulator = 0;

  function ssNavApplyIdleState(isIdle) {
    if (!document.body) return;
    ssNavIdleState = !!isIdle;
    document.body.classList.toggle('ss-nav-hotspots-idle', ssNavIdleState);
    // Desktop previews are class-driven by verified physical mouse movement; the class is cleared below when needed.
  }

  function ssNavRecordActivity() {
    ssNavLastActivityAt = Date.now();
    ssNavMoveAccumulator = 0;
    if (ssNavIdleState) ssNavApplyIdleState(false);
  }

  function ssNavPointerPoint(event) {
    if (!event) return null;
    if (event.touches && event.touches.length) {
      return { x:Number(event.touches[0].clientX), y:Number(event.touches[0].clientY) };
    }
    if (event.changedTouches && event.changedTouches.length) {
      return { x:Number(event.changedTouches[0].clientX), y:Number(event.changedTouches[0].clientY) };
    }
    if (typeof event.clientX === 'number' && typeof event.clientY === 'number') {
      return { x:Number(event.clientX), y:Number(event.clientY) };
    }
    return null;
  }

  function ssNavHandleMove(event) {
    if (!event || event.isTrusted === false) return;

    var dx = 0;
    var dy = 0;
    if (typeof event.movementX === 'number' && typeof event.movementY === 'number') {
      dx = event.movementX;
      dy = event.movementY;
    }

    var point = ssNavPointerPoint(event);
    if ((!dx && !dy) && point && Number.isFinite(point.x) && Number.isFinite(point.y) &&
        ssNavLastPointerX !== null && ssNavLastPointerY !== null) {
      dx = point.x - ssNavLastPointerX;
      dy = point.y - ssNavLastPointerY;
    }

    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
      ssNavLastPointerX = point.x;
      ssNavLastPointerY = point.y;
    }

    var distance = Math.hypot(dx, dy);
    if (!Number.isFinite(distance) || distance <= 0) return;

    // Require a few pixels of accumulated physical pointer motion. This ignores
    // stationary-cursor target changes and tiny rendering/layout jitter.
    ssNavMoveAccumulator += distance;
    if (ssNavMoveAccumulator >= 3) ssNavRecordActivity();
  }

  function ssNavHandleImmediateActivity(event) {
    if (event && event.isTrusted === false) return;
    var point = ssNavPointerPoint(event);
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
      ssNavLastPointerX = point.x;
      ssNavLastPointerY = point.y;
    }
    ssNavRecordActivity();
  }

  function ssNavMarkIdleElement(element) {
    if (!element || !element.classList) return;
    // Keep an opened information panel readable, but allow an opened scene list
    // to fade with the rest of the tour controls during the idle presentation state.
    if (element.classList.contains('info-hotspot') ||
        element.classList.contains('info-hotspot-modal')) return;
    element.classList.add('ss-idle-ui');
  }

  function ssNavCollectIdleElements(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var selectors = [
      '.link-hotspot',
      '#titleBar',
      '#sceneList',
      '#sceneListToggle',
      '#autorotateToggle',
      '#fullscreenToggle',
      '.viewControlButton',
      '#viewUp', '#viewDown', '#viewLeft', '#viewRight', '#viewIn', '#viewOut',
      '.ss-audio-player',
      '#player.player',
      '.player#player'
    ];

    if (root && root.matches) {
      for (var r = 0; r < selectors.length; r++) {
        try {
          if (root.matches(selectors[r])) ssNavMarkIdleElement(root);
        } catch (_) {}
      }
    }

    for (var i = 0; i < selectors.length; i++) {
      var found;
      try { found = scope.querySelectorAll(selectors[i]); }
      catch (_) { found = []; }
      for (var j = 0; j < found.length; j++) ssNavMarkIdleElement(found[j]);
    }
  }

  ssNavCollectIdleElements(document);

  if (window.MutationObserver && document.documentElement) {
    var ssNavObserver = new MutationObserver(function(records) {
      for (var i = 0; i < records.length; i++) {
        for (var j = 0; j < records[i].addedNodes.length; j++) {
          var node = records[i].addedNodes[j];
          if (node && node.nodeType === 1) ssNavCollectIdleElements(node);
        }
      }
    });
    ssNavObserver.observe(document.documentElement, { childList:true, subtree:true });
  }

  var ssNavPassiveOptions = { capture:true, passive:true };
  var ssNavActiveOptions = { capture:true };

  if (window.PointerEvent) {
    document.addEventListener('pointermove', ssNavHandleMove, ssNavPassiveOptions);
    document.addEventListener('pointerdown', ssNavHandleImmediateActivity, ssNavPassiveOptions);
  } else {
    document.addEventListener('mousemove', ssNavHandleMove, ssNavPassiveOptions);
    document.addEventListener('mousedown', ssNavHandleImmediateActivity, ssNavPassiveOptions);
    document.addEventListener('touchstart', ssNavHandleImmediateActivity, ssNavPassiveOptions);
    document.addEventListener('touchmove', ssNavHandleMove, ssNavPassiveOptions);
  }

  document.addEventListener('wheel', ssNavHandleImmediateActivity, ssNavPassiveOptions);
  document.addEventListener('click', ssNavHandleImmediateActivity, ssNavPassiveOptions);
  document.addEventListener('keydown', ssNavHandleImmediateActivity, ssNavActiveOptions);
  document.addEventListener('gesturestart', ssNavHandleImmediateActivity, ssNavPassiveOptions);
  document.addEventListener('gesturechange', ssNavHandleImmediateActivity, ssNavPassiveOptions);

  // Do not treat resize, orientation, focus, visibility, or autorotation as visitor
  // interaction. Only actual user input should keep the controls awake.
  window.setInterval(function() {
    var shouldBeIdle = (Date.now() - ssNavLastActivityAt) >= ssNavIdleDelay;
    if (shouldBeIdle !== ssNavIdleState) ssNavApplyIdleState(shouldBeIdle);
  }, 200);

  function createLinkHotspotElement(hotspot) {
    // SKY SURFER: clean normalized link hotspot baseline.
    // Legacy/custom tooltip behavior has been intentionally removed.
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot');
    wrapper.classList.add('link-hotspot');

    var icon = document.createElement('img');
    icon.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyRpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoTWFjaW50b3NoKSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDo5RTQ2MTQzOEU3NDYxMUU0QTU3Mjk4OUYzQUY1MjE2OCIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDo5RTQ2MTQzOUU3NDYxMUU0QTU3Mjk4OUYzQUY1MjE2OCI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjlFNDYxNDM2RTc0NjExRTRBNTcyOTg5RjNBRjUyMTY4IiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjlFNDYxNDM3RTc0NjExRTRBNTcyOTg5RjNBRjUyMTY4Ii8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+8SI5tAAAPjRJREFUeNrsnQdYE8nbwDcJIAgIKh0BEUEEAQXFQlfBE8WG7a9nR8/uYT87tlPvhLN7Kip6epZDz4ZKEUUQQSxUKWKhSFVBgiAl+XY45Athd2c2BYJknmefhCTszs68v33LlJfBkpHBpEVapIW4MKVNIC3SIgVEWqRFCoi0SIsUEGmRFikg0iItUkCkRVokvkhjvC1bGIi/40qbSgpIWxN6cZ1TCpMUkFYBAkPEIHERv2dIwZECIklAMIT4TJjrcwm+59IARwqMFJBmAYKB+J2oNQiDAgKuAJpGCowUEIGgQAEC9n8MIeEgE2IuifbgBYUhADBSWKSAIEOBAgSD4ntRmltcyGdciLaBASOFRQoILSioQEGBgoEAnaCAwMDgUnzHoNA+UljaMCCo/gOD4pUhwG9EAQkXwdTiUoDB/xsGDYGn4+NIAflOwaALBYMGOCg+CIrTTAQGDATe9/xg8H/GILkGo62CIiMFo4kAw4SfQfEZqrYRlQaBaQ4ySKggwiCmV5sCRaaNgYGqJciAYEAgIQKGDEJUp53K7+BSaBMqOIgOBglobRoUGSkYlBqBIQAkMF9EEC2C4pzDTCs6BxFkbdJHkZGC0egzJt9nTCFgoeOwYwgCRtcxF+bg8GmPNguKzHcGB0ooFvVgQiBhIgCHqkmE8UFgcGA8Qk8FA4fE3CLTMBiiM8+VAiK5WoMOGEyaf9MxtWBwoE4wRHHUyUBhEoDB+zmD5HtBQfkutInMdwCHKMFgUnwG+38qZ1/YSBbKoCCZViETdCYBKByezxg0QUEZcORKAWk5rUEGCpmpxA8BEwINCiyCahAUH0RQDcIkMauIzCkGHyxUoHz7jkNgYn032qTFAamprkarqKysMFqDiQAGk4YWYUKuV/e5upoaa9QId31LS0s9PX19HS0tbV1VVVUtBQUFlXby8h3bKyqqyLBY7fF7aycjIyPbqF1qaqrxtvlaU1v75Ut5eenXyspPFRUVpSUlJfmFhYW5796+eZ+QkJB9/VZQVlFxcS3EQcdIzCoOwXsOj2BTgcLg+38UR74BFPzeuPX9KtlP5JbeWREFEAo4UEwpMhOKKSQkjY6OqqrMOTNmmDo6OVnpGxiYq6mrG+OHIS74cmJtv5qaquKiojf4kZH17l1KZGTki1NnzqTxQEMVqeJ/T/RK9h7VVyELJoC+50oBEQIQPjAwDD7mwIAIOj8UMGDItEfdNZcuWmQywt3dvruxSX+dLjqWsrJyCpLQqdXVVRX57/MS09PSHt8OCoo6fOxYelV1NVG0ikjYqeDgIACFMqbChQQjpIDAAKFpUjEpAKF6j6pJvmkJ1vq1a/sNGTpkmKFRd0clJSW11mBHs9ns4jeZryKDg0Pu7NqzJ/ZTSUktCSQwOOhoFt6/qULSEg2JRAIihEnFhGgLKjBI4Vi3erXFOE/PMcYmJoMVlZQ6tuLQOFbOZn/KSE+/dyUw8N+de/YkIkBCBgqVVuEIYnJJIiQSBwgEDqIIFYrWQDkana+ftXWHjRs2eNj2tx2npqHZHfsOS3FhQWZsTGzgtu3bbzx59uwzCSyoB6qfAjO5uFJASAChAQcKGKz690SvpNpjkqenrre3949W1n3GSIpP0Rw+S/yz59f8/PzOXgwMzIVokW/mGdErKiitBhKJAQQRDibEpOI/WKiaY76Xl9HipUvm4Q63q4yMTJvccbKmpobz+tWr0P379v159MSJTBqapBZRq/BPb5F4SCQCEAI46PoaRGAwUACZPmWK/spVq+aZ9eo1AhPPpm+UpbKioqK2tramqqqqnPdzOTk5RRaLJSOvoNASWoz7Mjn59m979hw9c/58FiIgXAFAofJNJAIShgRkmBIUDl5IWAjao5GpNdDWVtXP13dBbxubieLUGJ8+fswvKMh/VVRQlJNfkP/+zes3eekZaYVZWdklKS9TP+cXFlAOBGlpaMqa9TTtoK+vp2pi3EPDsJuhtpamlo66pnoXTU2t7h07ddISp0ZJePHi0vLl3kcjox9/IjGpqDRJLUUkrFVA0tKAoMLBpACECAgWmTYBodpT/v4TXQYPXqiopNRBxBGisrzc3KT09PSEx48fJ16/eSMjKeVlOf/TWYRthvUy66k4aqSH8YABAyxMTEwstXV1e+H3pSzi+/ocfu/e4Vlz5lyqDxGTaY1aBLMLNsgoUZC0JCB04SAyq1iQ9420yJIFC3qs+eWXzVra2maiuon3ubkvk5OSou/evv342MmTqV8qKjgt2KGM9goKzHmzZ5sOGz58gHmvXgN1dHV7iurk+Xl5L/fs3u2z/9ChVBLNQQULl0CjSDwkLQWIoHBQaQ4WGSgGenryZwIC5vcfOHA6bk6xRABF6pOYmFB/f//woODgAgx9DpI425Hwe3c3N805c+a49OvffygOi6kIzK7a2MePz06bPv3Iu+zsSgowahE0icRD0hKAwKJVKHCwELRGnWn105w5xpt9fH7V0NQ0FtZ8SoiPv+vvf+LG6bN/ZWJoM25b+uHT6POZ0340mjPHy8PSymqYsGZYYUFBxtYtW9YdPXEinc/UqkWABhWSFo9uNTcg4oCDRQSMnKws65+LFye7/jDMW1ZWTuAJg8WFBdkhwSF/b9yy5e7bd+++YqKdRyTu/CCEy3q7Ghi027ZlyzBXN9f/qWlo6gmhTaqCb9/2Gz9p0oWq6moyIGpbMyQtBYgo4CAzrViW5uZKFy5c8DExNR0qhBmVEXj58qn1mzZFkvgVXDHBQCscK8T16/yVHVu32ntOmDALN78E1rCv0tJCJ06atDkhOZlNAUStCCFpNkBYTCazNcHBIoCj0TF72jTDgLNn/9TT17cR0HR463/8+G6PMWMOBN258666poYjhECKYscUsvUmGMlnyKDg98a9GxKSdfDQoevKCgqvunXr1h03vVTptlknNbVu48ePH/ypuCj2eXx8KYa+HSvdBwlDjA+bFtUgDIjgwJxxMigamVW/79plN3/hwt/kFRQU6VaQzWaX3rx27cSipUuvlX7+zBFQpTNo/i0qzSGodmskcCAEfuCPP0aNHD3aS0lJSYVupSorKsqPHj68auXatVEU5haRRqHSJhhGvhae+z0AggoHAyMf4KOCo+79xXPnxo4eN269jAztG+JGR0VdWbp06YnnCQllAtq7qPteiXtvXpHUvY+lpfL+/fu9BtrZjaNbTxDlun716o6JU6ZcITGtYJDUYk3HSloMkuYEhE4ol8wRJ9Qe4SGhix2cnbwEMad+27Vrt9/Bg4lCCpcgm2ALozlQ11VwhQHFe/Fii1Vr167R0NTsSreiD+8/OOHiOvQghRZBceBhIeBWD4ggcDBhfsa3z0GkKiI8fGXf/v2n0hW08LCw89Omz/DPLyyoEkKY6O7wLigoKECg7uxO6950tLXlAk6dmuMyZMgUumDHxcScd3Rx+a0+wtUqIREnIFSmFT8gLASHXIb3O9xelgm5e3d9b2trTzqVKv30qch3797tO3bvfiaAuqa7U2MTR9rUxESxX9++2t2NjNTV1TU6de7cSbk9XnC/SZ7Pnq/8gpcPHz6WFRUVfnyVmVn0JC4uLzU9vZwECNjGcXQEqknfrV+zxnr5ihUbVDp2VKfT3vHPn18Z6ua2/VNJSQ0fEDUkwJDN5YLtzcVtrYCQ+R1k00YIgeA9gOZ4FBkJ4BhPp0KZGRlPpk2b5hP79GmJgAJDZ6d3hqOdnfooDw9zCwsLUz19fSNtHW1D5Q4qKsI0atnn0tK893lvsrOyXicmJr68fuNGckRUVBEGXwsOW80HfSDY2tionj17drORsXE/upDg/sw2Hk1CBEUNhSbhnZ4Cewi0CkBQTCuUUC6hefU4MnIVXbMqLDj47ITJk098LiurFQAOpDCtXpcu8l6zZtk4OjrZ9jQztVHT0BTbTFveUow7Uy9TUuMiIh7Enjh16ml2Tk4lJrrNqRv1ZQdlZVbg5cteuMk1ja65NcDefg+FmUWlSahmAovV1BIHIDDTiswpJ/I5mmgRug452F/q5LFjOxcuWxaKkc/xoaMBGx3KSkoyPy9ZYusxatRgM3PzgfymUnMXYJqlJCfH3A4KCvPdty+29PPnaozetjxID7zD+w+4zp7rtY5O1JDHcSfSHigRLthAosghEScgdPwOJM1x8dy5cZ4TJ25GrQiYpr1j69Z1e/z84mmoYyJzqsmeWE72dhre3ss97Oztf+jYqVMnTALLp48fP0ZFRt7x8/O98SCyzgyDreyj1Tarvb2t1m/atJPOsoErly9vnThlSqAAmgTVHxEpIKIeSacyrWDhXKKjQYP8tnPnoOmzZ//KRKwwcMaXLl3685Hjx1NpCgD/0SiAMHHc2G7+x0/MX7Vm7XLTnj2tFFpmxR9SAXUz6dHDYuqPP44ZOXy43ueST7nJL1NLMfIReAaNPsaiHj8ueJ+d/djZ2dkedXDWuEcPe1Vl5aTg0NAcnvMJMhuaixByl2hAqEwrmPaQwfimj2zy8flTrl07ecQnZ/68eXN/vvjPP1kY9YQ3MnOwyZr1Ue7uemfPnFm2eNmyJTpduhgxm3GOjrAF1BWvczfPCRM8Rrq7dy3Mz3+TlpFRRhRlo2tGxycmlrxKT4saOtTVHudRCaUuvfv0cS54nxtePy2FDgitero7kfZg8kWtYNpDhh8WS3Nz5ZDQ0LOd1dS6ocIxdcqUhcFhYUWIcFBpO4aFmVkHX1/fGQ5OTqNEsZZEEgoY7X744MH1FStXnklISirFyFf48TvApLOx3YYMUT93/vwR3NzURKnDh+LiN65Dh/6YkJxcRmFe1WDwCY4Y1nS3FJHBJC5AYFErolAuPxwyIJz74tmz31Bn5QKzau5cr6VXrl3PoQkH/w7wda/7fX3dps2YPl/Y0KykFjbuo509ffroEm/vu1jT/bAwElhIIRk3elSX48dP7EcdKwGzgC379FlVH/6toYCjhgISsfoiojKxUDdaYJFAQqRFmIGXL08eaGc3HdUhBz4HhVnFJalrE9/IxdFR8+aN65uGjxg5Ebfq5LHvtMjJybXrZ2trN3HC+F4vk1MS3r579wWDz6YlgwR7mZZWlp+b+2Soq+tQcG7Y9cEs4D6WlqV/X7yYhJGnRhB0PQijNQBCtPMIi0prfHsPVgIuXrrkdxZeUEK5WzdtWk3hkHMR68ncvWOHy2++vjt1dHW7Ym2kqKmr64zz9Pyhs4pKQUhY2DuIgFFCAnwSTlVVkpOLixuKn2ZoZGRbXFDwIO7Zs48UAJBNrRF7vhFRmFgojjmLht8hY6CnpxAdHf0X6jLZY0eObl24dEmIEHAwNNTV5S6cP7fI0dllFNaGS8T98BuTp0w9WFhUVIXB50GRmltgnGTegvmbUK4Jlu8OHDjwx3fZ2RUUphbZvC06KxFbRIMIM1ouQ/T++r//LuppZobkd4SHhf01eerUS8JoDrsBA9Rv3ryxy6qPtT3WxotBV8MenuPG9n3+9GlsVnZOhaDm1q3bt1872NnJGXbrZgm7pqKSUud+NjaypwICYhCiV1zEsK9EhHnpOuZUqwLr3i9ZsMB0lpfXNhT1nJmRETfUze3Xr1VVHIonBoMqjDvJc5zh6TNnfNuSSQUrqriT7eHh4ZybnfUsKTmlhMLkooTk2rVrz8ePG2fRqXNnHdg1tXV0LD6XlETEPHnyAdHfEHQRm0QAgrLLYRMNAmbonjt/fn8HFRVoqBBErDw9Pb1fv31bQfGkoRyw9F68uPfeP/74XUVVVVWKRePSvn17xWHDhg2tqqhIjY6JyRfAJ2HgDy5u7OPHj8d7errCBhLBA9HKysr81KlTVysrK6n8jmZNxCMMIEShUirzCjqV5PzZM5Nt+vUbi3Bt7q87dqy7cPnyGxK1C4Vj7cqVttt27tguL8Ej4RIQ5ZJ1HuzixK2uyXgYFfWeJiR1n+fm5VW2k5F55ezi8gPsaa6krKxuZmr66cKlS0mIkSyxaxFRAYKiPShNrIG2th03bd7shxIefHDv3t9e8+ffoHiKUNZtzYoV/Xy2b98hKysrJ8UAIiAsloyDk5Mzp7o6rR4SVCFs6IOIyMh8J3t7ha6Ghhaw6+nq6lpGRjz4N+u/GckwX0TsWkRYQIhydtDZrqfh+OfixZ+7duvWFyHi8Xb4iBGby9jsWpJGooQDmFXbft0phYNGAeaPvaODQ0UZ+2W9uUX3IYqFhoXFT50yxRm2awp4QFpaWMof9/ePgmgPmBbhtqQPIqj2IFwtOH3KFIO58+dvx+sCuxmuz+bN64LDwvIgYTzC3VKAQw58DqlZJZgmGWRnZ/8289XjpJSXJXQfpOCBxq2pyXAdNgyaZkJdQ8Ms682b2/GJiaUIZhaqFhEIFEHHQahGoxkYfLxDhvfvF0+fbu9laTkSdlGw+4iDs7MvwtOjSZ1AKPfK1asHO6upaUjFXfDyobi4cLznuMUPH0V/m+vGv06D0tp4eP/+ioF2dlA/82VycpBF797rsMbjITUYfHyELOuuQOaXMCEs2EZmsJyBdb8DmZ1wOEbALlbOZpcuXbbsBMKNNlkBCAYBA84EbJHCIXwBbXjq9Gkf0KYY8WpLjMrkwfvwOJgWBLtOT3Pz4UA2MIoZ1hhJNmKMPEMZ1hyAMCCfk+UYJ8w+C9KeodzAjWvXTjyPj/+MYFo1aVAwQt7VsJuZVLxFU/C27Im36WKiBx5JXzb0GehDvC+Po8gZDtNPGDw9N/97kUazRDERC2WrTMIbBAkzQU5ABMf83ZKff76OYGM2OXbv2OHc1qePiKPgbeoB2haDb4/apM9AX4I+hV2jW/fuQ4GMUMkQhr5Na7NpEAxD33OW0rzy9vaeipL+7OLffx+rz2yEOouzYVbuTwsXekvFWTwFtC1oY75+hRUu6MvLFy+cgP0QyAYuI9MQzSyGOMwsuk461bQNXuecbJZuw2s/a2uViMiHwbBUy2CXdSNj49nV1dUcuqZVUkL8btOeZn2loiy+kvoyJa6XpdUajHyNBmFfycrKMjIzMk7CdpUHKaod7R3cnjx7VsrjmNeQOOq8B5eiPsjOuiicdIwgooXBzKyNGzZ4oOQhBykIcDi4NOpTd+z39XWVwiH+AtoYLCyjadpwQZ/ifXsadn4gI0BWEMwrWOBIMCEXQINQjX1QrS1vFNp9n5NzGTadvbiwIKdbd+MpXyoqahG1R11WKQszM5WIhxEB3+tKQEkrYGd8Bzu7GYkpKd+W79YiaBGsvYIC6/WrjPNqGppdIHKQqaXbxRNDD/nWYmirDsXupKPms2hE/LrVqy1Q1nqEhoReqE9eg2pa1b36+vpOl8LRfAWkSgDr9ime8IQF9C3exxdh58cBMgIyQyVT4nLUmTRhgP2NBMk4T88xsItVVlSwN2zefJuGY153jHJ37+Lg5DRaKrbNW8CmFqDtEQWzwRfY7ONzu5zNLoedv15myOBgQqAQOE+LMFEsDKMX2q07QJIWYxOTwbALPH/27FtOQFraa8PGjTO/l91HWlMBbQ7anu5TPPPNm8qE+Pg7sPMDmQGyI6AWoQWFMICQ3SyyqbV+7dp+ikpKHWEX8vc/cR0h6tDo/BPHjTW07tvXWSquLVNA24M+QISjoW8DTp++ATs3kJm1q1fbCmBaCeWwi2IchI4PgrkMHjwMdvL3ubnp9amWUUBtuM7y5SsmYc2Yv05amvYLTx8gT0M5cfr0K9DnsJO7ubn+wHM+utpDrBqEQRMU0sobGRtD130/e/o0DKO5VajDoEHqvW1sXKQy2rIF9AHoC5q+CPbi2bN7sHMbGnW3l5OVZdKVOQqrRywaBDWJTBOKly5aZKKkpASdMHjszz9D6WqvFStWjBIgP6G0iN4XkQF9QdMX4R4/fjwMIVqmtnDePBM6Mieocy5oFItBYeYQfdaI6hHu7lDtgavatKDg4AI6dQIpCOzs7YdJxVMyCugL0Cd0TJsbt2/ngb6H/W64u7sdmfmOIJO0zS1BNQhVrm5Sqrsbm/SHnTw5KSkao96hpMkB8nN07NSpc2sWKlw43qckJcXjR0J+Xl5Ba74X0BegTxC1CJev7ymLSY8eAzDhcsqLNYpF11Fv+F1HVVWmThcd6B5JIcF3H9M19UaMGDG4NQpS2edS9uULF87ZDxo4Q79r158s+/TZgB/ru+jre7k4Oc2+Ghh4uZzNrmiN94b3iTNGL8TKRel7LR1tC3U1NRZGPcVEZIOFgoR5UZ32Rr+fM2OGKWzuFS4MbP/TASkIgYJGac96WVoObG0C9DI5+bn78OEL/jdt2rnHT+IK8Y+qeY+Hjx7lTZg8+dTYMWMWZmZkpLS2+8P7xA70DcXTvEkBfQ8GiKnOC2Ro1vTpPTC0RKp0ZFdgQGCbGTNQCHZ0crKCXSgvNzep9PNnlKklDe+9Zs2ybum0Z3TLg3v3bgyyt18XHfukgB8M/uPegwe5Dk5Oq6KjosJa0z2CPsEfin0wtHBrXV+Dvs/JykqGndve3r43gmOOoj0YogCE8gmOGN3C9A0MzGEXSE9PT8Bo5vJ2cHRoNTN2a2pquH8FBBweMmzY/jI2uwoGx7ejsKio0sHZeVfgpUunWhMkjs5O/eiaWRkZGQmwH+GyZIYicwiyKjITi+rkSBpETV29O+wiMTExiYikN5zXzMysX2sQFtx0qNi5bduGmV5e//AIfw0CIA2/mTR16tnfd+3aWl1d9bU13HN939BK90YhAw0FlyVjGtYLqhyL1AehE1LDgIOO3xQ0Q9SNW7cyEM25uuIwaKCamoamtqQLyofi4qJFCxb8vHXnzijs/6dq1/AAQHU0+s3ajRvDlyxc5I07+B8l/b5B34A+gjzNG5VbQUHpCIAY1jvqGMRRx4TRHsJEsVA1St3f40aPMpCRkaHcqO3Tx48FCUlJbDoRtNGjRveSdCHJzc7OmDB+/IKAc+dSEWBAOapPnD6dPGH8hAX4uTMl/f5HjvToRSeS9DwhgQ1kgeo3QJZGjXDXh5hWmDBgCAMIqonVUCwtLfVgJy0qLMzkd9ogN82wsLAwlWThSEpIiHR2cVkSERVVKCI4Go7Q8PC8oa6uS1IQxg5asvS2sjLFaI5sfygqgoLPI1N0olliH0lH+btJRfX09aHb3xcVFWXTBRU/r5GkCsa9kJBLg+ztN715966cRMjJVsdRrZprdGRkZpbZOzqux691WVLbQVeviyGqg/7tTUFhIVQWDLoa6iA66RjWAutBMDoV0tLShgLyHi+I/kfDk0FbR7urBEaqagNOntzr5u5+6EtFRRUEAN6loWRLRmupAPpcVlaFX+sgfk1fcG2JA0RX15CqD4lKfl4edP9fDQ0NXZoPbIGKqHN9E1ZSVVUV6khnZWXlYTTWCpuamCgqd1CRqLweYGXcti1b1sz56adrBIJNtlUmWXpjDslvic5bg1/z362bN68Gg62S1CZ4H3UEfUXjX7hv373Lhf0IlyktYbWDOH0QBg21xmjXTr4D7KQZ6emFdK5v3bu3loRFqvLneXkt2rF7dywGz63Hu48slwKQb9/z/x+RxqnduWfPk3lecxYVFxa8l6S2qe8rZEc981VGEew3CgoKKggmltB7Y9EdB0FRY00qotBeAfqkx58apXT8nh49ekjMPrtv37xOHuXhseBiYGAmRm+vJqqdNzgkv+VSaKWai4FXXo8c6bHgTearRElpHyMjI3U6/sDrN2+hu8e3k5fvKKCJRcv0EvVepoSVaa+oCF1im5aRUUrnOurqGp0kofNfPH0a7uIy2DsmLq4YYk5xKWDAED+jMsMarhn3/PlHe0en5XFPngRLhB+io9ORjiyhyAIuU6oiMrEYzemDEBYZFqs91ffV1VWV2Tk5VXTO2blzJ+WW7vi7QUF/DXRw2Jqdm1sBMad4hRvD0PYWJovycAiAaWJ2FRQWVg4YNGjn1cBA/5ZuJxVVVVpbMAFZADIBkSkFUUSpmtNJJ62kDCSbU21NbQ3di+EqtsWS4NTg5cjBg7+OGD36RHV1dQ0iHChrXDCIzcx7Dg4BJE0c+QmTJ5/du2ePT0tOT1FQkKc9mbTqaxVlRA6XqWaZoMoUAxhNbwYyil5RUfGF7kUVFRVbBBA2m132y6pVK5d4e9/FiEOztRBTikhbEO1zTBUWpTK9eOtSB8ma9etbdHqKopJye9oPoerqLxCZkqHzkJYEDSJMJTlYKyiFBQU506dOXex38GA8BRxk21xS5muHHGSRQxgoDcCcOH06Zbyn56LWMD2lTiC43FoBZE0iNUibKK/S0hJGuLsvvR4UlIWRj12QpSIjSlmHkiKbDBQi4eBAnHlO2P0H+UOGDvVOSkh4LO3RlgNEkLS8Eg1qdFRUiKOLy9rnCQklBE9o2ObI/FCwyMC4FxLsFXLnzmwKUFgksBCZXkQmF+fV69dsByenLXdv374i0YLJYLAEkDWJBARaSdynraJ24hRo26jl5eXNslb78oULAQ7OznsLi4qqMOJxDKJkkRjEnOLd7V5GW0ur3fO4Jz6Ozi4rXIYMWQXeg894f0OgURgIkBCaX2Vsds2IUaP+PHbk6IHmmJ5Szi6j7WPiTnh7WKBERA/nZntyk1YOd7goAWHJsGjvZ/W1slKsgOBVrt21Y8ee/02bdhGDj3RjFE44pSnVt08f1YcRD45YWPX2/PbP4D34zNbGpiOC6UXmxGMY9aAjd+HSJbfXrVntU85mV4qzLSsqKmmfX66dnAzEia9sjgdks5g2NbW1lE8QWVk5eb0uXeTonPPDh49l4qzznl93+W7YsiWCwLYnGsjDIFEp/pwpdceEsWP1bwUFBXQ17GbLf33w2Y2bN09PHDfWgECTsEjMLX5YuCSwNLz33X/g2cYNG34Fy4HF1ZalJSV0BoExIAu4TLSDyFSFODUHKiB0L0RY0S/l5Z9g/9jD2JjOYBK3qKhQbCHL8LCw0M3btkUSCBWGwbPsMimc8IYUdKuXL+9z/OTJ053V1LqS1QN8d9z/5OlfVq2ywZqmsaPyTcj6hWgchbv/0KEXd4KCboqrPXPfv/9ER5ZQZAGXqRIRwcEVhQbhQirDJbCB/1/FfqmAzq3pZthVlY7ZlpaWViiOzgRPUh+fLZcwmnsDE2gOsmxbMof37fvBZ/u2Q0pKStA5aopKSiqbt249eOzw4REkkMA0CVKeDh8fnyvArBRHm2ZmZhbRedqTyAK/if0JUVZQPxeZiUWWEJG0Il+/VkITxxt1N1anc/1nL17ki6MzXyYnJUZGPy6GaAmYn0Hob8ji5cbVq3PmLVy4BTchZJEdVrzMnjt3491btxbI/jcrgUWiTahCw5RTWJ4nJJQmxie8EEeb1vcVauozBi4L0ImoFRUVpRQyyCXxxWibXqL2QQghKSkpgU6/1tfX18ZoDPykpqeXl30uLRF1Z6Ykp6SjdCICHI2iVZoaGgpRERGbho8cOUfQug1xc5sWG/3Ix0BfX5FAi/CDycSIE6uSlrTU1Feibk+8jz6BvqLzP10NDKAL7HCZyhe3/yEKQLgolczPz8uDnUgHL4haq+FJkPc+762oOzQnN7cQYkIxKfwMJoEzzupr3adTVOTDP6z79nUVtn4WVr1d7oWGHXAYNEgD4rgT5RSnNMFyc3I+iNz/yM19Q9WHREVLWxu61qewsDBXQBNLbIBwaVaooSGys7KgGgR/wuoRmDGU9cHPK/JpE8ymT1uytHJUo+ENQjth7FjDmzduHO1q2M1CVHU0MOxq+k9g4NEZU6caYyRZhElMLrIEm3XvZWRlRZ66Ljc75w1GbzNAflkgLO/evnmPYFoJHeUS1Aehero3+U1CQgJ0EX5ndXUjmmByExMTU0Xdod2MjLpg8JyLTBLBbPR+tbd33+MnTx5W09DUEXU9O6upaRw6cuSgz8aN9gR1IHPkWST3UnePJiYmeqKu54v4+FQagvtNFqCbDPLIFJW/IbT5JaiJxUUEpu7vK9euv4ONpnfs1Emzj6WlEp3rX79xI1nUHdrLwsIcoz9nqtH4Rl2kav+BEVt37tythBdxhU/lFRQU1qxbtz3A338CQR1YFD4K4SCjOX7zoq7jzZs3kug4yEAGcFnQgEQaq67fqpsTR0dzCGRqMYUEg4zeRr//VFLCKS4qeg07ufvw4cZ0omcRUVFFxYUFeaLsUCNjY8MpEyeakPgXMEjqIlW3rl2bN2/B/JXNkfEKvwRj6vTpC8NDQr2VlZTkKDQImSNfd8yeNs0cN91EqkFA3zx8FF1M0YdNysgRI3pAz1tU9KaouLgWEqmilElRA4KqMcjUHBe/KWiEpH///hZ0zbqUlJQ4UQvdL+vW/dhOrh2K9mikNQz09BSjHz7cOMzdfRLWzMXB2Wnko8jInaYmJir89SKoc6N766CsLLt67dppIo8IpqQ8oWnuMGxtbXshAJJB4fSjmlgiHwfhQp4ElA5T1rt3UHMIt4EtMXqbjHEfRjwUOSA9zc3Nzp89Mx0VDPyQ7d+3r3poSPBvvW1s7LEWKni9rYODg/1cBw/WJaijDFEQAeQ3v3zhgld3E5Puoq5PxP0HTzD0Ade6YmxsDE2yhMtSCorMIciqSADh0g2/En0e8eBBPOxC2rq6vVQ6dKCK2Te5xolTp55WVlSIfOLa6HHjPIKuX5+nqaEhD3HIZWb++KPZtWv/+hkadTfBWrjo6OrqXbp86Y91q1cPhEDCMjI0VAoLDvYe4uY2VNT1AH3iHxDwHCOfu9akgL7voq8P1SCRkZEvILKHZM6hgCKoD8JF9RO+veKNlVpdXUU5A1cRd2jnzJxhRkeDZefkVKYkJ4tlf1q34cPdnsTG+v3x++8/GBsZKfML2yRPT+P7YWE/Hz1+fLeahqY6JiFFuYNKh607dmyIi4nZvHThAhsNdXUFXqgH2vbTOH7kyNhHjx7tt3NwGCSOOiQlJDwCfUPnCT5n5kxzeQUFyk3mgAydOnMmjWb0CkV2iX08IdqAi3A0/A446u9z3ifgjiBlIk9Xt2EDfPcfSKQD643r1+9Z9+3rIqYnsubiZcvmzl+0aE5ebm4em80uZTAZTF284IKojElw6W1tbQOOnbt2V4EUDJWVlVXKHTp00NDUFHvC01u3boXTFEqGq5sbNMlr/vu8xHoHnQtx0JEGJcUR5uVCbDxSYF5lpMfATm7eq9dAjHxZKeF5/zhwIPbTx49i3ZAAt9WZegYGusA/Me1pZirpcPCFg+V09fR0QYSuOeDA++ID6BPIg7OJ/1Hf95QlPS3tMeLDmYtBJtGKw0mnE+blX3vAvRUUFInwxO4x4odhWnTqBFbIRUVG3sGkRSIK3hd3QZ/QEcrRI0dqg76Haqb/ZIh/pSQXUSZpgyLMSDrMBmyiWfYfOpSOmyjQaeo/zftpKF3Tzs/P9wbJMkxpacYC+gD0BaL2aNAic2bPHgI7Ny47xUePHcugI3N0nXJBAeHSEVaMfCMD7qv09IcItvNgDG0P1YbzPoiMKgLbgEpFtGUL6APQF4j2P4OvzylLZkZGZFV1NYeuzEGcdpFrEFQHnVAN3g8Ph+4Xi6taE6+ZM4wQzb3/Xz7qu/ci1gw7XUgLeb/U9wHV0uQmZd7sWcagz2EnDw0NvUNmvqMEiprDSaeiEQmUHbt2PSlns6FLcGfMnDUKQYs0Ov+lK1ffPIuLeyCV05YpoO1BH6CaVd9ep02fMRJ2biAzu/bsiaUBBtJqV3FqEBgYRFvigHBvbUZ6+j3YBfpYWw8zMjSUp6lFuNu3bTsliZmW2oDvUQvanu7TG/SxpZXVD7DzA5kBskPTrKLyR8QSxYL9jQIM90pg4L+wi8krKCj5bN48HINPPWl0netBQTkPHzy4LhXZ5i2gzUHb09Ue27duHa6opATNQFUvM2RgcDB609yRYWGw6E04ha2wI9uooMmCnvc5OZc1NDWpZu+C2aA53bobT/lSUVFLcWO8dalb72BhZqbyMCoqQElJSUUquuIvYPDU0cFhZkJSUgn2/wl+qCD5L2+MggLr9auM82oaml0gcpCppdvFE6NOcEqW4xG286XITSyUgUGyhDEN7+NiY6/CLgQabsfWrQ4QX4S3LnXnT0xJ+Xzm1KmjUtFtngLaGoejlKePYQ/ZulfQtzA4QImNiQ0k0RYcMlMeE9FAoSAaBMPIt+z/tsZAhkSTNLz2s7ZWiYh8GCwrK0eZxuB9bm6GkbHx7OrqatgTqYlGS0qI323a06yvVITFV1JfpjztZWm1muKJTdhXsrKyjMyMjJM6urqUVgSYe+Vo7+D25NmzUh5NUUOhOcjS3QnkjwizYIrMWcaoNMe3v/Eb/hz/7DlUi4AG/O3XX50IIIX5P5wli5fsZUtY1tfvzLRi4238O4Y+9tDQd7/v+tUFBgcouIxcA7IC8TvItoIVePxDFFEslPlXlAkr/fz8ztXU1EBzg0ycPHluR1VVFoa+VqTuGuEREQV/Hj7sJxVl8ZTjR474gTbm61eoFQL6csKkydDtj4Bs4DJyFkNLbIqy9EKsUSykKBKGFvKte70YGJj7KiM9BHYB3Jk3OPDHH6ME0CLcNevX34+4H35DKs6iLaBNV61bd18Q7XFw377RoE9h1wCyAWSESoYw9MmKWHMBwoV8zqFQg00c+IP7DxxDuRGP0aPn9rGy6oDosDd62kyeMvXg2zevU6RiLZqCt+VL0KY0/Y66V9CHI0eN8kKRs3rZgKWb4H8viOyKRYNQRQrIIllNGvToiROZSQkJt2AXU1RS6rB/3z4vCjjIfCIuyO0xa+bMLR+Kiwul4i1cAetK8LbczJMvBXU6R12f4X04F/Ql7Dovk5ODgGwgmlcoqbUFKiwmUyBG+KNZRNEk3u/4t8Fs9JsvbHbmCA+PSXhdKH0MPX19U3ZpaVx0TEwhBBRGfaM01DMrO6ci593bZ8N++GGonBz6vrjS8v+lnM3+snjRwpW37tzNxagTBxFFGLGVy5ZZzvLyWgHzJYHv8cuaNaviExM/YcQ5F3k/QwnxYs0NCBkcGEayax9Gvv0lE2+IspHDh6vqdOkC25eJYdW7t8Xff/99s4zN5iBA0qgkpbwsqar48tJ5sIszi8WSkYo8egFppLds3Ljp2MmTKRg8i28TmdDR1pY7dfr0b4oIO9q/ePbs4uKff74FAYMDqYdQ2/2IChCRaZHkpKTkSZMmeeJP93YQU0vV2spK7sxff8WRwMClekJFx8QW1H6tynB0dnZmCnHzbamANR7bfXw2796794kgcIDj38DA+eYWFtAdX3At9fnHqVOX5+TmVkDAQNUeQmkSUQGCUWgNMmgagYI3SJVtX5vKHqY9oY3Y1dCwV21VVfzDqKg8jDjtNBkkddeKfPTofc3Xr2kOTo4OUk0C1xwAjh27d8fQjBQ19P/GX37pO2P27JUYQpg++M4dv9/9/OIw8pTWHATtIbLCEvIhShZRItMiDCpYgkNCXk6fNs1BSVkZtkMIw7pPn7737927m5uXV0kTEuwbJBVlZSmD7OwcpD4Juc8BzKp6zcFFjFg1gmNAv76qBw4c3AvbrQSU/Ly8lGHDh2+rrKwk0xy1GNr0EpHM5BU1IAwBtEijxsQbhlFdWZk81NV1HMz8AQ3u7ORkcubMmZCvVVVcAlBhkNSZW28zXz12cnYe0L59e0UpEo2jVcAh5/E5uBj5tA1CX7SDsjIr6FbQLm1dXeimdGC6/JbNm5c9ePiwEOJvNJv2EAUgMCcZBkkTvyQ2Lu6j65Ah7fQNDKxhF+7UubOObd++smf/+uspSX2gkADHPSb60X1nZydz1Y4d1aVo1I1zpE6d8r9V9dEqmCNMGqi5ef36T9Z9+w5DuWZ0VFTAgsWLb1H4GzA4RK49RA0IGRCo/knD+cLv3Uv43+TJzrhDDt2ixrBbN0stdY2cW7dvv4ZASwpJVnbOlwsXLob2s7FWNehq2KMtwxEZEXHzB3d3n5dpaWUYfIyBFI7D+w+4jp84cQnKNQsLCjJGjhy5rvTz52qs6XR1oogVLD+9RGkQFC1CBgaTSKPgDcVhl5Y+dxvmNgZ3oqFJXaz69Lar+vLlRdTjxwUQ/4i0nuVfvnACzp6NUZSXz7K0srLB/RK5tgQG7m+wD+3bt2fqjBl/421RIwwcq729rZavXrUDJUoIUhmsXb16Ydj9+4UUUNSSwIGJU3uIAxCyhJFUwkqoUZ4+f/7JpndvNkpUC3TEgIEDHd5nZ0fHJyaWCAhJXQm9d+9tTHT0PVvbfl3V1NV12gIcYMr6jOnTf8H9jSSE0CklHDOn/dht567dvvLy8goo175z69bvK9eufYAAB5UGEVthiXAogAH5jqhRmRS/YV7999+UCZ6eRp3V1IxgFwfjJ87Ozvav0tOi6s0DVEi4PL7Kfzb4u3dfDh85GqrWsWN+T3NzC/zc8t8jGLjS+Ox/7Ng+jzFjjuL3zIY8nTHYQ27c6FFdDh485KesotIR5frpqamhg11d/Wo5HA6JafVtrINqfYfYtEfdjbFEl+OFyO9g8oAAS3pJmPTF0txcOTj47lk1Dc1uKJX49PFj/tQpUxYGh4UVYdS7WzAoNFmD6WdhZtbB19d3hoOT0yiQKuB7AANM5Xj44MG1FStXnuFZCUgVpYJaDW5DhqifO3/+CMgUhhgle+06dOi0hOTkMqzpYqea+rrUYNRjIN9A5mDwbFMtrkGonHKqJziZSVZ3FBQV1XwsKop1dXMbKfNfjnDKoqCgoOTu7u6UmZEeTaJJkKJbDQ5kUdHXs3/99STh+fNwY2Pjjto6OgYYjXTVEla4z+LiIpYtXbJ1/aZNIQWFhRWYYFPFm2iOU6cDDqLCUVlRUb7S2/unO6GhhQTmVC3EtOJAHnwig0PcgKB8h+S7gCT3HZWVU/v17/8DiuMHIHFzdXPKz819QuKTwCBpYlKkZWR8Pu7vH5GanPTQQF9fQUNLy6C1TFUBU0WePXkSvnLF8p0/r1x5LTU9vYREa2B04Zg+ZUq3Q4cP+6lC8gry1uXwwYPLd/v6JvDBQKYhUE0rifdBhHXYKQcSQ8LCcnBzp8jM3NwZpRJgIHGoq+sQTlVVMkl0C+qwEz2Nkl+mlpw4eTLq4YP7wZ07dapSV1fXxYFUkEQwwI73YSEhVxctXLBr4xafu3jdP2JNlyRgNGz3JtGqX/fs8UX1OUC5+s8/2+YtXBiMoQ0EUo2ak/WTSGERpQ+CIQo+Ua5xFoVP0uiz8JDQRQ7OTnNpPD2rTx47tnPhsmWhGL2tKFGmxzCUlZRkfl6yxNZj1KjBOLwDcTBb1KEHmZ1SkpNjbgcFhfnu2xdbP7Yg7NacTcxlMM4xe67XOjqJSh/ef3DCxXXoQazp9jw1BJ/VQiJYYpmc2ByAYBAHmEHitEMzyH6D6HFk5Mq+/fv/SKdC4WFhZz0nTDjxuaysluYTB3UuGUOvSxd5r1mzbBwdnWx7mpnaqGloajUHFMWFBQUvU1LjIiIexIKUdASZnWBQIMMBpo8EXr4812XIEFrtHxcTc36Avf0ePuGnOuhMLxGL9hAnIDBTi0mgSfjzeMuQQSMnK8t6FBm5vre19Xg6FcrMyHgybdo0n9inT0sEgAQGS5PPHO3s1Ed5eJhbWFiYGhgYdNPU1jJU7qCiKkyjln0uLc17n/cmOyvrdWJi4kuQKx6kw8bQM75yBbxvzNbGRvXs2bNbjIyNaW2l9OLZs8BB9vbbq6qrqWCoweATEzmQ+8JaIyBUT17e/bQYJGYWITAdVVVlQu7eXUcXktJPn4p89+7dvmP37qcUURA6mpEKliZROlMTE8W+1tZaxsbGuJ+vhd+GagfchWmv0L69PL+p9AUvHz58LCsqKvz4KjOz6ElcXB7uYJeTCDoXQXjogtFQ//Vr1lgvX7FigwrN+WoADtdhw3Z8KimpoQCCTHPA1nyIzbRqDkBQTS0GhalFBkuDJokID19B19wCjYmbXOdnzJrl/z4vr0oANc1ABAaDBChQw8WwNMcYIhC07w2sBAw4dWoOblJNoRveBmaVo4vLbzyag0OhQchMK9iUF7HBIa4oFp3QL52QcJPf13I42ImTJ6NdHJ1YBl272tCpE5jkOHXKFCdOVVXG49jYQox88iQt8GgKq7AH0ZQLQccFmkDtvXixRcCZM7/1srBwpNsmwCF3cHHmHSWHwcGRNDiaQ4PATC0MazrlnczcYpJpEvD+4rlzY0aPG7eBTlTlWwNHR0VdWbp06fHnCQlsAcwuqtAxA/F3dOAjqhMX8XdIde9jaam8f//+uQPt7MbSrScY57h25cqOSVOnXsWIB/9gWqMWI97Kp1lNq+bUIDDtwUU0PciEra6B/rlyJU1FUTGpj7W1M8qIO+959PT1zaZMnerRq2fPirB799K/fv2KCSjIDJoCL0i2VgwT3fb+jbQm2PHwxNGjY3bu2rXTqHv3PnThACPkYBCQZJyDjkklEXA0JyBUwk/nqcogaJyG84LBxPycnPCBAwfYtldU6kincmBCYi9Ly0GzZs4crKulVXTv/v3s/6wDgc0ucU5HEXbP2UbmFNhI+vdduxyOHDmyo//AgcMFmZwJ5laB6SP1I+QcEhBQR85R9rZqllR7zWFi0XHaqRx3JoXZ1ejV0txc6cKFC1tMTE1dBa0o2FU+8PLlU+s3bYr8UlHBEUEHMZoBEjrXZ7RXUGDu2LrV3nPChFkoG0mTFTArd/LkyZsTkpPZJDDA5lmhDgRymxOOlgREVJCQQVN3XLl8afLwESOW4xaXwIufigsLskOCQ/7euGXL3bfv3n0V8ZOMISYYKMHoamDQbtuWLcNc3Vz/p6ahqSfoiaurq6pC7tz1Gz9p0oX6SBUHUXsIA8d3DYi4ICH7jDnfy6v7pi1bdsGyWcFKOZtdlhAff9ff/8SN02f/ysTgexS3VCH192ZO+9FozhwvD0srq2GKSkrKwlwELJP12bz5lz/9/b/lLacCoVXC0VKAkEW2MARIGPwAUGiUhvcGenryZwIC5uH29UxRrOnAza/UJzExof7+/uFBwcEFCJ3GbWYYGr53d3PTnDNnjku//v2H4maUqbAXBLuPxERHn5k+Y8bRd9nZlQgwwCYjouyt22IPn5YCRFhImBQahAwWxpIFC0zX/PLLJi1tbXNR3QQOy8vkpKTou7dvPz528mQqib/SbG0K/Ip5s2ebDhs+fIB5r14DcSh6iurkYN+q3b/+6nPgyJE0DL6xG9l7bmuBo6UBEQQS2ERH6N8glOl//NiEIUNdF6HsMk7XDMvLzU1KT0+Pf/ToUdLNoFsZSSkvy8XQyQ3t1susp+JI9xHGgwYN6mViYmKpratrIaz5RHBfn8Pv3Ts8a86cS/WpmHmngaBAQRapkmg4JAEQOpCQ5UQkMrvIAGn4n4G2tqp+vr7ze9vYTBTnUlqwBLigIP9VUUFRTn5+Xu6bN2/z0zPSCrOysktSXqZ+zi8sqKb6fy0NTVmznqYd9PX1VE2Me2gYGnbV0tLS1lXXVO+iqanVvWOnTmKbMQyW5r54+vSS9/LlR6JjY/kz2MI2V+CfS4Wyp5VEwSERgNRUV2MysrLCQMKkoVX4D7AizmD5ihXzellaumOiybhFq1RWVFTU1tZWV1VVfeH9XE5Orj2LxZKVb5nFWFyQs8V3795jZ86fz8LgC5rIoBE0XZqkBDwkAxBQCCDhBwTDiPfRQol2kQLCE+0yWrx0ybzuxiauuEZpk7u+A40B0p6BzE71yWs4JBqAg6A9qMAg2zVFouCQKEBoQEK4ZSmB0LMIHHpec4xBBMvEcWN1li9f8aOVdZ8xsrJy7dsCGCDVMsg4DJKq1ucEJMsIxq8tiEwuKiecg5GPkEscHBIHCE1IiLYVomN+MSn+j9HP2rrDxg0bPPra2o7R0NQ0+R7BAGMZcbGxV7dt336jPtUyWfo8lAMFjFYFh0QCAoGEyi8hgoNBAwyi/6s777rVqy3GeXqONjYxGaKoRG+Ol6SVcjb7U0Z6+r0rgYH/7tyzJxGDJFlFhIUrhK8hsXBILCA0ICEyuWBjJwwEDcIkOi8IEa9fu7afs4uLW3cTEwclJSWN1gAFm80ufJWe/vB+eHjwjl27ntSHarkIcHARNQXZmAYHQ1sjI5FwSDQgBJCgmFwMCgGHaQ1CU4sEvrprLl20yGSEu7s97tj31+miY4n7LBKx/Q/wKd7nvE/AHe6YW0FBkfsPHUrHiNN0E5lCKNmJYa+wGbktMjP3uwNEBCYXqkNPpjko8yryaRfmnBkzTB2dnKz0DQzM1NTVjTurde4mzERJRBiqPhR/eF1cVJSR9e5dSsSDB/H+AQGpuJaAbbQGy2GPqilQNnQjhAPvey7etxKtfVsFIAKYXCiQCAMHE0PInAWgGevhod/H2lpPt4uurpaWtraqqqp2u3byKgrtFVTbKyp2lGGx2rNkwPL6xiABwa+tqa2qqa398qW8/FPFl4qSr18rS0tKSvLy8/PycnNyc1+8eJ5z5dr1dzwwYBAh5QgJCSocUJMKwFHfr1JARFlfiMmFQSJdDARQGIjvUfIwEsFMdi+wQmaWUJkxdLQHlblFBheGke+V2ypNqiYP5lYWhOFfRdgkdQHP97w2N4PnlYE1XurL5OlwJt93/O85FBqKTJNhFKAIsh6EzMElEkyUVAFUWgQ1UWardsS/J0AwPjDIGp1LABHZQQQDLywcBA3CITG3MAgsMFBgmzMQ/Y2iRTgIn4kSjFYJR2sGhI42wRBBIYKF3zTjIPohMPNPWBMLJpgo/geVqUQ3QSbVHCpuK5axVg0IlTahCwpGoCE4POYXmdZgCAgHGSAwrYgJCAmKmYVh8CkhdDem47Z24foeACHTJqhg8QpxLYVGEcQ5R0keJKj2oIKEiwm3QV2bB+N7A0QUoGAYfAASBgeGoeVEEdYHoXLUUfbrRYECa8tgfK+AoILCxYgzTHEpNAiG0Q/roqahEzaSBTOzYE480e/JztsmwPjeAYGBwsDIk3qSaRWMpjlFtdcvys6RqH4IFxEaLg2wsLYORlsBhC4oRNqFS1M7oDrm4tiblw4wdGBoc2C0NUAE9VGIYEGBQVTOuSDOOgo0dP6/TYLRVgEh6mi6sFABh+priAIQVN8EowGCFAopIELBQqZJqM4FM7WEAQRVuOmaS1ypWEgBEYVmoQIGNh1G2MmKgoIjqVumSgFpxbDQAYbstwwRCyRXiM+kQEgBaVFguAhAiFKDiOJ7aZECIlZgBHH6m7Ne0iIFRKLBwYTwQ6RCLwVECpO0SF5hSptAWqRFCoi0SIsUEGmRFikg0iItUkCkRVqkgEiLtEh8+T8BBgCAD+f36Kr9wQAAAABJRU5ErkJggg==";
    icon.classList.add('link-hotspot-icon');

    var transformProperties = [ '-ms-transform', '-webkit-transform', 'transform' ];
    for (var i = 0; i < transformProperties.length; i++) {
      var property = transformProperties[i];
      icon.style[property] = 'rotate(' + hotspot.rotation + 'rad)';
    }

    // Standard click handler. Sky Surfer's enhancer replaces this block below.
    // Desktop: click navigates normally.
    // Phone/tablet: first tap shows the destination preview; second tap navigates.
    wrapper.addEventListener('click', function(event) {
      var touchLike = document.body.classList.contains('touch') ||
                      document.body.classList.contains('mobile') ||
                      (window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches);

      if (touchLike) {
        event.preventDefault();
        event.stopPropagation();

        if (!wrapper.classList.contains('preview-visible')) {
          var openPreviews = document.querySelectorAll('.link-hotspot.preview-visible');
          for (var i = 0; i < openPreviews.length; i++) {
            openPreviews[i].classList.remove('preview-visible');
          }
          wrapper.classList.add('preview-visible');
          return;
        }
      }

      switchScene(findSceneById(hotspot.target));
    });

    var ssStandardPreviewHideTimer = null;
    var ssStandardPreviewLastPointerX = null;
    var ssStandardPreviewLastPointerY = null;

    function ssStandardPreviewShow() {
      if (ssStandardPreviewHideTimer !== null) {
        window.clearTimeout(ssStandardPreviewHideTimer);
        ssStandardPreviewHideTimer = null;
      }

      var openStandardPreviews = document.querySelectorAll('.link-hotspot.ss-standard-preview-visible');
      for (var s = 0; s < openStandardPreviews.length; s++) {
        if (openStandardPreviews[s] !== wrapper) {
          openStandardPreviews[s].classList.remove('ss-standard-preview-visible');
        }
      }

      wrapper.classList.add('ss-standard-preview-visible');
    }

    function ssStandardPreviewRememberPointer(event) {
      ssStandardPreviewLastPointerX = event.clientX;
      ssStandardPreviewLastPointerY = event.clientY;
    }

    function ssStandardPreviewHandlePhysicalMove(event) {
      if (ssStandardPreviewLastPointerX === null || ssStandardPreviewLastPointerY === null) {
        ssStandardPreviewRememberPointer(event);
        return;
      }

      var deltaX = Math.abs(event.clientX - ssStandardPreviewLastPointerX);
      var deltaY = Math.abs(event.clientY - ssStandardPreviewLastPointerY);
      ssStandardPreviewRememberPointer(event);

      // Require a real coordinate change. Autorotation moving the hotspot
      // underneath a stationary cursor cannot satisfy this condition.
      if (deltaX < 1 && deltaY < 1) return;
      ssStandardPreviewShow();
    }

    function ssStandardPreviewScheduleHide() {
      if (ssStandardPreviewHideTimer !== null) {
        window.clearTimeout(ssStandardPreviewHideTimer);
      }

      ssStandardPreviewHideTimer = window.setTimeout(function() {
        ssStandardPreviewHideTimer = null;
        if (wrapper.matches(':hover')) return;
        wrapper.classList.remove('ss-standard-preview-visible');
      }, 500);
    }

    wrapper.addEventListener('mouseenter', ssStandardPreviewRememberPointer);
    wrapper.addEventListener('mousemove', ssStandardPreviewHandlePhysicalMove);
    wrapper.addEventListener('mouseleave', function() {
      ssStandardPreviewLastPointerX = null;
      ssStandardPreviewLastPointerY = null;
      ssStandardPreviewScheduleHide();
    });


    stopTouchAndScrollEventPropagation(wrapper);

    // Standard tooltip baseline. Sky Surfer's enhancer replaces this block
    // with the isolated destination-preview card below.
    // SKY SURFER: isolated destination preview. This intentionally does NOT
    // reuse Marzipano's .link-hotspot-tooltip class so older/custom project CSS
    // cannot crop, resize, or distort the 16:9 destination card.
    var tooltip = document.createElement('div');
    tooltip.classList.add('ss-scene-preview-anchor');

    var targetScene = findSceneDataById(hotspot.target);

    var previewCard = document.createElement('div');
    previewCard.classList.add('ss-scene-preview-card');

    var previewMedia = document.createElement('div');
    previewMedia.classList.add('ss-scene-preview-media');

    var previewImage = document.createElement('img');
    previewImage.classList.add('ss-scene-preview-image');
    previewImage.src = 'thumbnails/' + hotspot.target + '.jpg';
    previewImage.alt = targetScene.name;
    previewMedia.appendChild(previewImage);
    var previewTitle = document.createElement('div');
    previewTitle.classList.add('ss-scene-preview-title');
    previewTitle.textContent = targetScene.name;

    previewCard.appendChild(previewMedia);
    previewCard.appendChild(previewTitle);
    previewCard.addEventListener('mouseenter', function() {
      if (wrapper.classList.contains('ss-standard-preview-visible')) {
        if (typeof ssStandardPreviewHideTimer !== 'undefined' && ssStandardPreviewHideTimer !== null) {
          window.clearTimeout(ssStandardPreviewHideTimer);
          ssStandardPreviewHideTimer = null;
        }
      }
    });

    previewCard.addEventListener('mouseleave', function() {
      if (wrapper.classList.contains('ss-standard-preview-visible') &&
          typeof ssStandardPreviewScheduleHide === 'function') {
        ssStandardPreviewScheduleHide();
      }
    });

    previewCard.addEventListener('click', function(event) {
      event.preventDefault();
      event.stopPropagation();
      switchScene(findSceneById(hotspot.target));
    });
    tooltip.appendChild(previewCard);

    wrapper.appendChild(icon);
    wrapper.appendChild(tooltip);
    return wrapper;
  }

  function createInfoHotspotElement(hotspot) {

    // Create wrapper element to hold icon and tooltip.
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot');
    wrapper.classList.add('info-hotspot');

    // Create hotspot/tooltip header.
    var header = document.createElement('div');
    header.classList.add('info-hotspot-header');

    // Create image element.
    var iconWrapper = document.createElement('div');
    iconWrapper.classList.add('info-hotspot-icon-wrapper');
    var icon = document.createElement('img');
    icon.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyRpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoTWFjaW50b3NoKSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDo0OEVCN0IyNkY2NEMxMUU0QjYwM0YzQzFCMzYyQTIyMiIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDo0OEVCN0IyN0Y2NEMxMUU0QjYwM0YzQzFCMzYyQTIyMiI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjQ4RUI3QjI0RjY0QzExRTRCNjAzRjNDMUIzNjJBMjIyIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjQ4RUI3QjI1RjY0QzExRTRCNjAzRjNDMUIzNjJBMjIyIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+g8gPXQAABERJREFUeNrsnUloFEEUhivGnYAm4gLuCEYUUYyKW0QUBEVExLghCC6IiAsBT4qYg1dBcQH14MEFJOJB44JCMu6oIApJPIhLQA1xjRqNGo3/s3tQw9DTS02o6vl/+A9Jqnqm55tXr7v6VSWntbVVUeaoAz8CAqEIhEAoAiEQikAIhCIQAqEIhCIQAqEIhEAoAvGnHvAW+DJcD/+Cv8B34W1wT1PfeE4MH1Ath3fDfT3aNMAL4FsEklntgMt8tm2Cx8OPCCQzWgMfDtjnIjyHQPSrN/wEzgvYT05+APySSV2vNoWA8ecLCU/hVZZ+LYvQtz+B6FUfeFiE/k0EolcDI/Z/RiB69T1C30/wNQLRq1cR+h6Fv/GyV79q4REB+7xz+7xmhOjXwYDtW+AS02DEKUJy4fPwbB9tP8Ir4LMmnkhcIuQnvBA+5H77U0lmfE/BY0yFEacI+VeD4flwIdwVfgM/hi/AL0x/8zlcH8IhiyIQAqEIhEAoAiEQqp3VMcbn1g8ep5znJTKjW6EMnLuKOxCZvV0Jz4NHKeeZeVKN8HT4Ie/UM/+lWgpvgCelaZuAZxBIZtQNXguXKmf+yo9kgrEX/IFJXe97lmFJKg73BICR7FvIHKJPxfBeeGyEY3TiZW905SunTDQREYaohRESTYvgfcq7mj2I6pnUwynPzRGrNB7zB9zd5CgxNUKK4BPwcM3HrTZ9yDIxh6yGb2QAhuieDZeQJkXrAfgI3MUjITdGeI3rBOJfp+H1KX4vSU7WCpa4V1uLI7xGgkD8q6bNz1Lac1w5c1JSb1UOf/aInnR6rgwrrDYdyC71dyXTGReEFLTVtmk3Oq7RYdpVlnz7Nyqnmv2cR7tpIY9faQMQ2yYXZTpdCt8KQvQdyiFLv0aGhGFF/rARSNgFmglbTjBbgFQSSGYUNqFXWZMkLUrqsjlAQ8j8MYQRYk50JGwaAmwCEvv8kS1AqmwCYksOkZVQUikSdB6rTgUrgmCE+FSRCjepaFV02ARkajbkD5uAZEX+sCmHNLj3IbHOH7ZESGEIGH6iQ3JSLoEE1+SQ/e54/E2q5G/DWwmk/e7Q76caopVT1SL790oFZJl7BUcg7ZDQ36aItKvKqWpJ7s/YGd5v0smaXkpaoIJvu5SUPJOXrTTmwuvgmSnayEY0pQTiXxPV/6uggqg8Td/3yllpdZNA/CtKpbsXDNmFTjZQfsCkHnzY0S0pJ51gIgwbgAzSfDwpvCtWBm/TZDqQfE3HaYY3K6fwrtnkEzY9h3TWNETJmsQaCy7xjY+QKJXuX+Gd7v2HFTBsABLmg5TZ0pPu/Yvcibcoi2Q6kIqAIKS9bB4g/2WnTlko06ffZTb2EjwrzbB2TDl791Yry2XD8xDZsWE7vEQ5zzdkv/anytmzXRbyXFGGbRcedyBZJe6XRSAUgRAIRSAEQhEIgVAEQiAUgVAEQiBUKP0WYABkJ9nd+hk+gQAAAABJRU5ErkJggg==";
    icon.classList.add('info-hotspot-icon');
    iconWrapper.appendChild(icon);

    // Create title element.
    var titleWrapper = document.createElement('div');
    titleWrapper.classList.add('info-hotspot-title-wrapper');
    var title = document.createElement('div');
    title.classList.add('info-hotspot-title');
    title.innerHTML = hotspot.title;
    titleWrapper.appendChild(title);

    // Create close element.
    var closeWrapper = document.createElement('div');
    closeWrapper.classList.add('info-hotspot-close-wrapper');
    var closeIcon = document.createElement('img');
    closeIcon.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyRpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoTWFjaW50b3NoKSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDo0OEVCN0IyQUY2NEMxMUU0QjYwM0YzQzFCMzYyQTIyMiIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDo0OEVCN0IyQkY2NEMxMUU0QjYwM0YzQzFCMzYyQTIyMiI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjQ4RUI3QjI4RjY0QzExRTRCNjAzRjNDMUIzNjJBMjIyIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjQ4RUI3QjI5RjY0QzExRTRCNjAzRjNDMUIzNjJBMjIyIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+fKMLZQAABJ9JREFUeNrs3ctrFEEQB+BOK2hQzEVjzPuBSgwogoIKSnY9CIoXPQiKIgpC/ibFW4TgIUdRSDboQS8iJCZRgnn6iJHg+4FG12q3F9YcktlM1VT1bBX8bvPY7S/TPTuT6anK5/NGS05ZbQIF0VIQBdFSEAXRUhAF0VIQBdFSEC0FURAtBVGQ/6oa0gMZgCxAfkJmIbcgx1PQVqchtyGvIEuQt5C7kCuQ9Wh7cfdDELIfMplfufohNUj7SzLbIAOrfLcxSCfG/qoQblAdgAxBNkVYdsQfLe8COSqaIYOQjgjLfoAcgYzH2WFckGr/AVrKWGcUkgkAxWHkIO1lrOPaYq/v0ljGkJ4yMVx1+S9aKxxjqEwMV52QS5yD+oU1rtflu4JawRhta1z/PGeX9QOyIcb6rvvK+rOyNGC4WoRs5QDZAvmI0AhSUDAwXP2BrOPosj5BviE0hITuCwvD1TznGPIIqUE4B/oWRIzYbRIX5AZiw+xhQGnx+2xD3OZ1zkHdgT7wP4iwasz/TlkIEOMO5CQniKt6f5g2IaNk/fWiUDCeQw5D3nN2Wa5eQ7ohc8jdlxvotweEkY2LgQXiajIQFCqMjP/DNFJASlFmhaJgn02VYrzB2iD2DapJ/wGxUXIxUYoYrZIxKECoUDpjoASDQQUiCSUoDEoQapS6CMu2EmA8o8SgBqEa6Dv9QF+3CkaOACNLiZEEiKuphFGCxUgKJEmUoDGwLp2UU22+X28m6Nc3ho7BAVJEyZny78Wv1nAbQ8fgAqFCMQRH3XzSO+b6V9Ip/4VnFEMGiFQUVgxukNKzrxnFkAHialoAyrgEDCkg3Cjj/mxqXkJDSHo+hANFFIY0kFKU6UrEkAhSRMkQo4jEkApCjSIWQzLIv6sIRJ/P+m0bBYleFBchi7XbFC7b7FCQaNVOiCEexQrEyBFjiEaxFYqxHKVeQfgxSlEGpaDYCscQh2IVQxaKZcYYEoIhBsUyYzQZecWKYlOC4R7wmUrD2ZdNCYa7NtWNjLKLA8WmAMNdhHSPvs2mASUpkA5CjNKHQ4NHsQlh5BLAWI4yGSKKTRlGKUqGCKUhVBAKjFET/Rl2KpRBShQbGEa5k9QEh2KJMIYEYASJYokwGoVgBIdiKwAjibOvBmkgVBjYk9DMEaDsxETBeD7EITwkwqCaubTJrG2Sy5VqwhQmn1nkPELc+n2BYVAeKb3cXdY5gztXVpJz+lKgnDAx58uKC3IN8cs8NclPsFxEeYG4zaucY8hnyGYkjKzhm+26yQ/MHQjbcg+J1nOAuLnev6QAAxuFbZpYN4nyr5RgFLuvDEL3xTbF32/IcIz1RwRhYKI84RzUe2NgSH1tRdyBPtapL8frKkJ5h0ij//FYzpji7tXsM4yvq/gOOQv5GnH5YRPOC11e+iNlIuLy7oUuZ+JgYIC4egw5ala/j93vlwvl7TpFFPfD916Ek5NDpjDbXKzCnOvEdV+X/V/JQUiN74/vQ26awqXqkOsU5CLkmCk8wuDOptwE0n1+3FjC2AnX5DNahF2WloIoiJaCKIiWgmgpiIJoKYiCaCmIgmgpiIJocddfAQYAMoi8Y3LxsHAAAAAASUVORK5CYII=";
    closeIcon.classList.add('info-hotspot-close-icon');
    closeWrapper.appendChild(closeIcon);

    // Construct header element.
    header.appendChild(iconWrapper);
    header.appendChild(titleWrapper);
    header.appendChild(closeWrapper);

    // Create text element.
    var text = document.createElement('div');
    text.classList.add('info-hotspot-text');
    text.innerHTML = hotspot.text;

    // Place header and text into wrapper element.
    wrapper.appendChild(header);
    wrapper.appendChild(text);

    // Create a modal for the hotspot content to appear on mobile mode.
    var modal = document.createElement('div');
    modal.innerHTML = wrapper.innerHTML;
    modal.classList.add('info-hotspot-modal');
    document.body.appendChild(modal);

    var toggle = function() {
      wrapper.classList.toggle('visible');
      modal.classList.toggle('visible');
    };

    // Show content when hotspot is clicked.
    wrapper.querySelector('.info-hotspot-header').addEventListener('click', toggle);

    // Hide content when close icon is clicked.
    modal.querySelector('.info-hotspot-close-wrapper').addEventListener('click', toggle);

    // Prevent touch and scroll events from reaching the parent element.
    // This prevents the view control logic from interfering with the hotspot.
    stopTouchAndScrollEventPropagation(wrapper);

    return wrapper;
  }

  // Prevent touch and scroll events from reaching the parent element.
  function stopTouchAndScrollEventPropagation(element, eventList) {
    var eventList = [ 'touchstart', 'touchmove', 'touchend', 'touchcancel',
                      'wheel', 'mousewheel' ];
    for (var i = 0; i < eventList.length; i++) {
      element.addEventListener(eventList[i], function(event) {
        event.stopPropagation();
      });
    }
  }

  function findSceneById(id) {
    for (var i = 0; i < scenes.length; i++) {
      if (scenes[i].data.id === id) {
        return scenes[i];
      }
    }
    return null;
  }

  function findSceneDataById(id) {
    for (var i = 0; i < data.scenes.length; i++) {
      if (data.scenes[i].id === id) {
        return data.scenes[i];
      }
    }
    return null;
  }

  // Display the initial scene.
  switchScene(scenes[0]);

})();
