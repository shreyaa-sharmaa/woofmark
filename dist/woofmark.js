!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.woofmark=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var crossvent = require('crossvent');
var throttle = require('./throttle');
var tailormade = require('./tailormade');

function bullseye (el, target, options) {
  var o = options;
  var domTarget = target && target.tagName;

  if (!domTarget && arguments.length === 2) {
    o = target;
  }
  if (!domTarget) {
    target = el;
  }
  if (!o) { o = {}; }

  var destroyed = false;
  var throttledWrite = throttle(write, 30);
  var tailorOptions = { update: o.autoupdateToCaret !== false && update };
  var tailor = o.caret && tailormade(target, tailorOptions);

  write();

  if (o.tracking !== false) {
    crossvent.add(window, 'resize', throttledWrite);
  }

  return {
    read: readNull,
    refresh: write,
    destroy: destroy,
    sleep: sleep
  };

  function sleep () {
    tailorOptions.sleeping = true;
  }

  function readNull () { return read(); }

  function read (readings) {
    var bounds = target.getBoundingClientRect();
    var scrollTop = document.body.scrollTop || document.documentElement.scrollTop;
    if (tailor) {
      readings = tailor.read();
      return {
        x: (readings.absolute ? 0 : bounds.left) + readings.x,
        y: (readings.absolute ? 0 : bounds.top) + scrollTop + readings.y + 20
      };
    }
    return {
      x: bounds.left,
      y: bounds.top + scrollTop
    };
  }

  function update (readings) {
    write(readings);
  }

  function write (readings) {
    if (destroyed) {
      throw new Error('Bullseye can\'t refresh after being destroyed. Create another instance instead.');
    }
    if (tailor && !readings) {
      tailorOptions.sleeping = false;
      tailor.refresh(); return;
    }
    var p = read(readings);
    if (!tailor && target !== el) {
      p.y += target.offsetHeight;
    }
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
  }

  function destroy () {
    if (tailor) { tailor.destroy(); }
    crossvent.remove(window, 'resize', throttledWrite);
    destroyed = true;
  }
}

module.exports = bullseye;

},{"./tailormade":2,"./throttle":3,"crossvent":4}],2:[function(require,module,exports){
(function (global){
'use strict';

var sell = require('sell');
var crossvent = require('crossvent');
var seleccion = require('seleccion');
var throttle = require('./throttle');
var getSelection = seleccion.get;
var props = [
  'direction',
  'boxSizing',
  'width',
  'height',
  'overflowX',
  'overflowY',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration',
  'letterSpacing',
  'wordSpacing'
];
var win = global;
var doc = document;
var ff = win.mozInnerScreenX !== null && win.mozInnerScreenX !== void 0;

function tailormade (el, options) {
  var textInput = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
  var throttledRefresh = throttle(refresh, 30);
  var o = options || {};

  bind();

  return {
    read: readPosition,
    refresh: throttledRefresh,
    destroy: destroy
  };

  function noop () {}
  function readPosition () { return (textInput ? coordsText : coordsHTML)(); }

  function refresh () {
    if (o.sleeping) {
      return;
    }
    return (o.update || noop)(readPosition());
  }

  function coordsText () {
    var p = sell(el);
    var context = prepare();
    var readings = readTextCoords(context, p.start);
    doc.body.removeChild(context.mirror);
    return readings;
  }

  function coordsHTML () {
    var sel = getSelection();
    if (sel.rangeCount) {
      var range = sel.getRangeAt(0);
      var needsToWorkAroundNewlineBug = range.startContainer.nodeName === 'P' && range.startOffset === 0;
      if (needsToWorkAroundNewlineBug) {
        return {
          x: range.startContainer.offsetLeft,
          y: range.startContainer.offsetTop,
          absolute: true
        };
      }
      if (range.getClientRects) {
        var rects = range.getClientRects();
        if (rects.length > 0) {
          return {
            x: rects[0].left,
            y: rects[0].top,
            absolute: true
          };
        }
      }
    }
    return { x: 0, y: 0 };
  }

  function readTextCoords (context, p) {
    var rest = doc.createElement('span');
    var mirror = context.mirror;
    var computed = context.computed;

    write(mirror, read(el).substring(0, p));

    if (el.tagName === 'INPUT') {
      mirror.textContent = mirror.textContent.replace(/\s/g, '\u00a0');
    }

    write(rest, read(el).substring(p) || '.');

    mirror.appendChild(rest);

    return {
      x: rest.offsetLeft + parseInt(computed['borderLeftWidth']),
      y: rest.offsetTop + parseInt(computed['borderTopWidth'])
    };
  }

  function read (el) {
    return textInput ? el.value : el.innerHTML;
  }

  function prepare () {
    var computed = win.getComputedStyle ? getComputedStyle(el) : el.currentStyle;
    var mirror = doc.createElement('div');
    var style = mirror.style;

    doc.body.appendChild(mirror);

    if (el.tagName !== 'INPUT') {
      style.wordWrap = 'break-word';
    }
    style.whiteSpace = 'pre-wrap';
    style.position = 'absolute';
    style.visibility = 'hidden';
    props.forEach(copy);

    if (ff) {
      style.width = parseInt(computed.width) - 2 + 'px';
      if (el.scrollHeight > parseInt(computed.height)) {
        style.overflowY = 'scroll';
      }
    } else {
      style.overflow = 'hidden';
    }
    return { mirror: mirror, computed: computed };

    function copy (prop) {
      style[prop] = computed[prop];
    }
  }

  function write (el, value) {
    if (textInput) {
      el.textContent = value;
    } else {
      el.innerHTML = value;
    }
  }

  function bind (remove) {
    var op = remove ? 'remove' : 'add';
    crossvent[op](el, 'keydown', throttledRefresh);
    crossvent[op](el, 'keyup', throttledRefresh);
    crossvent[op](el, 'input', throttledRefresh);
    crossvent[op](el, 'paste', throttledRefresh);
    crossvent[op](el, 'change', throttledRefresh);
  }

  function destroy () {
    bind(true);
  }
}

module.exports = tailormade;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9idWxsc2V5ZS90YWlsb3JtYWRlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcblxudmFyIHNlbGwgPSByZXF1aXJlKCdzZWxsJyk7XG52YXIgY3Jvc3N2ZW50ID0gcmVxdWlyZSgnY3Jvc3N2ZW50Jyk7XG52YXIgc2VsZWNjaW9uID0gcmVxdWlyZSgnc2VsZWNjaW9uJyk7XG52YXIgdGhyb3R0bGUgPSByZXF1aXJlKCcuL3Rocm90dGxlJyk7XG52YXIgZ2V0U2VsZWN0aW9uID0gc2VsZWNjaW9uLmdldDtcbnZhciBwcm9wcyA9IFtcbiAgJ2RpcmVjdGlvbicsXG4gICdib3hTaXppbmcnLFxuICAnd2lkdGgnLFxuICAnaGVpZ2h0JyxcbiAgJ292ZXJmbG93WCcsXG4gICdvdmVyZmxvd1knLFxuICAnYm9yZGVyVG9wV2lkdGgnLFxuICAnYm9yZGVyUmlnaHRXaWR0aCcsXG4gICdib3JkZXJCb3R0b21XaWR0aCcsXG4gICdib3JkZXJMZWZ0V2lkdGgnLFxuICAncGFkZGluZ1RvcCcsXG4gICdwYWRkaW5nUmlnaHQnLFxuICAncGFkZGluZ0JvdHRvbScsXG4gICdwYWRkaW5nTGVmdCcsXG4gICdmb250U3R5bGUnLFxuICAnZm9udFZhcmlhbnQnLFxuICAnZm9udFdlaWdodCcsXG4gICdmb250U3RyZXRjaCcsXG4gICdmb250U2l6ZScsXG4gICdmb250U2l6ZUFkanVzdCcsXG4gICdsaW5lSGVpZ2h0JyxcbiAgJ2ZvbnRGYW1pbHknLFxuICAndGV4dEFsaWduJyxcbiAgJ3RleHRUcmFuc2Zvcm0nLFxuICAndGV4dEluZGVudCcsXG4gICd0ZXh0RGVjb3JhdGlvbicsXG4gICdsZXR0ZXJTcGFjaW5nJyxcbiAgJ3dvcmRTcGFjaW5nJ1xuXTtcbnZhciB3aW4gPSBnbG9iYWw7XG52YXIgZG9jID0gZG9jdW1lbnQ7XG52YXIgZmYgPSB3aW4ubW96SW5uZXJTY3JlZW5YICE9PSBudWxsICYmIHdpbi5tb3pJbm5lclNjcmVlblggIT09IHZvaWQgMDtcblxuZnVuY3Rpb24gdGFpbG9ybWFkZSAoZWwsIG9wdGlvbnMpIHtcbiAgdmFyIHRleHRJbnB1dCA9IGVsLnRhZ05hbWUgPT09ICdJTlBVVCcgfHwgZWwudGFnTmFtZSA9PT0gJ1RFWFRBUkVBJztcbiAgdmFyIHRocm90dGxlZFJlZnJlc2ggPSB0aHJvdHRsZShyZWZyZXNoLCAzMCk7XG4gIHZhciBvID0gb3B0aW9ucyB8fCB7fTtcblxuICBiaW5kKCk7XG5cbiAgcmV0dXJuIHtcbiAgICByZWFkOiByZWFkUG9zaXRpb24sXG4gICAgcmVmcmVzaDogdGhyb3R0bGVkUmVmcmVzaCxcbiAgICBkZXN0cm95OiBkZXN0cm95XG4gIH07XG5cbiAgZnVuY3Rpb24gbm9vcCAoKSB7fVxuICBmdW5jdGlvbiByZWFkUG9zaXRpb24gKCkgeyByZXR1cm4gKHRleHRJbnB1dCA/IGNvb3Jkc1RleHQgOiBjb29yZHNIVE1MKSgpOyB9XG5cbiAgZnVuY3Rpb24gcmVmcmVzaCAoKSB7XG4gICAgaWYgKG8uc2xlZXBpbmcpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgcmV0dXJuIChvLnVwZGF0ZSB8fCBub29wKShyZWFkUG9zaXRpb24oKSk7XG4gIH1cblxuICBmdW5jdGlvbiBjb29yZHNUZXh0ICgpIHtcbiAgICB2YXIgcCA9IHNlbGwoZWwpO1xuICAgIHZhciBjb250ZXh0ID0gcHJlcGFyZSgpO1xuICAgIHZhciByZWFkaW5ncyA9IHJlYWRUZXh0Q29vcmRzKGNvbnRleHQsIHAuc3RhcnQpO1xuICAgIGRvYy5ib2R5LnJlbW92ZUNoaWxkKGNvbnRleHQubWlycm9yKTtcbiAgICByZXR1cm4gcmVhZGluZ3M7XG4gIH1cblxuICBmdW5jdGlvbiBjb29yZHNIVE1MICgpIHtcbiAgICB2YXIgc2VsID0gZ2V0U2VsZWN0aW9uKCk7XG4gICAgaWYgKHNlbC5yYW5nZUNvdW50KSB7XG4gICAgICB2YXIgcmFuZ2UgPSBzZWwuZ2V0UmFuZ2VBdCgwKTtcbiAgICAgIHZhciBuZWVkc1RvV29ya0Fyb3VuZE5ld2xpbmVCdWcgPSByYW5nZS5zdGFydENvbnRhaW5lci5ub2RlTmFtZSA9PT0gJ1AnICYmIHJhbmdlLnN0YXJ0T2Zmc2V0ID09PSAwO1xuICAgICAgaWYgKG5lZWRzVG9Xb3JrQXJvdW5kTmV3bGluZUJ1Zykge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHg6IHJhbmdlLnN0YXJ0Q29udGFpbmVyLm9mZnNldExlZnQsXG4gICAgICAgICAgeTogcmFuZ2Uuc3RhcnRDb250YWluZXIub2Zmc2V0VG9wLFxuICAgICAgICAgIGFic29sdXRlOiB0cnVlXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICBpZiAocmFuZ2UuZ2V0Q2xpZW50UmVjdHMpIHtcbiAgICAgICAgdmFyIHJlY3RzID0gcmFuZ2UuZ2V0Q2xpZW50UmVjdHMoKTtcbiAgICAgICAgaWYgKHJlY3RzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgeDogcmVjdHNbMF0ubGVmdCxcbiAgICAgICAgICAgIHk6IHJlY3RzWzBdLnRvcCxcbiAgICAgICAgICAgIGFic29sdXRlOiB0cnVlXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4geyB4OiAwLCB5OiAwIH07XG4gIH1cblxuICBmdW5jdGlvbiByZWFkVGV4dENvb3JkcyAoY29udGV4dCwgcCkge1xuICAgIHZhciByZXN0ID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgICB2YXIgbWlycm9yID0gY29udGV4dC5taXJyb3I7XG4gICAgdmFyIGNvbXB1dGVkID0gY29udGV4dC5jb21wdXRlZDtcblxuICAgIHdyaXRlKG1pcnJvciwgcmVhZChlbCkuc3Vic3RyaW5nKDAsIHApKTtcblxuICAgIGlmIChlbC50YWdOYW1lID09PSAnSU5QVVQnKSB7XG4gICAgICBtaXJyb3IudGV4dENvbnRlbnQgPSBtaXJyb3IudGV4dENvbnRlbnQucmVwbGFjZSgvXFxzL2csICdcXHUwMGEwJyk7XG4gICAgfVxuXG4gICAgd3JpdGUocmVzdCwgcmVhZChlbCkuc3Vic3RyaW5nKHApIHx8ICcuJyk7XG5cbiAgICBtaXJyb3IuYXBwZW5kQ2hpbGQocmVzdCk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgeDogcmVzdC5vZmZzZXRMZWZ0ICsgcGFyc2VJbnQoY29tcHV0ZWRbJ2JvcmRlckxlZnRXaWR0aCddKSxcbiAgICAgIHk6IHJlc3Qub2Zmc2V0VG9wICsgcGFyc2VJbnQoY29tcHV0ZWRbJ2JvcmRlclRvcFdpZHRoJ10pXG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWQgKGVsKSB7XG4gICAgcmV0dXJuIHRleHRJbnB1dCA/IGVsLnZhbHVlIDogZWwuaW5uZXJIVE1MO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJlcGFyZSAoKSB7XG4gICAgdmFyIGNvbXB1dGVkID0gd2luLmdldENvbXB1dGVkU3R5bGUgPyBnZXRDb21wdXRlZFN0eWxlKGVsKSA6IGVsLmN1cnJlbnRTdHlsZTtcbiAgICB2YXIgbWlycm9yID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIHZhciBzdHlsZSA9IG1pcnJvci5zdHlsZTtcblxuICAgIGRvYy5ib2R5LmFwcGVuZENoaWxkKG1pcnJvcik7XG5cbiAgICBpZiAoZWwudGFnTmFtZSAhPT0gJ0lOUFVUJykge1xuICAgICAgc3R5bGUud29yZFdyYXAgPSAnYnJlYWstd29yZCc7XG4gICAgfVxuICAgIHN0eWxlLndoaXRlU3BhY2UgPSAncHJlLXdyYXAnO1xuICAgIHN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcbiAgICBzdHlsZS52aXNpYmlsaXR5ID0gJ2hpZGRlbic7XG4gICAgcHJvcHMuZm9yRWFjaChjb3B5KTtcblxuICAgIGlmIChmZikge1xuICAgICAgc3R5bGUud2lkdGggPSBwYXJzZUludChjb21wdXRlZC53aWR0aCkgLSAyICsgJ3B4JztcbiAgICAgIGlmIChlbC5zY3JvbGxIZWlnaHQgPiBwYXJzZUludChjb21wdXRlZC5oZWlnaHQpKSB7XG4gICAgICAgIHN0eWxlLm92ZXJmbG93WSA9ICdzY3JvbGwnO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBzdHlsZS5vdmVyZmxvdyA9ICdoaWRkZW4nO1xuICAgIH1cbiAgICByZXR1cm4geyBtaXJyb3I6IG1pcnJvciwgY29tcHV0ZWQ6IGNvbXB1dGVkIH07XG5cbiAgICBmdW5jdGlvbiBjb3B5IChwcm9wKSB7XG4gICAgICBzdHlsZVtwcm9wXSA9IGNvbXB1dGVkW3Byb3BdO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHdyaXRlIChlbCwgdmFsdWUpIHtcbiAgICBpZiAodGV4dElucHV0KSB7XG4gICAgICBlbC50ZXh0Q29udGVudCA9IHZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBlbC5pbm5lckhUTUwgPSB2YWx1ZTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBiaW5kIChyZW1vdmUpIHtcbiAgICB2YXIgb3AgPSByZW1vdmUgPyAncmVtb3ZlJyA6ICdhZGQnO1xuICAgIGNyb3NzdmVudFtvcF0oZWwsICdrZXlkb3duJywgdGhyb3R0bGVkUmVmcmVzaCk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ2tleXVwJywgdGhyb3R0bGVkUmVmcmVzaCk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ2lucHV0JywgdGhyb3R0bGVkUmVmcmVzaCk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ3Bhc3RlJywgdGhyb3R0bGVkUmVmcmVzaCk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ2NoYW5nZScsIHRocm90dGxlZFJlZnJlc2gpO1xuICB9XG5cbiAgZnVuY3Rpb24gZGVzdHJveSAoKSB7XG4gICAgYmluZCh0cnVlKTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHRhaWxvcm1hZGU7XG4iXX0=
},{"./throttle":3,"crossvent":4,"seleccion":18,"sell":20}],3:[function(require,module,exports){
'use strict';

function throttle (fn, boundary) {
  var last = -Infinity;
  var timer;
  return function bounced () {
    if (timer) {
      return;
    }
    unbound();

    function unbound () {
      clearTimeout(timer);
      timer = null;
      var next = last + boundary;
      var now = Date.now();
      if (now > next) {
        last = now;
        fn();
      } else {
        timer = setTimeout(unbound, next - now);
      }
    }
  };
}

module.exports = throttle;

},{}],4:[function(require,module,exports){
(function (global){
'use strict';

var customEvent = require('custom-event');
var eventmap = require('./eventmap');
var doc = document;
var addEvent = addEventEasy;
var removeEvent = removeEventEasy;
var hardCache = [];

if (!global.addEventListener) {
  addEvent = addEventHard;
  removeEvent = removeEventHard;
}

function addEventEasy (el, type, fn, capturing) {
  return el.addEventListener(type, fn, capturing);
}

function addEventHard (el, type, fn) {
  return el.attachEvent('on' + type, wrap(el, type, fn));
}

function removeEventEasy (el, type, fn, capturing) {
  return el.removeEventListener(type, fn, capturing);
}

function removeEventHard (el, type, fn) {
  return el.detachEvent('on' + type, unwrap(el, type, fn));
}

function fabricateEvent (el, type, model) {
  var e = eventmap.indexOf(type) === -1 ? makeCustomEvent() : makeClassicEvent();
  if (el.dispatchEvent) {
    el.dispatchEvent(e);
  } else {
    el.fireEvent('on' + type, e);
  }
  function makeClassicEvent () {
    var e;
    if (doc.createEvent) {
      e = doc.createEvent('Event');
      e.initEvent(type, true, true);
    } else if (doc.createEventObject) {
      e = doc.createEventObject();
    }
    return e;
  }
  function makeCustomEvent () {
    return new customEvent(type, { detail: model });
  }
}

function wrapperFactory (el, type, fn) {
  return function wrapper (originalEvent) {
    var e = originalEvent || global.event;
    e.target = e.target || e.srcElement;
    e.preventDefault = e.preventDefault || function preventDefault () { e.returnValue = false; };
    e.stopPropagation = e.stopPropagation || function stopPropagation () { e.cancelBubble = true; };
    e.which = e.which || e.keyCode;
    fn.call(el, e);
  };
}

function wrap (el, type, fn) {
  var wrapper = unwrap(el, type, fn) || wrapperFactory(el, type, fn);
  hardCache.push({
    wrapper: wrapper,
    element: el,
    type: type,
    fn: fn
  });
  return wrapper;
}

function unwrap (el, type, fn) {
  var i = find(el, type, fn);
  if (i) {
    var wrapper = hardCache[i].wrapper;
    hardCache.splice(i, 1); // free up a tad of memory
    return wrapper;
  }
}

function find (el, type, fn) {
  var i, item;
  for (i = 0; i < hardCache.length; i++) {
    item = hardCache[i];
    if (item.element === el && item.type === type && item.fn === fn) {
      return i;
    }
  }
}

module.exports = {
  add: addEvent,
  remove: removeEvent,
  fabricate: fabricateEvent
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9jcm9zc3ZlbnQvc3JjL2Nyb3NzdmVudC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbnZhciBjdXN0b21FdmVudCA9IHJlcXVpcmUoJ2N1c3RvbS1ldmVudCcpO1xudmFyIGV2ZW50bWFwID0gcmVxdWlyZSgnLi9ldmVudG1hcCcpO1xudmFyIGRvYyA9IGRvY3VtZW50O1xudmFyIGFkZEV2ZW50ID0gYWRkRXZlbnRFYXN5O1xudmFyIHJlbW92ZUV2ZW50ID0gcmVtb3ZlRXZlbnRFYXN5O1xudmFyIGhhcmRDYWNoZSA9IFtdO1xuXG5pZiAoIWdsb2JhbC5hZGRFdmVudExpc3RlbmVyKSB7XG4gIGFkZEV2ZW50ID0gYWRkRXZlbnRIYXJkO1xuICByZW1vdmVFdmVudCA9IHJlbW92ZUV2ZW50SGFyZDtcbn1cblxuZnVuY3Rpb24gYWRkRXZlbnRFYXN5IChlbCwgdHlwZSwgZm4sIGNhcHR1cmluZykge1xuICByZXR1cm4gZWwuYWRkRXZlbnRMaXN0ZW5lcih0eXBlLCBmbiwgY2FwdHVyaW5nKTtcbn1cblxuZnVuY3Rpb24gYWRkRXZlbnRIYXJkIChlbCwgdHlwZSwgZm4pIHtcbiAgcmV0dXJuIGVsLmF0dGFjaEV2ZW50KCdvbicgKyB0eXBlLCB3cmFwKGVsLCB0eXBlLCBmbikpO1xufVxuXG5mdW5jdGlvbiByZW1vdmVFdmVudEVhc3kgKGVsLCB0eXBlLCBmbiwgY2FwdHVyaW5nKSB7XG4gIHJldHVybiBlbC5yZW1vdmVFdmVudExpc3RlbmVyKHR5cGUsIGZuLCBjYXB0dXJpbmcpO1xufVxuXG5mdW5jdGlvbiByZW1vdmVFdmVudEhhcmQgKGVsLCB0eXBlLCBmbikge1xuICByZXR1cm4gZWwuZGV0YWNoRXZlbnQoJ29uJyArIHR5cGUsIHVud3JhcChlbCwgdHlwZSwgZm4pKTtcbn1cblxuZnVuY3Rpb24gZmFicmljYXRlRXZlbnQgKGVsLCB0eXBlLCBtb2RlbCkge1xuICB2YXIgZSA9IGV2ZW50bWFwLmluZGV4T2YodHlwZSkgPT09IC0xID8gbWFrZUN1c3RvbUV2ZW50KCkgOiBtYWtlQ2xhc3NpY0V2ZW50KCk7XG4gIGlmIChlbC5kaXNwYXRjaEV2ZW50KSB7XG4gICAgZWwuZGlzcGF0Y2hFdmVudChlKTtcbiAgfSBlbHNlIHtcbiAgICBlbC5maXJlRXZlbnQoJ29uJyArIHR5cGUsIGUpO1xuICB9XG4gIGZ1bmN0aW9uIG1ha2VDbGFzc2ljRXZlbnQgKCkge1xuICAgIHZhciBlO1xuICAgIGlmIChkb2MuY3JlYXRlRXZlbnQpIHtcbiAgICAgIGUgPSBkb2MuY3JlYXRlRXZlbnQoJ0V2ZW50Jyk7XG4gICAgICBlLmluaXRFdmVudCh0eXBlLCB0cnVlLCB0cnVlKTtcbiAgICB9IGVsc2UgaWYgKGRvYy5jcmVhdGVFdmVudE9iamVjdCkge1xuICAgICAgZSA9IGRvYy5jcmVhdGVFdmVudE9iamVjdCgpO1xuICAgIH1cbiAgICByZXR1cm4gZTtcbiAgfVxuICBmdW5jdGlvbiBtYWtlQ3VzdG9tRXZlbnQgKCkge1xuICAgIHJldHVybiBuZXcgY3VzdG9tRXZlbnQodHlwZSwgeyBkZXRhaWw6IG1vZGVsIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIHdyYXBwZXJGYWN0b3J5IChlbCwgdHlwZSwgZm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIHdyYXBwZXIgKG9yaWdpbmFsRXZlbnQpIHtcbiAgICB2YXIgZSA9IG9yaWdpbmFsRXZlbnQgfHwgZ2xvYmFsLmV2ZW50O1xuICAgIGUudGFyZ2V0ID0gZS50YXJnZXQgfHwgZS5zcmNFbGVtZW50O1xuICAgIGUucHJldmVudERlZmF1bHQgPSBlLnByZXZlbnREZWZhdWx0IHx8IGZ1bmN0aW9uIHByZXZlbnREZWZhdWx0ICgpIHsgZS5yZXR1cm5WYWx1ZSA9IGZhbHNlOyB9O1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uID0gZS5zdG9wUHJvcGFnYXRpb24gfHwgZnVuY3Rpb24gc3RvcFByb3BhZ2F0aW9uICgpIHsgZS5jYW5jZWxCdWJibGUgPSB0cnVlOyB9O1xuICAgIGUud2hpY2ggPSBlLndoaWNoIHx8IGUua2V5Q29kZTtcbiAgICBmbi5jYWxsKGVsLCBlKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gd3JhcCAoZWwsIHR5cGUsIGZuKSB7XG4gIHZhciB3cmFwcGVyID0gdW53cmFwKGVsLCB0eXBlLCBmbikgfHwgd3JhcHBlckZhY3RvcnkoZWwsIHR5cGUsIGZuKTtcbiAgaGFyZENhY2hlLnB1c2goe1xuICAgIHdyYXBwZXI6IHdyYXBwZXIsXG4gICAgZWxlbWVudDogZWwsXG4gICAgdHlwZTogdHlwZSxcbiAgICBmbjogZm5cbiAgfSk7XG4gIHJldHVybiB3cmFwcGVyO1xufVxuXG5mdW5jdGlvbiB1bndyYXAgKGVsLCB0eXBlLCBmbikge1xuICB2YXIgaSA9IGZpbmQoZWwsIHR5cGUsIGZuKTtcbiAgaWYgKGkpIHtcbiAgICB2YXIgd3JhcHBlciA9IGhhcmRDYWNoZVtpXS53cmFwcGVyO1xuICAgIGhhcmRDYWNoZS5zcGxpY2UoaSwgMSk7IC8vIGZyZWUgdXAgYSB0YWQgb2YgbWVtb3J5XG4gICAgcmV0dXJuIHdyYXBwZXI7XG4gIH1cbn1cblxuZnVuY3Rpb24gZmluZCAoZWwsIHR5cGUsIGZuKSB7XG4gIHZhciBpLCBpdGVtO1xuICBmb3IgKGkgPSAwOyBpIDwgaGFyZENhY2hlLmxlbmd0aDsgaSsrKSB7XG4gICAgaXRlbSA9IGhhcmRDYWNoZVtpXTtcbiAgICBpZiAoaXRlbS5lbGVtZW50ID09PSBlbCAmJiBpdGVtLnR5cGUgPT09IHR5cGUgJiYgaXRlbS5mbiA9PT0gZm4pIHtcbiAgICAgIHJldHVybiBpO1xuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgYWRkOiBhZGRFdmVudCxcbiAgcmVtb3ZlOiByZW1vdmVFdmVudCxcbiAgZmFicmljYXRlOiBmYWJyaWNhdGVFdmVudFxufTtcbiJdfQ==
},{"./eventmap":5,"custom-event":6}],5:[function(require,module,exports){
(function (global){
'use strict';

var eventmap = [];
var eventname = '';
var ron = /^on/;

for (eventname in global) {
  if (ron.test(eventname)) {
    eventmap.push(eventname.slice(2));
  }
}

module.exports = eventmap;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9jcm9zc3ZlbnQvc3JjL2V2ZW50bWFwLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbnZhciBldmVudG1hcCA9IFtdO1xudmFyIGV2ZW50bmFtZSA9ICcnO1xudmFyIHJvbiA9IC9eb24vO1xuXG5mb3IgKGV2ZW50bmFtZSBpbiBnbG9iYWwpIHtcbiAgaWYgKHJvbi50ZXN0KGV2ZW50bmFtZSkpIHtcbiAgICBldmVudG1hcC5wdXNoKGV2ZW50bmFtZS5zbGljZSgyKSk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBldmVudG1hcDtcbiJdfQ==
},{}],6:[function(require,module,exports){
(function (global){

var NativeCustomEvent = global.CustomEvent;

function useNative () {
  try {
    var p = new NativeCustomEvent('cat', { detail: { foo: 'bar' } });
    return  'cat' === p.type && 'bar' === p.detail.foo;
  } catch (e) {
  }
  return false;
}

/**
 * Cross-browser `CustomEvent` constructor.
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent.CustomEvent
 *
 * @public
 */

module.exports = useNative() ? NativeCustomEvent :

// IE >= 9
'function' === typeof document.createEvent ? function CustomEvent (type, params) {
  var e = document.createEvent('CustomEvent');
  if (params) {
    e.initCustomEvent(type, params.bubbles, params.cancelable, params.detail);
  } else {
    e.initCustomEvent(type, false, false, void 0);
  }
  return e;
} :

// IE <= 8
function CustomEvent (type, params) {
  var e = document.createEventObject();
  e.type = type;
  if (params) {
    e.bubbles = Boolean(params.bubbles);
    e.cancelable = Boolean(params.cancelable);
    e.detail = params.detail;
  } else {
    e.bubbles = false;
    e.cancelable = false;
    e.detail = void 0;
  }
  return e;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9jdXN0b20tZXZlbnQvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyJcbnZhciBOYXRpdmVDdXN0b21FdmVudCA9IGdsb2JhbC5DdXN0b21FdmVudDtcblxuZnVuY3Rpb24gdXNlTmF0aXZlICgpIHtcbiAgdHJ5IHtcbiAgICB2YXIgcCA9IG5ldyBOYXRpdmVDdXN0b21FdmVudCgnY2F0JywgeyBkZXRhaWw6IHsgZm9vOiAnYmFyJyB9IH0pO1xuICAgIHJldHVybiAgJ2NhdCcgPT09IHAudHlwZSAmJiAnYmFyJyA9PT0gcC5kZXRhaWwuZm9vO1xuICB9IGNhdGNoIChlKSB7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vKipcbiAqIENyb3NzLWJyb3dzZXIgYEN1c3RvbUV2ZW50YCBjb25zdHJ1Y3Rvci5cbiAqXG4gKiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvQ3VzdG9tRXZlbnQuQ3VzdG9tRXZlbnRcbiAqXG4gKiBAcHVibGljXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSB1c2VOYXRpdmUoKSA/IE5hdGl2ZUN1c3RvbUV2ZW50IDpcblxuLy8gSUUgPj0gOVxuJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGRvY3VtZW50LmNyZWF0ZUV2ZW50ID8gZnVuY3Rpb24gQ3VzdG9tRXZlbnQgKHR5cGUsIHBhcmFtcykge1xuICB2YXIgZSA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50KCdDdXN0b21FdmVudCcpO1xuICBpZiAocGFyYW1zKSB7XG4gICAgZS5pbml0Q3VzdG9tRXZlbnQodHlwZSwgcGFyYW1zLmJ1YmJsZXMsIHBhcmFtcy5jYW5jZWxhYmxlLCBwYXJhbXMuZGV0YWlsKTtcbiAgfSBlbHNlIHtcbiAgICBlLmluaXRDdXN0b21FdmVudCh0eXBlLCBmYWxzZSwgZmFsc2UsIHZvaWQgMCk7XG4gIH1cbiAgcmV0dXJuIGU7XG59IDpcblxuLy8gSUUgPD0gOFxuZnVuY3Rpb24gQ3VzdG9tRXZlbnQgKHR5cGUsIHBhcmFtcykge1xuICB2YXIgZSA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50T2JqZWN0KCk7XG4gIGUudHlwZSA9IHR5cGU7XG4gIGlmIChwYXJhbXMpIHtcbiAgICBlLmJ1YmJsZXMgPSBCb29sZWFuKHBhcmFtcy5idWJibGVzKTtcbiAgICBlLmNhbmNlbGFibGUgPSBCb29sZWFuKHBhcmFtcy5jYW5jZWxhYmxlKTtcbiAgICBlLmRldGFpbCA9IHBhcmFtcy5kZXRhaWw7XG4gIH0gZWxzZSB7XG4gICAgZS5idWJibGVzID0gZmFsc2U7XG4gICAgZS5jYW5jZWxhYmxlID0gZmFsc2U7XG4gICAgZS5kZXRhaWwgPSB2b2lkIDA7XG4gIH1cbiAgcmV0dXJuIGU7XG59XG4iXX0=
},{}],7:[function(require,module,exports){
'use strict';

var sektor = require('sektor');
var crossvent = require('crossvent');
var rspaces = /\s+/g;
var keymap = {
  13: 'enter',
  27: 'esc',
  32: 'space'
};
var handlers = {};

crossvent.add(window, 'keydown', keydown);

function clear (context) {
  if (context) {
    if (context in handlers) {
      handlers[context] = {};
    }
  } else {
    handlers = {};
  }
}

function switchboard (then, combo, options, fn) {
  if (fn === void 0) {
    fn = options;
    options = {};
  }

  var context = options.context || 'defaults';

  if (!fn) {
    return;
  }

  if (handlers[context] === void 0) {
    handlers[context] = {};
  }

  combo.toLowerCase().split(rspaces).forEach(item);

  function item (keys) {
    var c = keys.trim();
    if (c.length === 0) {
      return;
    }
    then(handlers[context], c, options, fn);
  }
}

function on (combo, options, fn) {
  switchboard(add, combo, options, fn);

  function add (area, key, options, fn) {
    var handler = {
      handle: fn,
      filter: options.filter
    };
    if (area[key]) {
      area[key].push(handler);
    } else {
      area[key] = [handler];
    }
  }
}

function off (combo, options, fn) {
  switchboard(rm, combo, options, fn);

  function rm (area, key, options, fn) {
    if (area[key]) {
      area[key] = area[key].filter(matching);
    }

    function matching (handler) {
      return handler.handle === fn && handler.filter === options.filter;
    }
  }
}

function getKeyCode (e) {
  return e.which || e.keyCode || e.charCode;
}

function keydown (e) {
  var code = getKeyCode(e);
  var key = keymap[code] || String.fromCharCode(code);
  if (key) {
    handle(key, e);
  }
}

function parseKeyCombo (key, e) {
  var combo = [key];
  if (e.shiftKey) {
    combo.unshift('shift');
  }
  if (e.altKey) {
    combo.unshift('alt');
  }
  if (e.ctrlKey ^ e.metaKey) {
    combo.unshift('cmd');
  }
  return combo.join('+').toLowerCase();
}

function handle (key, e) {
  var combo = parseKeyCombo(key, e);
  var context;
  for (context in handlers) {
    if (handlers[context][combo]) {
      handlers[context][combo].forEach(exec);
    }
  }

  function filtered (handler) {
    var filter = handler.filter;
    if (!filter) {
      return;
    }

    var el = e.target;
    var selector = typeof filter === 'string';
    if (selector) {
      return sektor.matchesSelector(el, filter) === false;
    }
    while (el.parentElement && el !== filter) {
      el = el.parentElement;
    }
    return el !== filter;
  }

  function exec (handler) {
    if (filtered(handler)) {
      return;
    }
    handler.handle(e);
  }
}

module.exports = {
  on: on,
  off: off,
  clear: clear,
  handlers: handlers
};

},{"crossvent":4,"sektor":11}],8:[function(require,module,exports){
(function (global){
'use strict';

var stub = require('./stub');
var tracking = require('./tracking');
var ls = 'localStorage' in global && global.localStorage ? global.localStorage : stub;

function accessor (key, value) {
  if (arguments.length === 1) {
    return get(key);
  }
  return set(key, value);
}

function get (key) {
  return JSON.parse(ls.getItem(key));
}

function set (key, value) {
  try {
    ls.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

function remove (key) {
  return ls.removeItem(key);
}

function clear () {
  return ls.clear();
}

accessor.set = set;
accessor.get = get;
accessor.remove = remove;
accessor.clear = clear;
accessor.on = tracking.on;
accessor.off = tracking.off;

module.exports = accessor;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9sb2NhbC1zdG9yYWdlL2xvY2FsLXN0b3JhZ2UuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbnZhciBzdHViID0gcmVxdWlyZSgnLi9zdHViJyk7XG52YXIgdHJhY2tpbmcgPSByZXF1aXJlKCcuL3RyYWNraW5nJyk7XG52YXIgbHMgPSAnbG9jYWxTdG9yYWdlJyBpbiBnbG9iYWwgJiYgZ2xvYmFsLmxvY2FsU3RvcmFnZSA/IGdsb2JhbC5sb2NhbFN0b3JhZ2UgOiBzdHViO1xuXG5mdW5jdGlvbiBhY2Nlc3NvciAoa2V5LCB2YWx1ZSkge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuICAgIHJldHVybiBnZXQoa2V5KTtcbiAgfVxuICByZXR1cm4gc2V0KGtleSwgdmFsdWUpO1xufVxuXG5mdW5jdGlvbiBnZXQgKGtleSkge1xuICByZXR1cm4gSlNPTi5wYXJzZShscy5nZXRJdGVtKGtleSkpO1xufVxuXG5mdW5jdGlvbiBzZXQgKGtleSwgdmFsdWUpIHtcbiAgdHJ5IHtcbiAgICBscy5zZXRJdGVtKGtleSwgSlNPTi5zdHJpbmdpZnkodmFsdWUpKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG5mdW5jdGlvbiByZW1vdmUgKGtleSkge1xuICByZXR1cm4gbHMucmVtb3ZlSXRlbShrZXkpO1xufVxuXG5mdW5jdGlvbiBjbGVhciAoKSB7XG4gIHJldHVybiBscy5jbGVhcigpO1xufVxuXG5hY2Nlc3Nvci5zZXQgPSBzZXQ7XG5hY2Nlc3Nvci5nZXQgPSBnZXQ7XG5hY2Nlc3Nvci5yZW1vdmUgPSByZW1vdmU7XG5hY2Nlc3Nvci5jbGVhciA9IGNsZWFyO1xuYWNjZXNzb3Iub24gPSB0cmFja2luZy5vbjtcbmFjY2Vzc29yLm9mZiA9IHRyYWNraW5nLm9mZjtcblxubW9kdWxlLmV4cG9ydHMgPSBhY2Nlc3NvcjtcbiJdfQ==
},{"./stub":9,"./tracking":10}],9:[function(require,module,exports){
'use strict';

var ms = {};

function getItem (key) {
  return key in ms ? ms[key] : null;
}

function setItem (key, value) {
  ms[key] = value;
  return true;
}

function removeItem (key) {
  var found = key in ms;
  if (found) {
    return delete ms[key];
  }
  return false;
}

function clear () {
  ms = {};
  return true;
}

module.exports = {
  getItem: getItem,
  setItem: setItem,
  removeItem: removeItem,
  clear: clear
};

},{}],10:[function(require,module,exports){
(function (global){
'use strict';

var listeners = {};
var listening = false;

function listen () {
  if (global.addEventListener) {
    global.addEventListener('storage', change, false);
  } else if (global.attachEvent) {
    global.attachEvent('onstorage', change);
  } else {
    global.onstorage = change;
  }
}

function change (e) {
  if (!e) {
    e = global.event;
  }
  var all = listeners[e.key];
  if (all) {
    all.forEach(fire);
  }

  function fire (listener) {
    listener(JSON.parse(e.newValue), JSON.parse(e.oldValue), e.url || e.uri);
  }
}

function on (key, fn) {
  if (listeners[key]) {
    listeners[key].push(fn);
  } else {
    listeners[key] = [fn];
  }
  if (listening === false) {
    listen();
  }
}

function off (key, fn) {
  var ns = listeners[key];
  if (ns.length > 1) {
    ns.splice(ns.indexOf(fn), 1);
  } else {
    listeners[key] = [];
  }
}

module.exports = {
  on: on,
  off: off
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9sb2NhbC1zdG9yYWdlL3RyYWNraW5nLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcblxudmFyIGxpc3RlbmVycyA9IHt9O1xudmFyIGxpc3RlbmluZyA9IGZhbHNlO1xuXG5mdW5jdGlvbiBsaXN0ZW4gKCkge1xuICBpZiAoZ2xvYmFsLmFkZEV2ZW50TGlzdGVuZXIpIHtcbiAgICBnbG9iYWwuYWRkRXZlbnRMaXN0ZW5lcignc3RvcmFnZScsIGNoYW5nZSwgZmFsc2UpO1xuICB9IGVsc2UgaWYgKGdsb2JhbC5hdHRhY2hFdmVudCkge1xuICAgIGdsb2JhbC5hdHRhY2hFdmVudCgnb25zdG9yYWdlJywgY2hhbmdlKTtcbiAgfSBlbHNlIHtcbiAgICBnbG9iYWwub25zdG9yYWdlID0gY2hhbmdlO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNoYW5nZSAoZSkge1xuICBpZiAoIWUpIHtcbiAgICBlID0gZ2xvYmFsLmV2ZW50O1xuICB9XG4gIHZhciBhbGwgPSBsaXN0ZW5lcnNbZS5rZXldO1xuICBpZiAoYWxsKSB7XG4gICAgYWxsLmZvckVhY2goZmlyZSk7XG4gIH1cblxuICBmdW5jdGlvbiBmaXJlIChsaXN0ZW5lcikge1xuICAgIGxpc3RlbmVyKEpTT04ucGFyc2UoZS5uZXdWYWx1ZSksIEpTT04ucGFyc2UoZS5vbGRWYWx1ZSksIGUudXJsIHx8IGUudXJpKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBvbiAoa2V5LCBmbikge1xuICBpZiAobGlzdGVuZXJzW2tleV0pIHtcbiAgICBsaXN0ZW5lcnNba2V5XS5wdXNoKGZuKTtcbiAgfSBlbHNlIHtcbiAgICBsaXN0ZW5lcnNba2V5XSA9IFtmbl07XG4gIH1cbiAgaWYgKGxpc3RlbmluZyA9PT0gZmFsc2UpIHtcbiAgICBsaXN0ZW4oKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBvZmYgKGtleSwgZm4pIHtcbiAgdmFyIG5zID0gbGlzdGVuZXJzW2tleV07XG4gIGlmIChucy5sZW5ndGggPiAxKSB7XG4gICAgbnMuc3BsaWNlKG5zLmluZGV4T2YoZm4pLCAxKTtcbiAgfSBlbHNlIHtcbiAgICBsaXN0ZW5lcnNba2V5XSA9IFtdO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBvbjogb24sXG4gIG9mZjogb2ZmXG59O1xuIl19
},{}],11:[function(require,module,exports){
(function (global){
'use strict';

var expando = 'sektor-' + Date.now();
var rsiblings = /[+~]/;
var document = global.document;
var del = (document && document.documentElement) || {};
var match = (
  del.matches ||
  del.webkitMatchesSelector ||
  del.mozMatchesSelector ||
  del.oMatchesSelector ||
  del.msMatchesSelector ||
  never
);

module.exports = sektor;

sektor.matches = matches;
sektor.matchesSelector = matchesSelector;

function qsa (selector, context) {
  var existed, id, prefix, prefixed, adapter, hack = context !== document;
  if (hack) { // id hack for context-rooted queries
    existed = context.getAttribute('id');
    id = existed || expando;
    prefix = '#' + id + ' ';
    prefixed = prefix + selector.replace(/,/g, ',' + prefix);
    adapter = rsiblings.test(selector) && context.parentNode;
    if (!existed) { context.setAttribute('id', id); }
  }
  try {
    return (adapter || context).querySelectorAll(prefixed || selector);
  } catch (e) {
    return [];
  } finally {
    if (existed === null) { context.removeAttribute('id'); }
  }
}

function sektor (selector, ctx, collection, seed) {
  var element;
  var context = ctx || document;
  var results = collection || [];
  var i = 0;
  if (typeof selector !== 'string') {
    return results;
  }
  if (context.nodeType !== 1 && context.nodeType !== 9) {
    return []; // bail if context is not an element or document
  }
  if (seed) {
    while ((element = seed[i++])) {
      if (matchesSelector(element, selector)) {
        results.push(element);
      }
    }
  } else {
    results.push.apply(results, qsa(selector, context));
  }
  return results;
}

function matches (selector, elements) {
  return sektor(selector, null, null, elements);
}

function matchesSelector (element, selector) {
  return match.call(element, selector);
}

function never () { return false; }

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9zZWt0b3Ivc3JjL3Nla3Rvci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbnZhciBleHBhbmRvID0gJ3Nla3Rvci0nICsgRGF0ZS5ub3coKTtcbnZhciByc2libGluZ3MgPSAvWyt+XS87XG52YXIgZG9jdW1lbnQgPSBnbG9iYWwuZG9jdW1lbnQ7XG52YXIgZGVsID0gKGRvY3VtZW50ICYmIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCkgfHwge307XG52YXIgbWF0Y2ggPSAoXG4gIGRlbC5tYXRjaGVzIHx8XG4gIGRlbC53ZWJraXRNYXRjaGVzU2VsZWN0b3IgfHxcbiAgZGVsLm1vek1hdGNoZXNTZWxlY3RvciB8fFxuICBkZWwub01hdGNoZXNTZWxlY3RvciB8fFxuICBkZWwubXNNYXRjaGVzU2VsZWN0b3IgfHxcbiAgbmV2ZXJcbik7XG5cbm1vZHVsZS5leHBvcnRzID0gc2VrdG9yO1xuXG5zZWt0b3IubWF0Y2hlcyA9IG1hdGNoZXM7XG5zZWt0b3IubWF0Y2hlc1NlbGVjdG9yID0gbWF0Y2hlc1NlbGVjdG9yO1xuXG5mdW5jdGlvbiBxc2EgKHNlbGVjdG9yLCBjb250ZXh0KSB7XG4gIHZhciBleGlzdGVkLCBpZCwgcHJlZml4LCBwcmVmaXhlZCwgYWRhcHRlciwgaGFjayA9IGNvbnRleHQgIT09IGRvY3VtZW50O1xuICBpZiAoaGFjaykgeyAvLyBpZCBoYWNrIGZvciBjb250ZXh0LXJvb3RlZCBxdWVyaWVzXG4gICAgZXhpc3RlZCA9IGNvbnRleHQuZ2V0QXR0cmlidXRlKCdpZCcpO1xuICAgIGlkID0gZXhpc3RlZCB8fCBleHBhbmRvO1xuICAgIHByZWZpeCA9ICcjJyArIGlkICsgJyAnO1xuICAgIHByZWZpeGVkID0gcHJlZml4ICsgc2VsZWN0b3IucmVwbGFjZSgvLC9nLCAnLCcgKyBwcmVmaXgpO1xuICAgIGFkYXB0ZXIgPSByc2libGluZ3MudGVzdChzZWxlY3RvcikgJiYgY29udGV4dC5wYXJlbnROb2RlO1xuICAgIGlmICghZXhpc3RlZCkgeyBjb250ZXh0LnNldEF0dHJpYnV0ZSgnaWQnLCBpZCk7IH1cbiAgfVxuICB0cnkge1xuICAgIHJldHVybiAoYWRhcHRlciB8fCBjb250ZXh0KS5xdWVyeVNlbGVjdG9yQWxsKHByZWZpeGVkIHx8IHNlbGVjdG9yKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiBbXTtcbiAgfSBmaW5hbGx5IHtcbiAgICBpZiAoZXhpc3RlZCA9PT0gbnVsbCkgeyBjb250ZXh0LnJlbW92ZUF0dHJpYnV0ZSgnaWQnKTsgfVxuICB9XG59XG5cbmZ1bmN0aW9uIHNla3RvciAoc2VsZWN0b3IsIGN0eCwgY29sbGVjdGlvbiwgc2VlZCkge1xuICB2YXIgZWxlbWVudDtcbiAgdmFyIGNvbnRleHQgPSBjdHggfHwgZG9jdW1lbnQ7XG4gIHZhciByZXN1bHRzID0gY29sbGVjdGlvbiB8fCBbXTtcbiAgdmFyIGkgPSAwO1xuICBpZiAodHlwZW9mIHNlbGVjdG9yICE9PSAnc3RyaW5nJykge1xuICAgIHJldHVybiByZXN1bHRzO1xuICB9XG4gIGlmIChjb250ZXh0Lm5vZGVUeXBlICE9PSAxICYmIGNvbnRleHQubm9kZVR5cGUgIT09IDkpIHtcbiAgICByZXR1cm4gW107IC8vIGJhaWwgaWYgY29udGV4dCBpcyBub3QgYW4gZWxlbWVudCBvciBkb2N1bWVudFxuICB9XG4gIGlmIChzZWVkKSB7XG4gICAgd2hpbGUgKChlbGVtZW50ID0gc2VlZFtpKytdKSkge1xuICAgICAgaWYgKG1hdGNoZXNTZWxlY3RvcihlbGVtZW50LCBzZWxlY3RvcikpIHtcbiAgICAgICAgcmVzdWx0cy5wdXNoKGVsZW1lbnQpO1xuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICByZXN1bHRzLnB1c2guYXBwbHkocmVzdWx0cywgcXNhKHNlbGVjdG9yLCBjb250ZXh0KSk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdHM7XG59XG5cbmZ1bmN0aW9uIG1hdGNoZXMgKHNlbGVjdG9yLCBlbGVtZW50cykge1xuICByZXR1cm4gc2VrdG9yKHNlbGVjdG9yLCBudWxsLCBudWxsLCBlbGVtZW50cyk7XG59XG5cbmZ1bmN0aW9uIG1hdGNoZXNTZWxlY3RvciAoZWxlbWVudCwgc2VsZWN0b3IpIHtcbiAgcmV0dXJuIG1hdGNoLmNhbGwoZWxlbWVudCwgc2VsZWN0b3IpO1xufVxuXG5mdW5jdGlvbiBuZXZlciAoKSB7IHJldHVybiBmYWxzZTsgfVxuIl19
},{}],12:[function(require,module,exports){
(function (global){
'use strict';

var getSelection;
var doc = global.document;
var getSelectionRaw = require('./getSelectionRaw');
var getSelectionNullOp = require('./getSelectionNullOp');
var getSelectionSynthetic = require('./getSelectionSynthetic');
var isHost = require('./isHost');
if (isHost.method(global, 'getSelection')) {
  getSelection = getSelectionRaw;
} else if (typeof doc.selection === 'object' && doc.selection) {
  getSelection = getSelectionSynthetic;
} else {
  getSelection = getSelectionNullOp;
}

module.exports = getSelection;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9zZWxlY2Npb24vc3JjL2dldFNlbGVjdGlvbi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbnZhciBnZXRTZWxlY3Rpb247XG52YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50O1xudmFyIGdldFNlbGVjdGlvblJhdyA9IHJlcXVpcmUoJy4vZ2V0U2VsZWN0aW9uUmF3Jyk7XG52YXIgZ2V0U2VsZWN0aW9uTnVsbE9wID0gcmVxdWlyZSgnLi9nZXRTZWxlY3Rpb25OdWxsT3AnKTtcbnZhciBnZXRTZWxlY3Rpb25TeW50aGV0aWMgPSByZXF1aXJlKCcuL2dldFNlbGVjdGlvblN5bnRoZXRpYycpO1xudmFyIGlzSG9zdCA9IHJlcXVpcmUoJy4vaXNIb3N0Jyk7XG5pZiAoaXNIb3N0Lm1ldGhvZChnbG9iYWwsICdnZXRTZWxlY3Rpb24nKSkge1xuICBnZXRTZWxlY3Rpb24gPSBnZXRTZWxlY3Rpb25SYXc7XG59IGVsc2UgaWYgKHR5cGVvZiBkb2Muc2VsZWN0aW9uID09PSAnb2JqZWN0JyAmJiBkb2Muc2VsZWN0aW9uKSB7XG4gIGdldFNlbGVjdGlvbiA9IGdldFNlbGVjdGlvblN5bnRoZXRpYztcbn0gZWxzZSB7XG4gIGdldFNlbGVjdGlvbiA9IGdldFNlbGVjdGlvbk51bGxPcDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBnZXRTZWxlY3Rpb247XG4iXX0=
},{"./getSelectionNullOp":13,"./getSelectionRaw":14,"./getSelectionSynthetic":15,"./isHost":16}],13:[function(require,module,exports){
'use strict';

function noop () {}

function getSelectionNullOp () {
  return {
    removeAllRanges: noop,
    addRange: noop
  };
}

module.exports = getSelectionNullOp;

},{}],14:[function(require,module,exports){
(function (global){
'use strict';

function getSelectionRaw () {
  return global.getSelection();
}

module.exports = getSelectionRaw;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9zZWxlY2Npb24vc3JjL2dldFNlbGVjdGlvblJhdy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBnZXRTZWxlY3Rpb25SYXcgKCkge1xuICByZXR1cm4gZ2xvYmFsLmdldFNlbGVjdGlvbigpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGdldFNlbGVjdGlvblJhdztcbiJdfQ==
},{}],15:[function(require,module,exports){
(function (global){
'use strict';

var rangeToTextRange = require('./rangeToTextRange');
var doc = global.document;
var body = doc.body;
var GetSelectionProto = GetSelection.prototype;

function GetSelection (selection) {
  var self = this;
  var range = selection.createRange();

  this._selection = selection;
  this._ranges = [];

  if (selection.type === 'Control') {
    updateControlSelection(self);
  } else if (isTextRange(range)) {
    updateFromTextRange(self, range);
  } else {
    updateEmptySelection(self);
  }
}

GetSelectionProto.removeAllRanges = function () {
  var textRange;
  try {
    this._selection.empty();
    if (this._selection.type !== 'None') {
      textRange = body.createTextRange();
      textRange.select();
      this._selection.empty();
    }
  } catch (e) {
  }
  updateEmptySelection(this);
};

GetSelectionProto.addRange = function (range) {
  if (this._selection.type === 'Control') {
    addRangeToControlSelection(this, range);
  } else {
    rangeToTextRange(range).select();
    this._ranges[0] = range;
    this.rangeCount = 1;
    this.isCollapsed = this._ranges[0].collapsed;
    updateAnchorAndFocusFromRange(this, range, false);
  }
};

GetSelectionProto.setRanges = function (ranges) {
  this.removeAllRanges();
  var rangeCount = ranges.length;
  if (rangeCount > 1) {
    createControlSelection(this, ranges);
  } else if (rangeCount) {
    this.addRange(ranges[0]);
  }
};

GetSelectionProto.getRangeAt = function (index) {
  if (index < 0 || index >= this.rangeCount) {
    throw new Error('getRangeAt(): index out of bounds');
  } else {
    return this._ranges[index].cloneRange();
  }
};

GetSelectionProto.removeRange = function (range) {
  if (this._selection.type !== 'Control') {
    removeRangeManually(this, range);
    return;
  }
  var controlRange = this._selection.createRange();
  var rangeElement = getSingleElementFromRange(range);
  var newControlRange = body.createControlRange();
  var el;
  var removed = false;
  for (var i = 0, len = controlRange.length; i < len; ++i) {
    el = controlRange.item(i);
    if (el !== rangeElement || removed) {
      newControlRange.add(controlRange.item(i));
    } else {
      removed = true;
    }
  }
  newControlRange.select();
  updateControlSelection(this);
};

GetSelectionProto.eachRange = function (fn, returnValue) {
  var i = 0;
  var len = this._ranges.length;
  for (i = 0; i < len; ++i) {
    if (fn(this.getRangeAt(i))) {
      return returnValue;
    }
  }
};

GetSelectionProto.getAllRanges = function () {
  var ranges = [];
  this.eachRange(function (range) {
    ranges.push(range);
  });
  return ranges;
};

GetSelectionProto.setSingleRange = function (range) {
  this.removeAllRanges();
  this.addRange(range);
};

function createControlSelection (sel, ranges) {
  var controlRange = body.createControlRange();
  for (var i = 0, el, len = ranges.length; i < len; ++i) {
    el = getSingleElementFromRange(ranges[i]);
    try {
      controlRange.add(el);
    } catch (e) {
      throw new Error('setRanges(): Element could not be added to control selection');
    }
  }
  controlRange.select();
  updateControlSelection(sel);
}

function removeRangeManually (sel, range) {
  var ranges = sel.getAllRanges();
  sel.removeAllRanges();
  for (var i = 0, len = ranges.length; i < len; ++i) {
    if (!isSameRange(range, ranges[i])) {
      sel.addRange(ranges[i]);
    }
  }
  if (!sel.rangeCount) {
    updateEmptySelection(sel);
  }
}

function updateAnchorAndFocusFromRange (sel, range) {
  var anchorPrefix = 'start';
  var focusPrefix = 'end';
  sel.anchorNode = range[anchorPrefix + 'Container'];
  sel.anchorOffset = range[anchorPrefix + 'Offset'];
  sel.focusNode = range[focusPrefix + 'Container'];
  sel.focusOffset = range[focusPrefix + 'Offset'];
}

function updateEmptySelection (sel) {
  sel.anchorNode = sel.focusNode = null;
  sel.anchorOffset = sel.focusOffset = 0;
  sel.rangeCount = 0;
  sel.isCollapsed = true;
  sel._ranges.length = 0;
}

function rangeContainsSingleElement (rangeNodes) {
  if (!rangeNodes.length || rangeNodes[0].nodeType !== 1) {
    return false;
  }
  for (var i = 1, len = rangeNodes.length; i < len; ++i) {
    if (!isAncestorOf(rangeNodes[0], rangeNodes[i])) {
      return false;
    }
  }
  return true;
}

function getSingleElementFromRange (range) {
  var nodes = range.getNodes();
  if (!rangeContainsSingleElement(nodes)) {
    throw new Error('getSingleElementFromRange(): range did not consist of a single element');
  }
  return nodes[0];
}

function isTextRange (range) {
  return range && range.text !== void 0;
}

function updateFromTextRange (sel, range) {
  sel._ranges = [range];
  updateAnchorAndFocusFromRange(sel, range, false);
  sel.rangeCount = 1;
  sel.isCollapsed = range.collapsed;
}

function updateControlSelection (sel) {
  sel._ranges.length = 0;
  if (sel._selection.type === 'None') {
    updateEmptySelection(sel);
  } else {
    var controlRange = sel._selection.createRange();
    if (isTextRange(controlRange)) {
      updateFromTextRange(sel, controlRange);
    } else {
      sel.rangeCount = controlRange.length;
      var range;
      for (var i = 0; i < sel.rangeCount; ++i) {
        range = doc.createRange();
        range.selectNode(controlRange.item(i));
        sel._ranges.push(range);
      }
      sel.isCollapsed = sel.rangeCount === 1 && sel._ranges[0].collapsed;
      updateAnchorAndFocusFromRange(sel, sel._ranges[sel.rangeCount - 1], false);
    }
  }
}

function addRangeToControlSelection (sel, range) {
  var controlRange = sel._selection.createRange();
  var rangeElement = getSingleElementFromRange(range);
  var newControlRange = body.createControlRange();
  for (var i = 0, len = controlRange.length; i < len; ++i) {
    newControlRange.add(controlRange.item(i));
  }
  try {
    newControlRange.add(rangeElement);
  } catch (e) {
    throw new Error('addRange(): Element could not be added to control selection');
  }
  newControlRange.select();
  updateControlSelection(sel);
}

function isSameRange (left, right) {
  return (
    left.startContainer === right.startContainer &&
    left.startOffset === right.startOffset &&
    left.endContainer === right.endContainer &&
    left.endOffset === right.endOffset
  );
}

function isAncestorOf (ancestor, descendant) {
  var node = descendant;
  while (node.parentNode) {
    if (node.parentNode === ancestor) {
      return true;
    }
    node = node.parentNode;
  }
  return false;
}

function getSelection () {
  return new GetSelection(global.document.selection);
}

module.exports = getSelection;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9zZWxlY2Npb24vc3JjL2dldFNlbGVjdGlvblN5bnRoZXRpYy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiJ3VzZSBzdHJpY3QnO1xuXG52YXIgcmFuZ2VUb1RleHRSYW5nZSA9IHJlcXVpcmUoJy4vcmFuZ2VUb1RleHRSYW5nZScpO1xudmFyIGRvYyA9IGdsb2JhbC5kb2N1bWVudDtcbnZhciBib2R5ID0gZG9jLmJvZHk7XG52YXIgR2V0U2VsZWN0aW9uUHJvdG8gPSBHZXRTZWxlY3Rpb24ucHJvdG90eXBlO1xuXG5mdW5jdGlvbiBHZXRTZWxlY3Rpb24gKHNlbGVjdGlvbikge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciByYW5nZSA9IHNlbGVjdGlvbi5jcmVhdGVSYW5nZSgpO1xuXG4gIHRoaXMuX3NlbGVjdGlvbiA9IHNlbGVjdGlvbjtcbiAgdGhpcy5fcmFuZ2VzID0gW107XG5cbiAgaWYgKHNlbGVjdGlvbi50eXBlID09PSAnQ29udHJvbCcpIHtcbiAgICB1cGRhdGVDb250cm9sU2VsZWN0aW9uKHNlbGYpO1xuICB9IGVsc2UgaWYgKGlzVGV4dFJhbmdlKHJhbmdlKSkge1xuICAgIHVwZGF0ZUZyb21UZXh0UmFuZ2Uoc2VsZiwgcmFuZ2UpO1xuICB9IGVsc2Uge1xuICAgIHVwZGF0ZUVtcHR5U2VsZWN0aW9uKHNlbGYpO1xuICB9XG59XG5cbkdldFNlbGVjdGlvblByb3RvLnJlbW92ZUFsbFJhbmdlcyA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHRleHRSYW5nZTtcbiAgdHJ5IHtcbiAgICB0aGlzLl9zZWxlY3Rpb24uZW1wdHkoKTtcbiAgICBpZiAodGhpcy5fc2VsZWN0aW9uLnR5cGUgIT09ICdOb25lJykge1xuICAgICAgdGV4dFJhbmdlID0gYm9keS5jcmVhdGVUZXh0UmFuZ2UoKTtcbiAgICAgIHRleHRSYW5nZS5zZWxlY3QoKTtcbiAgICAgIHRoaXMuX3NlbGVjdGlvbi5lbXB0eSgpO1xuICAgIH1cbiAgfSBjYXRjaCAoZSkge1xuICB9XG4gIHVwZGF0ZUVtcHR5U2VsZWN0aW9uKHRoaXMpO1xufTtcblxuR2V0U2VsZWN0aW9uUHJvdG8uYWRkUmFuZ2UgPSBmdW5jdGlvbiAocmFuZ2UpIHtcbiAgaWYgKHRoaXMuX3NlbGVjdGlvbi50eXBlID09PSAnQ29udHJvbCcpIHtcbiAgICBhZGRSYW5nZVRvQ29udHJvbFNlbGVjdGlvbih0aGlzLCByYW5nZSk7XG4gIH0gZWxzZSB7XG4gICAgcmFuZ2VUb1RleHRSYW5nZShyYW5nZSkuc2VsZWN0KCk7XG4gICAgdGhpcy5fcmFuZ2VzWzBdID0gcmFuZ2U7XG4gICAgdGhpcy5yYW5nZUNvdW50ID0gMTtcbiAgICB0aGlzLmlzQ29sbGFwc2VkID0gdGhpcy5fcmFuZ2VzWzBdLmNvbGxhcHNlZDtcbiAgICB1cGRhdGVBbmNob3JBbmRGb2N1c0Zyb21SYW5nZSh0aGlzLCByYW5nZSwgZmFsc2UpO1xuICB9XG59O1xuXG5HZXRTZWxlY3Rpb25Qcm90by5zZXRSYW5nZXMgPSBmdW5jdGlvbiAocmFuZ2VzKSB7XG4gIHRoaXMucmVtb3ZlQWxsUmFuZ2VzKCk7XG4gIHZhciByYW5nZUNvdW50ID0gcmFuZ2VzLmxlbmd0aDtcbiAgaWYgKHJhbmdlQ291bnQgPiAxKSB7XG4gICAgY3JlYXRlQ29udHJvbFNlbGVjdGlvbih0aGlzLCByYW5nZXMpO1xuICB9IGVsc2UgaWYgKHJhbmdlQ291bnQpIHtcbiAgICB0aGlzLmFkZFJhbmdlKHJhbmdlc1swXSk7XG4gIH1cbn07XG5cbkdldFNlbGVjdGlvblByb3RvLmdldFJhbmdlQXQgPSBmdW5jdGlvbiAoaW5kZXgpIHtcbiAgaWYgKGluZGV4IDwgMCB8fCBpbmRleCA+PSB0aGlzLnJhbmdlQ291bnQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2dldFJhbmdlQXQoKTogaW5kZXggb3V0IG9mIGJvdW5kcycpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB0aGlzLl9yYW5nZXNbaW5kZXhdLmNsb25lUmFuZ2UoKTtcbiAgfVxufTtcblxuR2V0U2VsZWN0aW9uUHJvdG8ucmVtb3ZlUmFuZ2UgPSBmdW5jdGlvbiAocmFuZ2UpIHtcbiAgaWYgKHRoaXMuX3NlbGVjdGlvbi50eXBlICE9PSAnQ29udHJvbCcpIHtcbiAgICByZW1vdmVSYW5nZU1hbnVhbGx5KHRoaXMsIHJhbmdlKTtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIGNvbnRyb2xSYW5nZSA9IHRoaXMuX3NlbGVjdGlvbi5jcmVhdGVSYW5nZSgpO1xuICB2YXIgcmFuZ2VFbGVtZW50ID0gZ2V0U2luZ2xlRWxlbWVudEZyb21SYW5nZShyYW5nZSk7XG4gIHZhciBuZXdDb250cm9sUmFuZ2UgPSBib2R5LmNyZWF0ZUNvbnRyb2xSYW5nZSgpO1xuICB2YXIgZWw7XG4gIHZhciByZW1vdmVkID0gZmFsc2U7XG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBjb250cm9sUmFuZ2UubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICBlbCA9IGNvbnRyb2xSYW5nZS5pdGVtKGkpO1xuICAgIGlmIChlbCAhPT0gcmFuZ2VFbGVtZW50IHx8IHJlbW92ZWQpIHtcbiAgICAgIG5ld0NvbnRyb2xSYW5nZS5hZGQoY29udHJvbFJhbmdlLml0ZW0oaSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZW1vdmVkID0gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgbmV3Q29udHJvbFJhbmdlLnNlbGVjdCgpO1xuICB1cGRhdGVDb250cm9sU2VsZWN0aW9uKHRoaXMpO1xufTtcblxuR2V0U2VsZWN0aW9uUHJvdG8uZWFjaFJhbmdlID0gZnVuY3Rpb24gKGZuLCByZXR1cm5WYWx1ZSkge1xuICB2YXIgaSA9IDA7XG4gIHZhciBsZW4gPSB0aGlzLl9yYW5nZXMubGVuZ3RoO1xuICBmb3IgKGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICBpZiAoZm4odGhpcy5nZXRSYW5nZUF0KGkpKSkge1xuICAgICAgcmV0dXJuIHJldHVyblZhbHVlO1xuICAgIH1cbiAgfVxufTtcblxuR2V0U2VsZWN0aW9uUHJvdG8uZ2V0QWxsUmFuZ2VzID0gZnVuY3Rpb24gKCkge1xuICB2YXIgcmFuZ2VzID0gW107XG4gIHRoaXMuZWFjaFJhbmdlKGZ1bmN0aW9uIChyYW5nZSkge1xuICAgIHJhbmdlcy5wdXNoKHJhbmdlKTtcbiAgfSk7XG4gIHJldHVybiByYW5nZXM7XG59O1xuXG5HZXRTZWxlY3Rpb25Qcm90by5zZXRTaW5nbGVSYW5nZSA9IGZ1bmN0aW9uIChyYW5nZSkge1xuICB0aGlzLnJlbW92ZUFsbFJhbmdlcygpO1xuICB0aGlzLmFkZFJhbmdlKHJhbmdlKTtcbn07XG5cbmZ1bmN0aW9uIGNyZWF0ZUNvbnRyb2xTZWxlY3Rpb24gKHNlbCwgcmFuZ2VzKSB7XG4gIHZhciBjb250cm9sUmFuZ2UgPSBib2R5LmNyZWF0ZUNvbnRyb2xSYW5nZSgpO1xuICBmb3IgKHZhciBpID0gMCwgZWwsIGxlbiA9IHJhbmdlcy5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICAgIGVsID0gZ2V0U2luZ2xlRWxlbWVudEZyb21SYW5nZShyYW5nZXNbaV0pO1xuICAgIHRyeSB7XG4gICAgICBjb250cm9sUmFuZ2UuYWRkKGVsKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3NldFJhbmdlcygpOiBFbGVtZW50IGNvdWxkIG5vdCBiZSBhZGRlZCB0byBjb250cm9sIHNlbGVjdGlvbicpO1xuICAgIH1cbiAgfVxuICBjb250cm9sUmFuZ2Uuc2VsZWN0KCk7XG4gIHVwZGF0ZUNvbnRyb2xTZWxlY3Rpb24oc2VsKTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlUmFuZ2VNYW51YWxseSAoc2VsLCByYW5nZSkge1xuICB2YXIgcmFuZ2VzID0gc2VsLmdldEFsbFJhbmdlcygpO1xuICBzZWwucmVtb3ZlQWxsUmFuZ2VzKCk7XG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSByYW5nZXMubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICBpZiAoIWlzU2FtZVJhbmdlKHJhbmdlLCByYW5nZXNbaV0pKSB7XG4gICAgICBzZWwuYWRkUmFuZ2UocmFuZ2VzW2ldKTtcbiAgICB9XG4gIH1cbiAgaWYgKCFzZWwucmFuZ2VDb3VudCkge1xuICAgIHVwZGF0ZUVtcHR5U2VsZWN0aW9uKHNlbCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gdXBkYXRlQW5jaG9yQW5kRm9jdXNGcm9tUmFuZ2UgKHNlbCwgcmFuZ2UpIHtcbiAgdmFyIGFuY2hvclByZWZpeCA9ICdzdGFydCc7XG4gIHZhciBmb2N1c1ByZWZpeCA9ICdlbmQnO1xuICBzZWwuYW5jaG9yTm9kZSA9IHJhbmdlW2FuY2hvclByZWZpeCArICdDb250YWluZXInXTtcbiAgc2VsLmFuY2hvck9mZnNldCA9IHJhbmdlW2FuY2hvclByZWZpeCArICdPZmZzZXQnXTtcbiAgc2VsLmZvY3VzTm9kZSA9IHJhbmdlW2ZvY3VzUHJlZml4ICsgJ0NvbnRhaW5lciddO1xuICBzZWwuZm9jdXNPZmZzZXQgPSByYW5nZVtmb2N1c1ByZWZpeCArICdPZmZzZXQnXTtcbn1cblxuZnVuY3Rpb24gdXBkYXRlRW1wdHlTZWxlY3Rpb24gKHNlbCkge1xuICBzZWwuYW5jaG9yTm9kZSA9IHNlbC5mb2N1c05vZGUgPSBudWxsO1xuICBzZWwuYW5jaG9yT2Zmc2V0ID0gc2VsLmZvY3VzT2Zmc2V0ID0gMDtcbiAgc2VsLnJhbmdlQ291bnQgPSAwO1xuICBzZWwuaXNDb2xsYXBzZWQgPSB0cnVlO1xuICBzZWwuX3Jhbmdlcy5sZW5ndGggPSAwO1xufVxuXG5mdW5jdGlvbiByYW5nZUNvbnRhaW5zU2luZ2xlRWxlbWVudCAocmFuZ2VOb2Rlcykge1xuICBpZiAoIXJhbmdlTm9kZXMubGVuZ3RoIHx8IHJhbmdlTm9kZXNbMF0ubm9kZVR5cGUgIT09IDEpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgZm9yICh2YXIgaSA9IDEsIGxlbiA9IHJhbmdlTm9kZXMubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICBpZiAoIWlzQW5jZXN0b3JPZihyYW5nZU5vZGVzWzBdLCByYW5nZU5vZGVzW2ldKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gZ2V0U2luZ2xlRWxlbWVudEZyb21SYW5nZSAocmFuZ2UpIHtcbiAgdmFyIG5vZGVzID0gcmFuZ2UuZ2V0Tm9kZXMoKTtcbiAgaWYgKCFyYW5nZUNvbnRhaW5zU2luZ2xlRWxlbWVudChub2RlcykpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2dldFNpbmdsZUVsZW1lbnRGcm9tUmFuZ2UoKTogcmFuZ2UgZGlkIG5vdCBjb25zaXN0IG9mIGEgc2luZ2xlIGVsZW1lbnQnKTtcbiAgfVxuICByZXR1cm4gbm9kZXNbMF07XG59XG5cbmZ1bmN0aW9uIGlzVGV4dFJhbmdlIChyYW5nZSkge1xuICByZXR1cm4gcmFuZ2UgJiYgcmFuZ2UudGV4dCAhPT0gdm9pZCAwO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVGcm9tVGV4dFJhbmdlIChzZWwsIHJhbmdlKSB7XG4gIHNlbC5fcmFuZ2VzID0gW3JhbmdlXTtcbiAgdXBkYXRlQW5jaG9yQW5kRm9jdXNGcm9tUmFuZ2Uoc2VsLCByYW5nZSwgZmFsc2UpO1xuICBzZWwucmFuZ2VDb3VudCA9IDE7XG4gIHNlbC5pc0NvbGxhcHNlZCA9IHJhbmdlLmNvbGxhcHNlZDtcbn1cblxuZnVuY3Rpb24gdXBkYXRlQ29udHJvbFNlbGVjdGlvbiAoc2VsKSB7XG4gIHNlbC5fcmFuZ2VzLmxlbmd0aCA9IDA7XG4gIGlmIChzZWwuX3NlbGVjdGlvbi50eXBlID09PSAnTm9uZScpIHtcbiAgICB1cGRhdGVFbXB0eVNlbGVjdGlvbihzZWwpO1xuICB9IGVsc2Uge1xuICAgIHZhciBjb250cm9sUmFuZ2UgPSBzZWwuX3NlbGVjdGlvbi5jcmVhdGVSYW5nZSgpO1xuICAgIGlmIChpc1RleHRSYW5nZShjb250cm9sUmFuZ2UpKSB7XG4gICAgICB1cGRhdGVGcm9tVGV4dFJhbmdlKHNlbCwgY29udHJvbFJhbmdlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc2VsLnJhbmdlQ291bnQgPSBjb250cm9sUmFuZ2UubGVuZ3RoO1xuICAgICAgdmFyIHJhbmdlO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzZWwucmFuZ2VDb3VudDsgKytpKSB7XG4gICAgICAgIHJhbmdlID0gZG9jLmNyZWF0ZVJhbmdlKCk7XG4gICAgICAgIHJhbmdlLnNlbGVjdE5vZGUoY29udHJvbFJhbmdlLml0ZW0oaSkpO1xuICAgICAgICBzZWwuX3Jhbmdlcy5wdXNoKHJhbmdlKTtcbiAgICAgIH1cbiAgICAgIHNlbC5pc0NvbGxhcHNlZCA9IHNlbC5yYW5nZUNvdW50ID09PSAxICYmIHNlbC5fcmFuZ2VzWzBdLmNvbGxhcHNlZDtcbiAgICAgIHVwZGF0ZUFuY2hvckFuZEZvY3VzRnJvbVJhbmdlKHNlbCwgc2VsLl9yYW5nZXNbc2VsLnJhbmdlQ291bnQgLSAxXSwgZmFsc2UpO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBhZGRSYW5nZVRvQ29udHJvbFNlbGVjdGlvbiAoc2VsLCByYW5nZSkge1xuICB2YXIgY29udHJvbFJhbmdlID0gc2VsLl9zZWxlY3Rpb24uY3JlYXRlUmFuZ2UoKTtcbiAgdmFyIHJhbmdlRWxlbWVudCA9IGdldFNpbmdsZUVsZW1lbnRGcm9tUmFuZ2UocmFuZ2UpO1xuICB2YXIgbmV3Q29udHJvbFJhbmdlID0gYm9keS5jcmVhdGVDb250cm9sUmFuZ2UoKTtcbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGNvbnRyb2xSYW5nZS5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICAgIG5ld0NvbnRyb2xSYW5nZS5hZGQoY29udHJvbFJhbmdlLml0ZW0oaSkpO1xuICB9XG4gIHRyeSB7XG4gICAgbmV3Q29udHJvbFJhbmdlLmFkZChyYW5nZUVsZW1lbnQpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdhZGRSYW5nZSgpOiBFbGVtZW50IGNvdWxkIG5vdCBiZSBhZGRlZCB0byBjb250cm9sIHNlbGVjdGlvbicpO1xuICB9XG4gIG5ld0NvbnRyb2xSYW5nZS5zZWxlY3QoKTtcbiAgdXBkYXRlQ29udHJvbFNlbGVjdGlvbihzZWwpO1xufVxuXG5mdW5jdGlvbiBpc1NhbWVSYW5nZSAobGVmdCwgcmlnaHQpIHtcbiAgcmV0dXJuIChcbiAgICBsZWZ0LnN0YXJ0Q29udGFpbmVyID09PSByaWdodC5zdGFydENvbnRhaW5lciAmJlxuICAgIGxlZnQuc3RhcnRPZmZzZXQgPT09IHJpZ2h0LnN0YXJ0T2Zmc2V0ICYmXG4gICAgbGVmdC5lbmRDb250YWluZXIgPT09IHJpZ2h0LmVuZENvbnRhaW5lciAmJlxuICAgIGxlZnQuZW5kT2Zmc2V0ID09PSByaWdodC5lbmRPZmZzZXRcbiAgKTtcbn1cblxuZnVuY3Rpb24gaXNBbmNlc3Rvck9mIChhbmNlc3RvciwgZGVzY2VuZGFudCkge1xuICB2YXIgbm9kZSA9IGRlc2NlbmRhbnQ7XG4gIHdoaWxlIChub2RlLnBhcmVudE5vZGUpIHtcbiAgICBpZiAobm9kZS5wYXJlbnROb2RlID09PSBhbmNlc3Rvcikge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIG5vZGUgPSBub2RlLnBhcmVudE5vZGU7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBnZXRTZWxlY3Rpb24gKCkge1xuICByZXR1cm4gbmV3IEdldFNlbGVjdGlvbihnbG9iYWwuZG9jdW1lbnQuc2VsZWN0aW9uKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBnZXRTZWxlY3Rpb247XG4iXX0=
},{"./rangeToTextRange":17}],16:[function(require,module,exports){
'use strict';

function isHostMethod (host, prop) {
  var type = typeof host[prop];
  return type === 'function' || !!(type === 'object' && host[prop]) || type === 'unknown';
}

function isHostProperty (host, prop) {
  return typeof host[prop] !== 'undefined';
}

function many (fn) {
  return function areHosted (host, props) {
    var i = props.length;
    while (i--) {
      if (!fn(host, props[i])) {
        return false;
      }
    }
    return true;
  };
}

module.exports = {
  method: isHostMethod,
  methods: many(isHostMethod),
  property: isHostProperty,
  properties: many(isHostProperty)
};

},{}],17:[function(require,module,exports){
(function (global){
'use strict';

var doc = global.document;
var body = doc.body;

function rangeToTextRange (p) {
  if (p.collapsed) {
    return createBoundaryTextRange({ node: p.startContainer, offset: p.startOffset }, true);
  }
  var startRange = createBoundaryTextRange({ node: p.startContainer, offset: p.startOffset }, true);
  var endRange = createBoundaryTextRange({ node: p.endContainer, offset: p.endOffset }, false);
  var textRange = body.createTextRange();
  textRange.setEndPoint('StartToStart', startRange);
  textRange.setEndPoint('EndToEnd', endRange);
  return textRange;
}

function isCharacterDataNode (node) {
  var t = node.nodeType;
  return t === 3 || t === 4 || t === 8 ;
}

function createBoundaryTextRange (p, starting) {
  var bound;
  var parent;
  var offset = p.offset;
  var workingNode;
  var childNodes;
  var range = body.createTextRange();
  var data = isCharacterDataNode(p.node);

  if (data) {
    bound = p.node;
    parent = bound.parentNode;
  } else {
    childNodes = p.node.childNodes;
    bound = offset < childNodes.length ? childNodes[offset] : null;
    parent = p.node;
  }

  workingNode = doc.createElement('span');
  workingNode.innerHTML = '&#feff;';

  if (bound) {
    parent.insertBefore(workingNode, bound);
  } else {
    parent.appendChild(workingNode);
  }

  range.moveToElementText(workingNode);
  range.collapse(!starting);
  parent.removeChild(workingNode);

  if (data) {
    range[starting ? 'moveStart' : 'moveEnd']('character', offset);
  }
  return range;
}

module.exports = rangeToTextRange;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9zZWxlY2Npb24vc3JjL3JhbmdlVG9UZXh0UmFuZ2UuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbnZhciBkb2MgPSBnbG9iYWwuZG9jdW1lbnQ7XG52YXIgYm9keSA9IGRvYy5ib2R5O1xuXG5mdW5jdGlvbiByYW5nZVRvVGV4dFJhbmdlIChwKSB7XG4gIGlmIChwLmNvbGxhcHNlZCkge1xuICAgIHJldHVybiBjcmVhdGVCb3VuZGFyeVRleHRSYW5nZSh7IG5vZGU6IHAuc3RhcnRDb250YWluZXIsIG9mZnNldDogcC5zdGFydE9mZnNldCB9LCB0cnVlKTtcbiAgfVxuICB2YXIgc3RhcnRSYW5nZSA9IGNyZWF0ZUJvdW5kYXJ5VGV4dFJhbmdlKHsgbm9kZTogcC5zdGFydENvbnRhaW5lciwgb2Zmc2V0OiBwLnN0YXJ0T2Zmc2V0IH0sIHRydWUpO1xuICB2YXIgZW5kUmFuZ2UgPSBjcmVhdGVCb3VuZGFyeVRleHRSYW5nZSh7IG5vZGU6IHAuZW5kQ29udGFpbmVyLCBvZmZzZXQ6IHAuZW5kT2Zmc2V0IH0sIGZhbHNlKTtcbiAgdmFyIHRleHRSYW5nZSA9IGJvZHkuY3JlYXRlVGV4dFJhbmdlKCk7XG4gIHRleHRSYW5nZS5zZXRFbmRQb2ludCgnU3RhcnRUb1N0YXJ0Jywgc3RhcnRSYW5nZSk7XG4gIHRleHRSYW5nZS5zZXRFbmRQb2ludCgnRW5kVG9FbmQnLCBlbmRSYW5nZSk7XG4gIHJldHVybiB0ZXh0UmFuZ2U7XG59XG5cbmZ1bmN0aW9uIGlzQ2hhcmFjdGVyRGF0YU5vZGUgKG5vZGUpIHtcbiAgdmFyIHQgPSBub2RlLm5vZGVUeXBlO1xuICByZXR1cm4gdCA9PT0gMyB8fCB0ID09PSA0IHx8IHQgPT09IDggO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVCb3VuZGFyeVRleHRSYW5nZSAocCwgc3RhcnRpbmcpIHtcbiAgdmFyIGJvdW5kO1xuICB2YXIgcGFyZW50O1xuICB2YXIgb2Zmc2V0ID0gcC5vZmZzZXQ7XG4gIHZhciB3b3JraW5nTm9kZTtcbiAgdmFyIGNoaWxkTm9kZXM7XG4gIHZhciByYW5nZSA9IGJvZHkuY3JlYXRlVGV4dFJhbmdlKCk7XG4gIHZhciBkYXRhID0gaXNDaGFyYWN0ZXJEYXRhTm9kZShwLm5vZGUpO1xuXG4gIGlmIChkYXRhKSB7XG4gICAgYm91bmQgPSBwLm5vZGU7XG4gICAgcGFyZW50ID0gYm91bmQucGFyZW50Tm9kZTtcbiAgfSBlbHNlIHtcbiAgICBjaGlsZE5vZGVzID0gcC5ub2RlLmNoaWxkTm9kZXM7XG4gICAgYm91bmQgPSBvZmZzZXQgPCBjaGlsZE5vZGVzLmxlbmd0aCA/IGNoaWxkTm9kZXNbb2Zmc2V0XSA6IG51bGw7XG4gICAgcGFyZW50ID0gcC5ub2RlO1xuICB9XG5cbiAgd29ya2luZ05vZGUgPSBkb2MuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICB3b3JraW5nTm9kZS5pbm5lckhUTUwgPSAnJiNmZWZmOyc7XG5cbiAgaWYgKGJvdW5kKSB7XG4gICAgcGFyZW50Lmluc2VydEJlZm9yZSh3b3JraW5nTm9kZSwgYm91bmQpO1xuICB9IGVsc2Uge1xuICAgIHBhcmVudC5hcHBlbmRDaGlsZCh3b3JraW5nTm9kZSk7XG4gIH1cblxuICByYW5nZS5tb3ZlVG9FbGVtZW50VGV4dCh3b3JraW5nTm9kZSk7XG4gIHJhbmdlLmNvbGxhcHNlKCFzdGFydGluZyk7XG4gIHBhcmVudC5yZW1vdmVDaGlsZCh3b3JraW5nTm9kZSk7XG5cbiAgaWYgKGRhdGEpIHtcbiAgICByYW5nZVtzdGFydGluZyA/ICdtb3ZlU3RhcnQnIDogJ21vdmVFbmQnXSgnY2hhcmFjdGVyJywgb2Zmc2V0KTtcbiAgfVxuICByZXR1cm4gcmFuZ2U7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gcmFuZ2VUb1RleHRSYW5nZTtcbiJdfQ==
},{}],18:[function(require,module,exports){
'use strict';

var getSelection = require('./getSelection');
var setSelection = require('./setSelection');

module.exports = {
  get: getSelection,
  set: setSelection
};

},{"./getSelection":12,"./setSelection":19}],19:[function(require,module,exports){
(function (global){
'use strict';

var getSelection = require('./getSelection');
var rangeToTextRange = require('./rangeToTextRange');
var doc = global.document;

function setSelection (p) {
  if (doc.createRange) {
    modernSelection();
  } else {
    oldSelection();
  }

  function modernSelection () {
    var sel = getSelection();
    var range = doc.createRange();
    if (!p.startContainer) {
      return;
    }
    if (p.endContainer) {
      range.setEnd(p.endContainer, p.endOffset);
    } else {
      range.setEnd(p.startContainer, p.startOffset);
    }
    range.setStart(p.startContainer, p.startOffset);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function oldSelection () {
    rangeToTextRange(p).select();
  }
}

module.exports = setSelection;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9zZWxlY2Npb24vc3JjL3NldFNlbGVjdGlvbi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbnZhciBnZXRTZWxlY3Rpb24gPSByZXF1aXJlKCcuL2dldFNlbGVjdGlvbicpO1xudmFyIHJhbmdlVG9UZXh0UmFuZ2UgPSByZXF1aXJlKCcuL3JhbmdlVG9UZXh0UmFuZ2UnKTtcbnZhciBkb2MgPSBnbG9iYWwuZG9jdW1lbnQ7XG5cbmZ1bmN0aW9uIHNldFNlbGVjdGlvbiAocCkge1xuICBpZiAoZG9jLmNyZWF0ZVJhbmdlKSB7XG4gICAgbW9kZXJuU2VsZWN0aW9uKCk7XG4gIH0gZWxzZSB7XG4gICAgb2xkU2VsZWN0aW9uKCk7XG4gIH1cblxuICBmdW5jdGlvbiBtb2Rlcm5TZWxlY3Rpb24gKCkge1xuICAgIHZhciBzZWwgPSBnZXRTZWxlY3Rpb24oKTtcbiAgICB2YXIgcmFuZ2UgPSBkb2MuY3JlYXRlUmFuZ2UoKTtcbiAgICBpZiAoIXAuc3RhcnRDb250YWluZXIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKHAuZW5kQ29udGFpbmVyKSB7XG4gICAgICByYW5nZS5zZXRFbmQocC5lbmRDb250YWluZXIsIHAuZW5kT2Zmc2V0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmFuZ2Uuc2V0RW5kKHAuc3RhcnRDb250YWluZXIsIHAuc3RhcnRPZmZzZXQpO1xuICAgIH1cbiAgICByYW5nZS5zZXRTdGFydChwLnN0YXJ0Q29udGFpbmVyLCBwLnN0YXJ0T2Zmc2V0KTtcbiAgICBzZWwucmVtb3ZlQWxsUmFuZ2VzKCk7XG4gICAgc2VsLmFkZFJhbmdlKHJhbmdlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9sZFNlbGVjdGlvbiAoKSB7XG4gICAgcmFuZ2VUb1RleHRSYW5nZShwKS5zZWxlY3QoKTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHNldFNlbGVjdGlvbjtcbiJdfQ==
},{"./getSelection":12,"./rangeToTextRange":17}],20:[function(require,module,exports){
'use strict';

var get = easyGet;
var set = easySet;

if (document.selection && document.selection.createRange) {
  get = hardGet;
  set = hardSet;
}

function easyGet (el) {
  return {
    start: el.selectionStart,
    end: el.selectionEnd
  };
}

function hardGet (el) {
  var active = document.activeElement;
  if (active !== el) {
    el.focus();
  }

  var range = document.selection.createRange();
  var bookmark = range.getBookmark();
  var original = el.value;
  var marker = getUniqueMarker(original);
  var parent = range.parentElement();
  if (parent === null || !inputs(parent)) {
    return result(0, 0);
  }
  range.text = marker + range.text + marker;

  var contents = el.value;

  el.value = original;
  range.moveToBookmark(bookmark);
  range.select();

  return result(contents.indexOf(marker), contents.lastIndexOf(marker) - marker.length);

  function result (start, end) {
    if (active !== el) { // don't disrupt pre-existing state
      if (active) {
        active.focus();
      } else {
        el.blur();
      }
    }
    return { start: start, end: end };
  }
}

function getUniqueMarker (contents) {
  var marker;
  do {
    marker = '@@marker.' + Math.random() * new Date();
  } while (contents.indexOf(marker) !== -1);
  return marker;
}

function inputs (el) {
  return ((el.tagName === 'INPUT' && el.type === 'text') || el.tagName === 'TEXTAREA');
}

function easySet (el, p) {
  el.selectionStart = parse(el, p.start);
  el.selectionEnd = parse(el, p.end);
}

function hardSet (el, p) {
  var range = el.createTextRange();

  if (p.start === 'end' && p.end === 'end') {
    range.collapse(false);
    range.select();
  } else {
    range.collapse(true);
    range.moveEnd('character', parse(el, p.end));
    range.moveStart('character', parse(el, p.start));
    range.select();
  }
}

function parse (el, value) {
  return value === 'end' ? el.value.length : value || 0;
}

function sell (el, p) {
  if (arguments.length === 2) {
    set(el, p);
  }
  return get(el);
}

module.exports = sell;

},{}],21:[function(require,module,exports){
'use strict';

var crossvent = require('crossvent');
var InputState = require('./InputState');

function InputHistory (surface, mode) {
  var state = this;

  state.inputMode = mode;
  state.surface = surface;
  state.reset();

  listen(surface.textarea);
  listen(surface.editable);

  function listen (el) {
    var pasteHandler = selfie(handlePaste);
    crossvent.add(el, 'keypress', preventCtrlYZ);
    crossvent.add(el, 'keydown', selfie(handleCtrlYZ));
    crossvent.add(el, 'keydown', selfie(handleModeChange));
    crossvent.add(el, 'mousedown', setMoving);
    el.onpaste = pasteHandler;
    el.ondrop = pasteHandler;
  }

  function setMoving () {
    state.setMode('moving');
  }

  function selfie (fn) {
    return function handler (e) { return fn.call(null, state, e); };
  }
}

InputHistory.prototype.setInputMode = function (mode) {
  var state = this;
  state.inputMode = mode;
  state.reset();
};

InputHistory.prototype.reset = function () {
  var state = this;
  state.inputState = null;
  state.lastState = null;
  state.history = [];
  state.historyPointer = 0;
  state.historyMode = 'none';
  state.refreshing = null;
  state.refreshState(true);
  state.saveState();
  return state;
};

InputHistory.prototype.setCommandMode = function () {
  var state = this;
  state.historyMode = 'command';
  state.saveState();
  state.refreshing = setTimeout(function () {
    state.refreshState();
  }, 0);
};

InputHistory.prototype.canUndo = function () {
  return this.historyPointer > 1;
};

InputHistory.prototype.canRedo = function () {
  return this.history[this.historyPointer + 1];
};

InputHistory.prototype.undo = function () {
  var state = this;
  if (state.canUndo()) {
    if (state.lastState) {
      state.lastState.restore();
      state.lastState = null;
    } else {
      state.history[state.historyPointer] = new InputState(state.surface, state.inputMode);
      state.history[--state.historyPointer].restore();
    }
  }
  state.historyMode = 'none';
  state.surface.focus(state.inputMode);
  state.refreshState();
};

InputHistory.prototype.redo = function () {
  var state = this;
  if (state.canRedo()) {
    state.history[++state.historyPointer].restore();
  }

  state.historyMode = 'none';
  state.surface.focus(state.inputMode);
  state.refreshState();
};

InputHistory.prototype.setMode = function (value) {
  var state = this;
  if (state.historyMode !== value) {
    state.historyMode = value;
    state.saveState();
  }
  state.refreshing = setTimeout(function () {
    state.refreshState();
  }, 1);
};

InputHistory.prototype.refreshState = function (initialState) {
  var state = this;
  state.inputState = new InputState(state.surface, state.inputMode, initialState);
  state.refreshing = null;
};

InputHistory.prototype.saveState = function () {
  var state = this;
  var current = state.inputState || new InputState(state.surface, state.inputMode);

  if (state.historyMode === 'moving') {
    if (!state.lastState) {
      state.lastState = current;
    }
    return;
  }
  if (state.lastState) {
    if (state.history[state.historyPointer - 1].text !== state.lastState.text) {
      state.history[state.historyPointer++] = state.lastState;
    }
    state.lastState = null;
  }
  state.history[state.historyPointer++] = current;
  state.history[state.historyPointer + 1] = null;
};

function handleCtrlYZ (state, e) {
  var handled = false;
  var keyCode = e.charCode || e.keyCode;
  var keyCodeChar = String.fromCharCode(keyCode);

  if (e.ctrlKey || e.metaKey) {
    switch (keyCodeChar.toLowerCase()) {
      case 'y':
        state.redo();
        handled = true;
        break;

      case 'z':
        if (e.shiftKey) {
          state.redo();
        } else {
          state.undo();
        }
        handled = true;
        break;
    }
  }

  if (handled && e.preventDefault) {
    e.preventDefault();
  }
}

function handleModeChange (state, e) {
  if (e.ctrlKey || e.metaKey) {
    return;
  }

  var keyCode = e.keyCode;

  if ((keyCode >= 33 && keyCode <= 40) || (keyCode >= 63232 && keyCode <= 63235)) {
    state.setMode('moving');
  } else if (keyCode === 8 || keyCode === 46 || keyCode === 127) {
    state.setMode('deleting');
  } else if (keyCode === 13) {
    state.setMode('newlines');
  } else if (keyCode === 27) {
    state.setMode('escape');
  } else if ((keyCode < 16 || keyCode > 20) && keyCode !== 91) {
    state.setMode('typing');
  }
}

function handlePaste (state) {
  if (state.inputState && state.inputState.text !== state.surface.read(state.inputMode) && state.refreshing === null) {
    state.historyMode = 'paste';
    state.saveState();
    state.refreshState();
  }
}

function preventCtrlYZ (e) {
  var keyCode = e.charCode || e.keyCode;
  var yz = keyCode === 89 || keyCode === 90;
  var ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && yz) {
    e.preventDefault();
  }
}

module.exports = InputHistory;

},{"./InputState":22,"crossvent":4}],22:[function(require,module,exports){
(function (global){
'use strict';

var doc = global.document;
var isVisibleElement = require('./isVisibleElement');
var fixEOL = require('./fixEOL');
var MarkdownChunks = require('./markdown/MarkdownChunks');
var HtmlChunks = require('./html/HtmlChunks');
var chunks = {
  markdown: MarkdownChunks,
  html: HtmlChunks,
  wysiwyg: HtmlChunks
};

function InputState (surface, mode, initialState) {
  this.mode = mode;
  this.surface = surface;
  this.initialState = initialState || false;
  this.init();
}

InputState.prototype.init = function () {
  var self = this;
  var el = self.surface.current(self.mode);
  if (!isVisibleElement(el)) {
    return;
  }
  if (!this.initialState && doc.activeElement && doc.activeElement !== el) {
    return;
  }
  self.surface.readSelection(self);
  self.scrollTop = el.scrollTop;
  if (!self.text) {
    self.text = self.surface.read(self.mode);
  }
};

InputState.prototype.select = function () {
  var self = this;
  var el = self.surface.current(self.mode);
  if (!isVisibleElement(el)) {
    return;
  }
  self.surface.writeSelection(self);
};

InputState.prototype.restore = function () {
  var self = this;
  var el = self.surface.current(self.mode);
  if (typeof self.text === 'string' && self.text !== self.surface.read(self.mode)) {
    self.surface.write(self.mode, self.text);
  }
  self.select();
  el.scrollTop = self.scrollTop;
};

InputState.prototype.getChunks = function () {
  var self = this;
  var chunk = new chunks[self.mode]();
  chunk.before = fixEOL(self.text.substring(0, self.start));
  chunk.startTag = '';
  chunk.selection = fixEOL(self.text.substring(self.start, self.end));
  chunk.endTag = '';
  chunk.after = fixEOL(self.text.substring(self.end));
  chunk.scrollTop = self.scrollTop;
  self.cachedChunks = chunk;
  return chunk;
};

InputState.prototype.setChunks = function (chunk) {
  var self = this;
  chunk.before = chunk.before + chunk.startTag;
  chunk.after = chunk.endTag + chunk.after;
  self.start = chunk.before.length;
  self.end = chunk.before.length + chunk.selection.length;
  self.text = chunk.before + chunk.selection + chunk.after;
  self.scrollTop = chunk.scrollTop;
};

module.exports = InputState;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9JbnB1dFN0YXRlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbnZhciBkb2MgPSBnbG9iYWwuZG9jdW1lbnQ7XG52YXIgaXNWaXNpYmxlRWxlbWVudCA9IHJlcXVpcmUoJy4vaXNWaXNpYmxlRWxlbWVudCcpO1xudmFyIGZpeEVPTCA9IHJlcXVpcmUoJy4vZml4RU9MJyk7XG52YXIgTWFya2Rvd25DaHVua3MgPSByZXF1aXJlKCcuL21hcmtkb3duL01hcmtkb3duQ2h1bmtzJyk7XG52YXIgSHRtbENodW5rcyA9IHJlcXVpcmUoJy4vaHRtbC9IdG1sQ2h1bmtzJyk7XG52YXIgY2h1bmtzID0ge1xuICBtYXJrZG93bjogTWFya2Rvd25DaHVua3MsXG4gIGh0bWw6IEh0bWxDaHVua3MsXG4gIHd5c2l3eWc6IEh0bWxDaHVua3Ncbn07XG5cbmZ1bmN0aW9uIElucHV0U3RhdGUgKHN1cmZhY2UsIG1vZGUsIGluaXRpYWxTdGF0ZSkge1xuICB0aGlzLm1vZGUgPSBtb2RlO1xuICB0aGlzLnN1cmZhY2UgPSBzdXJmYWNlO1xuICB0aGlzLmluaXRpYWxTdGF0ZSA9IGluaXRpYWxTdGF0ZSB8fCBmYWxzZTtcbiAgdGhpcy5pbml0KCk7XG59XG5cbklucHV0U3RhdGUucHJvdG90eXBlLmluaXQgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIGVsID0gc2VsZi5zdXJmYWNlLmN1cnJlbnQoc2VsZi5tb2RlKTtcbiAgaWYgKCFpc1Zpc2libGVFbGVtZW50KGVsKSkge1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoIXRoaXMuaW5pdGlhbFN0YXRlICYmIGRvYy5hY3RpdmVFbGVtZW50ICYmIGRvYy5hY3RpdmVFbGVtZW50ICE9PSBlbCkge1xuICAgIHJldHVybjtcbiAgfVxuICBzZWxmLnN1cmZhY2UucmVhZFNlbGVjdGlvbihzZWxmKTtcbiAgc2VsZi5zY3JvbGxUb3AgPSBlbC5zY3JvbGxUb3A7XG4gIGlmICghc2VsZi50ZXh0KSB7XG4gICAgc2VsZi50ZXh0ID0gc2VsZi5zdXJmYWNlLnJlYWQoc2VsZi5tb2RlKTtcbiAgfVxufTtcblxuSW5wdXRTdGF0ZS5wcm90b3R5cGUuc2VsZWN0ID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciBlbCA9IHNlbGYuc3VyZmFjZS5jdXJyZW50KHNlbGYubW9kZSk7XG4gIGlmICghaXNWaXNpYmxlRWxlbWVudChlbCkpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgc2VsZi5zdXJmYWNlLndyaXRlU2VsZWN0aW9uKHNlbGYpO1xufTtcblxuSW5wdXRTdGF0ZS5wcm90b3R5cGUucmVzdG9yZSA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgZWwgPSBzZWxmLnN1cmZhY2UuY3VycmVudChzZWxmLm1vZGUpO1xuICBpZiAodHlwZW9mIHNlbGYudGV4dCA9PT0gJ3N0cmluZycgJiYgc2VsZi50ZXh0ICE9PSBzZWxmLnN1cmZhY2UucmVhZChzZWxmLm1vZGUpKSB7XG4gICAgc2VsZi5zdXJmYWNlLndyaXRlKHNlbGYubW9kZSwgc2VsZi50ZXh0KTtcbiAgfVxuICBzZWxmLnNlbGVjdCgpO1xuICBlbC5zY3JvbGxUb3AgPSBzZWxmLnNjcm9sbFRvcDtcbn07XG5cbklucHV0U3RhdGUucHJvdG90eXBlLmdldENodW5rcyA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgY2h1bmsgPSBuZXcgY2h1bmtzW3NlbGYubW9kZV0oKTtcbiAgY2h1bmsuYmVmb3JlID0gZml4RU9MKHNlbGYudGV4dC5zdWJzdHJpbmcoMCwgc2VsZi5zdGFydCkpO1xuICBjaHVuay5zdGFydFRhZyA9ICcnO1xuICBjaHVuay5zZWxlY3Rpb24gPSBmaXhFT0woc2VsZi50ZXh0LnN1YnN0cmluZyhzZWxmLnN0YXJ0LCBzZWxmLmVuZCkpO1xuICBjaHVuay5lbmRUYWcgPSAnJztcbiAgY2h1bmsuYWZ0ZXIgPSBmaXhFT0woc2VsZi50ZXh0LnN1YnN0cmluZyhzZWxmLmVuZCkpO1xuICBjaHVuay5zY3JvbGxUb3AgPSBzZWxmLnNjcm9sbFRvcDtcbiAgc2VsZi5jYWNoZWRDaHVua3MgPSBjaHVuaztcbiAgcmV0dXJuIGNodW5rO1xufTtcblxuSW5wdXRTdGF0ZS5wcm90b3R5cGUuc2V0Q2h1bmtzID0gZnVuY3Rpb24gKGNodW5rKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgY2h1bmsuYmVmb3JlID0gY2h1bmsuYmVmb3JlICsgY2h1bmsuc3RhcnRUYWc7XG4gIGNodW5rLmFmdGVyID0gY2h1bmsuZW5kVGFnICsgY2h1bmsuYWZ0ZXI7XG4gIHNlbGYuc3RhcnQgPSBjaHVuay5iZWZvcmUubGVuZ3RoO1xuICBzZWxmLmVuZCA9IGNodW5rLmJlZm9yZS5sZW5ndGggKyBjaHVuay5zZWxlY3Rpb24ubGVuZ3RoO1xuICBzZWxmLnRleHQgPSBjaHVuay5iZWZvcmUgKyBjaHVuay5zZWxlY3Rpb24gKyBjaHVuay5hZnRlcjtcbiAgc2VsZi5zY3JvbGxUb3AgPSBjaHVuay5zY3JvbGxUb3A7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IElucHV0U3RhdGU7XG4iXX0=
},{"./fixEOL":29,"./html/HtmlChunks":33,"./isVisibleElement":42,"./markdown/MarkdownChunks":44}],23:[function(require,module,exports){
'use strict';

var crossvent = require('crossvent');
var commands = {
  markdown: {
    boldOrItalic: require('./markdown/boldOrItalic'),
    linkOrImageOrAttachment: require('./markdown/linkOrImageOrAttachment'),
    blockquote: require('./markdown/blockquote'),
    codeblock: require('./markdown/codeblock'),
    heading: require('./markdown/heading'),
    list: require('./markdown/list'),
    hr: require('./markdown/hr')
  },
  html: {
    boldOrItalic: require('./html/boldOrItalic'),
    linkOrImageOrAttachment: require('./html/linkOrImageOrAttachment'),
    blockquote: require('./html/blockquote'),
    codeblock: require('./html/codeblock'),
    heading: require('./html/heading'),
    list: require('./html/list'),
    hr: require('./html/hr')
  }
};

commands.wysiwyg = commands.html;

function bindCommands (surface, options, editor) {
  bind('bold', 'cmd+b', bold);
  bind('italic', 'cmd+i', italic);
  bind('quote', 'cmd+j', router('blockquote'));
  bind('code', 'cmd+e', code);
  bind('ol', 'cmd+o', ol);
  bind('ul', 'cmd+u', ul);
  bind('heading', 'cmd+d', router('heading'));
  editor.showLinkDialog = fabricator(bind('link', 'cmd+k', linkOrImageOrAttachment('link')));
  editor.showImageDialog = fabricator(bind('image', 'cmd+g', linkOrImageOrAttachment('image')));
  editor.linkOrImageOrAttachment = linkOrImageOrAttachment;

  if (options.attachments) {
    editor.showAttachmentDialog = fabricator(bind('attachment', 'cmd+shift+k', linkOrImageOrAttachment('attachment')));
  }
  if (options.hr) { bind('hr', 'cmd+n', router('hr')); }

  function fabricator (el) {
    return function open () {
      crossvent.fabricate(el, 'click');
    };
  }
  function bold (mode, chunks) {
    commands[mode].boldOrItalic(chunks, 'bold');
  }
  function italic (mode, chunks) {
    commands[mode].boldOrItalic(chunks, 'italic');
  }
  function code (mode, chunks) {
    commands[mode].codeblock(chunks, { fencing: options.fencing });
  }
  function ul (mode, chunks) {
    commands[mode].list(chunks, false);
  }
  function ol (mode, chunks) {
    commands[mode].list(chunks, true);
  }
  function linkOrImageOrAttachment (type, autoUpload) {
    return function linkOrImageOrAttachmentInvoke (mode, chunks) {
      commands[mode].linkOrImageOrAttachment.call(this, chunks, {
        editor: editor,
        mode: mode,
        type: type,
        surface: surface,
        prompts: options.prompts,
        xhr: options.xhr,
        upload: options[type + 's'],
        classes: options.classes,
        mergeHtmlAndAttachment: options.mergeHtmlAndAttachment,
        autoUpload: autoUpload
      });
    };
  }
  function bind (id, combo, fn) {
    return editor.addCommandButton(id, combo, suppress(fn));
  }
  function router (method) {
    return function routed (mode, chunks) { commands[mode][method].call(this, chunks); };
  }
  function stop (e) {
    e.preventDefault(); e.stopPropagation();
  }
  function suppress (fn) {
    return function suppressor (e, mode, chunks) { stop(e); fn.call(this, mode, chunks); };
  }
}

module.exports = bindCommands;

},{"./html/blockquote":34,"./html/boldOrItalic":35,"./html/codeblock":36,"./html/heading":37,"./html/hr":38,"./html/linkOrImageOrAttachment":39,"./html/list":40,"./markdown/blockquote":45,"./markdown/boldOrItalic":46,"./markdown/codeblock":47,"./markdown/heading":48,"./markdown/hr":49,"./markdown/linkOrImageOrAttachment":50,"./markdown/list":51,"crossvent":4}],24:[function(require,module,exports){
'use strict';

function cast (collection) {
  var result = [];
  var i;
  var len = collection.length;
  for (i = 0; i < len; i++) {
    result.push(collection[i]);
  }
  return result;
}

module.exports = cast;

},{}],25:[function(require,module,exports){
'use strict';

var rinput = /^\s*(.*?)(?:\s+"(.+)")?\s*$/;
var rfull = /^(?:https?|ftp):\/\//;

function parseLinkInput (input) {
  return parser.apply(null, input.match(rinput));

  function parser (all, link, title) {
    var href = link.replace(/\?.*$/, queryUnencodedReplacer);
    href = decodeURIComponent(href);
    href = encodeURI(href).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29');
    href = href.replace(/\?.*$/, queryEncodedReplacer);

    return {
      href: formatHref(href), title: formatTitle(title)
    };
  }
}

function queryUnencodedReplacer (query) {
  return query.replace(/\+/g, ' ');
}

function queryEncodedReplacer (query) {
  return query.replace(/\+/g, '%2b');
}

function formatTitle (title) {
  if (!title) {
    return null;
  }

  return title
    .replace(/^\s+|\s+$/g, '')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatHref (url) {
  var href = url.replace(/^\s+|\s+$/g, '');
  if (href.length && href[0] !== '/' && !rfull.test(href)) {
    return 'http://' + href;
  }
  return href;
}

module.exports = parseLinkInput;

},{}],26:[function(require,module,exports){
'use strict';

function trim (remove) {
  var self = this;

  if (remove) {
    beforeReplacer = afterReplacer = '';
  }
  self.selection = self.selection.replace(/^(\s*)/, beforeReplacer).replace(/(\s*)$/, afterReplacer);

  function beforeReplacer (text) {
    self.before += text; return '';
  }
  function afterReplacer (text) {
    self.after = text + self.after; return '';
  }
}

module.exports = trim;

},{}],27:[function(require,module,exports){
'use strict';

var rtrim = /^\s+|\s+$/g;
var rspaces = /\s+/g;

function addClass (el, cls) {
  var current = el.className;
  if (current.indexOf(cls) === -1) {
    el.className = (current + ' ' + cls).replace(rtrim, '');
  }
}

function rmClass (el, cls) {
  el.className = el.className.replace(cls, '').replace(rtrim, '').replace(rspaces, ' ');
}

module.exports = {
  add: addClass,
  rm: rmClass
};

},{}],28:[function(require,module,exports){
'use strict';

function extendRegExp (regex, pre, post) {
  var pattern = regex.toString();
  var flags;

  pattern = pattern.replace(/\/([gim]*)$/, captureFlags);
  pattern = pattern.replace(/(^\/|\/$)/g, '');
  pattern = pre + pattern + post;
  return new RegExp(pattern, flags);

  function captureFlags (all, f) {
    flags = f;
    return '';
  }
}

module.exports = extendRegExp;

},{}],29:[function(require,module,exports){
'use strict';

function fixEOL (text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

module.exports = fixEOL;

},{}],30:[function(require,module,exports){
'use strict';

var InputState = require('./InputState');

function getCommandHandler (surface, history, fn) {
  return function handleCommand (e) {
    surface.focus(history.inputMode);
    history.setCommandMode();

    var state = new InputState(surface, history.inputMode);
    var chunks = state.getChunks();
    var asyncHandler = {
      async: async, immediate: true
    };

    fn.call(asyncHandler, e, history.inputMode, chunks);

    if (asyncHandler.immediate) {
      done();
    }

    function async () {
      asyncHandler.immediate = false;
      return done;
    }

    function done () {
      surface.focus(history.inputMode);
      state.setChunks(chunks);
      state.restore();
    }
  };
}

module.exports = getCommandHandler;

},{"./InputState":22}],31:[function(require,module,exports){
(function (global){
'use strict';

var doc = global.document;
var seleccion = require('seleccion');
var fixEOL = require('./fixEOL');
var many = require('./many');
var cast = require('./cast');
var getSelection = seleccion.get;
var setSelection = seleccion.set;
var ropen = /^(<[^>]+(?: [^>]*)?>)/;
var rclose = /(<\/[^>]+>)$/;

function surface (textarea, editable, droparea) {
  return {
    textarea: textarea,
    editable: editable,
    droparea: droparea,
    focus: setFocus,
    read: read,
    write: write,
    current: current,
    writeSelection: writeSelection,
    readSelection: readSelection
  };

  function setFocus (mode) {
    current(mode).focus();
  }

  function current (mode) {
    return mode === 'wysiwyg' ? editable : textarea;
  }

  function read (mode) {
    if (mode === 'wysiwyg') {
      return editable.innerHTML;
    }
    return textarea.value;
  }

  function write (mode, value) {
    if (mode === 'wysiwyg') {
      editable.innerHTML = value;
    } else {
      textarea.value = value;
    }
  }

  function writeSelection (state) {
    if (state.mode === 'wysiwyg') {
      writeSelectionEditable(state);
    } else {
      writeSelectionTextarea(state);
    }
  }

  function readSelection (state) {
    if (state.mode === 'wysiwyg') {
      readSelectionEditable(state);
    } else {
      readSelectionTextarea(state);
    }
  }

  function writeSelectionTextarea (state) {
    var range;
    if (textarea.selectionStart !== void 0) {
      textarea.focus();
      textarea.selectionStart = state.start;
      textarea.selectionEnd = state.end;
      textarea.scrollTop = state.scrollTop;
    } else if (doc.selection) {
      if (doc.activeElement && doc.activeElement !== textarea) {
        return;
      }
      textarea.focus();
      range = textarea.createTextRange();
      range.moveStart('character', -textarea.value.length);
      range.moveEnd('character', -textarea.value.length);
      range.moveEnd('character', state.end);
      range.moveStart('character', state.start);
      range.select();
    }
  }

  function readSelectionTextarea (state) {
    if (textarea.selectionStart !== void 0) {
      state.start = textarea.selectionStart;
      state.end = textarea.selectionEnd;
    } else if (doc.selection) {
      ancientlyReadSelectionTextarea(state);
    }
  }

  function ancientlyReadSelectionTextarea (state) {
    if (doc.activeElement && doc.activeElement !== textarea) {
      return;
    }

    state.text = fixEOL(textarea.value);

    var range = doc.selection.createRange();
    var fixedRange = fixEOL(range.text);
    var marker = '\x07';
    var markedRange = marker + fixedRange + marker;

    range.text = markedRange;

    var inputText = fixEOL(textarea.value);

    range.moveStart('character', -markedRange.length);
    range.text = fixedRange;
    state.start = inputText.indexOf(marker);
    state.end = inputText.lastIndexOf(marker) - marker.length;

    var diff = state.text.length - fixEOL(textarea.value).length;
    if (diff) {
      range.moveStart('character', -fixedRange.length);
      fixedRange += many('\n', diff);
      state.end += diff;
      range.text = fixedRange;
    }
    state.select();
  }

  function writeSelectionEditable (state) {
    var chunks = state.cachedChunks || state.getChunks();
    var start = chunks.before.length;
    var end = start + chunks.selection.length;
    var p = {};

    walk(editable.firstChild, peek);
    editable.focus();
    setSelection(p);

    function peek (context, el) {
      var cursor = context.text.length;
      var content = readNode(el).length;
      var sum = cursor + content;
      if (!p.startContainer && sum >= start) {
        p.startContainer = el;
        p.startOffset = bounded(start - cursor);
      }
      if (!p.endContainer && sum >= end) {
        p.endContainer = el;
        p.endOffset = bounded(end - cursor);
      }

      function bounded (offset) {
        return Math.max(0, Math.min(content, offset));
      }
    }
  }

  function readSelectionEditable (state) {
    var sel = getSelection();
    var distance = walk(editable.firstChild, peek);
    var start = distance.start || 0;
    var end = distance.end || 0;

    state.text = distance.text;

    if (end > start) {
      state.start = start;
      state.end = end;
    } else {
      state.start = end;
      state.end = start;
    }

    function peek (context, el) {
      if (el === sel.anchorNode) {
        context.start = context.text.length + sel.anchorOffset;
      }
      if (el === sel.focusNode) {
        context.end = context.text.length + sel.focusOffset;
      }
    }
  }

  function walk (el, peek, ctx, siblings) {
    var context = ctx || { text: '' };

    if (!el) {
      return context;
    }

    var elNode = el.nodeType === 1;
    var textNode = el.nodeType === 3;

    peek(context, el);

    if (textNode) {
      context.text += readNode(el);
    }
    if (elNode) {
      if (el.outerHTML.match(ropen)) { context.text += RegExp.$1; }
      cast(el.childNodes).forEach(walkChildren);
      if (el.outerHTML.match(rclose)) { context.text += RegExp.$1; }
    }
    if (siblings !== false && el.nextSibling) {
      return walk(el.nextSibling, peek, context);
    }
    return context;

    function walkChildren (child) {
      walk(child, peek, context, false);
    }
  }

  function readNode (el) {
    return el.nodeType === 3 ? fixEOL(el.textContent || el.innerText || '') : '';
  }
}

module.exports = surface;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9nZXRTdXJmYWNlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50O1xudmFyIHNlbGVjY2lvbiA9IHJlcXVpcmUoJ3NlbGVjY2lvbicpO1xudmFyIGZpeEVPTCA9IHJlcXVpcmUoJy4vZml4RU9MJyk7XG52YXIgbWFueSA9IHJlcXVpcmUoJy4vbWFueScpO1xudmFyIGNhc3QgPSByZXF1aXJlKCcuL2Nhc3QnKTtcbnZhciBnZXRTZWxlY3Rpb24gPSBzZWxlY2Npb24uZ2V0O1xudmFyIHNldFNlbGVjdGlvbiA9IHNlbGVjY2lvbi5zZXQ7XG52YXIgcm9wZW4gPSAvXig8W14+XSsoPzogW14+XSopPz4pLztcbnZhciByY2xvc2UgPSAvKDxcXC9bXj5dKz4pJC87XG5cbmZ1bmN0aW9uIHN1cmZhY2UgKHRleHRhcmVhLCBlZGl0YWJsZSwgZHJvcGFyZWEpIHtcbiAgcmV0dXJuIHtcbiAgICB0ZXh0YXJlYTogdGV4dGFyZWEsXG4gICAgZWRpdGFibGU6IGVkaXRhYmxlLFxuICAgIGRyb3BhcmVhOiBkcm9wYXJlYSxcbiAgICBmb2N1czogc2V0Rm9jdXMsXG4gICAgcmVhZDogcmVhZCxcbiAgICB3cml0ZTogd3JpdGUsXG4gICAgY3VycmVudDogY3VycmVudCxcbiAgICB3cml0ZVNlbGVjdGlvbjogd3JpdGVTZWxlY3Rpb24sXG4gICAgcmVhZFNlbGVjdGlvbjogcmVhZFNlbGVjdGlvblxuICB9O1xuXG4gIGZ1bmN0aW9uIHNldEZvY3VzIChtb2RlKSB7XG4gICAgY3VycmVudChtb2RlKS5mb2N1cygpO1xuICB9XG5cbiAgZnVuY3Rpb24gY3VycmVudCAobW9kZSkge1xuICAgIHJldHVybiBtb2RlID09PSAnd3lzaXd5ZycgPyBlZGl0YWJsZSA6IHRleHRhcmVhO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVhZCAobW9kZSkge1xuICAgIGlmIChtb2RlID09PSAnd3lzaXd5ZycpIHtcbiAgICAgIHJldHVybiBlZGl0YWJsZS5pbm5lckhUTUw7XG4gICAgfVxuICAgIHJldHVybiB0ZXh0YXJlYS52YWx1ZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHdyaXRlIChtb2RlLCB2YWx1ZSkge1xuICAgIGlmIChtb2RlID09PSAnd3lzaXd5ZycpIHtcbiAgICAgIGVkaXRhYmxlLmlubmVySFRNTCA9IHZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0ZXh0YXJlYS52YWx1ZSA9IHZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHdyaXRlU2VsZWN0aW9uIChzdGF0ZSkge1xuICAgIGlmIChzdGF0ZS5tb2RlID09PSAnd3lzaXd5ZycpIHtcbiAgICAgIHdyaXRlU2VsZWN0aW9uRWRpdGFibGUoc3RhdGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICB3cml0ZVNlbGVjdGlvblRleHRhcmVhKHN0YXRlKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZWFkU2VsZWN0aW9uIChzdGF0ZSkge1xuICAgIGlmIChzdGF0ZS5tb2RlID09PSAnd3lzaXd5ZycpIHtcbiAgICAgIHJlYWRTZWxlY3Rpb25FZGl0YWJsZShzdGF0ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlYWRTZWxlY3Rpb25UZXh0YXJlYShzdGF0ZSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gd3JpdGVTZWxlY3Rpb25UZXh0YXJlYSAoc3RhdGUpIHtcbiAgICB2YXIgcmFuZ2U7XG4gICAgaWYgKHRleHRhcmVhLnNlbGVjdGlvblN0YXJ0ICE9PSB2b2lkIDApIHtcbiAgICAgIHRleHRhcmVhLmZvY3VzKCk7XG4gICAgICB0ZXh0YXJlYS5zZWxlY3Rpb25TdGFydCA9IHN0YXRlLnN0YXJ0O1xuICAgICAgdGV4dGFyZWEuc2VsZWN0aW9uRW5kID0gc3RhdGUuZW5kO1xuICAgICAgdGV4dGFyZWEuc2Nyb2xsVG9wID0gc3RhdGUuc2Nyb2xsVG9wO1xuICAgIH0gZWxzZSBpZiAoZG9jLnNlbGVjdGlvbikge1xuICAgICAgaWYgKGRvYy5hY3RpdmVFbGVtZW50ICYmIGRvYy5hY3RpdmVFbGVtZW50ICE9PSB0ZXh0YXJlYSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0ZXh0YXJlYS5mb2N1cygpO1xuICAgICAgcmFuZ2UgPSB0ZXh0YXJlYS5jcmVhdGVUZXh0UmFuZ2UoKTtcbiAgICAgIHJhbmdlLm1vdmVTdGFydCgnY2hhcmFjdGVyJywgLXRleHRhcmVhLnZhbHVlLmxlbmd0aCk7XG4gICAgICByYW5nZS5tb3ZlRW5kKCdjaGFyYWN0ZXInLCAtdGV4dGFyZWEudmFsdWUubGVuZ3RoKTtcbiAgICAgIHJhbmdlLm1vdmVFbmQoJ2NoYXJhY3RlcicsIHN0YXRlLmVuZCk7XG4gICAgICByYW5nZS5tb3ZlU3RhcnQoJ2NoYXJhY3RlcicsIHN0YXRlLnN0YXJ0KTtcbiAgICAgIHJhbmdlLnNlbGVjdCgpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWRTZWxlY3Rpb25UZXh0YXJlYSAoc3RhdGUpIHtcbiAgICBpZiAodGV4dGFyZWEuc2VsZWN0aW9uU3RhcnQgIT09IHZvaWQgMCkge1xuICAgICAgc3RhdGUuc3RhcnQgPSB0ZXh0YXJlYS5zZWxlY3Rpb25TdGFydDtcbiAgICAgIHN0YXRlLmVuZCA9IHRleHRhcmVhLnNlbGVjdGlvbkVuZDtcbiAgICB9IGVsc2UgaWYgKGRvYy5zZWxlY3Rpb24pIHtcbiAgICAgIGFuY2llbnRseVJlYWRTZWxlY3Rpb25UZXh0YXJlYShzdGF0ZSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gYW5jaWVudGx5UmVhZFNlbGVjdGlvblRleHRhcmVhIChzdGF0ZSkge1xuICAgIGlmIChkb2MuYWN0aXZlRWxlbWVudCAmJiBkb2MuYWN0aXZlRWxlbWVudCAhPT0gdGV4dGFyZWEpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBzdGF0ZS50ZXh0ID0gZml4RU9MKHRleHRhcmVhLnZhbHVlKTtcblxuICAgIHZhciByYW5nZSA9IGRvYy5zZWxlY3Rpb24uY3JlYXRlUmFuZ2UoKTtcbiAgICB2YXIgZml4ZWRSYW5nZSA9IGZpeEVPTChyYW5nZS50ZXh0KTtcbiAgICB2YXIgbWFya2VyID0gJ1xceDA3JztcbiAgICB2YXIgbWFya2VkUmFuZ2UgPSBtYXJrZXIgKyBmaXhlZFJhbmdlICsgbWFya2VyO1xuXG4gICAgcmFuZ2UudGV4dCA9IG1hcmtlZFJhbmdlO1xuXG4gICAgdmFyIGlucHV0VGV4dCA9IGZpeEVPTCh0ZXh0YXJlYS52YWx1ZSk7XG5cbiAgICByYW5nZS5tb3ZlU3RhcnQoJ2NoYXJhY3RlcicsIC1tYXJrZWRSYW5nZS5sZW5ndGgpO1xuICAgIHJhbmdlLnRleHQgPSBmaXhlZFJhbmdlO1xuICAgIHN0YXRlLnN0YXJ0ID0gaW5wdXRUZXh0LmluZGV4T2YobWFya2VyKTtcbiAgICBzdGF0ZS5lbmQgPSBpbnB1dFRleHQubGFzdEluZGV4T2YobWFya2VyKSAtIG1hcmtlci5sZW5ndGg7XG5cbiAgICB2YXIgZGlmZiA9IHN0YXRlLnRleHQubGVuZ3RoIC0gZml4RU9MKHRleHRhcmVhLnZhbHVlKS5sZW5ndGg7XG4gICAgaWYgKGRpZmYpIHtcbiAgICAgIHJhbmdlLm1vdmVTdGFydCgnY2hhcmFjdGVyJywgLWZpeGVkUmFuZ2UubGVuZ3RoKTtcbiAgICAgIGZpeGVkUmFuZ2UgKz0gbWFueSgnXFxuJywgZGlmZik7XG4gICAgICBzdGF0ZS5lbmQgKz0gZGlmZjtcbiAgICAgIHJhbmdlLnRleHQgPSBmaXhlZFJhbmdlO1xuICAgIH1cbiAgICBzdGF0ZS5zZWxlY3QoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHdyaXRlU2VsZWN0aW9uRWRpdGFibGUgKHN0YXRlKSB7XG4gICAgdmFyIGNodW5rcyA9IHN0YXRlLmNhY2hlZENodW5rcyB8fCBzdGF0ZS5nZXRDaHVua3MoKTtcbiAgICB2YXIgc3RhcnQgPSBjaHVua3MuYmVmb3JlLmxlbmd0aDtcbiAgICB2YXIgZW5kID0gc3RhcnQgKyBjaHVua3Muc2VsZWN0aW9uLmxlbmd0aDtcbiAgICB2YXIgcCA9IHt9O1xuXG4gICAgd2FsayhlZGl0YWJsZS5maXJzdENoaWxkLCBwZWVrKTtcbiAgICBlZGl0YWJsZS5mb2N1cygpO1xuICAgIHNldFNlbGVjdGlvbihwKTtcblxuICAgIGZ1bmN0aW9uIHBlZWsgKGNvbnRleHQsIGVsKSB7XG4gICAgICB2YXIgY3Vyc29yID0gY29udGV4dC50ZXh0Lmxlbmd0aDtcbiAgICAgIHZhciBjb250ZW50ID0gcmVhZE5vZGUoZWwpLmxlbmd0aDtcbiAgICAgIHZhciBzdW0gPSBjdXJzb3IgKyBjb250ZW50O1xuICAgICAgaWYgKCFwLnN0YXJ0Q29udGFpbmVyICYmIHN1bSA+PSBzdGFydCkge1xuICAgICAgICBwLnN0YXJ0Q29udGFpbmVyID0gZWw7XG4gICAgICAgIHAuc3RhcnRPZmZzZXQgPSBib3VuZGVkKHN0YXJ0IC0gY3Vyc29yKTtcbiAgICAgIH1cbiAgICAgIGlmICghcC5lbmRDb250YWluZXIgJiYgc3VtID49IGVuZCkge1xuICAgICAgICBwLmVuZENvbnRhaW5lciA9IGVsO1xuICAgICAgICBwLmVuZE9mZnNldCA9IGJvdW5kZWQoZW5kIC0gY3Vyc29yKTtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gYm91bmRlZCAob2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiBNYXRoLm1heCgwLCBNYXRoLm1pbihjb250ZW50LCBvZmZzZXQpKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZWFkU2VsZWN0aW9uRWRpdGFibGUgKHN0YXRlKSB7XG4gICAgdmFyIHNlbCA9IGdldFNlbGVjdGlvbigpO1xuICAgIHZhciBkaXN0YW5jZSA9IHdhbGsoZWRpdGFibGUuZmlyc3RDaGlsZCwgcGVlayk7XG4gICAgdmFyIHN0YXJ0ID0gZGlzdGFuY2Uuc3RhcnQgfHwgMDtcbiAgICB2YXIgZW5kID0gZGlzdGFuY2UuZW5kIHx8IDA7XG5cbiAgICBzdGF0ZS50ZXh0ID0gZGlzdGFuY2UudGV4dDtcblxuICAgIGlmIChlbmQgPiBzdGFydCkge1xuICAgICAgc3RhdGUuc3RhcnQgPSBzdGFydDtcbiAgICAgIHN0YXRlLmVuZCA9IGVuZDtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RhdGUuc3RhcnQgPSBlbmQ7XG4gICAgICBzdGF0ZS5lbmQgPSBzdGFydDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWVrIChjb250ZXh0LCBlbCkge1xuICAgICAgaWYgKGVsID09PSBzZWwuYW5jaG9yTm9kZSkge1xuICAgICAgICBjb250ZXh0LnN0YXJ0ID0gY29udGV4dC50ZXh0Lmxlbmd0aCArIHNlbC5hbmNob3JPZmZzZXQ7XG4gICAgICB9XG4gICAgICBpZiAoZWwgPT09IHNlbC5mb2N1c05vZGUpIHtcbiAgICAgICAgY29udGV4dC5lbmQgPSBjb250ZXh0LnRleHQubGVuZ3RoICsgc2VsLmZvY3VzT2Zmc2V0O1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHdhbGsgKGVsLCBwZWVrLCBjdHgsIHNpYmxpbmdzKSB7XG4gICAgdmFyIGNvbnRleHQgPSBjdHggfHwgeyB0ZXh0OiAnJyB9O1xuXG4gICAgaWYgKCFlbCkge1xuICAgICAgcmV0dXJuIGNvbnRleHQ7XG4gICAgfVxuXG4gICAgdmFyIGVsTm9kZSA9IGVsLm5vZGVUeXBlID09PSAxO1xuICAgIHZhciB0ZXh0Tm9kZSA9IGVsLm5vZGVUeXBlID09PSAzO1xuXG4gICAgcGVlayhjb250ZXh0LCBlbCk7XG5cbiAgICBpZiAodGV4dE5vZGUpIHtcbiAgICAgIGNvbnRleHQudGV4dCArPSByZWFkTm9kZShlbCk7XG4gICAgfVxuICAgIGlmIChlbE5vZGUpIHtcbiAgICAgIGlmIChlbC5vdXRlckhUTUwubWF0Y2gocm9wZW4pKSB7IGNvbnRleHQudGV4dCArPSBSZWdFeHAuJDE7IH1cbiAgICAgIGNhc3QoZWwuY2hpbGROb2RlcykuZm9yRWFjaCh3YWxrQ2hpbGRyZW4pO1xuICAgICAgaWYgKGVsLm91dGVySFRNTC5tYXRjaChyY2xvc2UpKSB7IGNvbnRleHQudGV4dCArPSBSZWdFeHAuJDE7IH1cbiAgICB9XG4gICAgaWYgKHNpYmxpbmdzICE9PSBmYWxzZSAmJiBlbC5uZXh0U2libGluZykge1xuICAgICAgcmV0dXJuIHdhbGsoZWwubmV4dFNpYmxpbmcsIHBlZWssIGNvbnRleHQpO1xuICAgIH1cbiAgICByZXR1cm4gY29udGV4dDtcblxuICAgIGZ1bmN0aW9uIHdhbGtDaGlsZHJlbiAoY2hpbGQpIHtcbiAgICAgIHdhbGsoY2hpbGQsIHBlZWssIGNvbnRleHQsIGZhbHNlKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZWFkTm9kZSAoZWwpIHtcbiAgICByZXR1cm4gZWwubm9kZVR5cGUgPT09IDMgPyBmaXhFT0woZWwudGV4dENvbnRlbnQgfHwgZWwuaW5uZXJUZXh0IHx8ICcnKSA6ICcnO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gc3VyZmFjZTtcbiJdfQ==
},{"./cast":24,"./fixEOL":29,"./many":43,"seleccion":18}],32:[function(require,module,exports){
'use strict';

function getText (el) {
  return el.innerText || el.textContent;
}

module.exports = getText;

},{}],33:[function(require,module,exports){
'use strict';

var trimChunks = require('../chunks/trim');

function HtmlChunks () {
}

HtmlChunks.prototype.trim = trimChunks;

HtmlChunks.prototype.findTags = function () {
};

HtmlChunks.prototype.skip = function () {
};

module.exports = HtmlChunks;

},{"../chunks/trim":26}],34:[function(require,module,exports){
'use strict';

var strings = require('../strings');
var wrapping = require('./wrapping');

function blockquote (chunks) {
  wrapping('blockquote', strings.placeholders.quote, chunks);
}

module.exports = blockquote;

},{"../strings":61,"./wrapping":41}],35:[function(require,module,exports){
'use strict';

var strings = require('../strings');
var wrapping = require('./wrapping');

function boldOrItalic (chunks, type) {
  wrapping(type === 'bold' ? 'strong' : 'em', strings.placeholders[type], chunks);
}

module.exports = boldOrItalic;

},{"../strings":61,"./wrapping":41}],36:[function(require,module,exports){
'use strict';

var strings = require('../strings');
var wrapping = require('./wrapping');

function codeblock (chunks) {
  wrapping('pre><code', strings.placeholders.code, chunks);
}

module.exports = codeblock;

},{"../strings":61,"./wrapping":41}],37:[function(require,module,exports){
'use strict';

var strings = require('../strings');
var rleading = /<h([1-6])( [^>]*)?>$/;
var rtrailing = /^<\/h([1-6])>/;

function heading (chunks) {
  chunks.trim();

  var trail = rtrailing.exec(chunks.after);
  var lead = rleading.exec(chunks.before);
  if (lead && trail && lead[1] === trail[1]) {
    swap();
  } else {
    add();
  } 

  // func changes headings
  function swap () {
    var level = parseInt(lead[1], 10);
    // checks for the next heading size. Calls remove() if <h4> is reached.
    var next = level > 3 ? 0 : level + 1;
    if(next === 0) {
      remove();
    }
    else {
      chunks.before = chunks.before.replace(rleading, '<h' + next + '>');
      chunks.after = chunks.after.replace(rtrailing, '</h' + next + '>');
    }
  }

  function remove () {
    chunks.before = chunks.before.replace(rleading, '');
    chunks.after = chunks.after.replace(rtrailing, '');
  }

  // func called to enter a new heading
  function add () {
    if (!chunks.selection) {
      chunks.selection = strings.placeholders.heading;
    }
    chunks.before += '<h1>';
    chunks.after = '</h1>' + chunks.after;
  }
}

module.exports = heading;

},{"../strings":61}],38:[function(require,module,exports){
'use strict';

function hr (chunks) {
  chunks.before += '\n<hr>\n';
  chunks.selection = '';
}

module.exports = hr;

},{}],39:[function(require,module,exports){
'use strict';

var crossvent = require('crossvent');
var once = require('../once');
var strings = require('../strings');
var parseLinkInput = require('../chunks/parseLinkInput');
var rleading = /<a( [^>]*)?>$/;
var rtrailing = /^<\/a>/;
var rimage = /<img( [^>]*)?\/>$/;

function linkOrImageOrAttachment (chunks, options) {
  var type = options.type;
  var image = type === 'image';
  var resume;

  if (type !== 'attachment') {
    chunks.trim();
  }

  if (removal()) {
    return;
  }

  resume = this.async();

  options.prompts.close();
  (options.prompts[type] || options.prompts.link)(options, once(resolved));

  function removal () {
    if (image) {
      if (rimage.test(chunks.selection)) {
        chunks.selection = '';
        return true;
      }
    } else if (rtrailing.exec(chunks.after) && rleading.exec(chunks.before)) {
      chunks.before = chunks.before.replace(rleading, '');
      chunks.after = chunks.after.replace(rtrailing, '');
      return true;
    }
  }

  function resolved (result) {
    var parts;
    var link = parseLinkInput(result.definition);
    if (link.href.length === 0) {
      resume(); return;
    }

    if (type === 'attachment') {
      parts = options.mergeHtmlAndAttachment(chunks.before + chunks.selection + chunks.after, link);
      chunks.before = parts.before;
      chunks.selection = parts.selection;
      chunks.after = parts.after;
      resume();
      crossvent.fabricate(options.surface.textarea, 'woofmark-mode-change');
      return;
    }

    var title = link.title ? ' title="' + link.title + '"' : '';

    if (image) {
      imageWrap();
    } else {
      linkWrap();
    }

    if (!chunks.selection) {
      chunks.selection = strings.placeholders[type];
    }
    resume();

    function imageWrap () {
      chunks.before += '<img src="' + link.href + '" alt="';
      chunks.after = '"' + title + ' />' + chunks.after;
    }

    function linkWrap () {
      var names = options.classes.input.links;
      var classes = names ? ' class="' + names + '"' : '';
      chunks.before += '<a href="' + link.href + '"' + title + classes + '>';
      chunks.after = '</a>' + chunks.after;
    }
  }
}

module.exports = linkOrImageOrAttachment;

},{"../chunks/parseLinkInput":25,"../once":54,"../strings":61,"crossvent":4}],40:[function(require,module,exports){
'use strict';

var strings = require('../strings');
var rleftsingle = /<(ul|ol)( [^>]*)?>\s*<li( [^>]*)?>$/;
var rrightsingle = /^<\/li>\s*<\/(ul|ol)>/;
var rleftitem = /<li( [^>]*)?>$/;
var rrightitem = /^<\/li( [^>]*)?>/;
var ropen = /^<(ul|ol)( [^>]*)?>$/;

function list (chunks, ordered) {
  var tag = ordered ? 'ol' : 'ul';
  var olist = '<' + tag + '>';
  var clist = '</' + tag + '>';

  chunks.trim();

  if (rleftsingle.test(chunks.before) && rrightsingle.test(chunks.after)) {
    if (tag === RegExp.$1) {
      chunks.before = chunks.before.replace(rleftsingle, '');
      chunks.after = chunks.after.replace(rrightsingle, '');
      return;
    }
  }

  var ulStart = chunks.before.lastIndexOf('<ul');
  var olStart = chunks.before.lastIndexOf('<ol');
  var closeTag = chunks.after.indexOf('</ul>');
  if (closeTag === -1) {
    closeTag = chunks.after.indexOf('</ol>');
  }
  if (closeTag === -1) {
    add(); return;
  }
  var openStart = ulStart > olStart ? ulStart : olStart;
  if (openStart === -1) {
    add(); return;
  }
  var openEnd = chunks.before.indexOf('>', openStart);
  if (openEnd === -1) {
    add(); return;
  }

  var openTag = chunks.before.substr(openStart, openEnd - openStart + 1);
  if (ropen.test(openTag)) {
    if (tag !== RegExp.$1) {
      chunks.before = chunks.before.substr(0, openStart) + '<' + tag + chunks.before.substr(openStart + 3);
      chunks.after = chunks.after.substr(0, closeTag) + '</' + tag + chunks.after.substr(closeTag + 4);
    } else {
      if (rleftitem.test(chunks.before) && rrightitem.test(chunks.after)) {
        chunks.before = chunks.before.replace(rleftitem, '');
        chunks.after = chunks.after.replace(rrightitem, '');
      } else {
        add(true);
      }
    }
  }

  function add (list) {
    var open = list ? '' : olist;
    var close = list ? '' : clist;

    chunks.before += open + '<li>';
    chunks.after = '</li>' + close + chunks.after;

    if (!chunks.selection) {
      chunks.selection = strings.placeholders.listitem;
    }
  }
}

module.exports = list;

},{"../strings":61}],41:[function(require,module,exports){
'use strict';

function wrapping (tag, placeholder, chunks) {
  var open = '<' + tag;
  var close = '</' + tag.replace(/</g, '</');
  var rleading = new RegExp(open + '( [^>]*)?>$', 'i');
  var rtrailing = new RegExp('^' + close + '>', 'i');
  var ropen = new RegExp(open + '( [^>]*)?>', 'ig');
  var rclose = new RegExp(close + '( [^>]*)?>', 'ig');

  chunks.trim();

  var trail = rtrailing.exec(chunks.after);
  var lead = rleading.exec(chunks.before);
  if (lead && trail) {
    chunks.before = chunks.before.replace(rleading, '');
    chunks.after = chunks.after.replace(rtrailing, '');
  } else {
    if (!chunks.selection) {
      chunks.selection = placeholder;
    }
    var opened = ropen.test(chunks.selection);
    if (opened) {
      chunks.selection = chunks.selection.replace(ropen, '');
      if (!surrounded(chunks, tag)) {
        chunks.before += open + '>';
      }
    }
    var closed = rclose.test(chunks.selection);
    if (closed) {
      chunks.selection = chunks.selection.replace(rclose, '');
      if (!surrounded(chunks, tag)) {
        chunks.after = close + '>' + chunks.after;
      }
    }
    if (opened || closed) {
      pushover(); return;
    }
    if (surrounded(chunks, tag)) {
      if (rleading.test(chunks.before)) {
        chunks.before = chunks.before.replace(rleading, '');
      } else {
        chunks.before += close + '>';
      }
      if (rtrailing.test(chunks.after)) {
        chunks.after = chunks.after.replace(rtrailing, '');
      } else {
        chunks.after = open + '>' + chunks.after;
      }
    } else if (!closebounded(chunks, tag)) {
      chunks.after = close + '>' + chunks.after;
      chunks.before += open + '>';
    }
    pushover();
  }

  function pushover () {
    chunks.selection.replace(/<(\/)?([^> ]+)( [^>]*)?>/ig, pushoverOtherTags);
  }

  function pushoverOtherTags (all, closing, tag, a, i) {
    var attrs = a || '';
    var open = !closing;
    var rclosed = new RegExp('<\/' + tag.replace(/</g, '</') + '>', 'i');
    var ropened = new RegExp('<' + tag + '( [^>]*)?>', 'i');
    if (open && !rclosed.test(chunks.selection.substr(i))) {
      chunks.selection += '</' + tag + '>';
      chunks.after = chunks.after.replace(/^(<\/[^>]+>)/, '$1<' + tag + attrs + '>');
    }

    if (closing && !ropened.test(chunks.selection.substr(0, i))) {
      chunks.selection = '<' + tag + attrs + '>' + chunks.selection;
      chunks.before = chunks.before.replace(/(<[^>]+(?: [^>]*)?>)$/, '</' + tag + '>$1');
    }
  }
}

function closebounded (chunks, tag) {
  var rcloseleft = new RegExp('</' + tag.replace(/</g, '</') + '>$', 'i');
  var ropenright = new RegExp('^<' + tag + '(?: [^>]*)?>', 'i');
  var bounded = rcloseleft.test(chunks.before) && ropenright.test(chunks.after);
  if (bounded) {
    chunks.before = chunks.before.replace(rcloseleft, '');
    chunks.after = chunks.after.replace(ropenright, '');
  }
  return bounded;
}

function surrounded (chunks, tag) {
  var ropen = new RegExp('<' + tag + '(?: [^>]*)?>', 'ig');
  var rclose = new RegExp('<\/' + tag.replace(/</g, '</') + '>', 'ig');
  var opensBefore = count(chunks.before, ropen);
  var opensAfter = count(chunks.after, ropen);
  var closesBefore = count(chunks.before, rclose);
  var closesAfter = count(chunks.after, rclose);
  var open = opensBefore - closesBefore > 0;
  var close = closesAfter - opensAfter > 0;
  return open && close;

  function count (text, regex) {
    var match = text.match(regex);
    if (match) {
      return match.length;
    }
    return 0;
  }
}

module.exports = wrapping;

},{}],42:[function(require,module,exports){
(function (global){
'use strict';

function isVisibleElement (elem) {
  if (global.getComputedStyle) {
    return global.getComputedStyle(elem, null).getPropertyValue('display') !== 'none';
  } else if (elem.currentStyle) {
    return elem.currentStyle.display !== 'none';
  }
}

module.exports = isVisibleElement;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9pc1Zpc2libGVFbGVtZW50LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gaXNWaXNpYmxlRWxlbWVudCAoZWxlbSkge1xuICBpZiAoZ2xvYmFsLmdldENvbXB1dGVkU3R5bGUpIHtcbiAgICByZXR1cm4gZ2xvYmFsLmdldENvbXB1dGVkU3R5bGUoZWxlbSwgbnVsbCkuZ2V0UHJvcGVydHlWYWx1ZSgnZGlzcGxheScpICE9PSAnbm9uZSc7XG4gIH0gZWxzZSBpZiAoZWxlbS5jdXJyZW50U3R5bGUpIHtcbiAgICByZXR1cm4gZWxlbS5jdXJyZW50U3R5bGUuZGlzcGxheSAhPT0gJ25vbmUnO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNWaXNpYmxlRWxlbWVudDtcbiJdfQ==
},{}],43:[function(require,module,exports){
'use strict';

function many (text, times) {
  return new Array(times + 1).join(text);
}

module.exports = many;

},{}],44:[function(require,module,exports){
'use strict';

var many = require('../many');
var extendRegExp = require('../extendRegExp');
var trimChunks = require('../chunks/trim');
var re = RegExp;

function MarkdownChunks () {
}

MarkdownChunks.prototype.trim = trimChunks;

MarkdownChunks.prototype.findTags = function (startRegex, endRegex) {
  var self = this;
  var regex;

  if (startRegex) {
    regex = extendRegExp(startRegex, '', '$');
    this.before = this.before.replace(regex, startReplacer);
    regex = extendRegExp(startRegex, '^', '');
    this.selection = this.selection.replace(regex, startReplacer);
  }

  if (endRegex) {
    regex = extendRegExp(endRegex, '', '$');
    this.selection = this.selection.replace(regex, endReplacer);
    regex = extendRegExp(endRegex, '^', '');
    this.after = this.after.replace(regex, endReplacer);
  }

  function startReplacer (match) {
    self.startTag = self.startTag + match; return '';
  }

  function endReplacer (match) {
    self.endTag = match + self.endTag; return '';
  }
};

MarkdownChunks.prototype.skip = function (options) {
  var o = options || {};
  var beforeCount = 'before' in o ? o.before : 1;
  var afterCount = 'after' in o ? o.after : 1;

  this.selection = this.selection.replace(/(^\n*)/, '');
  this.startTag = this.startTag + re.$1;
  this.selection = this.selection.replace(/(\n*$)/, '');
  this.endTag = this.endTag + re.$1;
  this.startTag = this.startTag.replace(/(^\n*)/, '');
  this.before = this.before + re.$1;
  this.endTag = this.endTag.replace(/(\n*$)/, '');
  this.after = this.after + re.$1;

  if (this.before) {
    this.before = replace(this.before, ++beforeCount, '$');
  }

  if (this.after) {
    this.after = replace(this.after, ++afterCount, '');
  }

  function replace (text, count, suffix) {
    var regex = o.any ? '\\n*' : many('\\n?', count);
    var replacement = many('\n', count);
    return text.replace(new re(regex + suffix), replacement);
  }
};

module.exports = MarkdownChunks;

},{"../chunks/trim":26,"../extendRegExp":28,"../many":43}],45:[function(require,module,exports){
'use strict';

var strings = require('../strings');
var wrapping = require('./wrapping');
var settings = require('./settings');
var rtrailblankline = /(>[ \t]*)$/;
var rleadblankline = /^(>[ \t]*)/;
var rnewlinefencing = /^(\n*)([^\r]+?)(\n*)$/;
var rendtag = /^(((\n|^)(\n[ \t]*)*>(.+\n)*.*)+(\n[ \t]*)*)/;
var rleadbracket = /^\n((>|\s)*)\n/;
var rtrailbracket = /\n((>|\s)*)\n$/;

function blockquote (chunks) {
  var match = '';
  var leftOver = '';
  var line;

  chunks.selection = chunks.selection.replace(rnewlinefencing, newlinereplacer);
  chunks.before = chunks.before.replace(rtrailblankline, trailblanklinereplacer);
  chunks.selection = chunks.selection.replace(/^(\s|>)+$/, '');
  chunks.selection = chunks.selection || strings.placeholders.quote;

  if (chunks.before) {
    beforeProcessing();
  }

  chunks.startTag = match;
  chunks.before = leftOver;

  if (chunks.after) {
    chunks.after = chunks.after.replace(/^\n?/, '\n');
  }

  chunks.after = chunks.after.replace(rendtag, endtagreplacer);

  if (/^(?![ ]{0,3}>)/m.test(chunks.selection)) {
    wrapping.wrap(chunks, settings.lineLength - 2);
    chunks.selection = chunks.selection.replace(/^/gm, '> ');
    replaceBlanksInTags(true);
    chunks.skip();
  } else {
    chunks.selection = chunks.selection.replace(/^[ ]{0,3}> ?/gm, '');
    wrapping.unwrap(chunks);
    replaceBlanksInTags(false);

    if (!/^(\n|^)[ ]{0,3}>/.test(chunks.selection) && chunks.startTag) {
      chunks.startTag = chunks.startTag.replace(/\n{0,2}$/, '\n\n');
    }

    if (!/(\n|^)[ ]{0,3}>.*$/.test(chunks.selection) && chunks.endTag) {
      chunks.endTag = chunks.endTag.replace(/^\n{0,2}/, '\n\n');
    }
  }

  if (!/\n/.test(chunks.selection)) {
    chunks.selection = chunks.selection.replace(rleadblankline, leadblanklinereplacer);
  }

  function newlinereplacer (all, before, text, after) {
    chunks.before += before;
    chunks.after = after + chunks.after;
    return text;
  }

  function trailblanklinereplacer (all, blank) {
    chunks.selection = blank + chunks.selection; return '';
  }

  function leadblanklinereplacer (all, blanks) {
    chunks.startTag += blanks; return '';
  }

  function beforeProcessing () {
    var lines = chunks.before.replace(/\n$/, '').split('\n');
    var chained = false;
    var good;

    for (var i = 0; i < lines.length; i++) {
      good = false;
      line = lines[i];
      chained = chained && line.length > 0;
      if (/^>/.test(line)) {
        good = true;
        if (!chained && line.length > 1) {
          chained = true;
        }
      } else if (/^[ \t]*$/.test(line)) {
        good = true;
      } else {
        good = chained;
      }
      if (good) {
        match += line + '\n';
      } else {
        leftOver += match + line;
        match = '\n';
      }
    }

    if (!/(^|\n)>/.test(match)) {
      leftOver += match;
      match = '';
    }
  }

  function endtagreplacer (all) {
    chunks.endTag = all; return '';
  }

  function replaceBlanksInTags (bracket) {
    var replacement = bracket ? '> ' : '';

    if (chunks.startTag) {
      chunks.startTag = chunks.startTag.replace(rtrailbracket, replacer);
    }
    if (chunks.endTag) {
      chunks.endTag = chunks.endTag.replace(rleadbracket, replacer);
    }

    function replacer (all, markdown) {
      return '\n' + markdown.replace(/^[ ]{0,3}>?[ \t]*$/gm, replacement) + '\n';
    }
  }
}

module.exports = blockquote;

},{"../strings":61,"./settings":52,"./wrapping":53}],46:[function(require,module,exports){
'use strict';

var rleading = /^(\**)/;
var rtrailing = /(\**$)/;
var rtrailingspace = /(\s?)$/;
var strings = require('../strings');

function boldOrItalic (chunks, type) {
  var rnewlines = /\n{2,}/g;
  var starCount = type === 'bold' ? 2 : 1;

  chunks.trim();
  chunks.selection = chunks.selection.replace(rnewlines, '\n');

  var markup;
  var leadStars = rtrailing.exec(chunks.before)[0];
  var trailStars = rleading.exec(chunks.after)[0];
  var stars = '\\*{' + starCount + '}';
  var fence = Math.min(leadStars.length, trailStars.length);
  if (fence >= starCount && (fence !== 2 || starCount !== 1)) {
    chunks.before = chunks.before.replace(new RegExp(stars + '$', ''), '');
    chunks.after = chunks.after.replace(new RegExp('^' + stars, ''), '');
  } else if (!chunks.selection && trailStars) {
    chunks.after = chunks.after.replace(rleading, '');
    chunks.before = chunks.before.replace(rtrailingspace, '') + trailStars + RegExp.$1;
  } else {
    if (!chunks.selection && !trailStars) {
      chunks.selection = strings.placeholders[type];
    }

    markup = starCount === 1 ? '*' : '**';
    chunks.before = chunks.before + markup;
    chunks.after = markup + chunks.after;
  }
}

module.exports = boldOrItalic;

},{"../strings":61}],47:[function(require,module,exports){
'use strict';

var strings = require('../strings');
var rtextbefore = /\S[ ]*$/;
var rtextafter = /^[ ]*\S/;
var rnewline = /\n/;
var rbacktick = /`/;
var rfencebefore = /```[a-z]*\n?$/;
var rfencebeforeinside = /^```[a-z]*\n/;
var rfenceafter = /^\n?```/;
var rfenceafterinside = /\n```$/;

function codeblock (chunks, options) {
  var newlined = rnewline.test(chunks.selection);
  var trailing = rtextafter.test(chunks.after);
  var leading = rtextbefore.test(chunks.before);
  var outfenced = rfencebefore.test(chunks.before) && rfenceafter.test(chunks.after);
  if (outfenced || newlined || !(leading || trailing)) {
    block(outfenced);
  } else {
    inline();
  }

  function inline () {
    chunks.trim();
    chunks.findTags(rbacktick, rbacktick);

    if (!chunks.startTag && !chunks.endTag) {
      chunks.startTag = chunks.endTag = '`';
      if (!chunks.selection) {
        chunks.selection = strings.placeholders.code;
      }
    } else if (chunks.endTag && !chunks.startTag) {
      chunks.before += chunks.endTag;
      chunks.endTag = '';
    } else {
      chunks.startTag = chunks.endTag = '';
    }
  }

  function block (outfenced) {
    if (outfenced) {
      chunks.before = chunks.before.replace(rfencebefore, '');
      chunks.after = chunks.after.replace(rfenceafter, '');
      return;
    }

    chunks.before = chunks.before.replace(/[ ]{4}|```[a-z]*\n$/, mergeSelection);
    chunks.skip({
      before: /(\n|^)(\t|[ ]{4,}|```[a-z]*\n).*\n$/.test(chunks.before) ? 0 : 1,
      after: /^\n(\t|[ ]{4,}|\n```)/.test(chunks.after) ? 0 : 1
    });

    if (!chunks.selection) {
      if (options.fencing) {
        chunks.startTag = '```\n';
        chunks.endTag = '\n```';
      } else {
        chunks.startTag = '    ';
      }
      chunks.selection = strings.placeholders.code;
    } else {
      if (rfencebeforeinside.test(chunks.selection) && rfenceafterinside.test(chunks.selection)) {
        chunks.selection = chunks.selection.replace(/(^```[a-z]*\n)|(```$)/g, '');
      } else if (/^[ ]{0,3}\S/m.test(chunks.selection)) {
        if (options.fencing) {
          chunks.before += '```\n';
          chunks.after = '\n```' + chunks.after;
        } else if (newlined) {
          chunks.selection = chunks.selection.replace(/^/gm, '    ');
        } else {
          chunks.before += '    ';
        }
      } else {
        chunks.selection = chunks.selection.replace(/^(?:[ ]{4}|[ ]{0,3}\t|```[a-z]*)/gm, '');
      }
    }

    function mergeSelection (all) {
      chunks.selection = all + chunks.selection; return '';
    }
  }
}

module.exports = codeblock;

},{"../strings":61}],48:[function(require,module,exports){
'use strict';

var many = require('../many');
var strings = require('../strings');

function heading (chunks) {
  var level = 0;

  chunks.selection = chunks.selection
    .replace(/\s+/g, ' ')
    .replace(/(^\s+|\s+$)/g, '');

  if (!chunks.selection) {
    chunks.startTag = '# ';
    chunks.selection = strings.placeholders.heading;
    chunks.endTag = '';
    chunks.skip({ before: 1, after: 1 });
    return;
  }

  chunks.findTags(/#+[ ]*/, /[ ]*#+/);

  if (/#+/.test(chunks.startTag)) {
    level = RegExp.lastMatch.length;
  }

  chunks.startTag = chunks.endTag = '';
  chunks.findTags(null, /\s?(-+|=+)/);

  if (/=+/.test(chunks.endTag)) {
    level = 1;
  }

  if (/-+/.test(chunks.endTag)) {
    level = 2;
  }

  chunks.startTag = chunks.endTag = '';
  chunks.skip({ before: 1, after: 1 });

  // checks the next heading size to implement. Changes to 0 if 4 is reached.
  var levelToCreate = level > 3 ? 0 : level + 1;
  if (levelToCreate === 0) {
    chunks.startTag = chunks.startTag.replace(/#+/, '');
  }
  else {
    chunks.startTag = many('#', levelToCreate) + ' ';
  }
}

module.exports = heading;

},{"../many":43,"../strings":61}],49:[function(require,module,exports){
'use strict';

function hr (chunks) {
  chunks.startTag = '----------\n';
  chunks.selection = '';
  chunks.skip({ left: 2, right: 1, any: true });
}

module.exports = hr;

},{}],50:[function(require,module,exports){
'use strict';

var once = require('../once');
var strings = require('../strings');
var parseLinkInput = require('../chunks/parseLinkInput');
var rdefinitions = /^[ ]{0,3}\[((?:attachment-)?\d+)\]:[ \t]*\n?[ \t]*<?(\S+?)>?[ \t]*\n?[ \t]*(?:(\n*)["(](.+?)[")][ \t]*)?(?:\n+|$)/gm;
var rattachment = /^attachment-(\d+)$/i;

function extractDefinitions (text, definitions) {
  rdefinitions.lastIndex = 0;
  return text.replace(rdefinitions, replacer);

  function replacer (all, id, link, newlines, title) {
    definitions[id] = all.replace(/\s*$/, '');
    if (newlines) {
      definitions[id] = all.replace(/["(](.+?)[")]$/, '');
      return newlines + title;
    }
    return '';
  }
}

function pushDefinition (chunks, definition, attachment) {
  var regex = /(\[)((?:\[[^\]]*\]|[^\[\]])*)(\][ ]?(?:\n[ ]*)?\[)((?:attachment-)?\d+)(\])/g;
  var anchor = 0;
  var definitions = {};
  var footnotes = [];

  chunks.before = extractDefinitions(chunks.before, definitions);
  chunks.selection = extractDefinitions(chunks.selection, definitions);
  chunks.after = extractDefinitions(chunks.after, definitions);
  chunks.before = chunks.before.replace(regex, getLink);

  if (definition) {
    if (!attachment) { pushAnchor(definition); }
  } else {
    chunks.selection = chunks.selection.replace(regex, getLink);
  }

  var result = anchor;

  chunks.after = chunks.after.replace(regex, getLink);

  if (chunks.after) {
    chunks.after = chunks.after.replace(/\n*$/, '');
  }
  if (!chunks.after) {
    chunks.selection = chunks.selection.replace(/\n*$/, '');
  }

  anchor = 0;
  Object.keys(definitions).forEach(pushAttachments);

  if (attachment) {
    pushAnchor(definition);
  }
  chunks.after += '\n\n' + footnotes.join('\n');

  return result;

  function pushAttachments (definition) {
    if (rattachment.test(definition)) {
      pushAnchor(definitions[definition]);
    }
  }

  function pushAnchor (definition) {
    anchor++;
    definition = definition.replace(/^[ ]{0,3}\[(attachment-)?(\d+)\]:/, '  [$1' + anchor + ']:');
    footnotes.push(definition);
  }

  function getLink (all, before, inner, afterInner, definition, end) {
    inner = inner.replace(regex, getLink);
    if (definitions[definition]) {
      pushAnchor(definitions[definition]);
      return before + inner + afterInner + anchor + end;
    }
    return all;
  }
}

function linkOrImageOrAttachment (chunks, options) {
  var type = options.type;
  var image = type === 'image';
  var resume;

  chunks.trim();
  chunks.findTags(/\s*!?\[/, /\][ ]?(?:\n[ ]*)?(\[.*?\])?/);

  if (chunks.endTag.length > 1 && chunks.startTag.length > 0) {
    chunks.startTag = chunks.startTag.replace(/!?\[/, '');
    chunks.endTag = '';
    pushDefinition(chunks);
    return;
  }

  chunks.selection = chunks.startTag + chunks.selection + chunks.endTag;
  chunks.startTag = chunks.endTag = '';

  if (/\n\n/.test(chunks.selection)) {
    pushDefinition(chunks);
    return;
  }
  resume = this.async();

  options.prompts.close();
  (options.prompts[type] || options.prompts.link)(options, once(resolved));

  function resolved (result) {
    var link = parseLinkInput(result.definition);
    if (link.href.length === 0) {
      resume(); return;
    }

    chunks.selection = (' ' + chunks.selection).replace(/([^\\](?:\\\\)*)(?=[[\]])/g, '$1\\').substr(1);

    var key = result.attachment ? '  [attachment-9999]: ' : ' [9999]: ';
    var definition = key + link.href + (link.title ? ' "' + link.title + '"' : '');
    var anchor = pushDefinition(chunks, definition, result.attachment);

    if (!result.attachment) {
      add();
    }

    resume();

    function add () {
      chunks.startTag = image ? '![' : '[';
      chunks.endTag = '][' + anchor + ']';

      if (!chunks.selection) {
        chunks.selection = strings.placeholders[type];
      }
    }
  }
}

module.exports = linkOrImageOrAttachment;

},{"../chunks/parseLinkInput":25,"../once":54,"../strings":61}],51:[function(require,module,exports){
'use strict';

var many = require('../many');
var strings = require('../strings');
var wrapping = require('./wrapping');
var settings = require('./settings');
var rprevious = /(\n|^)(([ ]{0,3}([*+-]|\d+[.])[ \t]+.*)(\n.+|\n{2,}([*+-].*|\d+[.])[ \t]+.*|\n{2,}[ \t]+\S.*)*)\n*$/;
var rnext = /^\n*(([ ]{0,3}([*+-]|\d+[.])[ \t]+.*)(\n.+|\n{2,}([*+-].*|\d+[.])[ \t]+.*|\n{2,}[ \t]+\S.*)*)\n*/;
var rbullettype = /^\s*([*+-])/;
var rskipper = /[^\n]\n\n[^\n]/;

function pad (text) {
  return ' ' + text + ' ';
}

function list (chunks, ordered) {
  var bullet = '-';
  var num = 1;
  var digital;
  var beforeSkip = 1;
  var afterSkip = 1;

  chunks.findTags(/(\n|^)*[ ]{0,3}([*+-]|\d+[.])\s+/, null);

  if (chunks.before && !/\n$/.test(chunks.before) && !/^\n/.test(chunks.startTag)) {
    chunks.before += chunks.startTag;
    chunks.startTag = '';
  }

  if (chunks.startTag) {
    digital = /\d+[.]/.test(chunks.startTag);
    chunks.startTag = '';
    chunks.selection = chunks.selection.replace(/\n[ ]{4}/g, '\n');
    wrapping.unwrap(chunks);
    chunks.skip();

    if (digital) {
      chunks.after = chunks.after.replace(rnext, getPrefixedItem);
    }
    if (ordered === digital) {
      return;
    }
  }

  chunks.before = chunks.before.replace(rprevious, beforeReplacer);

  if (!chunks.selection) {
    chunks.selection = strings.placeholders.listitem;
  }

  var prefix = nextBullet();
  var spaces = many(' ', prefix.length);

  chunks.after = chunks.after.replace(rnext, afterReplacer);
  chunks.trim(true);
  chunks.skip({ before: beforeSkip, after: afterSkip, any: true });
  chunks.startTag = prefix;
  wrapping.wrap(chunks, settings.lineLength - prefix.length);
  chunks.selection = chunks.selection.replace(/\n/g, '\n' + spaces);

  function beforeReplacer (text) {
    if (rbullettype.test(text)) {
      bullet = RegExp.$1;
    }
    beforeSkip = rskipper.test(text) ? 1 : 0;
    return getPrefixedItem(text);
  }

  function afterReplacer (text) {
    afterSkip = rskipper.test(text) ? 1 : 0;
    return getPrefixedItem(text);
  }

  function nextBullet () {
    if (ordered) {
      return pad((num++) + '.');
    }
    return pad(bullet);
  }

  function getPrefixedItem (text) {
    var rmarkers = /^[ ]{0,3}([*+-]|\d+[.])\s/gm;
    return text.replace(rmarkers, nextBullet);
  }
}

module.exports = list;

},{"../many":43,"../strings":61,"./settings":52,"./wrapping":53}],52:[function(require,module,exports){
'use strict';

module.exports = {
  lineLength: 72
};

},{}],53:[function(require,module,exports){
'use strict';

var prefixes = '(?:\\s{4,}|\\s*>|\\s*-\\s+|\\s*\\d+\\.|=|\\+|-|_|\\*|#|\\s*\\[[^\n]]+\\]:)';
var rleadingprefixes = new RegExp('^' + prefixes, '');
var rtext = new RegExp('([^\\n])\\n(?!(\\n|' + prefixes + '))', 'g');
var rtrailingspaces = /\s+$/;

function wrap (chunks, len) {
  var regex = new RegExp('(.{1,' + len + '})( +|$\\n?)', 'gm');

  unwrap(chunks);
  chunks.selection = chunks.selection
    .replace(regex, replacer)
    .replace(rtrailingspaces, '');

  function replacer (line, marked) {
    return rleadingprefixes.test(line) ? line : marked + '\n';
  }
}

function unwrap (chunks) {
  rtext.lastIndex = 0;
  chunks.selection = chunks.selection.replace(rtext, '$1 $2');
}

module.exports = {
  wrap: wrap,
  unwrap: unwrap
};

},{}],54:[function(require,module,exports){
'use strict';

function once (fn) {
  var disposed;
  return function disposable () {
    if (disposed) {
      return;
    }
    disposed = true;
    return fn.apply(this, arguments);
  };
}

module.exports = once;

},{}],55:[function(require,module,exports){
'use strict';

var doc = document;

function homebrewQSA (className) {
  var results = [];
  var all = doc.getElementsByTagName('*');
  var i;
  for (i in all) {
    if (wrap(all[i].className).indexOf(wrap(className)) !== -1) {
      results.push(all[i]);
    }
  }
  return results;
}

function wrap (text) {
  return ' ' + text + ' ';
}

function closePrompts () {
  if (doc.body.querySelectorAll) {
    remove(doc.body.querySelectorAll('.wk-prompt'));
  } else {
    remove(homebrewQSA('wk-prompt'));
  }
}

function remove (prompts) {
  var len = prompts.length;
  var i;
  for (i = 0; i < len; i++) {
    prompts[i].parentElement.removeChild(prompts[i]);
  }
}

module.exports = closePrompts;

},{}],56:[function(require,module,exports){
'use strict';

var crossvent = require('crossvent');
var render = require('./render');
var classes = require('../classes');
var strings = require('../strings');
var uploads = require('../uploads');
var ENTER_KEY = 13;
var ESCAPE_KEY = 27;
var dragClass = 'wk-dragging';
var dragClassSpecific = 'wk-prompt-upload-dragging';
var root = document.documentElement;

function always () {
  return true;
}

function classify (group, classes) {
  Object.keys(group).forEach(customize);
  function customize (key) {
    if (classes[key]) {
      group[key].className += ' ' + classes[key];
    }
  }
}

function prompt (options, done) {
  var scrollSize = 0; // For window.scroll 
  var text = strings.prompts[options.type];
  var dom = render({
    id: 'wk-prompt-' + options.type,
    title: text.title,
    description: text.description,
    placeholder: text.placeholder
  });
  var domup;

  crossvent.add(dom.cancel, 'click', remove);
  crossvent.add(root, 'click', rootClick);
  crossvent.add(dom.close, 'click', remove);
  crossvent.add(dom.ok, 'click', ok);
  crossvent.add(dom.input, 'keypress', enter);
  crossvent.add(dom.dialog, 'keydown', esc);
  classify(dom, options.classes.prompts);

  // Disappearing the popup when scrolled.
  window.onscroll = function () {
    scrollSize++;
    if (scrollSize > 10) {
      remove();
    }
  };

  var xhr = options.xhr;
  var upload = options.upload;
  if (typeof upload === 'string') {
    upload = { url: upload };
  }
  if (upload) {
    arrangeUploads();
  }
  if (options.autoUpload) {
    submit(options.autoUpload);
  }

  setTimeout(focusDialog, 0);

  function focusDialog () {
    dom.input.focus();
  }

  // function will be called when click any other place except the editor box and onClick it will remove the popup.
  function rootClick (e) {
    var editorClassList = e.target.classList.value;
    if (!editorClassList.includes('wk-prompt')) {
      remove();
    }
  }

  function enter (e) {
    var key = e.which || e.keyCode;
    if (key === ENTER_KEY) {
      ok();
      e.preventDefault();
    }
  }

  function esc (e) {
    var key = e.which || e.keyCode;
    if (key === ESCAPE_KEY) {
      remove();
      e.preventDefault();
    }
  }

  function ok () {
    remove();
    done({ definition: dom.input.value });
  }

  function remove () {
    if (upload) { bindUploadEvents(true); }
    if (dom.dialog.parentElement) { dom.dialog.parentElement.removeChild(dom.dialog); }
    options.surface.focus(options.mode);
  }

  function bindUploadEvents (remove) {
    var op = remove ? 'remove' : 'add';
    crossvent[op](root, 'dragenter', dragging);
    crossvent[op](root, 'dragend', dragstop);
    crossvent[op](root, 'mouseout', dragstop);
  }

  function warn () {
    classes.add(domup.warning, 'wk-prompt-error-show');
  }
  function dragging () {
    classes.add(domup.area, dragClass);
    classes.add(domup.area, dragClassSpecific);
  }
  function dragstop () {
    classes.rm(domup.area, dragClass);
    classes.rm(domup.area, dragClassSpecific);
    uploads.stop(options.surface.droparea);
  }

  function arrangeUploads () {
    domup = render.uploads(dom, strings.prompts.types + (upload.restriction || options.type + 's'));
    bindUploadEvents();

    crossvent.add(domup.fileinput, 'change', handleChange, false);
    crossvent.add(domup.area, 'dragover', handleDragOver, false);
    crossvent.add(domup.area, 'drop', handleFileSelect, false);
    classify(domup, options.classes.prompts);
  }

  function handleChange (e) {
    stop(e);
    submit(domup.fileinput.files);
    domup.fileinput.value = '';
    domup.fileinput.value = null;
  }

  function handleDragOver (e) {
    stop(e);
    e.dataTransfer.dropEffect = 'copy';
  }

  function handleFileSelect (e) {
    dragstop();
    stop(e);
    submit(e.dataTransfer.files);
  }

  function stop (e) {
    e.stopPropagation();
    e.preventDefault();
  }

  function valid (files) {
    var i;
    for (i = 0; i < files.length; i++) {
      if ((upload.validate || always)(files[i])) {
        return files[i];
      }
    }
    warn();
  }

  function submit (files) {
    classes.rm(domup.failed, 'wk-prompt-error-show');
    classes.rm(domup.warning, 'wk-prompt-error-show');
    var file = valid(files);
    if (!file) {
      return;
    }
    var form = new FormData();
    var req = {
      'Content-Type': 'multipart/form-data',
      headers: {
        Accept: 'application/json'
      },
      method: upload.method || 'PUT',
      url: upload.url,
      body: form
    };

    form.append(upload.key || 'woofmark_upload', file, file.name);
    classes.add(domup.area, 'wk-prompt-uploading');
    xhr(req, handleResponse);

    function handleResponse (err, res, body) {
      classes.rm(domup.area, 'wk-prompt-uploading');
      if (err || res.statusCode < 200 || res.statusCode > 299) {
        classes.add(domup.failed, 'wk-prompt-error-show');
        return;
      }
      dom.input.value = body.href + ' "' + body.title + '"';
      remove();
      done({ definition: dom.input.value, attachment: options.type === 'attachment' });
    }
  }
}

module.exports = prompt;

},{"../classes":27,"../strings":61,"../uploads":62,"./render":57,"crossvent":4}],57:[function(require,module,exports){
(function (global){
'use strict';

var crossvent = require('crossvent');
var getText = require('../getText');
var setText = require('../setText');
var classes = require('../classes');
var strings = require('../strings');
var ac = 'appendChild';
var doc = global.document;

function e (type, cls, text) {
  var el = doc.createElement(type);
  el.className = cls;
  if (text) {
    setText(el, text);
  }
  return el;
}

function render (options) {
  var dom = {
    dialog: e('article', 'wk-prompt ' + options.id),
    close: e('a', 'wk-prompt-close'),
    header: e('header', 'wk-prompt-header'),
    h1: e('h1', 'wk-prompt-title', options.title),
    section: e('section', 'wk-prompt-body'),
    desc: e('p', 'wk-prompt-description', options.description),
    inputContainer: e('div', 'wk-prompt-input-container'),
    input: e('input', 'wk-prompt-input'),
    cancel: e('button', 'wk-prompt-cancel', 'Cancel'),
    ok: e('button', 'wk-prompt-ok', 'Ok'),
    footer: e('footer', 'wk-prompt-buttons')
  };
  dom.ok.type = 'button';
  dom.header[ac](dom.h1);
  dom.section[ac](dom.desc);
  dom.section[ac](dom.inputContainer);
  dom.inputContainer[ac](dom.input);
  dom.input.placeholder = options.placeholder;
  dom.cancel.type = 'button';
  dom.footer[ac](dom.cancel);
  dom.footer[ac](dom.ok);
  dom.dialog[ac](dom.close);
  dom.dialog[ac](dom.header);
  dom.dialog[ac](dom.section);
  dom.dialog[ac](dom.footer);
  doc.body[ac](dom.dialog);
  return dom;
}

function uploads (dom, warning) {
  var fup = 'wk-prompt-fileupload';
  var domup = {
    area: e('section', 'wk-prompt-upload-area'),
    warning: e('p', 'wk-prompt-error wk-warning', warning),
    failed: e('p', 'wk-prompt-error wk-failed', strings.prompts.uploadfailed),
    upload: e('label', 'wk-prompt-upload'),
    uploading: e('span', 'wk-prompt-progress', strings.prompts.uploading),
    drop: e('span', 'wk-prompt-drop', strings.prompts.drop),
    dropicon: e('p', 'wk-drop-icon wk-prompt-drop-icon'),
    browse: e('span', 'wk-prompt-browse', strings.prompts.browse),
    dragdrop: e('p', 'wk-prompt-dragdrop', strings.prompts.drophint),
    fileinput: e('input', fup)
  };
  domup.area[ac](domup.drop);
  domup.area[ac](domup.uploading);
  domup.area[ac](domup.dropicon);
  domup.upload[ac](domup.browse);
  domup.upload[ac](domup.fileinput);
  domup.fileinput.id = fup;
  domup.fileinput.type = 'file';
  dom.dialog.className += ' wk-prompt-uploads';
  dom.inputContainer.className += ' wk-prompt-input-container-uploads';
  dom.input.className += ' wk-prompt-input-uploads';
  dom.section.insertBefore(domup.warning, dom.inputContainer);
  dom.section.insertBefore(domup.failed, dom.inputContainer);
  dom.section[ac](domup.upload);
  dom.section[ac](domup.dragdrop);
  dom.section[ac](domup.area);
  setText(dom.desc, getText(dom.desc) + strings.prompts.upload);
  crossvent.add(domup.fileinput, 'focus', focusedFileInput);
  crossvent.add(domup.fileinput, 'blur', blurredFileInput);

  function focusedFileInput () {
    classes.add(domup.upload, 'wk-focused');
  }
  function blurredFileInput () {
    classes.rm(domup.upload, 'wk-focused');
  }
  return domup;
}

render.uploads = uploads;
module.exports = render;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9wcm9tcHRzL3JlbmRlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiJ3VzZSBzdHJpY3QnO1xuXG52YXIgY3Jvc3N2ZW50ID0gcmVxdWlyZSgnY3Jvc3N2ZW50Jyk7XG52YXIgZ2V0VGV4dCA9IHJlcXVpcmUoJy4uL2dldFRleHQnKTtcbnZhciBzZXRUZXh0ID0gcmVxdWlyZSgnLi4vc2V0VGV4dCcpO1xudmFyIGNsYXNzZXMgPSByZXF1aXJlKCcuLi9jbGFzc2VzJyk7XG52YXIgc3RyaW5ncyA9IHJlcXVpcmUoJy4uL3N0cmluZ3MnKTtcbnZhciBhYyA9ICdhcHBlbmRDaGlsZCc7XG52YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50O1xuXG5mdW5jdGlvbiBlICh0eXBlLCBjbHMsIHRleHQpIHtcbiAgdmFyIGVsID0gZG9jLmNyZWF0ZUVsZW1lbnQodHlwZSk7XG4gIGVsLmNsYXNzTmFtZSA9IGNscztcbiAgaWYgKHRleHQpIHtcbiAgICBzZXRUZXh0KGVsLCB0ZXh0KTtcbiAgfVxuICByZXR1cm4gZWw7XG59XG5cbmZ1bmN0aW9uIHJlbmRlciAob3B0aW9ucykge1xuICB2YXIgZG9tID0ge1xuICAgIGRpYWxvZzogZSgnYXJ0aWNsZScsICd3ay1wcm9tcHQgJyArIG9wdGlvbnMuaWQpLFxuICAgIGNsb3NlOiBlKCdhJywgJ3drLXByb21wdC1jbG9zZScpLFxuICAgIGhlYWRlcjogZSgnaGVhZGVyJywgJ3drLXByb21wdC1oZWFkZXInKSxcbiAgICBoMTogZSgnaDEnLCAnd2stcHJvbXB0LXRpdGxlJywgb3B0aW9ucy50aXRsZSksXG4gICAgc2VjdGlvbjogZSgnc2VjdGlvbicsICd3ay1wcm9tcHQtYm9keScpLFxuICAgIGRlc2M6IGUoJ3AnLCAnd2stcHJvbXB0LWRlc2NyaXB0aW9uJywgb3B0aW9ucy5kZXNjcmlwdGlvbiksXG4gICAgaW5wdXRDb250YWluZXI6IGUoJ2RpdicsICd3ay1wcm9tcHQtaW5wdXQtY29udGFpbmVyJyksXG4gICAgaW5wdXQ6IGUoJ2lucHV0JywgJ3drLXByb21wdC1pbnB1dCcpLFxuICAgIGNhbmNlbDogZSgnYnV0dG9uJywgJ3drLXByb21wdC1jYW5jZWwnLCAnQ2FuY2VsJyksXG4gICAgb2s6IGUoJ2J1dHRvbicsICd3ay1wcm9tcHQtb2snLCAnT2snKSxcbiAgICBmb290ZXI6IGUoJ2Zvb3RlcicsICd3ay1wcm9tcHQtYnV0dG9ucycpXG4gIH07XG4gIGRvbS5vay50eXBlID0gJ2J1dHRvbic7XG4gIGRvbS5oZWFkZXJbYWNdKGRvbS5oMSk7XG4gIGRvbS5zZWN0aW9uW2FjXShkb20uZGVzYyk7XG4gIGRvbS5zZWN0aW9uW2FjXShkb20uaW5wdXRDb250YWluZXIpO1xuICBkb20uaW5wdXRDb250YWluZXJbYWNdKGRvbS5pbnB1dCk7XG4gIGRvbS5pbnB1dC5wbGFjZWhvbGRlciA9IG9wdGlvbnMucGxhY2Vob2xkZXI7XG4gIGRvbS5jYW5jZWwudHlwZSA9ICdidXR0b24nO1xuICBkb20uZm9vdGVyW2FjXShkb20uY2FuY2VsKTtcbiAgZG9tLmZvb3RlclthY10oZG9tLm9rKTtcbiAgZG9tLmRpYWxvZ1thY10oZG9tLmNsb3NlKTtcbiAgZG9tLmRpYWxvZ1thY10oZG9tLmhlYWRlcik7XG4gIGRvbS5kaWFsb2dbYWNdKGRvbS5zZWN0aW9uKTtcbiAgZG9tLmRpYWxvZ1thY10oZG9tLmZvb3Rlcik7XG4gIGRvYy5ib2R5W2FjXShkb20uZGlhbG9nKTtcbiAgcmV0dXJuIGRvbTtcbn1cblxuZnVuY3Rpb24gdXBsb2FkcyAoZG9tLCB3YXJuaW5nKSB7XG4gIHZhciBmdXAgPSAnd2stcHJvbXB0LWZpbGV1cGxvYWQnO1xuICB2YXIgZG9tdXAgPSB7XG4gICAgYXJlYTogZSgnc2VjdGlvbicsICd3ay1wcm9tcHQtdXBsb2FkLWFyZWEnKSxcbiAgICB3YXJuaW5nOiBlKCdwJywgJ3drLXByb21wdC1lcnJvciB3ay13YXJuaW5nJywgd2FybmluZyksXG4gICAgZmFpbGVkOiBlKCdwJywgJ3drLXByb21wdC1lcnJvciB3ay1mYWlsZWQnLCBzdHJpbmdzLnByb21wdHMudXBsb2FkZmFpbGVkKSxcbiAgICB1cGxvYWQ6IGUoJ2xhYmVsJywgJ3drLXByb21wdC11cGxvYWQnKSxcbiAgICB1cGxvYWRpbmc6IGUoJ3NwYW4nLCAnd2stcHJvbXB0LXByb2dyZXNzJywgc3RyaW5ncy5wcm9tcHRzLnVwbG9hZGluZyksXG4gICAgZHJvcDogZSgnc3BhbicsICd3ay1wcm9tcHQtZHJvcCcsIHN0cmluZ3MucHJvbXB0cy5kcm9wKSxcbiAgICBkcm9waWNvbjogZSgncCcsICd3ay1kcm9wLWljb24gd2stcHJvbXB0LWRyb3AtaWNvbicpLFxuICAgIGJyb3dzZTogZSgnc3BhbicsICd3ay1wcm9tcHQtYnJvd3NlJywgc3RyaW5ncy5wcm9tcHRzLmJyb3dzZSksXG4gICAgZHJhZ2Ryb3A6IGUoJ3AnLCAnd2stcHJvbXB0LWRyYWdkcm9wJywgc3RyaW5ncy5wcm9tcHRzLmRyb3BoaW50KSxcbiAgICBmaWxlaW5wdXQ6IGUoJ2lucHV0JywgZnVwKVxuICB9O1xuICBkb211cC5hcmVhW2FjXShkb211cC5kcm9wKTtcbiAgZG9tdXAuYXJlYVthY10oZG9tdXAudXBsb2FkaW5nKTtcbiAgZG9tdXAuYXJlYVthY10oZG9tdXAuZHJvcGljb24pO1xuICBkb211cC51cGxvYWRbYWNdKGRvbXVwLmJyb3dzZSk7XG4gIGRvbXVwLnVwbG9hZFthY10oZG9tdXAuZmlsZWlucHV0KTtcbiAgZG9tdXAuZmlsZWlucHV0LmlkID0gZnVwO1xuICBkb211cC5maWxlaW5wdXQudHlwZSA9ICdmaWxlJztcbiAgZG9tLmRpYWxvZy5jbGFzc05hbWUgKz0gJyB3ay1wcm9tcHQtdXBsb2Fkcyc7XG4gIGRvbS5pbnB1dENvbnRhaW5lci5jbGFzc05hbWUgKz0gJyB3ay1wcm9tcHQtaW5wdXQtY29udGFpbmVyLXVwbG9hZHMnO1xuICBkb20uaW5wdXQuY2xhc3NOYW1lICs9ICcgd2stcHJvbXB0LWlucHV0LXVwbG9hZHMnO1xuICBkb20uc2VjdGlvbi5pbnNlcnRCZWZvcmUoZG9tdXAud2FybmluZywgZG9tLmlucHV0Q29udGFpbmVyKTtcbiAgZG9tLnNlY3Rpb24uaW5zZXJ0QmVmb3JlKGRvbXVwLmZhaWxlZCwgZG9tLmlucHV0Q29udGFpbmVyKTtcbiAgZG9tLnNlY3Rpb25bYWNdKGRvbXVwLnVwbG9hZCk7XG4gIGRvbS5zZWN0aW9uW2FjXShkb211cC5kcmFnZHJvcCk7XG4gIGRvbS5zZWN0aW9uW2FjXShkb211cC5hcmVhKTtcbiAgc2V0VGV4dChkb20uZGVzYywgZ2V0VGV4dChkb20uZGVzYykgKyBzdHJpbmdzLnByb21wdHMudXBsb2FkKTtcbiAgY3Jvc3N2ZW50LmFkZChkb211cC5maWxlaW5wdXQsICdmb2N1cycsIGZvY3VzZWRGaWxlSW5wdXQpO1xuICBjcm9zc3ZlbnQuYWRkKGRvbXVwLmZpbGVpbnB1dCwgJ2JsdXInLCBibHVycmVkRmlsZUlucHV0KTtcblxuICBmdW5jdGlvbiBmb2N1c2VkRmlsZUlucHV0ICgpIHtcbiAgICBjbGFzc2VzLmFkZChkb211cC51cGxvYWQsICd3ay1mb2N1c2VkJyk7XG4gIH1cbiAgZnVuY3Rpb24gYmx1cnJlZEZpbGVJbnB1dCAoKSB7XG4gICAgY2xhc3Nlcy5ybShkb211cC51cGxvYWQsICd3ay1mb2N1c2VkJyk7XG4gIH1cbiAgcmV0dXJuIGRvbXVwO1xufVxuXG5yZW5kZXIudXBsb2FkcyA9IHVwbG9hZHM7XG5tb2R1bGUuZXhwb3J0cyA9IHJlbmRlcjtcbiJdfQ==
},{"../classes":27,"../getText":32,"../setText":60,"../strings":61,"crossvent":4}],58:[function(require,module,exports){
'use strict';

var bullseye = require('bullseye');

function rememberSelection (history) {
  var code = Math.random().toString(18).substr(2).replace(/\d+/g, '');
  var open = 'WoofmarkSelectionOpenMarker' + code;
  var close = 'WoofmarkSelectionCloseMarker' + code;
  var rmarkers = new RegExp(open + '|' + close, 'g');
  return {
    markers: markers(),
    unmark: unmark
  };

  function markers () {
    var state = history.reset().inputState;
    var chunks = state.getChunks();
    var selectionStart = chunks.before.length;
    var selectionEnd = selectionStart + chunks.selection.length;
    return [[selectionStart, open], [selectionEnd, close]];
  }

  function unmark () {
    var state = history.inputState;
    var chunks = state.getChunks();
    var all = chunks.before + chunks.selection + chunks.after;
    var start = all.lastIndexOf(open);
    var end = all.lastIndexOf(close) + close.length;
    var selectionStart = start === -1 ? 0 : start;
    var selectionEnd = end === -1 ? 0 : end;
    chunks.before = all.substr(0, selectionStart).replace(rmarkers, '');
    chunks.selection = all.substr(selectionStart, selectionEnd - selectionStart).replace(rmarkers, '');
    chunks.after = all.substr(end).replace(rmarkers, '');
    var el = history.surface.current(history.inputMode);
    var eye = bullseye(el, {
      caret: true, autoupdateToCaret: false, tracking: false
    });
    state.setChunks(chunks);
    state.restore(false);
    state.scrollTop = el.scrollTop = eye.read().y - el.getBoundingClientRect().top - 50;
    eye.destroy();
  }
}

module.exports = rememberSelection;

},{"bullseye":1}],59:[function(require,module,exports){
'use strict';

var setText = require('./setText');
var strings = require('./strings');

function commands (el, id) {
  setText(el, strings.buttons[id] || id);
}

function modes (el, id) {
  var texts = {
    markdown: 'm\u2193',
    wysiwyg: 'wysiwyg'
  };
  setText(el, texts[id] || id);
}

module.exports = {
  modes: modes,
  commands: commands
};

},{"./setText":60,"./strings":61}],60:[function(require,module,exports){
'use strict';

function setText (el, value) {
  el.innerText = el.textContent = value;
}

module.exports = setText;

},{}],61:[function(require,module,exports){
'use strict';

module.exports = {
  placeholders: {
    bold: 'strong text',
    italic: 'emphasized text',
    quote: 'quoted text',
    code: 'code goes here',
    listitem: 'list item',
    heading: 'Heading Text',
    link: 'link text',
    image: 'image description',
    attachment: 'attachment description'
  },
  titles: {
    bold: 'Strong <strong> Ctrl+B',
    italic: 'Emphasis <em> Ctrl+I',
    quote: 'Blockquote <blockquote> Ctrl+J',
    code: 'Code Sample <pre><code> Ctrl+E',
    ol: 'Numbered List <ol> Ctrl+O',
    ul: 'Bulleted List <ul> Ctrl+U',
    heading: 'Heading <h1>, <h2>, ... Ctrl+D',
    link: 'Hyperlink <a> Ctrl+K',
    image: 'Image <img> Ctrl+G',
    attachment: 'Attachment Ctrl+Shift+K',
    markdown: 'Markdown Mode Ctrl+M',
    html: 'HTML Mode Ctrl+H',
    wysiwyg: 'Preview Mode Ctrl+P'
  },
  buttons: {
    bold: 'B',
    italic: 'I',
    quote: '\u201c',
    code: '</>',
    ol: '1.',
    ul: '\u29BF',
    heading: 'Tt',
    link: 'Link',
    image: 'Image',
    attachment: 'Attachment',
    hr: '\u21b5'
  },
  prompts: {
    link: {
      title: 'Insert Link',
      description: 'Type or paste the url to your link',
      placeholder: 'http://example.com/ "title"'
    },
    image: {
      title: 'Insert Image',
      description: 'Enter the url to your image',
      placeholder: 'http://example.com/public/image.png "title"'
    },
    attachment: {
      title: 'Attach File',
      description: 'Enter the url to your attachment',
      placeholder: 'http://example.com/public/report.pdf "title"'
    },
    types: 'You can only upload ',
    browse: 'Browse...',
    drophint: 'You can also drag files from your computer and drop them here!',
    drop: 'Drop your file here to begin upload...',
    upload: ', or upload a file',
    uploading: 'Uploading your file...',
    uploadfailed: 'The upload failed! That\'s all we know.'
  }
};

},{}],62:[function(require,module,exports){
'use strict';

var crossvent = require('crossvent');
var classes = require('./classes');
var dragClass = 'wk-dragging';
var dragClassSpecific = 'wk-container-dragging';
var root = document.documentElement;
var dragginCss = 0; // variable to count the enter and leaving numbers.

function uploads (container, droparea, editor, options, remove) {
  var op = remove ? 'remove' : 'add';
  crossvent[op](root, 'dragend', dragstopforce);
  crossvent[op](root, 'mouseout', dragstopforce);
  crossvent[op](container, 'dragover', handleDragOver, false);
  crossvent[op](container, 'dragenter', dragging, false);  // whenever the drag with components enter the container
  crossvent[op](container, 'dragleave', dragstop, false);  // whenever the drag with components moves out of container
  crossvent[op](droparea, 'drop', handleFileSelect, false);

  function dragging () {
    dragginCss++;
    classes.add(droparea, dragClass);
    classes.add(droparea, dragClassSpecific);
  }
  function dragstop () {
    dragginCss--;
    if(dragginCss === 0){
      dragstopper(droparea);
    }
  }
  function dragstopforce () {
    dragstopper(droparea);
  }
  function handleDragOver (e) {
    stop(e);
    classes.add(droparea, dragClass);
    classes.add(droparea, dragClassSpecific);
    e.dataTransfer.dropEffect = 'copy';
  }
  function handleFileSelect (e) {
    dragstop();
    stop(e);
    editor.runCommand(function runner (chunks, mode) {
      var files = Array.prototype.slice.call(e.dataTransfer.files);
      var type = inferType(files);
      editor.linkOrImageOrAttachment(type, files).call(this, mode, chunks);
    });
  }
  function inferType (files) {
    if (options.images && !options.attachments) {
      return 'image';
    }
    if (!options.images && options.attachments) {
      return 'attachment';
    }
    if (files.every(matches(options.images.validate || never))) {
      return 'image';
    }
    return 'attachment';
  }
}

function matches (fn) {
  return function matcher (file) { return fn(file); };
}
function never () {
  return false;
}
function stop (e) {
  e.stopPropagation();
  e.preventDefault();
}
function dragstopper (droparea) {
  classes.rm(droparea, dragClass);
  classes.rm(droparea, dragClassSpecific);
}

uploads.stop = dragstopper;
module.exports = uploads;

},{"./classes":27,"crossvent":4}],63:[function(require,module,exports){
(function (global){
'use strict';

var ls = require('local-storage');
var crossvent = require('crossvent');
var kanye = require('kanye');
var uploads = require('./uploads');
var strings = require('./strings');
var setText = require('./setText');
var rememberSelection = require('./rememberSelection');
var bindCommands = require('./bindCommands');
var InputHistory = require('./InputHistory');
var getCommandHandler = require('./getCommandHandler');
var getSurface = require('./getSurface');
var classes = require('./classes');
var renderers = require('./renderers');
var xhrStub = require('./xhrStub');
var prompt = require('./prompts/prompt');
var closePrompts = require('./prompts/close');
var modeNames = ['markdown', 'html', 'wysiwyg'];
var cache = [];
var mac = /\bMac OS\b/.test(global.navigator.userAgent);
var doc = document;
var rparagraph = /^<p><\/p>\n?$/i;

function find (textarea) {
  for (var i = 0; i < cache.length; i++) {
    if (cache[i] && cache[i].ta === textarea) {
      return cache[i].editor;
    }
  }
  return null;
}

function woofmark (textarea, options) {
  var cached = find(textarea);
  if (cached) {
    return cached;
  }

  var parent = textarea.parentElement;
  if (parent.children.length > 1) {
    throw new Error('woofmark demands <textarea> elements to have no siblings');
  }

  var o = options || {};
  if (o.markdown === void 0) { o.markdown = true; }
  if (o.html === void 0) { o.html = true; }
  if (o.wysiwyg === void 0) { o.wysiwyg = true; }

  if (!o.markdown && !o.html && !o.wysiwyg) {
    throw new Error('woofmark expects at least one input mode to be available');
  }

  if (o.hr === void 0) { o.hr = false; }
  if (o.storage === void 0) { o.storage = true; }
  if (o.storage === true) { o.storage = 'woofmark_input_mode'; }
  if (o.fencing === void 0) { o.fencing = true; }
  if (o.render === void 0) { o.render = {}; }
  if (o.render.modes === void 0) { o.render.modes = {}; }
  if (o.render.commands === void 0) { o.render.commands = {}; }
  if (o.prompts === void 0) { o.prompts = {}; }
  if (o.prompts.link === void 0) { o.prompts.link = prompt; }
  if (o.prompts.image === void 0) { o.prompts.image = prompt; }
  if (o.prompts.attachment === void 0) { o.prompts.attachment = prompt; }
  if (o.prompts.close === void 0) { o.prompts.close = closePrompts; }
  if (o.xhr === void 0) { o.xhr = xhrStub; }
  if (o.classes === void 0) { o.classes = {}; }
  if (o.classes.wysiwyg === void 0) { o.classes.wysiwyg = []; }
  if (o.classes.prompts === void 0) { o.classes.prompts = {}; }
  if (o.classes.input === void 0) { o.classes.input = {}; }

  var preference = o.storage && ls.get(o.storage);
  if (preference) {
    o.defaultMode = preference;
  }

  var droparea = tag({ c: 'wk-container-drop' });
  var switchboard = tag({ c: 'wk-switchboard' });
  var commands = tag({ c: 'wk-commands' });
  var editable = tag({ c: ['wk-wysiwyg', 'wk-hide'].concat(o.classes.wysiwyg).join(' ') });
  var surface = getSurface(textarea, editable, droparea);
  var history = new InputHistory(surface, 'markdown');
  var editor = {
    addCommand: addCommand,
    addCommandButton: addCommandButton,
    runCommand: runCommand,
    parseMarkdown: o.parseMarkdown,
    parseHTML: o.parseHTML,
    destroy: destroy,
    value: getMarkdown,
    textarea: textarea,
    editable: o.wysiwyg ? editable : null,
    setMode: persistMode,
    history: {
      undo: history.undo,
      redo: history.redo,
      canUndo: history.canUndo,
      canRedo: history.canRedo
    },
    mode: 'markdown'
  };
  var entry = { ta: textarea, editor: editor };
  var i = cache.push(entry);
  var kanyeContext = 'woofmark_' + i;
  var kanyeOptions = {
    filter: parent,
    context: kanyeContext
  };
  var modes = {
    markdown: {
      button: tag({ t: 'button', c: 'wk-mode wk-mode-active' }),
      set: markdownMode
    },
    html: {
      button: tag({ t: 'button', c: 'wk-mode wk-mode-inactive' }),
      set: htmlMode
    },
    wysiwyg: {
      button: tag({ t: 'button', c: 'wk-mode wk-mode-inactive' }),
      set: wysiwygMode
    }
  };
  var place;

  tag({ t: 'span', c: 'wk-drop-text', x: strings.prompts.drop, p: droparea });
  tag({ t: 'p', c: ['wk-drop-icon'].concat(o.classes.dropicon).join(' '), p: droparea });

  editable.contentEditable = true;
  modes.markdown.button.setAttribute('disabled', 'disabled');
  modeNames.forEach(addMode);

  if (o.wysiwyg) {
    place = tag({ c: 'wk-wysiwyg-placeholder wk-hide', x: textarea.placeholder });
    crossvent.add(place, 'click', focusEditable);
  }

  if (o.defaultMode && o[o.defaultMode]) {
    modes[o.defaultMode].set();
  } else if (o.markdown) {
    modes.markdown.set();
  } else if (o.html) {
    modes.html.set();
  } else {
    modes.wysiwyg.set();
  }

  bindCommands(surface, o, editor);
  bindEvents();

  return editor;

  function addMode (id) {
    var button = modes[id].button;
    var custom = o.render.modes;
    if (o[id]) {
      switchboard.appendChild(button);
      (typeof custom === 'function' ? custom : renderers.modes)(button, id);
      crossvent.add(button, 'click', modes[id].set);
      button.type = 'button';
      button.tabIndex = -1;

      var title = strings.titles[id];
      if (title) {
        button.setAttribute('title', mac ? macify(title) : title);
      }
    }
  }

  function bindEvents (remove) {
    var ar = remove ? 'rm' : 'add';
    var mov = remove ? 'removeChild' : 'appendChild';
    if (remove) {
      kanye.clear(kanyeContext);
    } else {
      if (o.markdown) { kanye.on('cmd+m', kanyeOptions, markdownMode); }
      if (o.html) { kanye.on('cmd+h', kanyeOptions, htmlMode); }
      if (o.wysiwyg) { kanye.on('cmd+p', kanyeOptions, wysiwygMode); }
    }
    classes[ar](parent, 'wk-container');
    parent[mov](editable);
    if (place) { parent[mov](place); }
    parent[mov](commands);
    parent[mov](switchboard);
    if ((o.images || o.attachments) && o.xhr) {
      parent[mov](droparea);
      uploads(parent, droparea, editor, o, remove);
    }
  }

  function destroy () {
    if (editor.mode !== 'markdown') {
      textarea.value = getMarkdown();
    }
    classes.rm(textarea, 'wk-hide');
    bindEvents(true);
    delete cache[i - 1];
  }

  function markdownMode (e) { persistMode('markdown', e); }
  function htmlMode (e) { persistMode('html', e); }
  function wysiwygMode (e) { persistMode('wysiwyg', e); }

  function persistMode (nextMode, e) {
    var remembrance;
    var currentMode = editor.mode;
    var old = modes[currentMode].button;
    var button = modes[nextMode].button;
    var focusing = !!e || doc.activeElement === textarea || doc.activeElement === editable;

    stop(e);

    if (currentMode === nextMode) {
      return;
    }

    remembrance = focusing && rememberSelection(history, o);
    textarea.blur(); // avert chrome repaint bugs

    if (nextMode === 'markdown') {
      if (currentMode === 'html') {
        textarea.value = parse('parseHTML', textarea.value).trim();
      } else {
        textarea.value = parse('parseHTML', editable).trim();
      }
    } else if (nextMode === 'html') {
      if (currentMode === 'markdown') {
        textarea.value = parse('parseMarkdown', textarea.value).trim();
      } else {
        textarea.value = editable.innerHTML.trim();
      }
    } else if (nextMode === 'wysiwyg') {
      if (currentMode === 'markdown') {
        editable.innerHTML = parse('parseMarkdown', textarea.value).replace(rparagraph, '').trim();
      } else {
        editable.innerHTML = textarea.value.replace(rparagraph, '').trim();
      }
    }

    if (nextMode === 'wysiwyg') {
      classes.add(textarea, 'wk-hide');
      classes.rm(editable, 'wk-hide');
      if (place) { classes.rm(place, 'wk-hide'); }
      if (focusing) { setTimeout(focusEditable, 0); }
    } else {
      classes.rm(textarea, 'wk-hide');
      classes.add(editable, 'wk-hide');
      if (place) { classes.add(place, 'wk-hide'); }
      if (focusing) { textarea.focus(); }
    }
    classes.add(button, 'wk-mode-active');
    classes.rm(old, 'wk-mode-active');
    classes.add(old, 'wk-mode-inactive');
    classes.rm(button, 'wk-mode-inactive');
    button.setAttribute('disabled', 'disabled');
    old.removeAttribute('disabled');
    editor.mode = nextMode;

    if (o.storage) { ls.set(o.storage, nextMode); }

    history.setInputMode(nextMode);
    if (remembrance) { remembrance.unmark(); }
    fireLater('woofmark-mode-change');

    function parse (method, input) {
      return o[method](input, {
        markers: remembrance && remembrance.markers || []
      });
    }
  }

  function fireLater (type) {
    setTimeout(function fire () {
      crossvent.fabricate(textarea, type);
    }, 0);
  }

  function focusEditable () {
    editable.focus();
  }

  function getMarkdown () {
    if (editor.mode === 'wysiwyg') {
      return o.parseHTML(editable);
    }
    if (editor.mode === 'html') {
      return o.parseHTML(textarea.value);
    }
    return textarea.value;
  }

  function addCommandButton (id, combo, fn) {
    if (arguments.length === 2) {
      fn = combo;
      combo = null;
    }
    var button = tag({ t: 'button', c: 'wk-command', p: commands });
    var custom = o.render.commands;
    var render = typeof custom === 'function' ? custom : renderers.commands;
    var title = strings.titles[id];
    if (title) {
      button.setAttribute('title', mac ? macify(title) : title);
    }
    button.type = 'button';
    button.tabIndex = -1;
    render(button, id);
    crossvent.add(button, 'click', getCommandHandler(surface, history, fn));
    if (combo) {
      addCommand(combo, fn);
    }
    return button;
  }

  function addCommand (combo, fn) {
    kanye.on(combo, kanyeOptions, getCommandHandler(surface, history, fn));
  }

  function runCommand (fn) {
    getCommandHandler(surface, history, rearrange)(null);
    function rearrange (e, mode, chunks) {
      return fn.call(this, chunks, mode);
    }
  }
}

function tag (options) {
  var o = options || {};
  var el = doc.createElement(o.t || 'div');
  el.className = o.c || '';
  setText(el, o.x || '');
  if (o.p) { o.p.appendChild(el); }
  return el;
}

function stop (e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
}

function macify (text) {
  return text
    .replace(/\bctrl\b/i, '\u2318')
    .replace(/\balt\b/i, '\u2325')
    .replace(/\bshift\b/i, '\u21e7');
}

woofmark.find = find;
woofmark.strings = strings;
module.exports = woofmark;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy93b29mbWFyay5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbnZhciBscyA9IHJlcXVpcmUoJ2xvY2FsLXN0b3JhZ2UnKTtcbnZhciBjcm9zc3ZlbnQgPSByZXF1aXJlKCdjcm9zc3ZlbnQnKTtcbnZhciBrYW55ZSA9IHJlcXVpcmUoJ2thbnllJyk7XG52YXIgdXBsb2FkcyA9IHJlcXVpcmUoJy4vdXBsb2FkcycpO1xudmFyIHN0cmluZ3MgPSByZXF1aXJlKCcuL3N0cmluZ3MnKTtcbnZhciBzZXRUZXh0ID0gcmVxdWlyZSgnLi9zZXRUZXh0Jyk7XG52YXIgcmVtZW1iZXJTZWxlY3Rpb24gPSByZXF1aXJlKCcuL3JlbWVtYmVyU2VsZWN0aW9uJyk7XG52YXIgYmluZENvbW1hbmRzID0gcmVxdWlyZSgnLi9iaW5kQ29tbWFuZHMnKTtcbnZhciBJbnB1dEhpc3RvcnkgPSByZXF1aXJlKCcuL0lucHV0SGlzdG9yeScpO1xudmFyIGdldENvbW1hbmRIYW5kbGVyID0gcmVxdWlyZSgnLi9nZXRDb21tYW5kSGFuZGxlcicpO1xudmFyIGdldFN1cmZhY2UgPSByZXF1aXJlKCcuL2dldFN1cmZhY2UnKTtcbnZhciBjbGFzc2VzID0gcmVxdWlyZSgnLi9jbGFzc2VzJyk7XG52YXIgcmVuZGVyZXJzID0gcmVxdWlyZSgnLi9yZW5kZXJlcnMnKTtcbnZhciB4aHJTdHViID0gcmVxdWlyZSgnLi94aHJTdHViJyk7XG52YXIgcHJvbXB0ID0gcmVxdWlyZSgnLi9wcm9tcHRzL3Byb21wdCcpO1xudmFyIGNsb3NlUHJvbXB0cyA9IHJlcXVpcmUoJy4vcHJvbXB0cy9jbG9zZScpO1xudmFyIG1vZGVOYW1lcyA9IFsnbWFya2Rvd24nLCAnaHRtbCcsICd3eXNpd3lnJ107XG52YXIgY2FjaGUgPSBbXTtcbnZhciBtYWMgPSAvXFxiTWFjIE9TXFxiLy50ZXN0KGdsb2JhbC5uYXZpZ2F0b3IudXNlckFnZW50KTtcbnZhciBkb2MgPSBkb2N1bWVudDtcbnZhciBycGFyYWdyYXBoID0gL148cD48XFwvcD5cXG4/JC9pO1xuXG5mdW5jdGlvbiBmaW5kICh0ZXh0YXJlYSkge1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGNhY2hlLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKGNhY2hlW2ldICYmIGNhY2hlW2ldLnRhID09PSB0ZXh0YXJlYSkge1xuICAgICAgcmV0dXJuIGNhY2hlW2ldLmVkaXRvcjtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIHdvb2ZtYXJrICh0ZXh0YXJlYSwgb3B0aW9ucykge1xuICB2YXIgY2FjaGVkID0gZmluZCh0ZXh0YXJlYSk7XG4gIGlmIChjYWNoZWQpIHtcbiAgICByZXR1cm4gY2FjaGVkO1xuICB9XG5cbiAgdmFyIHBhcmVudCA9IHRleHRhcmVhLnBhcmVudEVsZW1lbnQ7XG4gIGlmIChwYXJlbnQuY2hpbGRyZW4ubGVuZ3RoID4gMSkge1xuICAgIHRocm93IG5ldyBFcnJvcignd29vZm1hcmsgZGVtYW5kcyA8dGV4dGFyZWE+IGVsZW1lbnRzIHRvIGhhdmUgbm8gc2libGluZ3MnKTtcbiAgfVxuXG4gIHZhciBvID0gb3B0aW9ucyB8fCB7fTtcbiAgaWYgKG8ubWFya2Rvd24gPT09IHZvaWQgMCkgeyBvLm1hcmtkb3duID0gdHJ1ZTsgfVxuICBpZiAoby5odG1sID09PSB2b2lkIDApIHsgby5odG1sID0gdHJ1ZTsgfVxuICBpZiAoby53eXNpd3lnID09PSB2b2lkIDApIHsgby53eXNpd3lnID0gdHJ1ZTsgfVxuXG4gIGlmICghby5tYXJrZG93biAmJiAhby5odG1sICYmICFvLnd5c2l3eWcpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3dvb2ZtYXJrIGV4cGVjdHMgYXQgbGVhc3Qgb25lIGlucHV0IG1vZGUgdG8gYmUgYXZhaWxhYmxlJyk7XG4gIH1cblxuICBpZiAoby5ociA9PT0gdm9pZCAwKSB7IG8uaHIgPSBmYWxzZTsgfVxuICBpZiAoby5zdG9yYWdlID09PSB2b2lkIDApIHsgby5zdG9yYWdlID0gdHJ1ZTsgfVxuICBpZiAoby5zdG9yYWdlID09PSB0cnVlKSB7IG8uc3RvcmFnZSA9ICd3b29mbWFya19pbnB1dF9tb2RlJzsgfVxuICBpZiAoby5mZW5jaW5nID09PSB2b2lkIDApIHsgby5mZW5jaW5nID0gdHJ1ZTsgfVxuICBpZiAoby5yZW5kZXIgPT09IHZvaWQgMCkgeyBvLnJlbmRlciA9IHt9OyB9XG4gIGlmIChvLnJlbmRlci5tb2RlcyA9PT0gdm9pZCAwKSB7IG8ucmVuZGVyLm1vZGVzID0ge307IH1cbiAgaWYgKG8ucmVuZGVyLmNvbW1hbmRzID09PSB2b2lkIDApIHsgby5yZW5kZXIuY29tbWFuZHMgPSB7fTsgfVxuICBpZiAoby5wcm9tcHRzID09PSB2b2lkIDApIHsgby5wcm9tcHRzID0ge307IH1cbiAgaWYgKG8ucHJvbXB0cy5saW5rID09PSB2b2lkIDApIHsgby5wcm9tcHRzLmxpbmsgPSBwcm9tcHQ7IH1cbiAgaWYgKG8ucHJvbXB0cy5pbWFnZSA9PT0gdm9pZCAwKSB7IG8ucHJvbXB0cy5pbWFnZSA9IHByb21wdDsgfVxuICBpZiAoby5wcm9tcHRzLmF0dGFjaG1lbnQgPT09IHZvaWQgMCkgeyBvLnByb21wdHMuYXR0YWNobWVudCA9IHByb21wdDsgfVxuICBpZiAoby5wcm9tcHRzLmNsb3NlID09PSB2b2lkIDApIHsgby5wcm9tcHRzLmNsb3NlID0gY2xvc2VQcm9tcHRzOyB9XG4gIGlmIChvLnhociA9PT0gdm9pZCAwKSB7IG8ueGhyID0geGhyU3R1YjsgfVxuICBpZiAoby5jbGFzc2VzID09PSB2b2lkIDApIHsgby5jbGFzc2VzID0ge307IH1cbiAgaWYgKG8uY2xhc3Nlcy53eXNpd3lnID09PSB2b2lkIDApIHsgby5jbGFzc2VzLnd5c2l3eWcgPSBbXTsgfVxuICBpZiAoby5jbGFzc2VzLnByb21wdHMgPT09IHZvaWQgMCkgeyBvLmNsYXNzZXMucHJvbXB0cyA9IHt9OyB9XG4gIGlmIChvLmNsYXNzZXMuaW5wdXQgPT09IHZvaWQgMCkgeyBvLmNsYXNzZXMuaW5wdXQgPSB7fTsgfVxuXG4gIHZhciBwcmVmZXJlbmNlID0gby5zdG9yYWdlICYmIGxzLmdldChvLnN0b3JhZ2UpO1xuICBpZiAocHJlZmVyZW5jZSkge1xuICAgIG8uZGVmYXVsdE1vZGUgPSBwcmVmZXJlbmNlO1xuICB9XG5cbiAgdmFyIGRyb3BhcmVhID0gdGFnKHsgYzogJ3drLWNvbnRhaW5lci1kcm9wJyB9KTtcbiAgdmFyIHN3aXRjaGJvYXJkID0gdGFnKHsgYzogJ3drLXN3aXRjaGJvYXJkJyB9KTtcbiAgdmFyIGNvbW1hbmRzID0gdGFnKHsgYzogJ3drLWNvbW1hbmRzJyB9KTtcbiAgdmFyIGVkaXRhYmxlID0gdGFnKHsgYzogWyd3ay13eXNpd3lnJywgJ3drLWhpZGUnXS5jb25jYXQoby5jbGFzc2VzLnd5c2l3eWcpLmpvaW4oJyAnKSB9KTtcbiAgdmFyIHN1cmZhY2UgPSBnZXRTdXJmYWNlKHRleHRhcmVhLCBlZGl0YWJsZSwgZHJvcGFyZWEpO1xuICB2YXIgaGlzdG9yeSA9IG5ldyBJbnB1dEhpc3Rvcnkoc3VyZmFjZSwgJ21hcmtkb3duJyk7XG4gIHZhciBlZGl0b3IgPSB7XG4gICAgYWRkQ29tbWFuZDogYWRkQ29tbWFuZCxcbiAgICBhZGRDb21tYW5kQnV0dG9uOiBhZGRDb21tYW5kQnV0dG9uLFxuICAgIHJ1bkNvbW1hbmQ6IHJ1bkNvbW1hbmQsXG4gICAgcGFyc2VNYXJrZG93bjogby5wYXJzZU1hcmtkb3duLFxuICAgIHBhcnNlSFRNTDogby5wYXJzZUhUTUwsXG4gICAgZGVzdHJveTogZGVzdHJveSxcbiAgICB2YWx1ZTogZ2V0TWFya2Rvd24sXG4gICAgdGV4dGFyZWE6IHRleHRhcmVhLFxuICAgIGVkaXRhYmxlOiBvLnd5c2l3eWcgPyBlZGl0YWJsZSA6IG51bGwsXG4gICAgc2V0TW9kZTogcGVyc2lzdE1vZGUsXG4gICAgaGlzdG9yeToge1xuICAgICAgdW5kbzogaGlzdG9yeS51bmRvLFxuICAgICAgcmVkbzogaGlzdG9yeS5yZWRvLFxuICAgICAgY2FuVW5kbzogaGlzdG9yeS5jYW5VbmRvLFxuICAgICAgY2FuUmVkbzogaGlzdG9yeS5jYW5SZWRvXG4gICAgfSxcbiAgICBtb2RlOiAnbWFya2Rvd24nXG4gIH07XG4gIHZhciBlbnRyeSA9IHsgdGE6IHRleHRhcmVhLCBlZGl0b3I6IGVkaXRvciB9O1xuICB2YXIgaSA9IGNhY2hlLnB1c2goZW50cnkpO1xuICB2YXIga2FueWVDb250ZXh0ID0gJ3dvb2ZtYXJrXycgKyBpO1xuICB2YXIga2FueWVPcHRpb25zID0ge1xuICAgIGZpbHRlcjogcGFyZW50LFxuICAgIGNvbnRleHQ6IGthbnllQ29udGV4dFxuICB9O1xuICB2YXIgbW9kZXMgPSB7XG4gICAgbWFya2Rvd246IHtcbiAgICAgIGJ1dHRvbjogdGFnKHsgdDogJ2J1dHRvbicsIGM6ICd3ay1tb2RlIHdrLW1vZGUtYWN0aXZlJyB9KSxcbiAgICAgIHNldDogbWFya2Rvd25Nb2RlXG4gICAgfSxcbiAgICBodG1sOiB7XG4gICAgICBidXR0b246IHRhZyh7IHQ6ICdidXR0b24nLCBjOiAnd2stbW9kZSB3ay1tb2RlLWluYWN0aXZlJyB9KSxcbiAgICAgIHNldDogaHRtbE1vZGVcbiAgICB9LFxuICAgIHd5c2l3eWc6IHtcbiAgICAgIGJ1dHRvbjogdGFnKHsgdDogJ2J1dHRvbicsIGM6ICd3ay1tb2RlIHdrLW1vZGUtaW5hY3RpdmUnIH0pLFxuICAgICAgc2V0OiB3eXNpd3lnTW9kZVxuICAgIH1cbiAgfTtcbiAgdmFyIHBsYWNlO1xuXG4gIHRhZyh7IHQ6ICdzcGFuJywgYzogJ3drLWRyb3AtdGV4dCcsIHg6IHN0cmluZ3MucHJvbXB0cy5kcm9wLCBwOiBkcm9wYXJlYSB9KTtcbiAgdGFnKHsgdDogJ3AnLCBjOiBbJ3drLWRyb3AtaWNvbiddLmNvbmNhdChvLmNsYXNzZXMuZHJvcGljb24pLmpvaW4oJyAnKSwgcDogZHJvcGFyZWEgfSk7XG5cbiAgZWRpdGFibGUuY29udGVudEVkaXRhYmxlID0gdHJ1ZTtcbiAgbW9kZXMubWFya2Rvd24uYnV0dG9uLnNldEF0dHJpYnV0ZSgnZGlzYWJsZWQnLCAnZGlzYWJsZWQnKTtcbiAgbW9kZU5hbWVzLmZvckVhY2goYWRkTW9kZSk7XG5cbiAgaWYgKG8ud3lzaXd5Zykge1xuICAgIHBsYWNlID0gdGFnKHsgYzogJ3drLXd5c2l3eWctcGxhY2Vob2xkZXIgd2staGlkZScsIHg6IHRleHRhcmVhLnBsYWNlaG9sZGVyIH0pO1xuICAgIGNyb3NzdmVudC5hZGQocGxhY2UsICdjbGljaycsIGZvY3VzRWRpdGFibGUpO1xuICB9XG5cbiAgaWYgKG8uZGVmYXVsdE1vZGUgJiYgb1tvLmRlZmF1bHRNb2RlXSkge1xuICAgIG1vZGVzW28uZGVmYXVsdE1vZGVdLnNldCgpO1xuICB9IGVsc2UgaWYgKG8ubWFya2Rvd24pIHtcbiAgICBtb2Rlcy5tYXJrZG93bi5zZXQoKTtcbiAgfSBlbHNlIGlmIChvLmh0bWwpIHtcbiAgICBtb2Rlcy5odG1sLnNldCgpO1xuICB9IGVsc2Uge1xuICAgIG1vZGVzLnd5c2l3eWcuc2V0KCk7XG4gIH1cblxuICBiaW5kQ29tbWFuZHMoc3VyZmFjZSwgbywgZWRpdG9yKTtcbiAgYmluZEV2ZW50cygpO1xuXG4gIHJldHVybiBlZGl0b3I7XG5cbiAgZnVuY3Rpb24gYWRkTW9kZSAoaWQpIHtcbiAgICB2YXIgYnV0dG9uID0gbW9kZXNbaWRdLmJ1dHRvbjtcbiAgICB2YXIgY3VzdG9tID0gby5yZW5kZXIubW9kZXM7XG4gICAgaWYgKG9baWRdKSB7XG4gICAgICBzd2l0Y2hib2FyZC5hcHBlbmRDaGlsZChidXR0b24pO1xuICAgICAgKHR5cGVvZiBjdXN0b20gPT09ICdmdW5jdGlvbicgPyBjdXN0b20gOiByZW5kZXJlcnMubW9kZXMpKGJ1dHRvbiwgaWQpO1xuICAgICAgY3Jvc3N2ZW50LmFkZChidXR0b24sICdjbGljaycsIG1vZGVzW2lkXS5zZXQpO1xuICAgICAgYnV0dG9uLnR5cGUgPSAnYnV0dG9uJztcbiAgICAgIGJ1dHRvbi50YWJJbmRleCA9IC0xO1xuXG4gICAgICB2YXIgdGl0bGUgPSBzdHJpbmdzLnRpdGxlc1tpZF07XG4gICAgICBpZiAodGl0bGUpIHtcbiAgICAgICAgYnV0dG9uLnNldEF0dHJpYnV0ZSgndGl0bGUnLCBtYWMgPyBtYWNpZnkodGl0bGUpIDogdGl0bGUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGJpbmRFdmVudHMgKHJlbW92ZSkge1xuICAgIHZhciBhciA9IHJlbW92ZSA/ICdybScgOiAnYWRkJztcbiAgICB2YXIgbW92ID0gcmVtb3ZlID8gJ3JlbW92ZUNoaWxkJyA6ICdhcHBlbmRDaGlsZCc7XG4gICAgaWYgKHJlbW92ZSkge1xuICAgICAga2FueWUuY2xlYXIoa2FueWVDb250ZXh0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKG8ubWFya2Rvd24pIHsga2FueWUub24oJ2NtZCttJywga2FueWVPcHRpb25zLCBtYXJrZG93bk1vZGUpOyB9XG4gICAgICBpZiAoby5odG1sKSB7IGthbnllLm9uKCdjbWQraCcsIGthbnllT3B0aW9ucywgaHRtbE1vZGUpOyB9XG4gICAgICBpZiAoby53eXNpd3lnKSB7IGthbnllLm9uKCdjbWQrcCcsIGthbnllT3B0aW9ucywgd3lzaXd5Z01vZGUpOyB9XG4gICAgfVxuICAgIGNsYXNzZXNbYXJdKHBhcmVudCwgJ3drLWNvbnRhaW5lcicpO1xuICAgIHBhcmVudFttb3ZdKGVkaXRhYmxlKTtcbiAgICBpZiAocGxhY2UpIHsgcGFyZW50W21vdl0ocGxhY2UpOyB9XG4gICAgcGFyZW50W21vdl0oY29tbWFuZHMpO1xuICAgIHBhcmVudFttb3ZdKHN3aXRjaGJvYXJkKTtcbiAgICBpZiAoKG8uaW1hZ2VzIHx8IG8uYXR0YWNobWVudHMpICYmIG8ueGhyKSB7XG4gICAgICBwYXJlbnRbbW92XShkcm9wYXJlYSk7XG4gICAgICB1cGxvYWRzKHBhcmVudCwgZHJvcGFyZWEsIGVkaXRvciwgbywgcmVtb3ZlKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBkZXN0cm95ICgpIHtcbiAgICBpZiAoZWRpdG9yLm1vZGUgIT09ICdtYXJrZG93bicpIHtcbiAgICAgIHRleHRhcmVhLnZhbHVlID0gZ2V0TWFya2Rvd24oKTtcbiAgICB9XG4gICAgY2xhc3Nlcy5ybSh0ZXh0YXJlYSwgJ3drLWhpZGUnKTtcbiAgICBiaW5kRXZlbnRzKHRydWUpO1xuICAgIGRlbGV0ZSBjYWNoZVtpIC0gMV07XG4gIH1cblxuICBmdW5jdGlvbiBtYXJrZG93bk1vZGUgKGUpIHsgcGVyc2lzdE1vZGUoJ21hcmtkb3duJywgZSk7IH1cbiAgZnVuY3Rpb24gaHRtbE1vZGUgKGUpIHsgcGVyc2lzdE1vZGUoJ2h0bWwnLCBlKTsgfVxuICBmdW5jdGlvbiB3eXNpd3lnTW9kZSAoZSkgeyBwZXJzaXN0TW9kZSgnd3lzaXd5ZycsIGUpOyB9XG5cbiAgZnVuY3Rpb24gcGVyc2lzdE1vZGUgKG5leHRNb2RlLCBlKSB7XG4gICAgdmFyIHJlbWVtYnJhbmNlO1xuICAgIHZhciBjdXJyZW50TW9kZSA9IGVkaXRvci5tb2RlO1xuICAgIHZhciBvbGQgPSBtb2Rlc1tjdXJyZW50TW9kZV0uYnV0dG9uO1xuICAgIHZhciBidXR0b24gPSBtb2Rlc1tuZXh0TW9kZV0uYnV0dG9uO1xuICAgIHZhciBmb2N1c2luZyA9ICEhZSB8fCBkb2MuYWN0aXZlRWxlbWVudCA9PT0gdGV4dGFyZWEgfHwgZG9jLmFjdGl2ZUVsZW1lbnQgPT09IGVkaXRhYmxlO1xuXG4gICAgc3RvcChlKTtcblxuICAgIGlmIChjdXJyZW50TW9kZSA9PT0gbmV4dE1vZGUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICByZW1lbWJyYW5jZSA9IGZvY3VzaW5nICYmIHJlbWVtYmVyU2VsZWN0aW9uKGhpc3RvcnksIG8pO1xuICAgIHRleHRhcmVhLmJsdXIoKTsgLy8gYXZlcnQgY2hyb21lIHJlcGFpbnQgYnVnc1xuXG4gICAgaWYgKG5leHRNb2RlID09PSAnbWFya2Rvd24nKSB7XG4gICAgICBpZiAoY3VycmVudE1vZGUgPT09ICdodG1sJykge1xuICAgICAgICB0ZXh0YXJlYS52YWx1ZSA9IHBhcnNlKCdwYXJzZUhUTUwnLCB0ZXh0YXJlYS52YWx1ZSkudHJpbSgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGV4dGFyZWEudmFsdWUgPSBwYXJzZSgncGFyc2VIVE1MJywgZWRpdGFibGUpLnRyaW0oKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG5leHRNb2RlID09PSAnaHRtbCcpIHtcbiAgICAgIGlmIChjdXJyZW50TW9kZSA9PT0gJ21hcmtkb3duJykge1xuICAgICAgICB0ZXh0YXJlYS52YWx1ZSA9IHBhcnNlKCdwYXJzZU1hcmtkb3duJywgdGV4dGFyZWEudmFsdWUpLnRyaW0oKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRleHRhcmVhLnZhbHVlID0gZWRpdGFibGUuaW5uZXJIVE1MLnRyaW0oKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG5leHRNb2RlID09PSAnd3lzaXd5ZycpIHtcbiAgICAgIGlmIChjdXJyZW50TW9kZSA9PT0gJ21hcmtkb3duJykge1xuICAgICAgICBlZGl0YWJsZS5pbm5lckhUTUwgPSBwYXJzZSgncGFyc2VNYXJrZG93bicsIHRleHRhcmVhLnZhbHVlKS5yZXBsYWNlKHJwYXJhZ3JhcGgsICcnKS50cmltKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlZGl0YWJsZS5pbm5lckhUTUwgPSB0ZXh0YXJlYS52YWx1ZS5yZXBsYWNlKHJwYXJhZ3JhcGgsICcnKS50cmltKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKG5leHRNb2RlID09PSAnd3lzaXd5ZycpIHtcbiAgICAgIGNsYXNzZXMuYWRkKHRleHRhcmVhLCAnd2staGlkZScpO1xuICAgICAgY2xhc3Nlcy5ybShlZGl0YWJsZSwgJ3drLWhpZGUnKTtcbiAgICAgIGlmIChwbGFjZSkgeyBjbGFzc2VzLnJtKHBsYWNlLCAnd2staGlkZScpOyB9XG4gICAgICBpZiAoZm9jdXNpbmcpIHsgc2V0VGltZW91dChmb2N1c0VkaXRhYmxlLCAwKTsgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjbGFzc2VzLnJtKHRleHRhcmVhLCAnd2staGlkZScpO1xuICAgICAgY2xhc3Nlcy5hZGQoZWRpdGFibGUsICd3ay1oaWRlJyk7XG4gICAgICBpZiAocGxhY2UpIHsgY2xhc3Nlcy5hZGQocGxhY2UsICd3ay1oaWRlJyk7IH1cbiAgICAgIGlmIChmb2N1c2luZykgeyB0ZXh0YXJlYS5mb2N1cygpOyB9XG4gICAgfVxuICAgIGNsYXNzZXMuYWRkKGJ1dHRvbiwgJ3drLW1vZGUtYWN0aXZlJyk7XG4gICAgY2xhc3Nlcy5ybShvbGQsICd3ay1tb2RlLWFjdGl2ZScpO1xuICAgIGNsYXNzZXMuYWRkKG9sZCwgJ3drLW1vZGUtaW5hY3RpdmUnKTtcbiAgICBjbGFzc2VzLnJtKGJ1dHRvbiwgJ3drLW1vZGUtaW5hY3RpdmUnKTtcbiAgICBidXR0b24uc2V0QXR0cmlidXRlKCdkaXNhYmxlZCcsICdkaXNhYmxlZCcpO1xuICAgIG9sZC5yZW1vdmVBdHRyaWJ1dGUoJ2Rpc2FibGVkJyk7XG4gICAgZWRpdG9yLm1vZGUgPSBuZXh0TW9kZTtcblxuICAgIGlmIChvLnN0b3JhZ2UpIHsgbHMuc2V0KG8uc3RvcmFnZSwgbmV4dE1vZGUpOyB9XG5cbiAgICBoaXN0b3J5LnNldElucHV0TW9kZShuZXh0TW9kZSk7XG4gICAgaWYgKHJlbWVtYnJhbmNlKSB7IHJlbWVtYnJhbmNlLnVubWFyaygpOyB9XG4gICAgZmlyZUxhdGVyKCd3b29mbWFyay1tb2RlLWNoYW5nZScpO1xuXG4gICAgZnVuY3Rpb24gcGFyc2UgKG1ldGhvZCwgaW5wdXQpIHtcbiAgICAgIHJldHVybiBvW21ldGhvZF0oaW5wdXQsIHtcbiAgICAgICAgbWFya2VyczogcmVtZW1icmFuY2UgJiYgcmVtZW1icmFuY2UubWFya2VycyB8fCBbXVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZmlyZUxhdGVyICh0eXBlKSB7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbiBmaXJlICgpIHtcbiAgICAgIGNyb3NzdmVudC5mYWJyaWNhdGUodGV4dGFyZWEsIHR5cGUpO1xuICAgIH0sIDApO1xuICB9XG5cbiAgZnVuY3Rpb24gZm9jdXNFZGl0YWJsZSAoKSB7XG4gICAgZWRpdGFibGUuZm9jdXMoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldE1hcmtkb3duICgpIHtcbiAgICBpZiAoZWRpdG9yLm1vZGUgPT09ICd3eXNpd3lnJykge1xuICAgICAgcmV0dXJuIG8ucGFyc2VIVE1MKGVkaXRhYmxlKTtcbiAgICB9XG4gICAgaWYgKGVkaXRvci5tb2RlID09PSAnaHRtbCcpIHtcbiAgICAgIHJldHVybiBvLnBhcnNlSFRNTCh0ZXh0YXJlYS52YWx1ZSk7XG4gICAgfVxuICAgIHJldHVybiB0ZXh0YXJlYS52YWx1ZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFkZENvbW1hbmRCdXR0b24gKGlkLCBjb21ibywgZm4pIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMikge1xuICAgICAgZm4gPSBjb21ibztcbiAgICAgIGNvbWJvID0gbnVsbDtcbiAgICB9XG4gICAgdmFyIGJ1dHRvbiA9IHRhZyh7IHQ6ICdidXR0b24nLCBjOiAnd2stY29tbWFuZCcsIHA6IGNvbW1hbmRzIH0pO1xuICAgIHZhciBjdXN0b20gPSBvLnJlbmRlci5jb21tYW5kcztcbiAgICB2YXIgcmVuZGVyID0gdHlwZW9mIGN1c3RvbSA9PT0gJ2Z1bmN0aW9uJyA/IGN1c3RvbSA6IHJlbmRlcmVycy5jb21tYW5kcztcbiAgICB2YXIgdGl0bGUgPSBzdHJpbmdzLnRpdGxlc1tpZF07XG4gICAgaWYgKHRpdGxlKSB7XG4gICAgICBidXR0b24uc2V0QXR0cmlidXRlKCd0aXRsZScsIG1hYyA/IG1hY2lmeSh0aXRsZSkgOiB0aXRsZSk7XG4gICAgfVxuICAgIGJ1dHRvbi50eXBlID0gJ2J1dHRvbic7XG4gICAgYnV0dG9uLnRhYkluZGV4ID0gLTE7XG4gICAgcmVuZGVyKGJ1dHRvbiwgaWQpO1xuICAgIGNyb3NzdmVudC5hZGQoYnV0dG9uLCAnY2xpY2snLCBnZXRDb21tYW5kSGFuZGxlcihzdXJmYWNlLCBoaXN0b3J5LCBmbikpO1xuICAgIGlmIChjb21ibykge1xuICAgICAgYWRkQ29tbWFuZChjb21ibywgZm4pO1xuICAgIH1cbiAgICByZXR1cm4gYnV0dG9uO1xuICB9XG5cbiAgZnVuY3Rpb24gYWRkQ29tbWFuZCAoY29tYm8sIGZuKSB7XG4gICAga2FueWUub24oY29tYm8sIGthbnllT3B0aW9ucywgZ2V0Q29tbWFuZEhhbmRsZXIoc3VyZmFjZSwgaGlzdG9yeSwgZm4pKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJ1bkNvbW1hbmQgKGZuKSB7XG4gICAgZ2V0Q29tbWFuZEhhbmRsZXIoc3VyZmFjZSwgaGlzdG9yeSwgcmVhcnJhbmdlKShudWxsKTtcbiAgICBmdW5jdGlvbiByZWFycmFuZ2UgKGUsIG1vZGUsIGNodW5rcykge1xuICAgICAgcmV0dXJuIGZuLmNhbGwodGhpcywgY2h1bmtzLCBtb2RlKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gdGFnIChvcHRpb25zKSB7XG4gIHZhciBvID0gb3B0aW9ucyB8fCB7fTtcbiAgdmFyIGVsID0gZG9jLmNyZWF0ZUVsZW1lbnQoby50IHx8ICdkaXYnKTtcbiAgZWwuY2xhc3NOYW1lID0gby5jIHx8ICcnO1xuICBzZXRUZXh0KGVsLCBvLnggfHwgJycpO1xuICBpZiAoby5wKSB7IG8ucC5hcHBlbmRDaGlsZChlbCk7IH1cbiAgcmV0dXJuIGVsO1xufVxuXG5mdW5jdGlvbiBzdG9wIChlKSB7XG4gIGlmIChlKSB7IGUucHJldmVudERlZmF1bHQoKTsgZS5zdG9wUHJvcGFnYXRpb24oKTsgfVxufVxuXG5mdW5jdGlvbiBtYWNpZnkgKHRleHQpIHtcbiAgcmV0dXJuIHRleHRcbiAgICAucmVwbGFjZSgvXFxiY3RybFxcYi9pLCAnXFx1MjMxOCcpXG4gICAgLnJlcGxhY2UoL1xcYmFsdFxcYi9pLCAnXFx1MjMyNScpXG4gICAgLnJlcGxhY2UoL1xcYnNoaWZ0XFxiL2ksICdcXHUyMWU3Jyk7XG59XG5cbndvb2ZtYXJrLmZpbmQgPSBmaW5kO1xud29vZm1hcmsuc3RyaW5ncyA9IHN0cmluZ3M7XG5tb2R1bGUuZXhwb3J0cyA9IHdvb2ZtYXJrO1xuIl19
},{"./InputHistory":21,"./bindCommands":23,"./classes":27,"./getCommandHandler":30,"./getSurface":31,"./prompts/close":55,"./prompts/prompt":56,"./rememberSelection":58,"./renderers":59,"./setText":60,"./strings":61,"./uploads":62,"./xhrStub":64,"crossvent":4,"kanye":7,"local-storage":8}],64:[function(require,module,exports){
'use strict';

function xhrStub (options) {
  throw new Error('Woofmark is missing XHR configuration. Can\'t request ' + options.url);
}

module.exports = xhrStub;

},{}]},{},[63])(63)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnVsbHNleWUvYnVsbHNleWUuanMiLCJub2RlX21vZHVsZXMvYnVsbHNleWUvdGFpbG9ybWFkZS5qcyIsIm5vZGVfbW9kdWxlcy9idWxsc2V5ZS90aHJvdHRsZS5qcyIsIm5vZGVfbW9kdWxlcy9jcm9zc3ZlbnQvc3JjL2Nyb3NzdmVudC5qcyIsIm5vZGVfbW9kdWxlcy9jcm9zc3ZlbnQvc3JjL2V2ZW50bWFwLmpzIiwibm9kZV9tb2R1bGVzL2N1c3RvbS1ldmVudC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9rYW55ZS9rYW55ZS5qcyIsIm5vZGVfbW9kdWxlcy9sb2NhbC1zdG9yYWdlL2xvY2FsLXN0b3JhZ2UuanMiLCJub2RlX21vZHVsZXMvbG9jYWwtc3RvcmFnZS9zdHViLmpzIiwibm9kZV9tb2R1bGVzL2xvY2FsLXN0b3JhZ2UvdHJhY2tpbmcuanMiLCJub2RlX21vZHVsZXMvc2VrdG9yL3NyYy9zZWt0b3IuanMiLCJub2RlX21vZHVsZXMvc2VsZWNjaW9uL3NyYy9nZXRTZWxlY3Rpb24uanMiLCJub2RlX21vZHVsZXMvc2VsZWNjaW9uL3NyYy9nZXRTZWxlY3Rpb25OdWxsT3AuanMiLCJub2RlX21vZHVsZXMvc2VsZWNjaW9uL3NyYy9nZXRTZWxlY3Rpb25SYXcuanMiLCJub2RlX21vZHVsZXMvc2VsZWNjaW9uL3NyYy9nZXRTZWxlY3Rpb25TeW50aGV0aWMuanMiLCJub2RlX21vZHVsZXMvc2VsZWNjaW9uL3NyYy9pc0hvc3QuanMiLCJub2RlX21vZHVsZXMvc2VsZWNjaW9uL3NyYy9yYW5nZVRvVGV4dFJhbmdlLmpzIiwibm9kZV9tb2R1bGVzL3NlbGVjY2lvbi9zcmMvc2VsZWNjaW9uLmpzIiwibm9kZV9tb2R1bGVzL3NlbGVjY2lvbi9zcmMvc2V0U2VsZWN0aW9uLmpzIiwibm9kZV9tb2R1bGVzL3NlbGwvc2VsbC5qcyIsInNyYy9JbnB1dEhpc3RvcnkuanMiLCJzcmMvSW5wdXRTdGF0ZS5qcyIsInNyYy9iaW5kQ29tbWFuZHMuanMiLCJzcmMvY2FzdC5qcyIsInNyYy9jaHVua3MvcGFyc2VMaW5rSW5wdXQuanMiLCJzcmMvY2h1bmtzL3RyaW0uanMiLCJzcmMvY2xhc3Nlcy5qcyIsInNyYy9leHRlbmRSZWdFeHAuanMiLCJzcmMvZml4RU9MLmpzIiwic3JjL2dldENvbW1hbmRIYW5kbGVyLmpzIiwic3JjL2dldFN1cmZhY2UuanMiLCJzcmMvZ2V0VGV4dC5qcyIsInNyYy9odG1sL0h0bWxDaHVua3MuanMiLCJzcmMvaHRtbC9ibG9ja3F1b3RlLmpzIiwic3JjL2h0bWwvYm9sZE9ySXRhbGljLmpzIiwic3JjL2h0bWwvY29kZWJsb2NrLmpzIiwic3JjL2h0bWwvaGVhZGluZy5qcyIsInNyYy9odG1sL2hyLmpzIiwic3JjL2h0bWwvbGlua09ySW1hZ2VPckF0dGFjaG1lbnQuanMiLCJzcmMvaHRtbC9saXN0LmpzIiwic3JjL2h0bWwvd3JhcHBpbmcuanMiLCJzcmMvaXNWaXNpYmxlRWxlbWVudC5qcyIsInNyYy9tYW55LmpzIiwic3JjL21hcmtkb3duL01hcmtkb3duQ2h1bmtzLmpzIiwic3JjL21hcmtkb3duL2Jsb2NrcXVvdGUuanMiLCJzcmMvbWFya2Rvd24vYm9sZE9ySXRhbGljLmpzIiwic3JjL21hcmtkb3duL2NvZGVibG9jay5qcyIsInNyYy9tYXJrZG93bi9oZWFkaW5nLmpzIiwic3JjL21hcmtkb3duL2hyLmpzIiwic3JjL21hcmtkb3duL2xpbmtPckltYWdlT3JBdHRhY2htZW50LmpzIiwic3JjL21hcmtkb3duL2xpc3QuanMiLCJzcmMvbWFya2Rvd24vc2V0dGluZ3MuanMiLCJzcmMvbWFya2Rvd24vd3JhcHBpbmcuanMiLCJzcmMvb25jZS5qcyIsInNyYy9wcm9tcHRzL2Nsb3NlLmpzIiwic3JjL3Byb21wdHMvcHJvbXB0LmpzIiwic3JjL3Byb21wdHMvcmVuZGVyLmpzIiwic3JjL3JlbWVtYmVyU2VsZWN0aW9uLmpzIiwic3JjL3JlbmRlcmVycy5qcyIsInNyYy9zZXRUZXh0LmpzIiwic3JjL3N0cmluZ3MuanMiLCJzcmMvdXBsb2Fkcy5qcyIsInNyYy93b29mbWFyay5qcyIsInNyYy94aHJTdHViLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeE1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN01BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25FQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcblxudmFyIGNyb3NzdmVudCA9IHJlcXVpcmUoJ2Nyb3NzdmVudCcpO1xudmFyIHRocm90dGxlID0gcmVxdWlyZSgnLi90aHJvdHRsZScpO1xudmFyIHRhaWxvcm1hZGUgPSByZXF1aXJlKCcuL3RhaWxvcm1hZGUnKTtcblxuZnVuY3Rpb24gYnVsbHNleWUgKGVsLCB0YXJnZXQsIG9wdGlvbnMpIHtcbiAgdmFyIG8gPSBvcHRpb25zO1xuICB2YXIgZG9tVGFyZ2V0ID0gdGFyZ2V0ICYmIHRhcmdldC50YWdOYW1lO1xuXG4gIGlmICghZG9tVGFyZ2V0ICYmIGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIHtcbiAgICBvID0gdGFyZ2V0O1xuICB9XG4gIGlmICghZG9tVGFyZ2V0KSB7XG4gICAgdGFyZ2V0ID0gZWw7XG4gIH1cbiAgaWYgKCFvKSB7IG8gPSB7fTsgfVxuXG4gIHZhciBkZXN0cm95ZWQgPSBmYWxzZTtcbiAgdmFyIHRocm90dGxlZFdyaXRlID0gdGhyb3R0bGUod3JpdGUsIDMwKTtcbiAgdmFyIHRhaWxvck9wdGlvbnMgPSB7IHVwZGF0ZTogby5hdXRvdXBkYXRlVG9DYXJldCAhPT0gZmFsc2UgJiYgdXBkYXRlIH07XG4gIHZhciB0YWlsb3IgPSBvLmNhcmV0ICYmIHRhaWxvcm1hZGUodGFyZ2V0LCB0YWlsb3JPcHRpb25zKTtcblxuICB3cml0ZSgpO1xuXG4gIGlmIChvLnRyYWNraW5nICE9PSBmYWxzZSkge1xuICAgIGNyb3NzdmVudC5hZGQod2luZG93LCAncmVzaXplJywgdGhyb3R0bGVkV3JpdGUpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICByZWFkOiByZWFkTnVsbCxcbiAgICByZWZyZXNoOiB3cml0ZSxcbiAgICBkZXN0cm95OiBkZXN0cm95LFxuICAgIHNsZWVwOiBzbGVlcFxuICB9O1xuXG4gIGZ1bmN0aW9uIHNsZWVwICgpIHtcbiAgICB0YWlsb3JPcHRpb25zLnNsZWVwaW5nID0gdHJ1ZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWROdWxsICgpIHsgcmV0dXJuIHJlYWQoKTsgfVxuXG4gIGZ1bmN0aW9uIHJlYWQgKHJlYWRpbmdzKSB7XG4gICAgdmFyIGJvdW5kcyA9IHRhcmdldC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICB2YXIgc2Nyb2xsVG9wID0gZG9jdW1lbnQuYm9keS5zY3JvbGxUb3AgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbFRvcDtcbiAgICBpZiAodGFpbG9yKSB7XG4gICAgICByZWFkaW5ncyA9IHRhaWxvci5yZWFkKCk7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB4OiAocmVhZGluZ3MuYWJzb2x1dGUgPyAwIDogYm91bmRzLmxlZnQpICsgcmVhZGluZ3MueCxcbiAgICAgICAgeTogKHJlYWRpbmdzLmFic29sdXRlID8gMCA6IGJvdW5kcy50b3ApICsgc2Nyb2xsVG9wICsgcmVhZGluZ3MueSArIDIwXG4gICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgeDogYm91bmRzLmxlZnQsXG4gICAgICB5OiBib3VuZHMudG9wICsgc2Nyb2xsVG9wXG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHVwZGF0ZSAocmVhZGluZ3MpIHtcbiAgICB3cml0ZShyZWFkaW5ncyk7XG4gIH1cblxuICBmdW5jdGlvbiB3cml0ZSAocmVhZGluZ3MpIHtcbiAgICBpZiAoZGVzdHJveWVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0J1bGxzZXllIGNhblxcJ3QgcmVmcmVzaCBhZnRlciBiZWluZyBkZXN0cm95ZWQuIENyZWF0ZSBhbm90aGVyIGluc3RhbmNlIGluc3RlYWQuJyk7XG4gICAgfVxuICAgIGlmICh0YWlsb3IgJiYgIXJlYWRpbmdzKSB7XG4gICAgICB0YWlsb3JPcHRpb25zLnNsZWVwaW5nID0gZmFsc2U7XG4gICAgICB0YWlsb3IucmVmcmVzaCgpOyByZXR1cm47XG4gICAgfVxuICAgIHZhciBwID0gcmVhZChyZWFkaW5ncyk7XG4gICAgaWYgKCF0YWlsb3IgJiYgdGFyZ2V0ICE9PSBlbCkge1xuICAgICAgcC55ICs9IHRhcmdldC5vZmZzZXRIZWlnaHQ7XG4gICAgfVxuICAgIGVsLnN0eWxlLmxlZnQgPSBwLnggKyAncHgnO1xuICAgIGVsLnN0eWxlLnRvcCA9IHAueSArICdweCc7XG4gIH1cblxuICBmdW5jdGlvbiBkZXN0cm95ICgpIHtcbiAgICBpZiAodGFpbG9yKSB7IHRhaWxvci5kZXN0cm95KCk7IH1cbiAgICBjcm9zc3ZlbnQucmVtb3ZlKHdpbmRvdywgJ3Jlc2l6ZScsIHRocm90dGxlZFdyaXRlKTtcbiAgICBkZXN0cm95ZWQgPSB0cnVlO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYnVsbHNleWU7XG4iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBzZWxsID0gcmVxdWlyZSgnc2VsbCcpO1xudmFyIGNyb3NzdmVudCA9IHJlcXVpcmUoJ2Nyb3NzdmVudCcpO1xudmFyIHNlbGVjY2lvbiA9IHJlcXVpcmUoJ3NlbGVjY2lvbicpO1xudmFyIHRocm90dGxlID0gcmVxdWlyZSgnLi90aHJvdHRsZScpO1xudmFyIGdldFNlbGVjdGlvbiA9IHNlbGVjY2lvbi5nZXQ7XG52YXIgcHJvcHMgPSBbXG4gICdkaXJlY3Rpb24nLFxuICAnYm94U2l6aW5nJyxcbiAgJ3dpZHRoJyxcbiAgJ2hlaWdodCcsXG4gICdvdmVyZmxvd1gnLFxuICAnb3ZlcmZsb3dZJyxcbiAgJ2JvcmRlclRvcFdpZHRoJyxcbiAgJ2JvcmRlclJpZ2h0V2lkdGgnLFxuICAnYm9yZGVyQm90dG9tV2lkdGgnLFxuICAnYm9yZGVyTGVmdFdpZHRoJyxcbiAgJ3BhZGRpbmdUb3AnLFxuICAncGFkZGluZ1JpZ2h0JyxcbiAgJ3BhZGRpbmdCb3R0b20nLFxuICAncGFkZGluZ0xlZnQnLFxuICAnZm9udFN0eWxlJyxcbiAgJ2ZvbnRWYXJpYW50JyxcbiAgJ2ZvbnRXZWlnaHQnLFxuICAnZm9udFN0cmV0Y2gnLFxuICAnZm9udFNpemUnLFxuICAnZm9udFNpemVBZGp1c3QnLFxuICAnbGluZUhlaWdodCcsXG4gICdmb250RmFtaWx5JyxcbiAgJ3RleHRBbGlnbicsXG4gICd0ZXh0VHJhbnNmb3JtJyxcbiAgJ3RleHRJbmRlbnQnLFxuICAndGV4dERlY29yYXRpb24nLFxuICAnbGV0dGVyU3BhY2luZycsXG4gICd3b3JkU3BhY2luZydcbl07XG52YXIgd2luID0gZ2xvYmFsO1xudmFyIGRvYyA9IGRvY3VtZW50O1xudmFyIGZmID0gd2luLm1veklubmVyU2NyZWVuWCAhPT0gbnVsbCAmJiB3aW4ubW96SW5uZXJTY3JlZW5YICE9PSB2b2lkIDA7XG5cbmZ1bmN0aW9uIHRhaWxvcm1hZGUgKGVsLCBvcHRpb25zKSB7XG4gIHZhciB0ZXh0SW5wdXQgPSBlbC50YWdOYW1lID09PSAnSU5QVVQnIHx8IGVsLnRhZ05hbWUgPT09ICdURVhUQVJFQSc7XG4gIHZhciB0aHJvdHRsZWRSZWZyZXNoID0gdGhyb3R0bGUocmVmcmVzaCwgMzApO1xuICB2YXIgbyA9IG9wdGlvbnMgfHwge307XG5cbiAgYmluZCgpO1xuXG4gIHJldHVybiB7XG4gICAgcmVhZDogcmVhZFBvc2l0aW9uLFxuICAgIHJlZnJlc2g6IHRocm90dGxlZFJlZnJlc2gsXG4gICAgZGVzdHJveTogZGVzdHJveVxuICB9O1xuXG4gIGZ1bmN0aW9uIG5vb3AgKCkge31cbiAgZnVuY3Rpb24gcmVhZFBvc2l0aW9uICgpIHsgcmV0dXJuICh0ZXh0SW5wdXQgPyBjb29yZHNUZXh0IDogY29vcmRzSFRNTCkoKTsgfVxuXG4gIGZ1bmN0aW9uIHJlZnJlc2ggKCkge1xuICAgIGlmIChvLnNsZWVwaW5nKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHJldHVybiAoby51cGRhdGUgfHwgbm9vcCkocmVhZFBvc2l0aW9uKCkpO1xuICB9XG5cbiAgZnVuY3Rpb24gY29vcmRzVGV4dCAoKSB7XG4gICAgdmFyIHAgPSBzZWxsKGVsKTtcbiAgICB2YXIgY29udGV4dCA9IHByZXBhcmUoKTtcbiAgICB2YXIgcmVhZGluZ3MgPSByZWFkVGV4dENvb3Jkcyhjb250ZXh0LCBwLnN0YXJ0KTtcbiAgICBkb2MuYm9keS5yZW1vdmVDaGlsZChjb250ZXh0Lm1pcnJvcik7XG4gICAgcmV0dXJuIHJlYWRpbmdzO1xuICB9XG5cbiAgZnVuY3Rpb24gY29vcmRzSFRNTCAoKSB7XG4gICAgdmFyIHNlbCA9IGdldFNlbGVjdGlvbigpO1xuICAgIGlmIChzZWwucmFuZ2VDb3VudCkge1xuICAgICAgdmFyIHJhbmdlID0gc2VsLmdldFJhbmdlQXQoMCk7XG4gICAgICB2YXIgbmVlZHNUb1dvcmtBcm91bmROZXdsaW5lQnVnID0gcmFuZ2Uuc3RhcnRDb250YWluZXIubm9kZU5hbWUgPT09ICdQJyAmJiByYW5nZS5zdGFydE9mZnNldCA9PT0gMDtcbiAgICAgIGlmIChuZWVkc1RvV29ya0Fyb3VuZE5ld2xpbmVCdWcpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB4OiByYW5nZS5zdGFydENvbnRhaW5lci5vZmZzZXRMZWZ0LFxuICAgICAgICAgIHk6IHJhbmdlLnN0YXJ0Q29udGFpbmVyLm9mZnNldFRvcCxcbiAgICAgICAgICBhYnNvbHV0ZTogdHJ1ZVxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgaWYgKHJhbmdlLmdldENsaWVudFJlY3RzKSB7XG4gICAgICAgIHZhciByZWN0cyA9IHJhbmdlLmdldENsaWVudFJlY3RzKCk7XG4gICAgICAgIGlmIChyZWN0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHg6IHJlY3RzWzBdLmxlZnQsXG4gICAgICAgICAgICB5OiByZWN0c1swXS50b3AsXG4gICAgICAgICAgICBhYnNvbHV0ZTogdHJ1ZVxuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHsgeDogMCwgeTogMCB9O1xuICB9XG5cbiAgZnVuY3Rpb24gcmVhZFRleHRDb29yZHMgKGNvbnRleHQsIHApIHtcbiAgICB2YXIgcmVzdCA9IGRvYy5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgdmFyIG1pcnJvciA9IGNvbnRleHQubWlycm9yO1xuICAgIHZhciBjb21wdXRlZCA9IGNvbnRleHQuY29tcHV0ZWQ7XG5cbiAgICB3cml0ZShtaXJyb3IsIHJlYWQoZWwpLnN1YnN0cmluZygwLCBwKSk7XG5cbiAgICBpZiAoZWwudGFnTmFtZSA9PT0gJ0lOUFVUJykge1xuICAgICAgbWlycm9yLnRleHRDb250ZW50ID0gbWlycm9yLnRleHRDb250ZW50LnJlcGxhY2UoL1xccy9nLCAnXFx1MDBhMCcpO1xuICAgIH1cblxuICAgIHdyaXRlKHJlc3QsIHJlYWQoZWwpLnN1YnN0cmluZyhwKSB8fCAnLicpO1xuXG4gICAgbWlycm9yLmFwcGVuZENoaWxkKHJlc3QpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHg6IHJlc3Qub2Zmc2V0TGVmdCArIHBhcnNlSW50KGNvbXB1dGVkWydib3JkZXJMZWZ0V2lkdGgnXSksXG4gICAgICB5OiByZXN0Lm9mZnNldFRvcCArIHBhcnNlSW50KGNvbXB1dGVkWydib3JkZXJUb3BXaWR0aCddKVxuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiByZWFkIChlbCkge1xuICAgIHJldHVybiB0ZXh0SW5wdXQgPyBlbC52YWx1ZSA6IGVsLmlubmVySFRNTDtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByZXBhcmUgKCkge1xuICAgIHZhciBjb21wdXRlZCA9IHdpbi5nZXRDb21wdXRlZFN0eWxlID8gZ2V0Q29tcHV0ZWRTdHlsZShlbCkgOiBlbC5jdXJyZW50U3R5bGU7XG4gICAgdmFyIG1pcnJvciA9IGRvYy5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICB2YXIgc3R5bGUgPSBtaXJyb3Iuc3R5bGU7XG5cbiAgICBkb2MuYm9keS5hcHBlbmRDaGlsZChtaXJyb3IpO1xuXG4gICAgaWYgKGVsLnRhZ05hbWUgIT09ICdJTlBVVCcpIHtcbiAgICAgIHN0eWxlLndvcmRXcmFwID0gJ2JyZWFrLXdvcmQnO1xuICAgIH1cbiAgICBzdHlsZS53aGl0ZVNwYWNlID0gJ3ByZS13cmFwJztcbiAgICBzdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG4gICAgc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nO1xuICAgIHByb3BzLmZvckVhY2goY29weSk7XG5cbiAgICBpZiAoZmYpIHtcbiAgICAgIHN0eWxlLndpZHRoID0gcGFyc2VJbnQoY29tcHV0ZWQud2lkdGgpIC0gMiArICdweCc7XG4gICAgICBpZiAoZWwuc2Nyb2xsSGVpZ2h0ID4gcGFyc2VJbnQoY29tcHV0ZWQuaGVpZ2h0KSkge1xuICAgICAgICBzdHlsZS5vdmVyZmxvd1kgPSAnc2Nyb2xsJztcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgc3R5bGUub3ZlcmZsb3cgPSAnaGlkZGVuJztcbiAgICB9XG4gICAgcmV0dXJuIHsgbWlycm9yOiBtaXJyb3IsIGNvbXB1dGVkOiBjb21wdXRlZCB9O1xuXG4gICAgZnVuY3Rpb24gY29weSAocHJvcCkge1xuICAgICAgc3R5bGVbcHJvcF0gPSBjb21wdXRlZFtwcm9wXTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB3cml0ZSAoZWwsIHZhbHVlKSB7XG4gICAgaWYgKHRleHRJbnB1dCkge1xuICAgICAgZWwudGV4dENvbnRlbnQgPSB2YWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgZWwuaW5uZXJIVE1MID0gdmFsdWU7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gYmluZCAocmVtb3ZlKSB7XG4gICAgdmFyIG9wID0gcmVtb3ZlID8gJ3JlbW92ZScgOiAnYWRkJztcbiAgICBjcm9zc3ZlbnRbb3BdKGVsLCAna2V5ZG93bicsIHRocm90dGxlZFJlZnJlc2gpO1xuICAgIGNyb3NzdmVudFtvcF0oZWwsICdrZXl1cCcsIHRocm90dGxlZFJlZnJlc2gpO1xuICAgIGNyb3NzdmVudFtvcF0oZWwsICdpbnB1dCcsIHRocm90dGxlZFJlZnJlc2gpO1xuICAgIGNyb3NzdmVudFtvcF0oZWwsICdwYXN0ZScsIHRocm90dGxlZFJlZnJlc2gpO1xuICAgIGNyb3NzdmVudFtvcF0oZWwsICdjaGFuZ2UnLCB0aHJvdHRsZWRSZWZyZXNoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRlc3Ryb3kgKCkge1xuICAgIGJpbmQodHJ1ZSk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSB0YWlsb3JtYWRlO1xuXG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSlcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0OnV0Zi04O2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKemIzVnlZMlZ6SWpwYkltNXZaR1ZmYlc5a2RXeGxjeTlpZFd4c2MyVjVaUzkwWVdsc2IzSnRZV1JsTG1weklsMHNJbTVoYldWeklqcGJYU3dpYldGd2NHbHVaM01pT2lJN1FVRkJRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRWlMQ0ptYVd4bElqb2laMlZ1WlhKaGRHVmtMbXB6SWl3aWMyOTFjbU5sVW05dmRDSTZJaUlzSW5OdmRYSmpaWE5EYjI1MFpXNTBJanBiSWlkMWMyVWdjM1J5YVdOMEp6dGNibHh1ZG1GeUlITmxiR3dnUFNCeVpYRjFhWEpsS0NkelpXeHNKeWs3WEc1MllYSWdZM0p2YzNOMlpXNTBJRDBnY21WeGRXbHlaU2duWTNKdmMzTjJaVzUwSnlrN1hHNTJZWElnYzJWc1pXTmphVzl1SUQwZ2NtVnhkV2x5WlNnbmMyVnNaV05qYVc5dUp5azdYRzUyWVhJZ2RHaHliM1IwYkdVZ1BTQnlaWEYxYVhKbEtDY3VMM1JvY205MGRHeGxKeWs3WEc1MllYSWdaMlYwVTJWc1pXTjBhVzl1SUQwZ2MyVnNaV05qYVc5dUxtZGxkRHRjYm5aaGNpQndjbTl3Y3lBOUlGdGNiaUFnSjJScGNtVmpkR2x2Ymljc1hHNGdJQ2RpYjNoVGFYcHBibWNuTEZ4dUlDQW5kMmxrZEdnbkxGeHVJQ0FuYUdWcFoyaDBKeXhjYmlBZ0oyOTJaWEptYkc5M1dDY3NYRzRnSUNkdmRtVnlabXh2ZDFrbkxGeHVJQ0FuWW05eVpHVnlWRzl3VjJsa2RHZ25MRnh1SUNBblltOXlaR1Z5VW1sbmFIUlhhV1IwYUNjc1hHNGdJQ2RpYjNKa1pYSkNiM1IwYjIxWGFXUjBhQ2NzWEc0Z0lDZGliM0prWlhKTVpXWjBWMmxrZEdnbkxGeHVJQ0FuY0dGa1pHbHVaMVJ2Y0Njc1hHNGdJQ2R3WVdSa2FXNW5VbWxuYUhRbkxGeHVJQ0FuY0dGa1pHbHVaMEp2ZEhSdmJTY3NYRzRnSUNkd1lXUmthVzVuVEdWbWRDY3NYRzRnSUNkbWIyNTBVM1I1YkdVbkxGeHVJQ0FuWm05dWRGWmhjbWxoYm5RbkxGeHVJQ0FuWm05dWRGZGxhV2RvZENjc1hHNGdJQ2RtYjI1MFUzUnlaWFJqYUNjc1hHNGdJQ2RtYjI1MFUybDZaU2NzWEc0Z0lDZG1iMjUwVTJsNlpVRmthblZ6ZENjc1hHNGdJQ2RzYVc1bFNHVnBaMmgwSnl4Y2JpQWdKMlp2Ym5SR1lXMXBiSGtuTEZ4dUlDQW5kR1Y0ZEVGc2FXZHVKeXhjYmlBZ0ozUmxlSFJVY21GdWMyWnZjbTBuTEZ4dUlDQW5kR1Y0ZEVsdVpHVnVkQ2NzWEc0Z0lDZDBaWGgwUkdWamIzSmhkR2x2Ymljc1hHNGdJQ2RzWlhSMFpYSlRjR0ZqYVc1bkp5eGNiaUFnSjNkdmNtUlRjR0ZqYVc1bkoxeHVYVHRjYm5aaGNpQjNhVzRnUFNCbmJHOWlZV3c3WEc1MllYSWdaRzlqSUQwZ1pHOWpkVzFsYm5RN1hHNTJZWElnWm1ZZ1BTQjNhVzR1Ylc5NlNXNXVaWEpUWTNKbFpXNVlJQ0U5UFNCdWRXeHNJQ1ltSUhkcGJpNXRiM3BKYm01bGNsTmpjbVZsYmxnZ0lUMDlJSFp2YVdRZ01EdGNibHh1Wm5WdVkzUnBiMjRnZEdGcGJHOXliV0ZrWlNBb1pXd3NJRzl3ZEdsdmJuTXBJSHRjYmlBZ2RtRnlJSFJsZUhSSmJuQjFkQ0E5SUdWc0xuUmhaMDVoYldVZ1BUMDlJQ2RKVGxCVlZDY2dmSHdnWld3dWRHRm5UbUZ0WlNBOVBUMGdKMVJGV0ZSQlVrVkJKenRjYmlBZ2RtRnlJSFJvY205MGRHeGxaRkpsWm5KbGMyZ2dQU0IwYUhKdmRIUnNaU2h5WldaeVpYTm9MQ0F6TUNrN1hHNGdJSFpoY2lCdklEMGdiM0IwYVc5dWN5QjhmQ0I3ZlR0Y2JseHVJQ0JpYVc1a0tDazdYRzVjYmlBZ2NtVjBkWEp1SUh0Y2JpQWdJQ0J5WldGa09pQnlaV0ZrVUc5emFYUnBiMjRzWEc0Z0lDQWdjbVZtY21WemFEb2dkR2h5YjNSMGJHVmtVbVZtY21WemFDeGNiaUFnSUNCa1pYTjBjbTk1T2lCa1pYTjBjbTk1WEc0Z0lIMDdYRzVjYmlBZ1puVnVZM1JwYjI0Z2JtOXZjQ0FvS1NCN2ZWeHVJQ0JtZFc1amRHbHZiaUJ5WldGa1VHOXphWFJwYjI0Z0tDa2dleUJ5WlhSMWNtNGdLSFJsZUhSSmJuQjFkQ0EvSUdOdmIzSmtjMVJsZUhRZ09pQmpiMjl5WkhOSVZFMU1LU2dwT3lCOVhHNWNiaUFnWm5WdVkzUnBiMjRnY21WbWNtVnphQ0FvS1NCN1hHNGdJQ0FnYVdZZ0tHOHVjMnhsWlhCcGJtY3BJSHRjYmlBZ0lDQWdJSEpsZEhWeWJqdGNiaUFnSUNCOVhHNGdJQ0FnY21WMGRYSnVJQ2h2TG5Wd1pHRjBaU0I4ZkNCdWIyOXdLU2h5WldGa1VHOXphWFJwYjI0b0tTazdYRzRnSUgxY2JseHVJQ0JtZFc1amRHbHZiaUJqYjI5eVpITlVaWGgwSUNncElIdGNiaUFnSUNCMllYSWdjQ0E5SUhObGJHd29aV3dwTzF4dUlDQWdJSFpoY2lCamIyNTBaWGgwSUQwZ2NISmxjR0Z5WlNncE8xeHVJQ0FnSUhaaGNpQnlaV0ZrYVc1bmN5QTlJSEpsWVdSVVpYaDBRMjl2Y21SektHTnZiblJsZUhRc0lIQXVjM1JoY25RcE8xeHVJQ0FnSUdSdll5NWliMlI1TG5KbGJXOTJaVU5vYVd4a0tHTnZiblJsZUhRdWJXbHljbTl5S1R0Y2JpQWdJQ0J5WlhSMWNtNGdjbVZoWkdsdVozTTdYRzRnSUgxY2JseHVJQ0JtZFc1amRHbHZiaUJqYjI5eVpITklWRTFNSUNncElIdGNiaUFnSUNCMllYSWdjMlZzSUQwZ1oyVjBVMlZzWldOMGFXOXVLQ2s3WEc0Z0lDQWdhV1lnS0hObGJDNXlZVzVuWlVOdmRXNTBLU0I3WEc0Z0lDQWdJQ0IyWVhJZ2NtRnVaMlVnUFNCelpXd3VaMlYwVW1GdVoyVkJkQ2d3S1R0Y2JpQWdJQ0FnSUhaaGNpQnVaV1ZrYzFSdlYyOXlhMEZ5YjNWdVpFNWxkMnhwYm1WQ2RXY2dQU0J5WVc1blpTNXpkR0Z5ZEVOdmJuUmhhVzVsY2k1dWIyUmxUbUZ0WlNBOVBUMGdKMUFuSUNZbUlISmhibWRsTG5OMFlYSjBUMlptYzJWMElEMDlQU0F3TzF4dUlDQWdJQ0FnYVdZZ0tHNWxaV1J6Vkc5WGIzSnJRWEp2ZFc1a1RtVjNiR2x1WlVKMVp5a2dlMXh1SUNBZ0lDQWdJQ0J5WlhSMWNtNGdlMXh1SUNBZ0lDQWdJQ0FnSUhnNklISmhibWRsTG5OMFlYSjBRMjl1ZEdGcGJtVnlMbTltWm5ObGRFeGxablFzWEc0Z0lDQWdJQ0FnSUNBZ2VUb2djbUZ1WjJVdWMzUmhjblJEYjI1MFlXbHVaWEl1YjJabWMyVjBWRzl3TEZ4dUlDQWdJQ0FnSUNBZ0lHRmljMjlzZFhSbE9pQjBjblZsWEc0Z0lDQWdJQ0FnSUgwN1hHNGdJQ0FnSUNCOVhHNGdJQ0FnSUNCcFppQW9jbUZ1WjJVdVoyVjBRMnhwWlc1MFVtVmpkSE1wSUh0Y2JpQWdJQ0FnSUNBZ2RtRnlJSEpsWTNSeklEMGdjbUZ1WjJVdVoyVjBRMnhwWlc1MFVtVmpkSE1vS1R0Y2JpQWdJQ0FnSUNBZ2FXWWdLSEpsWTNSekxteGxibWQwYUNBK0lEQXBJSHRjYmlBZ0lDQWdJQ0FnSUNCeVpYUjFjbTRnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdlRG9nY21WamRITmJNRjB1YkdWbWRDeGNiaUFnSUNBZ0lDQWdJQ0FnSUhrNklISmxZM1J6V3pCZExuUnZjQ3hjYmlBZ0lDQWdJQ0FnSUNBZ0lHRmljMjlzZFhSbE9pQjBjblZsWEc0Z0lDQWdJQ0FnSUNBZ2ZUdGNiaUFnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdmVnh1SUNBZ0lIMWNiaUFnSUNCeVpYUjFjbTRnZXlCNE9pQXdMQ0I1T2lBd0lIMDdYRzRnSUgxY2JseHVJQ0JtZFc1amRHbHZiaUJ5WldGa1ZHVjRkRU52YjNKa2N5QW9ZMjl1ZEdWNGRDd2djQ2tnZTF4dUlDQWdJSFpoY2lCeVpYTjBJRDBnWkc5akxtTnlaV0YwWlVWc1pXMWxiblFvSjNOd1lXNG5LVHRjYmlBZ0lDQjJZWElnYldseWNtOXlJRDBnWTI5dWRHVjRkQzV0YVhKeWIzSTdYRzRnSUNBZ2RtRnlJR052YlhCMWRHVmtJRDBnWTI5dWRHVjRkQzVqYjIxd2RYUmxaRHRjYmx4dUlDQWdJSGR5YVhSbEtHMXBjbkp2Y2l3Z2NtVmhaQ2hsYkNrdWMzVmljM1J5YVc1bktEQXNJSEFwS1R0Y2JseHVJQ0FnSUdsbUlDaGxiQzUwWVdkT1lXMWxJRDA5UFNBblNVNVFWVlFuS1NCN1hHNGdJQ0FnSUNCdGFYSnliM0l1ZEdWNGRFTnZiblJsYm5RZ1BTQnRhWEp5YjNJdWRHVjRkRU52Ym5SbGJuUXVjbVZ3YkdGalpTZ3ZYRnh6TDJjc0lDZGNYSFV3TUdFd0p5azdYRzRnSUNBZ2ZWeHVYRzRnSUNBZ2QzSnBkR1VvY21WemRDd2djbVZoWkNobGJDa3VjM1ZpYzNSeWFXNW5LSEFwSUh4OElDY3VKeWs3WEc1Y2JpQWdJQ0J0YVhKeWIzSXVZWEJ3Wlc1a1EyaHBiR1FvY21WemRDazdYRzVjYmlBZ0lDQnlaWFIxY200Z2UxeHVJQ0FnSUNBZ2VEb2djbVZ6ZEM1dlptWnpaWFJNWldaMElDc2djR0Z5YzJWSmJuUW9ZMjl0Y0hWMFpXUmJKMkp2Y21SbGNreGxablJYYVdSMGFDZGRLU3hjYmlBZ0lDQWdJSGs2SUhKbGMzUXViMlptYzJWMFZHOXdJQ3NnY0dGeWMyVkpiblFvWTI5dGNIVjBaV1JiSjJKdmNtUmxjbFJ2Y0ZkcFpIUm9KMTBwWEc0Z0lDQWdmVHRjYmlBZ2ZWeHVYRzRnSUdaMWJtTjBhVzl1SUhKbFlXUWdLR1ZzS1NCN1hHNGdJQ0FnY21WMGRYSnVJSFJsZUhSSmJuQjFkQ0EvSUdWc0xuWmhiSFZsSURvZ1pXd3VhVzV1WlhKSVZFMU1PMXh1SUNCOVhHNWNiaUFnWm5WdVkzUnBiMjRnY0hKbGNHRnlaU0FvS1NCN1hHNGdJQ0FnZG1GeUlHTnZiWEIxZEdWa0lEMGdkMmx1TG1kbGRFTnZiWEIxZEdWa1UzUjViR1VnUHlCblpYUkRiMjF3ZFhSbFpGTjBlV3hsS0dWc0tTQTZJR1ZzTG1OMWNuSmxiblJUZEhsc1pUdGNiaUFnSUNCMllYSWdiV2x5Y205eUlEMGdaRzlqTG1OeVpXRjBaVVZzWlcxbGJuUW9KMlJwZGljcE8xeHVJQ0FnSUhaaGNpQnpkSGxzWlNBOUlHMXBjbkp2Y2k1emRIbHNaVHRjYmx4dUlDQWdJR1J2WXk1aWIyUjVMbUZ3Y0dWdVpFTm9hV3hrS0cxcGNuSnZjaWs3WEc1Y2JpQWdJQ0JwWmlBb1pXd3VkR0ZuVG1GdFpTQWhQVDBnSjBsT1VGVlVKeWtnZTF4dUlDQWdJQ0FnYzNSNWJHVXVkMjl5WkZkeVlYQWdQU0FuWW5KbFlXc3RkMjl5WkNjN1hHNGdJQ0FnZlZ4dUlDQWdJSE4wZVd4bExuZG9hWFJsVTNCaFkyVWdQU0FuY0hKbExYZHlZWEFuTzF4dUlDQWdJSE4wZVd4bExuQnZjMmwwYVc5dUlEMGdKMkZpYzI5c2RYUmxKenRjYmlBZ0lDQnpkSGxzWlM1MmFYTnBZbWxzYVhSNUlEMGdKMmhwWkdSbGJpYzdYRzRnSUNBZ2NISnZjSE11Wm05eVJXRmphQ2hqYjNCNUtUdGNibHh1SUNBZ0lHbG1JQ2htWmlrZ2UxeHVJQ0FnSUNBZ2MzUjViR1V1ZDJsa2RHZ2dQU0J3WVhKelpVbHVkQ2hqYjIxd2RYUmxaQzUzYVdSMGFDa2dMU0F5SUNzZ0ozQjRKenRjYmlBZ0lDQWdJR2xtSUNobGJDNXpZM0p2Ykd4SVpXbG5hSFFnUGlCd1lYSnpaVWx1ZENoamIyMXdkWFJsWkM1b1pXbG5hSFFwS1NCN1hHNGdJQ0FnSUNBZ0lITjBlV3hsTG05MlpYSm1iRzkzV1NBOUlDZHpZM0p2Ykd3bk8xeHVJQ0FnSUNBZ2ZWeHVJQ0FnSUgwZ1pXeHpaU0I3WEc0Z0lDQWdJQ0J6ZEhsc1pTNXZkbVZ5Wm14dmR5QTlJQ2RvYVdSa1pXNG5PMXh1SUNBZ0lIMWNiaUFnSUNCeVpYUjFjbTRnZXlCdGFYSnliM0k2SUcxcGNuSnZjaXdnWTI5dGNIVjBaV1E2SUdOdmJYQjFkR1ZrSUgwN1hHNWNiaUFnSUNCbWRXNWpkR2x2YmlCamIzQjVJQ2h3Y205d0tTQjdYRzRnSUNBZ0lDQnpkSGxzWlZ0d2NtOXdYU0E5SUdOdmJYQjFkR1ZrVzNCeWIzQmRPMXh1SUNBZ0lIMWNiaUFnZlZ4dVhHNGdJR1oxYm1OMGFXOXVJSGR5YVhSbElDaGxiQ3dnZG1Gc2RXVXBJSHRjYmlBZ0lDQnBaaUFvZEdWNGRFbHVjSFYwS1NCN1hHNGdJQ0FnSUNCbGJDNTBaWGgwUTI5dWRHVnVkQ0E5SUhaaGJIVmxPMXh1SUNBZ0lIMGdaV3h6WlNCN1hHNGdJQ0FnSUNCbGJDNXBibTVsY2toVVRVd2dQU0IyWVd4MVpUdGNiaUFnSUNCOVhHNGdJSDFjYmx4dUlDQm1kVzVqZEdsdmJpQmlhVzVrSUNoeVpXMXZkbVVwSUh0Y2JpQWdJQ0IyWVhJZ2IzQWdQU0J5WlcxdmRtVWdQeUFuY21WdGIzWmxKeUE2SUNkaFpHUW5PMXh1SUNBZ0lHTnliM056ZG1WdWRGdHZjRjBvWld3c0lDZHJaWGxrYjNkdUp5d2dkR2h5YjNSMGJHVmtVbVZtY21WemFDazdYRzRnSUNBZ1kzSnZjM04yWlc1MFcyOXdYU2hsYkN3Z0oydGxlWFZ3Snl3Z2RHaHliM1IwYkdWa1VtVm1jbVZ6YUNrN1hHNGdJQ0FnWTNKdmMzTjJaVzUwVzI5d1hTaGxiQ3dnSjJsdWNIVjBKeXdnZEdoeWIzUjBiR1ZrVW1WbWNtVnphQ2s3WEc0Z0lDQWdZM0p2YzNOMlpXNTBXMjl3WFNobGJDd2dKM0JoYzNSbEp5d2dkR2h5YjNSMGJHVmtVbVZtY21WemFDazdYRzRnSUNBZ1kzSnZjM04yWlc1MFcyOXdYU2hsYkN3Z0oyTm9ZVzVuWlNjc0lIUm9jbTkwZEd4bFpGSmxabkpsYzJncE8xeHVJQ0I5WEc1Y2JpQWdablZ1WTNScGIyNGdaR1Z6ZEhKdmVTQW9LU0I3WEc0Z0lDQWdZbWx1WkNoMGNuVmxLVHRjYmlBZ2ZWeHVmVnh1WEc1dGIyUjFiR1V1Wlhod2IzSjBjeUE5SUhSaGFXeHZjbTFoWkdVN1hHNGlYWDA9IiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiB0aHJvdHRsZSAoZm4sIGJvdW5kYXJ5KSB7XG4gIHZhciBsYXN0ID0gLUluZmluaXR5O1xuICB2YXIgdGltZXI7XG4gIHJldHVybiBmdW5jdGlvbiBib3VuY2VkICgpIHtcbiAgICBpZiAodGltZXIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdW5ib3VuZCgpO1xuXG4gICAgZnVuY3Rpb24gdW5ib3VuZCAoKSB7XG4gICAgICBjbGVhclRpbWVvdXQodGltZXIpO1xuICAgICAgdGltZXIgPSBudWxsO1xuICAgICAgdmFyIG5leHQgPSBsYXN0ICsgYm91bmRhcnk7XG4gICAgICB2YXIgbm93ID0gRGF0ZS5ub3coKTtcbiAgICAgIGlmIChub3cgPiBuZXh0KSB7XG4gICAgICAgIGxhc3QgPSBub3c7XG4gICAgICAgIGZuKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aW1lciA9IHNldFRpbWVvdXQodW5ib3VuZCwgbmV4dCAtIG5vdyk7XG4gICAgICB9XG4gICAgfVxuICB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHRocm90dGxlO1xuIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgY3VzdG9tRXZlbnQgPSByZXF1aXJlKCdjdXN0b20tZXZlbnQnKTtcbnZhciBldmVudG1hcCA9IHJlcXVpcmUoJy4vZXZlbnRtYXAnKTtcbnZhciBkb2MgPSBkb2N1bWVudDtcbnZhciBhZGRFdmVudCA9IGFkZEV2ZW50RWFzeTtcbnZhciByZW1vdmVFdmVudCA9IHJlbW92ZUV2ZW50RWFzeTtcbnZhciBoYXJkQ2FjaGUgPSBbXTtcblxuaWYgKCFnbG9iYWwuYWRkRXZlbnRMaXN0ZW5lcikge1xuICBhZGRFdmVudCA9IGFkZEV2ZW50SGFyZDtcbiAgcmVtb3ZlRXZlbnQgPSByZW1vdmVFdmVudEhhcmQ7XG59XG5cbmZ1bmN0aW9uIGFkZEV2ZW50RWFzeSAoZWwsIHR5cGUsIGZuLCBjYXB0dXJpbmcpIHtcbiAgcmV0dXJuIGVsLmFkZEV2ZW50TGlzdGVuZXIodHlwZSwgZm4sIGNhcHR1cmluZyk7XG59XG5cbmZ1bmN0aW9uIGFkZEV2ZW50SGFyZCAoZWwsIHR5cGUsIGZuKSB7XG4gIHJldHVybiBlbC5hdHRhY2hFdmVudCgnb24nICsgdHlwZSwgd3JhcChlbCwgdHlwZSwgZm4pKTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlRXZlbnRFYXN5IChlbCwgdHlwZSwgZm4sIGNhcHR1cmluZykge1xuICByZXR1cm4gZWwucmVtb3ZlRXZlbnRMaXN0ZW5lcih0eXBlLCBmbiwgY2FwdHVyaW5nKTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlRXZlbnRIYXJkIChlbCwgdHlwZSwgZm4pIHtcbiAgcmV0dXJuIGVsLmRldGFjaEV2ZW50KCdvbicgKyB0eXBlLCB1bndyYXAoZWwsIHR5cGUsIGZuKSk7XG59XG5cbmZ1bmN0aW9uIGZhYnJpY2F0ZUV2ZW50IChlbCwgdHlwZSwgbW9kZWwpIHtcbiAgdmFyIGUgPSBldmVudG1hcC5pbmRleE9mKHR5cGUpID09PSAtMSA/IG1ha2VDdXN0b21FdmVudCgpIDogbWFrZUNsYXNzaWNFdmVudCgpO1xuICBpZiAoZWwuZGlzcGF0Y2hFdmVudCkge1xuICAgIGVsLmRpc3BhdGNoRXZlbnQoZSk7XG4gIH0gZWxzZSB7XG4gICAgZWwuZmlyZUV2ZW50KCdvbicgKyB0eXBlLCBlKTtcbiAgfVxuICBmdW5jdGlvbiBtYWtlQ2xhc3NpY0V2ZW50ICgpIHtcbiAgICB2YXIgZTtcbiAgICBpZiAoZG9jLmNyZWF0ZUV2ZW50KSB7XG4gICAgICBlID0gZG9jLmNyZWF0ZUV2ZW50KCdFdmVudCcpO1xuICAgICAgZS5pbml0RXZlbnQodHlwZSwgdHJ1ZSwgdHJ1ZSk7XG4gICAgfSBlbHNlIGlmIChkb2MuY3JlYXRlRXZlbnRPYmplY3QpIHtcbiAgICAgIGUgPSBkb2MuY3JlYXRlRXZlbnRPYmplY3QoKTtcbiAgICB9XG4gICAgcmV0dXJuIGU7XG4gIH1cbiAgZnVuY3Rpb24gbWFrZUN1c3RvbUV2ZW50ICgpIHtcbiAgICByZXR1cm4gbmV3IGN1c3RvbUV2ZW50KHR5cGUsIHsgZGV0YWlsOiBtb2RlbCB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiB3cmFwcGVyRmFjdG9yeSAoZWwsIHR5cGUsIGZuKSB7XG4gIHJldHVybiBmdW5jdGlvbiB3cmFwcGVyIChvcmlnaW5hbEV2ZW50KSB7XG4gICAgdmFyIGUgPSBvcmlnaW5hbEV2ZW50IHx8IGdsb2JhbC5ldmVudDtcbiAgICBlLnRhcmdldCA9IGUudGFyZ2V0IHx8IGUuc3JjRWxlbWVudDtcbiAgICBlLnByZXZlbnREZWZhdWx0ID0gZS5wcmV2ZW50RGVmYXVsdCB8fCBmdW5jdGlvbiBwcmV2ZW50RGVmYXVsdCAoKSB7IGUucmV0dXJuVmFsdWUgPSBmYWxzZTsgfTtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbiA9IGUuc3RvcFByb3BhZ2F0aW9uIHx8IGZ1bmN0aW9uIHN0b3BQcm9wYWdhdGlvbiAoKSB7IGUuY2FuY2VsQnViYmxlID0gdHJ1ZTsgfTtcbiAgICBlLndoaWNoID0gZS53aGljaCB8fCBlLmtleUNvZGU7XG4gICAgZm4uY2FsbChlbCwgZSk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHdyYXAgKGVsLCB0eXBlLCBmbikge1xuICB2YXIgd3JhcHBlciA9IHVud3JhcChlbCwgdHlwZSwgZm4pIHx8IHdyYXBwZXJGYWN0b3J5KGVsLCB0eXBlLCBmbik7XG4gIGhhcmRDYWNoZS5wdXNoKHtcbiAgICB3cmFwcGVyOiB3cmFwcGVyLFxuICAgIGVsZW1lbnQ6IGVsLFxuICAgIHR5cGU6IHR5cGUsXG4gICAgZm46IGZuXG4gIH0pO1xuICByZXR1cm4gd3JhcHBlcjtcbn1cblxuZnVuY3Rpb24gdW53cmFwIChlbCwgdHlwZSwgZm4pIHtcbiAgdmFyIGkgPSBmaW5kKGVsLCB0eXBlLCBmbik7XG4gIGlmIChpKSB7XG4gICAgdmFyIHdyYXBwZXIgPSBoYXJkQ2FjaGVbaV0ud3JhcHBlcjtcbiAgICBoYXJkQ2FjaGUuc3BsaWNlKGksIDEpOyAvLyBmcmVlIHVwIGEgdGFkIG9mIG1lbW9yeVxuICAgIHJldHVybiB3cmFwcGVyO1xuICB9XG59XG5cbmZ1bmN0aW9uIGZpbmQgKGVsLCB0eXBlLCBmbikge1xuICB2YXIgaSwgaXRlbTtcbiAgZm9yIChpID0gMDsgaSA8IGhhcmRDYWNoZS5sZW5ndGg7IGkrKykge1xuICAgIGl0ZW0gPSBoYXJkQ2FjaGVbaV07XG4gICAgaWYgKGl0ZW0uZWxlbWVudCA9PT0gZWwgJiYgaXRlbS50eXBlID09PSB0eXBlICYmIGl0ZW0uZm4gPT09IGZuKSB7XG4gICAgICByZXR1cm4gaTtcbiAgICB9XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGFkZDogYWRkRXZlbnQsXG4gIHJlbW92ZTogcmVtb3ZlRXZlbnQsXG4gIGZhYnJpY2F0ZTogZmFicmljYXRlRXZlbnRcbn07XG5cbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ6dXRmLTg7YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0p6YjNWeVkyVnpJanBiSW01dlpHVmZiVzlrZFd4bGN5OWpjbTl6YzNabGJuUXZjM0pqTDJOeWIzTnpkbVZ1ZEM1cWN5SmRMQ0p1WVcxbGN5STZXMTBzSW0xaGNIQnBibWR6SWpvaU8wRkJRVUU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQklpd2labWxzWlNJNkltZGxibVZ5WVhSbFpDNXFjeUlzSW5OdmRYSmpaVkp2YjNRaU9pSWlMQ0p6YjNWeVkyVnpRMjl1ZEdWdWRDSTZXeUluZFhObElITjBjbWxqZENjN1hHNWNiblpoY2lCamRYTjBiMjFGZG1WdWRDQTlJSEpsY1hWcGNtVW9KMk4xYzNSdmJTMWxkbVZ1ZENjcE8xeHVkbUZ5SUdWMlpXNTBiV0Z3SUQwZ2NtVnhkV2x5WlNnbkxpOWxkbVZ1ZEcxaGNDY3BPMXh1ZG1GeUlHUnZZeUE5SUdSdlkzVnRaVzUwTzF4dWRtRnlJR0ZrWkVWMlpXNTBJRDBnWVdSa1JYWmxiblJGWVhONU8xeHVkbUZ5SUhKbGJXOTJaVVYyWlc1MElEMGdjbVZ0YjNabFJYWmxiblJGWVhONU8xeHVkbUZ5SUdoaGNtUkRZV05vWlNBOUlGdGRPMXh1WEc1cFppQW9JV2RzYjJKaGJDNWhaR1JGZG1WdWRFeHBjM1JsYm1WeUtTQjdYRzRnSUdGa1pFVjJaVzUwSUQwZ1lXUmtSWFpsYm5SSVlYSmtPMXh1SUNCeVpXMXZkbVZGZG1WdWRDQTlJSEpsYlc5MlpVVjJaVzUwU0dGeVpEdGNibjFjYmx4dVpuVnVZM1JwYjI0Z1lXUmtSWFpsYm5SRllYTjVJQ2hsYkN3Z2RIbHdaU3dnWm00c0lHTmhjSFIxY21sdVp5a2dlMXh1SUNCeVpYUjFjbTRnWld3dVlXUmtSWFpsYm5STWFYTjBaVzVsY2loMGVYQmxMQ0JtYml3Z1kyRndkSFZ5YVc1bktUdGNibjFjYmx4dVpuVnVZM1JwYjI0Z1lXUmtSWFpsYm5SSVlYSmtJQ2hsYkN3Z2RIbHdaU3dnWm00cElIdGNiaUFnY21WMGRYSnVJR1ZzTG1GMGRHRmphRVYyWlc1MEtDZHZiaWNnS3lCMGVYQmxMQ0IzY21Gd0tHVnNMQ0IwZVhCbExDQm1iaWtwTzF4dWZWeHVYRzVtZFc1amRHbHZiaUJ5WlcxdmRtVkZkbVZ1ZEVWaGMza2dLR1ZzTENCMGVYQmxMQ0JtYml3Z1kyRndkSFZ5YVc1bktTQjdYRzRnSUhKbGRIVnliaUJsYkM1eVpXMXZkbVZGZG1WdWRFeHBjM1JsYm1WeUtIUjVjR1VzSUdadUxDQmpZWEIwZFhKcGJtY3BPMXh1ZlZ4dVhHNW1kVzVqZEdsdmJpQnlaVzF2ZG1WRmRtVnVkRWhoY21RZ0tHVnNMQ0IwZVhCbExDQm1iaWtnZTF4dUlDQnlaWFIxY200Z1pXd3VaR1YwWVdOb1JYWmxiblFvSjI5dUp5QXJJSFI1Y0dVc0lIVnVkM0poY0NobGJDd2dkSGx3WlN3Z1ptNHBLVHRjYm4xY2JseHVablZ1WTNScGIyNGdabUZpY21sallYUmxSWFpsYm5RZ0tHVnNMQ0IwZVhCbExDQnRiMlJsYkNrZ2UxeHVJQ0IyWVhJZ1pTQTlJR1YyWlc1MGJXRndMbWx1WkdWNFQyWW9kSGx3WlNrZ1BUMDlJQzB4SUQ4Z2JXRnJaVU4xYzNSdmJVVjJaVzUwS0NrZ09pQnRZV3RsUTJ4aGMzTnBZMFYyWlc1MEtDazdYRzRnSUdsbUlDaGxiQzVrYVhOd1lYUmphRVYyWlc1MEtTQjdYRzRnSUNBZ1pXd3VaR2x6Y0dGMFkyaEZkbVZ1ZENobEtUdGNiaUFnZlNCbGJITmxJSHRjYmlBZ0lDQmxiQzVtYVhKbFJYWmxiblFvSjI5dUp5QXJJSFI1Y0dVc0lHVXBPMXh1SUNCOVhHNGdJR1oxYm1OMGFXOXVJRzFoYTJWRGJHRnpjMmxqUlhabGJuUWdLQ2tnZTF4dUlDQWdJSFpoY2lCbE8xeHVJQ0FnSUdsbUlDaGtiMk11WTNKbFlYUmxSWFpsYm5RcElIdGNiaUFnSUNBZ0lHVWdQU0JrYjJNdVkzSmxZWFJsUlhabGJuUW9KMFYyWlc1MEp5azdYRzRnSUNBZ0lDQmxMbWx1YVhSRmRtVnVkQ2gwZVhCbExDQjBjblZsTENCMGNuVmxLVHRjYmlBZ0lDQjlJR1ZzYzJVZ2FXWWdLR1J2WXk1amNtVmhkR1ZGZG1WdWRFOWlhbVZqZENrZ2UxeHVJQ0FnSUNBZ1pTQTlJR1J2WXk1amNtVmhkR1ZGZG1WdWRFOWlhbVZqZENncE8xeHVJQ0FnSUgxY2JpQWdJQ0J5WlhSMWNtNGdaVHRjYmlBZ2ZWeHVJQ0JtZFc1amRHbHZiaUJ0WVd0bFEzVnpkRzl0UlhabGJuUWdLQ2tnZTF4dUlDQWdJSEpsZEhWeWJpQnVaWGNnWTNWemRHOXRSWFpsYm5Rb2RIbHdaU3dnZXlCa1pYUmhhV3c2SUcxdlpHVnNJSDBwTzF4dUlDQjlYRzU5WEc1Y2JtWjFibU4wYVc5dUlIZHlZWEJ3WlhKR1lXTjBiM0o1SUNobGJDd2dkSGx3WlN3Z1ptNHBJSHRjYmlBZ2NtVjBkWEp1SUdaMWJtTjBhVzl1SUhkeVlYQndaWElnS0c5eWFXZHBibUZzUlhabGJuUXBJSHRjYmlBZ0lDQjJZWElnWlNBOUlHOXlhV2RwYm1Gc1JYWmxiblFnZkh3Z1oyeHZZbUZzTG1WMlpXNTBPMXh1SUNBZ0lHVXVkR0Z5WjJWMElEMGdaUzUwWVhKblpYUWdmSHdnWlM1emNtTkZiR1Z0Wlc1ME8xeHVJQ0FnSUdVdWNISmxkbVZ1ZEVSbFptRjFiSFFnUFNCbExuQnlaWFpsYm5SRVpXWmhkV3gwSUh4OElHWjFibU4wYVc5dUlIQnlaWFpsYm5SRVpXWmhkV3gwSUNncElIc2daUzV5WlhSMWNtNVdZV3gxWlNBOUlHWmhiSE5sT3lCOU8xeHVJQ0FnSUdVdWMzUnZjRkJ5YjNCaFoyRjBhVzl1SUQwZ1pTNXpkRzl3VUhKdmNHRm5ZWFJwYjI0Z2ZId2dablZ1WTNScGIyNGdjM1J2Y0ZCeWIzQmhaMkYwYVc5dUlDZ3BJSHNnWlM1allXNWpaV3hDZFdKaWJHVWdQU0IwY25WbE95QjlPMXh1SUNBZ0lHVXVkMmhwWTJnZ1BTQmxMbmRvYVdOb0lIeDhJR1V1YTJWNVEyOWtaVHRjYmlBZ0lDQm1iaTVqWVd4c0tHVnNMQ0JsS1R0Y2JpQWdmVHRjYm4xY2JseHVablZ1WTNScGIyNGdkM0poY0NBb1pXd3NJSFI1Y0dVc0lHWnVLU0I3WEc0Z0lIWmhjaUIzY21Gd2NHVnlJRDBnZFc1M2NtRndLR1ZzTENCMGVYQmxMQ0JtYmlrZ2ZId2dkM0poY0hCbGNrWmhZM1J2Y25rb1pXd3NJSFI1Y0dVc0lHWnVLVHRjYmlBZ2FHRnlaRU5oWTJobExuQjFjMmdvZTF4dUlDQWdJSGR5WVhCd1pYSTZJSGR5WVhCd1pYSXNYRzRnSUNBZ1pXeGxiV1Z1ZERvZ1pXd3NYRzRnSUNBZ2RIbHdaVG9nZEhsd1pTeGNiaUFnSUNCbWJqb2dabTVjYmlBZ2ZTazdYRzRnSUhKbGRIVnliaUIzY21Gd2NHVnlPMXh1ZlZ4dVhHNW1kVzVqZEdsdmJpQjFibmR5WVhBZ0tHVnNMQ0IwZVhCbExDQm1iaWtnZTF4dUlDQjJZWElnYVNBOUlHWnBibVFvWld3c0lIUjVjR1VzSUdadUtUdGNiaUFnYVdZZ0tHa3BJSHRjYmlBZ0lDQjJZWElnZDNKaGNIQmxjaUE5SUdoaGNtUkRZV05vWlZ0cFhTNTNjbUZ3Y0dWeU8xeHVJQ0FnSUdoaGNtUkRZV05vWlM1emNHeHBZMlVvYVN3Z01TazdJQzh2SUdaeVpXVWdkWEFnWVNCMFlXUWdiMllnYldWdGIzSjVYRzRnSUNBZ2NtVjBkWEp1SUhkeVlYQndaWEk3WEc0Z0lIMWNibjFjYmx4dVpuVnVZM1JwYjI0Z1ptbHVaQ0FvWld3c0lIUjVjR1VzSUdadUtTQjdYRzRnSUhaaGNpQnBMQ0JwZEdWdE8xeHVJQ0JtYjNJZ0tHa2dQU0F3T3lCcElEd2dhR0Z5WkVOaFkyaGxMbXhsYm1kMGFEc2dhU3NyS1NCN1hHNGdJQ0FnYVhSbGJTQTlJR2hoY21SRFlXTm9aVnRwWFR0Y2JpQWdJQ0JwWmlBb2FYUmxiUzVsYkdWdFpXNTBJRDA5UFNCbGJDQW1KaUJwZEdWdExuUjVjR1VnUFQwOUlIUjVjR1VnSmlZZ2FYUmxiUzVtYmlBOVBUMGdabTRwSUh0Y2JpQWdJQ0FnSUhKbGRIVnliaUJwTzF4dUlDQWdJSDFjYmlBZ2ZWeHVmVnh1WEc1dGIyUjFiR1V1Wlhod2IzSjBjeUE5SUh0Y2JpQWdZV1JrT2lCaFpHUkZkbVZ1ZEN4Y2JpQWdjbVZ0YjNabE9pQnlaVzF2ZG1WRmRtVnVkQ3hjYmlBZ1ptRmljbWxqWVhSbE9pQm1ZV0p5YVdOaGRHVkZkbVZ1ZEZ4dWZUdGNiaUpkZlE9PSIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIGV2ZW50bWFwID0gW107XG52YXIgZXZlbnRuYW1lID0gJyc7XG52YXIgcm9uID0gL15vbi87XG5cbmZvciAoZXZlbnRuYW1lIGluIGdsb2JhbCkge1xuICBpZiAocm9uLnRlc3QoZXZlbnRuYW1lKSkge1xuICAgIGV2ZW50bWFwLnB1c2goZXZlbnRuYW1lLnNsaWNlKDIpKTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGV2ZW50bWFwO1xuXG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSlcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0OnV0Zi04O2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKemIzVnlZMlZ6SWpwYkltNXZaR1ZmYlc5a2RXeGxjeTlqY205emMzWmxiblF2YzNKakwyVjJaVzUwYldGd0xtcHpJbDBzSW01aGJXVnpJanBiWFN3aWJXRndjR2x1WjNNaU9pSTdRVUZCUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQklpd2labWxzWlNJNkltZGxibVZ5WVhSbFpDNXFjeUlzSW5OdmRYSmpaVkp2YjNRaU9pSWlMQ0p6YjNWeVkyVnpRMjl1ZEdWdWRDSTZXeUluZFhObElITjBjbWxqZENjN1hHNWNiblpoY2lCbGRtVnVkRzFoY0NBOUlGdGRPMXh1ZG1GeUlHVjJaVzUwYm1GdFpTQTlJQ2NuTzF4dWRtRnlJSEp2YmlBOUlDOWViMjR2TzF4dVhHNW1iM0lnS0dWMlpXNTBibUZ0WlNCcGJpQm5iRzlpWVd3cElIdGNiaUFnYVdZZ0tISnZiaTUwWlhOMEtHVjJaVzUwYm1GdFpTa3BJSHRjYmlBZ0lDQmxkbVZ1ZEcxaGNDNXdkWE5vS0dWMlpXNTBibUZ0WlM1emJHbGpaU2d5S1NrN1hHNGdJSDFjYm4xY2JseHViVzlrZFd4bExtVjRjRzl5ZEhNZ1BTQmxkbVZ1ZEcxaGNEdGNiaUpkZlE9PSIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcblxudmFyIE5hdGl2ZUN1c3RvbUV2ZW50ID0gZ2xvYmFsLkN1c3RvbUV2ZW50O1xuXG5mdW5jdGlvbiB1c2VOYXRpdmUgKCkge1xuICB0cnkge1xuICAgIHZhciBwID0gbmV3IE5hdGl2ZUN1c3RvbUV2ZW50KCdjYXQnLCB7IGRldGFpbDogeyBmb286ICdiYXInIH0gfSk7XG4gICAgcmV0dXJuICAnY2F0JyA9PT0gcC50eXBlICYmICdiYXInID09PSBwLmRldGFpbC5mb287XG4gIH0gY2F0Y2ggKGUpIHtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbi8qKlxuICogQ3Jvc3MtYnJvd3NlciBgQ3VzdG9tRXZlbnRgIGNvbnN0cnVjdG9yLlxuICpcbiAqIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9DdXN0b21FdmVudC5DdXN0b21FdmVudFxuICpcbiAqIEBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IHVzZU5hdGl2ZSgpID8gTmF0aXZlQ3VzdG9tRXZlbnQgOlxuXG4vLyBJRSA+PSA5XG4nZnVuY3Rpb24nID09PSB0eXBlb2YgZG9jdW1lbnQuY3JlYXRlRXZlbnQgPyBmdW5jdGlvbiBDdXN0b21FdmVudCAodHlwZSwgcGFyYW1zKSB7XG4gIHZhciBlID0gZG9jdW1lbnQuY3JlYXRlRXZlbnQoJ0N1c3RvbUV2ZW50Jyk7XG4gIGlmIChwYXJhbXMpIHtcbiAgICBlLmluaXRDdXN0b21FdmVudCh0eXBlLCBwYXJhbXMuYnViYmxlcywgcGFyYW1zLmNhbmNlbGFibGUsIHBhcmFtcy5kZXRhaWwpO1xuICB9IGVsc2Uge1xuICAgIGUuaW5pdEN1c3RvbUV2ZW50KHR5cGUsIGZhbHNlLCBmYWxzZSwgdm9pZCAwKTtcbiAgfVxuICByZXR1cm4gZTtcbn0gOlxuXG4vLyBJRSA8PSA4XG5mdW5jdGlvbiBDdXN0b21FdmVudCAodHlwZSwgcGFyYW1zKSB7XG4gIHZhciBlID0gZG9jdW1lbnQuY3JlYXRlRXZlbnRPYmplY3QoKTtcbiAgZS50eXBlID0gdHlwZTtcbiAgaWYgKHBhcmFtcykge1xuICAgIGUuYnViYmxlcyA9IEJvb2xlYW4ocGFyYW1zLmJ1YmJsZXMpO1xuICAgIGUuY2FuY2VsYWJsZSA9IEJvb2xlYW4ocGFyYW1zLmNhbmNlbGFibGUpO1xuICAgIGUuZGV0YWlsID0gcGFyYW1zLmRldGFpbDtcbiAgfSBlbHNlIHtcbiAgICBlLmJ1YmJsZXMgPSBmYWxzZTtcbiAgICBlLmNhbmNlbGFibGUgPSBmYWxzZTtcbiAgICBlLmRldGFpbCA9IHZvaWQgMDtcbiAgfVxuICByZXR1cm4gZTtcbn1cblxufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pXG4vLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247Y2hhcnNldDp1dGYtODtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSnpiM1Z5WTJWeklqcGJJbTV2WkdWZmJXOWtkV3hsY3k5amRYTjBiMjB0WlhabGJuUXZhVzVrWlhndWFuTWlYU3dpYm1GdFpYTWlPbHRkTENKdFlYQndhVzVuY3lJNklqdEJRVUZCTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJJaXdpWm1sc1pTSTZJbWRsYm1WeVlYUmxaQzVxY3lJc0luTnZkWEpqWlZKdmIzUWlPaUlpTENKemIzVnlZMlZ6UTI5dWRHVnVkQ0k2V3lKY2JuWmhjaUJPWVhScGRtVkRkWE4wYjIxRmRtVnVkQ0E5SUdkc2IySmhiQzVEZFhOMGIyMUZkbVZ1ZER0Y2JseHVablZ1WTNScGIyNGdkWE5sVG1GMGFYWmxJQ2dwSUh0Y2JpQWdkSEo1SUh0Y2JpQWdJQ0IyWVhJZ2NDQTlJRzVsZHlCT1lYUnBkbVZEZFhOMGIyMUZkbVZ1ZENnblkyRjBKeXdnZXlCa1pYUmhhV3c2SUhzZ1ptOXZPaUFuWW1GeUp5QjlJSDBwTzF4dUlDQWdJSEpsZEhWeWJpQWdKMk5oZENjZ1BUMDlJSEF1ZEhsd1pTQW1KaUFuWW1GeUp5QTlQVDBnY0M1a1pYUmhhV3d1Wm05dk8xeHVJQ0I5SUdOaGRHTm9JQ2hsS1NCN1hHNGdJSDFjYmlBZ2NtVjBkWEp1SUdaaGJITmxPMXh1ZlZ4dVhHNHZLaXBjYmlBcUlFTnliM056TFdKeWIzZHpaWElnWUVOMWMzUnZiVVYyWlc1MFlDQmpiMjV6ZEhKMVkzUnZjaTVjYmlBcVhHNGdLaUJvZEhSd2N6b3ZMMlJsZG1Wc2IzQmxjaTV0YjNwcGJHeGhMbTl5Wnk5bGJpMVZVeTlrYjJOekwxZGxZaTlCVUVrdlEzVnpkRzl0UlhabGJuUXVRM1Z6ZEc5dFJYWmxiblJjYmlBcVhHNGdLaUJBY0hWaWJHbGpYRzRnS2k5Y2JseHViVzlrZFd4bExtVjRjRzl5ZEhNZ1BTQjFjMlZPWVhScGRtVW9LU0EvSUU1aGRHbDJaVU4xYzNSdmJVVjJaVzUwSURwY2JseHVMeThnU1VVZ1BqMGdPVnh1SjJaMWJtTjBhVzl1SnlBOVBUMGdkSGx3Wlc5bUlHUnZZM1Z0Wlc1MExtTnlaV0YwWlVWMlpXNTBJRDhnWm5WdVkzUnBiMjRnUTNWemRHOXRSWFpsYm5RZ0tIUjVjR1VzSUhCaGNtRnRjeWtnZTF4dUlDQjJZWElnWlNBOUlHUnZZM1Z0Wlc1MExtTnlaV0YwWlVWMlpXNTBLQ2REZFhOMGIyMUZkbVZ1ZENjcE8xeHVJQ0JwWmlBb2NHRnlZVzF6S1NCN1hHNGdJQ0FnWlM1cGJtbDBRM1Z6ZEc5dFJYWmxiblFvZEhsd1pTd2djR0Z5WVcxekxtSjFZbUpzWlhNc0lIQmhjbUZ0Y3k1allXNWpaV3hoWW14bExDQndZWEpoYlhNdVpHVjBZV2xzS1R0Y2JpQWdmU0JsYkhObElIdGNiaUFnSUNCbExtbHVhWFJEZFhOMGIyMUZkbVZ1ZENoMGVYQmxMQ0JtWVd4elpTd2dabUZzYzJVc0lIWnZhV1FnTUNrN1hHNGdJSDFjYmlBZ2NtVjBkWEp1SUdVN1hHNTlJRHBjYmx4dUx5OGdTVVVnUEQwZ09GeHVablZ1WTNScGIyNGdRM1Z6ZEc5dFJYWmxiblFnS0hSNWNHVXNJSEJoY21GdGN5a2dlMXh1SUNCMllYSWdaU0E5SUdSdlkzVnRaVzUwTG1OeVpXRjBaVVYyWlc1MFQySnFaV04wS0NrN1hHNGdJR1V1ZEhsd1pTQTlJSFI1Y0dVN1hHNGdJR2xtSUNod1lYSmhiWE1wSUh0Y2JpQWdJQ0JsTG1KMVltSnNaWE1nUFNCQ2IyOXNaV0Z1S0hCaGNtRnRjeTVpZFdKaWJHVnpLVHRjYmlBZ0lDQmxMbU5oYm1ObGJHRmliR1VnUFNCQ2IyOXNaV0Z1S0hCaGNtRnRjeTVqWVc1alpXeGhZbXhsS1R0Y2JpQWdJQ0JsTG1SbGRHRnBiQ0E5SUhCaGNtRnRjeTVrWlhSaGFXdzdYRzRnSUgwZ1pXeHpaU0I3WEc0Z0lDQWdaUzVpZFdKaWJHVnpJRDBnWm1Gc2MyVTdYRzRnSUNBZ1pTNWpZVzVqWld4aFlteGxJRDBnWm1Gc2MyVTdYRzRnSUNBZ1pTNWtaWFJoYVd3Z1BTQjJiMmxrSURBN1hHNGdJSDFjYmlBZ2NtVjBkWEp1SUdVN1hHNTlYRzRpWFgwPSIsIid1c2Ugc3RyaWN0JztcblxudmFyIHNla3RvciA9IHJlcXVpcmUoJ3Nla3RvcicpO1xudmFyIGNyb3NzdmVudCA9IHJlcXVpcmUoJ2Nyb3NzdmVudCcpO1xudmFyIHJzcGFjZXMgPSAvXFxzKy9nO1xudmFyIGtleW1hcCA9IHtcbiAgMTM6ICdlbnRlcicsXG4gIDI3OiAnZXNjJyxcbiAgMzI6ICdzcGFjZSdcbn07XG52YXIgaGFuZGxlcnMgPSB7fTtcblxuY3Jvc3N2ZW50LmFkZCh3aW5kb3csICdrZXlkb3duJywga2V5ZG93bik7XG5cbmZ1bmN0aW9uIGNsZWFyIChjb250ZXh0KSB7XG4gIGlmIChjb250ZXh0KSB7XG4gICAgaWYgKGNvbnRleHQgaW4gaGFuZGxlcnMpIHtcbiAgICAgIGhhbmRsZXJzW2NvbnRleHRdID0ge307XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGhhbmRsZXJzID0ge307XG4gIH1cbn1cblxuZnVuY3Rpb24gc3dpdGNoYm9hcmQgKHRoZW4sIGNvbWJvLCBvcHRpb25zLCBmbikge1xuICBpZiAoZm4gPT09IHZvaWQgMCkge1xuICAgIGZuID0gb3B0aW9ucztcbiAgICBvcHRpb25zID0ge307XG4gIH1cblxuICB2YXIgY29udGV4dCA9IG9wdGlvbnMuY29udGV4dCB8fCAnZGVmYXVsdHMnO1xuXG4gIGlmICghZm4pIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAoaGFuZGxlcnNbY29udGV4dF0gPT09IHZvaWQgMCkge1xuICAgIGhhbmRsZXJzW2NvbnRleHRdID0ge307XG4gIH1cblxuICBjb21iby50b0xvd2VyQ2FzZSgpLnNwbGl0KHJzcGFjZXMpLmZvckVhY2goaXRlbSk7XG5cbiAgZnVuY3Rpb24gaXRlbSAoa2V5cykge1xuICAgIHZhciBjID0ga2V5cy50cmltKCk7XG4gICAgaWYgKGMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoZW4oaGFuZGxlcnNbY29udGV4dF0sIGMsIG9wdGlvbnMsIGZuKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBvbiAoY29tYm8sIG9wdGlvbnMsIGZuKSB7XG4gIHN3aXRjaGJvYXJkKGFkZCwgY29tYm8sIG9wdGlvbnMsIGZuKTtcblxuICBmdW5jdGlvbiBhZGQgKGFyZWEsIGtleSwgb3B0aW9ucywgZm4pIHtcbiAgICB2YXIgaGFuZGxlciA9IHtcbiAgICAgIGhhbmRsZTogZm4sXG4gICAgICBmaWx0ZXI6IG9wdGlvbnMuZmlsdGVyXG4gICAgfTtcbiAgICBpZiAoYXJlYVtrZXldKSB7XG4gICAgICBhcmVhW2tleV0ucHVzaChoYW5kbGVyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgYXJlYVtrZXldID0gW2hhbmRsZXJdO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBvZmYgKGNvbWJvLCBvcHRpb25zLCBmbikge1xuICBzd2l0Y2hib2FyZChybSwgY29tYm8sIG9wdGlvbnMsIGZuKTtcblxuICBmdW5jdGlvbiBybSAoYXJlYSwga2V5LCBvcHRpb25zLCBmbikge1xuICAgIGlmIChhcmVhW2tleV0pIHtcbiAgICAgIGFyZWFba2V5XSA9IGFyZWFba2V5XS5maWx0ZXIobWF0Y2hpbmcpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG1hdGNoaW5nIChoYW5kbGVyKSB7XG4gICAgICByZXR1cm4gaGFuZGxlci5oYW5kbGUgPT09IGZuICYmIGhhbmRsZXIuZmlsdGVyID09PSBvcHRpb25zLmZpbHRlcjtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0S2V5Q29kZSAoZSkge1xuICByZXR1cm4gZS53aGljaCB8fCBlLmtleUNvZGUgfHwgZS5jaGFyQ29kZTtcbn1cblxuZnVuY3Rpb24ga2V5ZG93biAoZSkge1xuICB2YXIgY29kZSA9IGdldEtleUNvZGUoZSk7XG4gIHZhciBrZXkgPSBrZXltYXBbY29kZV0gfHwgU3RyaW5nLmZyb21DaGFyQ29kZShjb2RlKTtcbiAgaWYgKGtleSkge1xuICAgIGhhbmRsZShrZXksIGUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHBhcnNlS2V5Q29tYm8gKGtleSwgZSkge1xuICB2YXIgY29tYm8gPSBba2V5XTtcbiAgaWYgKGUuc2hpZnRLZXkpIHtcbiAgICBjb21iby51bnNoaWZ0KCdzaGlmdCcpO1xuICB9XG4gIGlmIChlLmFsdEtleSkge1xuICAgIGNvbWJvLnVuc2hpZnQoJ2FsdCcpO1xuICB9XG4gIGlmIChlLmN0cmxLZXkgXiBlLm1ldGFLZXkpIHtcbiAgICBjb21iby51bnNoaWZ0KCdjbWQnKTtcbiAgfVxuICByZXR1cm4gY29tYm8uam9pbignKycpLnRvTG93ZXJDYXNlKCk7XG59XG5cbmZ1bmN0aW9uIGhhbmRsZSAoa2V5LCBlKSB7XG4gIHZhciBjb21ibyA9IHBhcnNlS2V5Q29tYm8oa2V5LCBlKTtcbiAgdmFyIGNvbnRleHQ7XG4gIGZvciAoY29udGV4dCBpbiBoYW5kbGVycykge1xuICAgIGlmIChoYW5kbGVyc1tjb250ZXh0XVtjb21ib10pIHtcbiAgICAgIGhhbmRsZXJzW2NvbnRleHRdW2NvbWJvXS5mb3JFYWNoKGV4ZWMpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGZpbHRlcmVkIChoYW5kbGVyKSB7XG4gICAgdmFyIGZpbHRlciA9IGhhbmRsZXIuZmlsdGVyO1xuICAgIGlmICghZmlsdGVyKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGVsID0gZS50YXJnZXQ7XG4gICAgdmFyIHNlbGVjdG9yID0gdHlwZW9mIGZpbHRlciA9PT0gJ3N0cmluZyc7XG4gICAgaWYgKHNlbGVjdG9yKSB7XG4gICAgICByZXR1cm4gc2VrdG9yLm1hdGNoZXNTZWxlY3RvcihlbCwgZmlsdGVyKSA9PT0gZmFsc2U7XG4gICAgfVxuICAgIHdoaWxlIChlbC5wYXJlbnRFbGVtZW50ICYmIGVsICE9PSBmaWx0ZXIpIHtcbiAgICAgIGVsID0gZWwucGFyZW50RWxlbWVudDtcbiAgICB9XG4gICAgcmV0dXJuIGVsICE9PSBmaWx0ZXI7XG4gIH1cblxuICBmdW5jdGlvbiBleGVjIChoYW5kbGVyKSB7XG4gICAgaWYgKGZpbHRlcmVkKGhhbmRsZXIpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGhhbmRsZXIuaGFuZGxlKGUpO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBvbjogb24sXG4gIG9mZjogb2ZmLFxuICBjbGVhcjogY2xlYXIsXG4gIGhhbmRsZXJzOiBoYW5kbGVyc1xufTtcbiIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIHN0dWIgPSByZXF1aXJlKCcuL3N0dWInKTtcbnZhciB0cmFja2luZyA9IHJlcXVpcmUoJy4vdHJhY2tpbmcnKTtcbnZhciBscyA9ICdsb2NhbFN0b3JhZ2UnIGluIGdsb2JhbCAmJiBnbG9iYWwubG9jYWxTdG9yYWdlID8gZ2xvYmFsLmxvY2FsU3RvcmFnZSA6IHN0dWI7XG5cbmZ1bmN0aW9uIGFjY2Vzc29yIChrZXksIHZhbHVlKSB7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAxKSB7XG4gICAgcmV0dXJuIGdldChrZXkpO1xuICB9XG4gIHJldHVybiBzZXQoa2V5LCB2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGdldCAoa2V5KSB7XG4gIHJldHVybiBKU09OLnBhcnNlKGxzLmdldEl0ZW0oa2V5KSk7XG59XG5cbmZ1bmN0aW9uIHNldCAoa2V5LCB2YWx1ZSkge1xuICB0cnkge1xuICAgIGxzLnNldEl0ZW0oa2V5LCBKU09OLnN0cmluZ2lmeSh2YWx1ZSkpO1xuICAgIHJldHVybiB0cnVlO1xuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlbW92ZSAoa2V5KSB7XG4gIHJldHVybiBscy5yZW1vdmVJdGVtKGtleSk7XG59XG5cbmZ1bmN0aW9uIGNsZWFyICgpIHtcbiAgcmV0dXJuIGxzLmNsZWFyKCk7XG59XG5cbmFjY2Vzc29yLnNldCA9IHNldDtcbmFjY2Vzc29yLmdldCA9IGdldDtcbmFjY2Vzc29yLnJlbW92ZSA9IHJlbW92ZTtcbmFjY2Vzc29yLmNsZWFyID0gY2xlYXI7XG5hY2Nlc3Nvci5vbiA9IHRyYWNraW5nLm9uO1xuYWNjZXNzb3Iub2ZmID0gdHJhY2tpbmcub2ZmO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGFjY2Vzc29yO1xuXG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSlcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0OnV0Zi04O2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKemIzVnlZMlZ6SWpwYkltNXZaR1ZmYlc5a2RXeGxjeTlzYjJOaGJDMXpkRzl5WVdkbEwyeHZZMkZzTFhOMGIzSmhaMlV1YW5NaVhTd2libUZ0WlhNaU9sdGRMQ0p0WVhCd2FXNW5jeUk2SWp0QlFVRkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CSWl3aVptbHNaU0k2SW1kbGJtVnlZWFJsWkM1cWN5SXNJbk52ZFhKalpWSnZiM1FpT2lJaUxDSnpiM1Z5WTJWelEyOXVkR1Z1ZENJNld5SW5kWE5sSUhOMGNtbGpkQ2M3WEc1Y2JuWmhjaUJ6ZEhWaUlEMGdjbVZ4ZFdseVpTZ25MaTl6ZEhWaUp5azdYRzUyWVhJZ2RISmhZMnRwYm1jZ1BTQnlaWEYxYVhKbEtDY3VMM1J5WVdOcmFXNW5KeWs3WEc1MllYSWdiSE1nUFNBbmJHOWpZV3hUZEc5eVlXZGxKeUJwYmlCbmJHOWlZV3dnSmlZZ1oyeHZZbUZzTG14dlkyRnNVM1J2Y21GblpTQS9JR2RzYjJKaGJDNXNiMk5oYkZOMGIzSmhaMlVnT2lCemRIVmlPMXh1WEc1bWRXNWpkR2x2YmlCaFkyTmxjM052Y2lBb2EyVjVMQ0IyWVd4MVpTa2dlMXh1SUNCcFppQW9ZWEpuZFcxbGJuUnpMbXhsYm1kMGFDQTlQVDBnTVNrZ2UxeHVJQ0FnSUhKbGRIVnliaUJuWlhRb2EyVjVLVHRjYmlBZ2ZWeHVJQ0J5WlhSMWNtNGdjMlYwS0d0bGVTd2dkbUZzZFdVcE8xeHVmVnh1WEc1bWRXNWpkR2x2YmlCblpYUWdLR3RsZVNrZ2UxeHVJQ0J5WlhSMWNtNGdTbE5QVGk1d1lYSnpaU2hzY3k1blpYUkpkR1Z0S0d0bGVTa3BPMXh1ZlZ4dVhHNW1kVzVqZEdsdmJpQnpaWFFnS0d0bGVTd2dkbUZzZFdVcElIdGNiaUFnZEhKNUlIdGNiaUFnSUNCc2N5NXpaWFJKZEdWdEtHdGxlU3dnU2xOUFRpNXpkSEpwYm1kcFpua29kbUZzZFdVcEtUdGNiaUFnSUNCeVpYUjFjbTRnZEhKMVpUdGNiaUFnZlNCallYUmphQ0FvWlNrZ2UxeHVJQ0FnSUhKbGRIVnliaUJtWVd4elpUdGNiaUFnZlZ4dWZWeHVYRzVtZFc1amRHbHZiaUJ5WlcxdmRtVWdLR3RsZVNrZ2UxeHVJQ0J5WlhSMWNtNGdiSE11Y21WdGIzWmxTWFJsYlNoclpYa3BPMXh1ZlZ4dVhHNW1kVzVqZEdsdmJpQmpiR1ZoY2lBb0tTQjdYRzRnSUhKbGRIVnliaUJzY3k1amJHVmhjaWdwTzF4dWZWeHVYRzVoWTJObGMzTnZjaTV6WlhRZ1BTQnpaWFE3WEc1aFkyTmxjM052Y2k1blpYUWdQU0JuWlhRN1hHNWhZMk5sYzNOdmNpNXlaVzF2ZG1VZ1BTQnlaVzF2ZG1VN1hHNWhZMk5sYzNOdmNpNWpiR1ZoY2lBOUlHTnNaV0Z5TzF4dVlXTmpaWE56YjNJdWIyNGdQU0IwY21GamEybHVaeTV2Ymp0Y2JtRmpZMlZ6YzI5eUxtOW1aaUE5SUhSeVlXTnJhVzVuTG05bVpqdGNibHh1Ylc5a2RXeGxMbVY0Y0c5eWRITWdQU0JoWTJObGMzTnZjanRjYmlKZGZRPT0iLCIndXNlIHN0cmljdCc7XG5cbnZhciBtcyA9IHt9O1xuXG5mdW5jdGlvbiBnZXRJdGVtIChrZXkpIHtcbiAgcmV0dXJuIGtleSBpbiBtcyA/IG1zW2tleV0gOiBudWxsO1xufVxuXG5mdW5jdGlvbiBzZXRJdGVtIChrZXksIHZhbHVlKSB7XG4gIG1zW2tleV0gPSB2YWx1ZTtcbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIHJlbW92ZUl0ZW0gKGtleSkge1xuICB2YXIgZm91bmQgPSBrZXkgaW4gbXM7XG4gIGlmIChmb3VuZCkge1xuICAgIHJldHVybiBkZWxldGUgbXNba2V5XTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIGNsZWFyICgpIHtcbiAgbXMgPSB7fTtcbiAgcmV0dXJuIHRydWU7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBnZXRJdGVtOiBnZXRJdGVtLFxuICBzZXRJdGVtOiBzZXRJdGVtLFxuICByZW1vdmVJdGVtOiByZW1vdmVJdGVtLFxuICBjbGVhcjogY2xlYXJcbn07XG4iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBsaXN0ZW5lcnMgPSB7fTtcbnZhciBsaXN0ZW5pbmcgPSBmYWxzZTtcblxuZnVuY3Rpb24gbGlzdGVuICgpIHtcbiAgaWYgKGdsb2JhbC5hZGRFdmVudExpc3RlbmVyKSB7XG4gICAgZ2xvYmFsLmFkZEV2ZW50TGlzdGVuZXIoJ3N0b3JhZ2UnLCBjaGFuZ2UsIGZhbHNlKTtcbiAgfSBlbHNlIGlmIChnbG9iYWwuYXR0YWNoRXZlbnQpIHtcbiAgICBnbG9iYWwuYXR0YWNoRXZlbnQoJ29uc3RvcmFnZScsIGNoYW5nZSk7XG4gIH0gZWxzZSB7XG4gICAgZ2xvYmFsLm9uc3RvcmFnZSA9IGNoYW5nZTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjaGFuZ2UgKGUpIHtcbiAgaWYgKCFlKSB7XG4gICAgZSA9IGdsb2JhbC5ldmVudDtcbiAgfVxuICB2YXIgYWxsID0gbGlzdGVuZXJzW2Uua2V5XTtcbiAgaWYgKGFsbCkge1xuICAgIGFsbC5mb3JFYWNoKGZpcmUpO1xuICB9XG5cbiAgZnVuY3Rpb24gZmlyZSAobGlzdGVuZXIpIHtcbiAgICBsaXN0ZW5lcihKU09OLnBhcnNlKGUubmV3VmFsdWUpLCBKU09OLnBhcnNlKGUub2xkVmFsdWUpLCBlLnVybCB8fCBlLnVyaSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gb24gKGtleSwgZm4pIHtcbiAgaWYgKGxpc3RlbmVyc1trZXldKSB7XG4gICAgbGlzdGVuZXJzW2tleV0ucHVzaChmbik7XG4gIH0gZWxzZSB7XG4gICAgbGlzdGVuZXJzW2tleV0gPSBbZm5dO1xuICB9XG4gIGlmIChsaXN0ZW5pbmcgPT09IGZhbHNlKSB7XG4gICAgbGlzdGVuKCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gb2ZmIChrZXksIGZuKSB7XG4gIHZhciBucyA9IGxpc3RlbmVyc1trZXldO1xuICBpZiAobnMubGVuZ3RoID4gMSkge1xuICAgIG5zLnNwbGljZShucy5pbmRleE9mKGZuKSwgMSk7XG4gIH0gZWxzZSB7XG4gICAgbGlzdGVuZXJzW2tleV0gPSBbXTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgb246IG9uLFxuICBvZmY6IG9mZlxufTtcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pXG4vLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247Y2hhcnNldDp1dGYtODtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSnpiM1Z5WTJWeklqcGJJbTV2WkdWZmJXOWtkV3hsY3k5c2IyTmhiQzF6ZEc5eVlXZGxMM1J5WVdOcmFXNW5MbXB6SWwwc0ltNWhiV1Z6SWpwYlhTd2liV0Z3Y0dsdVozTWlPaUk3UVVGQlFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEVpTENKbWFXeGxJam9pWjJWdVpYSmhkR1ZrTG1weklpd2ljMjkxY21ObFVtOXZkQ0k2SWlJc0luTnZkWEpqWlhORGIyNTBaVzUwSWpwYklpZDFjMlVnYzNSeWFXTjBKenRjYmx4dWRtRnlJR3hwYzNSbGJtVnljeUE5SUh0OU8xeHVkbUZ5SUd4cGMzUmxibWx1WnlBOUlHWmhiSE5sTzF4dVhHNW1kVzVqZEdsdmJpQnNhWE4wWlc0Z0tDa2dlMXh1SUNCcFppQW9aMnh2WW1Gc0xtRmtaRVYyWlc1MFRHbHpkR1Z1WlhJcElIdGNiaUFnSUNCbmJHOWlZV3d1WVdSa1JYWmxiblJNYVhOMFpXNWxjaWduYzNSdmNtRm5aU2NzSUdOb1lXNW5aU3dnWm1Gc2MyVXBPMXh1SUNCOUlHVnNjMlVnYVdZZ0tHZHNiMkpoYkM1aGRIUmhZMmhGZG1WdWRDa2dlMXh1SUNBZ0lHZHNiMkpoYkM1aGRIUmhZMmhGZG1WdWRDZ25iMjV6ZEc5eVlXZGxKeXdnWTJoaGJtZGxLVHRjYmlBZ2ZTQmxiSE5sSUh0Y2JpQWdJQ0JuYkc5aVlXd3ViMjV6ZEc5eVlXZGxJRDBnWTJoaGJtZGxPMXh1SUNCOVhHNTlYRzVjYm1aMWJtTjBhVzl1SUdOb1lXNW5aU0FvWlNrZ2UxeHVJQ0JwWmlBb0lXVXBJSHRjYmlBZ0lDQmxJRDBnWjJ4dlltRnNMbVYyWlc1ME8xeHVJQ0I5WEc0Z0lIWmhjaUJoYkd3Z1BTQnNhWE4wWlc1bGNuTmJaUzVyWlhsZE8xeHVJQ0JwWmlBb1lXeHNLU0I3WEc0Z0lDQWdZV3hzTG1admNrVmhZMmdvWm1seVpTazdYRzRnSUgxY2JseHVJQ0JtZFc1amRHbHZiaUJtYVhKbElDaHNhWE4wWlc1bGNpa2dlMXh1SUNBZ0lHeHBjM1JsYm1WeUtFcFRUMDR1Y0dGeWMyVW9aUzV1WlhkV1lXeDFaU2tzSUVwVFQwNHVjR0Z5YzJVb1pTNXZiR1JXWVd4MVpTa3NJR1V1ZFhKc0lIeDhJR1V1ZFhKcEtUdGNiaUFnZlZ4dWZWeHVYRzVtZFc1amRHbHZiaUJ2YmlBb2EyVjVMQ0JtYmlrZ2UxeHVJQ0JwWmlBb2JHbHpkR1Z1WlhKelcydGxlVjBwSUh0Y2JpQWdJQ0JzYVhOMFpXNWxjbk5iYTJWNVhTNXdkWE5vS0dadUtUdGNiaUFnZlNCbGJITmxJSHRjYmlBZ0lDQnNhWE4wWlc1bGNuTmJhMlY1WFNBOUlGdG1ibDA3WEc0Z0lIMWNiaUFnYVdZZ0tHeHBjM1JsYm1sdVp5QTlQVDBnWm1Gc2MyVXBJSHRjYmlBZ0lDQnNhWE4wWlc0b0tUdGNiaUFnZlZ4dWZWeHVYRzVtZFc1amRHbHZiaUJ2Wm1ZZ0tHdGxlU3dnWm00cElIdGNiaUFnZG1GeUlHNXpJRDBnYkdsemRHVnVaWEp6VzJ0bGVWMDdYRzRnSUdsbUlDaHVjeTVzWlc1bmRHZ2dQaUF4S1NCN1hHNGdJQ0FnYm5NdWMzQnNhV05sS0c1ekxtbHVaR1Y0VDJZb1ptNHBMQ0F4S1R0Y2JpQWdmU0JsYkhObElIdGNiaUFnSUNCc2FYTjBaVzVsY25OYmEyVjVYU0E5SUZ0ZE8xeHVJQ0I5WEc1OVhHNWNibTF2WkhWc1pTNWxlSEJ2Y25SeklEMGdlMXh1SUNCdmJqb2diMjRzWEc0Z0lHOW1aam9nYjJabVhHNTlPMXh1SWwxOSIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIGV4cGFuZG8gPSAnc2VrdG9yLScgKyBEYXRlLm5vdygpO1xudmFyIHJzaWJsaW5ncyA9IC9bK35dLztcbnZhciBkb2N1bWVudCA9IGdsb2JhbC5kb2N1bWVudDtcbnZhciBkZWwgPSAoZG9jdW1lbnQgJiYgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50KSB8fCB7fTtcbnZhciBtYXRjaCA9IChcbiAgZGVsLm1hdGNoZXMgfHxcbiAgZGVsLndlYmtpdE1hdGNoZXNTZWxlY3RvciB8fFxuICBkZWwubW96TWF0Y2hlc1NlbGVjdG9yIHx8XG4gIGRlbC5vTWF0Y2hlc1NlbGVjdG9yIHx8XG4gIGRlbC5tc01hdGNoZXNTZWxlY3RvciB8fFxuICBuZXZlclxuKTtcblxubW9kdWxlLmV4cG9ydHMgPSBzZWt0b3I7XG5cbnNla3Rvci5tYXRjaGVzID0gbWF0Y2hlcztcbnNla3Rvci5tYXRjaGVzU2VsZWN0b3IgPSBtYXRjaGVzU2VsZWN0b3I7XG5cbmZ1bmN0aW9uIHFzYSAoc2VsZWN0b3IsIGNvbnRleHQpIHtcbiAgdmFyIGV4aXN0ZWQsIGlkLCBwcmVmaXgsIHByZWZpeGVkLCBhZGFwdGVyLCBoYWNrID0gY29udGV4dCAhPT0gZG9jdW1lbnQ7XG4gIGlmIChoYWNrKSB7IC8vIGlkIGhhY2sgZm9yIGNvbnRleHQtcm9vdGVkIHF1ZXJpZXNcbiAgICBleGlzdGVkID0gY29udGV4dC5nZXRBdHRyaWJ1dGUoJ2lkJyk7XG4gICAgaWQgPSBleGlzdGVkIHx8IGV4cGFuZG87XG4gICAgcHJlZml4ID0gJyMnICsgaWQgKyAnICc7XG4gICAgcHJlZml4ZWQgPSBwcmVmaXggKyBzZWxlY3Rvci5yZXBsYWNlKC8sL2csICcsJyArIHByZWZpeCk7XG4gICAgYWRhcHRlciA9IHJzaWJsaW5ncy50ZXN0KHNlbGVjdG9yKSAmJiBjb250ZXh0LnBhcmVudE5vZGU7XG4gICAgaWYgKCFleGlzdGVkKSB7IGNvbnRleHQuc2V0QXR0cmlidXRlKCdpZCcsIGlkKTsgfVxuICB9XG4gIHRyeSB7XG4gICAgcmV0dXJuIChhZGFwdGVyIHx8IGNvbnRleHQpLnF1ZXJ5U2VsZWN0b3JBbGwocHJlZml4ZWQgfHwgc2VsZWN0b3IpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIFtdO1xuICB9IGZpbmFsbHkge1xuICAgIGlmIChleGlzdGVkID09PSBudWxsKSB7IGNvbnRleHQucmVtb3ZlQXR0cmlidXRlKCdpZCcpOyB9XG4gIH1cbn1cblxuZnVuY3Rpb24gc2VrdG9yIChzZWxlY3RvciwgY3R4LCBjb2xsZWN0aW9uLCBzZWVkKSB7XG4gIHZhciBlbGVtZW50O1xuICB2YXIgY29udGV4dCA9IGN0eCB8fCBkb2N1bWVudDtcbiAgdmFyIHJlc3VsdHMgPSBjb2xsZWN0aW9uIHx8IFtdO1xuICB2YXIgaSA9IDA7XG4gIGlmICh0eXBlb2Ygc2VsZWN0b3IgIT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH1cbiAgaWYgKGNvbnRleHQubm9kZVR5cGUgIT09IDEgJiYgY29udGV4dC5ub2RlVHlwZSAhPT0gOSkge1xuICAgIHJldHVybiBbXTsgLy8gYmFpbCBpZiBjb250ZXh0IGlzIG5vdCBhbiBlbGVtZW50IG9yIGRvY3VtZW50XG4gIH1cbiAgaWYgKHNlZWQpIHtcbiAgICB3aGlsZSAoKGVsZW1lbnQgPSBzZWVkW2krK10pKSB7XG4gICAgICBpZiAobWF0Y2hlc1NlbGVjdG9yKGVsZW1lbnQsIHNlbGVjdG9yKSkge1xuICAgICAgICByZXN1bHRzLnB1c2goZWxlbWVudCk7XG4gICAgICB9XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHJlc3VsdHMucHVzaC5hcHBseShyZXN1bHRzLCBxc2Eoc2VsZWN0b3IsIGNvbnRleHQpKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0cztcbn1cblxuZnVuY3Rpb24gbWF0Y2hlcyAoc2VsZWN0b3IsIGVsZW1lbnRzKSB7XG4gIHJldHVybiBzZWt0b3Ioc2VsZWN0b3IsIG51bGwsIG51bGwsIGVsZW1lbnRzKTtcbn1cblxuZnVuY3Rpb24gbWF0Y2hlc1NlbGVjdG9yIChlbGVtZW50LCBzZWxlY3Rvcikge1xuICByZXR1cm4gbWF0Y2guY2FsbChlbGVtZW50LCBzZWxlY3Rvcik7XG59XG5cbmZ1bmN0aW9uIG5ldmVyICgpIHsgcmV0dXJuIGZhbHNlOyB9XG5cbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ6dXRmLTg7YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0p6YjNWeVkyVnpJanBiSW01dlpHVmZiVzlrZFd4bGN5OXpaV3QwYjNJdmMzSmpMM05sYTNSdmNpNXFjeUpkTENKdVlXMWxjeUk2VzEwc0ltMWhjSEJwYm1keklqb2lPMEZCUVVFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJJaXdpWm1sc1pTSTZJbWRsYm1WeVlYUmxaQzVxY3lJc0luTnZkWEpqWlZKdmIzUWlPaUlpTENKemIzVnlZMlZ6UTI5dWRHVnVkQ0k2V3lJbmRYTmxJSE4wY21samRDYzdYRzVjYm5aaGNpQmxlSEJoYm1SdklEMGdKM05sYTNSdmNpMG5JQ3NnUkdGMFpTNXViM2NvS1R0Y2JuWmhjaUJ5YzJsaWJHbHVaM01nUFNBdld5dCtYUzg3WEc1MllYSWdaRzlqZFcxbGJuUWdQU0JuYkc5aVlXd3VaRzlqZFcxbGJuUTdYRzUyWVhJZ1pHVnNJRDBnS0dSdlkzVnRaVzUwSUNZbUlHUnZZM1Z0Wlc1MExtUnZZM1Z0Wlc1MFJXeGxiV1Z1ZENrZ2ZId2dlMzA3WEc1MllYSWdiV0YwWTJnZ1BTQW9YRzRnSUdSbGJDNXRZWFJqYUdWeklIeDhYRzRnSUdSbGJDNTNaV0pyYVhSTllYUmphR1Z6VTJWc1pXTjBiM0lnZkh4Y2JpQWdaR1ZzTG0xdmVrMWhkR05vWlhOVFpXeGxZM1J2Y2lCOGZGeHVJQ0JrWld3dWIwMWhkR05vWlhOVFpXeGxZM1J2Y2lCOGZGeHVJQ0JrWld3dWJYTk5ZWFJqYUdWelUyVnNaV04wYjNJZ2ZIeGNiaUFnYm1WMlpYSmNiaWs3WEc1Y2JtMXZaSFZzWlM1bGVIQnZjblJ6SUQwZ2MyVnJkRzl5TzF4dVhHNXpaV3QwYjNJdWJXRjBZMmhsY3lBOUlHMWhkR05vWlhNN1hHNXpaV3QwYjNJdWJXRjBZMmhsYzFObGJHVmpkRzl5SUQwZ2JXRjBZMmhsYzFObGJHVmpkRzl5TzF4dVhHNW1kVzVqZEdsdmJpQnhjMkVnS0hObGJHVmpkRzl5TENCamIyNTBaWGgwS1NCN1hHNGdJSFpoY2lCbGVHbHpkR1ZrTENCcFpDd2djSEpsWm1sNExDQndjbVZtYVhobFpDd2dZV1JoY0hSbGNpd2dhR0ZqYXlBOUlHTnZiblJsZUhRZ0lUMDlJR1J2WTNWdFpXNTBPMXh1SUNCcFppQW9hR0ZqYXlrZ2V5QXZMeUJwWkNCb1lXTnJJR1p2Y2lCamIyNTBaWGgwTFhKdmIzUmxaQ0J4ZFdWeWFXVnpYRzRnSUNBZ1pYaHBjM1JsWkNBOUlHTnZiblJsZUhRdVoyVjBRWFIwY21saWRYUmxLQ2RwWkNjcE8xeHVJQ0FnSUdsa0lEMGdaWGhwYzNSbFpDQjhmQ0JsZUhCaGJtUnZPMXh1SUNBZ0lIQnlaV1pwZUNBOUlDY2pKeUFySUdsa0lDc2dKeUFuTzF4dUlDQWdJSEJ5WldacGVHVmtJRDBnY0hKbFptbDRJQ3NnYzJWc1pXTjBiM0l1Y21Wd2JHRmpaU2d2TEM5bkxDQW5MQ2NnS3lCd2NtVm1hWGdwTzF4dUlDQWdJR0ZrWVhCMFpYSWdQU0J5YzJsaWJHbHVaM011ZEdWemRDaHpaV3hsWTNSdmNpa2dKaVlnWTI5dWRHVjRkQzV3WVhKbGJuUk9iMlJsTzF4dUlDQWdJR2xtSUNnaFpYaHBjM1JsWkNrZ2V5QmpiMjUwWlhoMExuTmxkRUYwZEhKcFluVjBaU2duYVdRbkxDQnBaQ2s3SUgxY2JpQWdmVnh1SUNCMGNua2dlMXh1SUNBZ0lISmxkSFZ5YmlBb1lXUmhjSFJsY2lCOGZDQmpiMjUwWlhoMEtTNXhkV1Z5ZVZObGJHVmpkRzl5UVd4c0tIQnlaV1pwZUdWa0lIeDhJSE5sYkdWamRHOXlLVHRjYmlBZ2ZTQmpZWFJqYUNBb1pTa2dlMXh1SUNBZ0lISmxkSFZ5YmlCYlhUdGNiaUFnZlNCbWFXNWhiR3g1SUh0Y2JpQWdJQ0JwWmlBb1pYaHBjM1JsWkNBOVBUMGdiblZzYkNrZ2V5QmpiMjUwWlhoMExuSmxiVzkyWlVGMGRISnBZblYwWlNnbmFXUW5LVHNnZlZ4dUlDQjlYRzU5WEc1Y2JtWjFibU4wYVc5dUlITmxhM1J2Y2lBb2MyVnNaV04wYjNJc0lHTjBlQ3dnWTI5c2JHVmpkR2x2Yml3Z2MyVmxaQ2tnZTF4dUlDQjJZWElnWld4bGJXVnVkRHRjYmlBZ2RtRnlJR052Ym5SbGVIUWdQU0JqZEhnZ2ZId2daRzlqZFcxbGJuUTdYRzRnSUhaaGNpQnlaWE4xYkhSeklEMGdZMjlzYkdWamRHbHZiaUI4ZkNCYlhUdGNiaUFnZG1GeUlHa2dQU0F3TzF4dUlDQnBaaUFvZEhsd1pXOW1JSE5sYkdWamRHOXlJQ0U5UFNBbmMzUnlhVzVuSnlrZ2UxeHVJQ0FnSUhKbGRIVnliaUJ5WlhOMWJIUnpPMXh1SUNCOVhHNGdJR2xtSUNoamIyNTBaWGgwTG01dlpHVlVlWEJsSUNFOVBTQXhJQ1ltSUdOdmJuUmxlSFF1Ym05a1pWUjVjR1VnSVQwOUlEa3BJSHRjYmlBZ0lDQnlaWFIxY200Z1cxMDdJQzh2SUdKaGFXd2dhV1lnWTI5dWRHVjRkQ0JwY3lCdWIzUWdZVzRnWld4bGJXVnVkQ0J2Y2lCa2IyTjFiV1Z1ZEZ4dUlDQjlYRzRnSUdsbUlDaHpaV1ZrS1NCN1hHNGdJQ0FnZDJocGJHVWdLQ2hsYkdWdFpXNTBJRDBnYzJWbFpGdHBLeXRkS1NrZ2UxeHVJQ0FnSUNBZ2FXWWdLRzFoZEdOb1pYTlRaV3hsWTNSdmNpaGxiR1Z0Wlc1MExDQnpaV3hsWTNSdmNpa3BJSHRjYmlBZ0lDQWdJQ0FnY21WemRXeDBjeTV3ZFhOb0tHVnNaVzFsYm5RcE8xeHVJQ0FnSUNBZ2ZWeHVJQ0FnSUgxY2JpQWdmU0JsYkhObElIdGNiaUFnSUNCeVpYTjFiSFJ6TG5CMWMyZ3VZWEJ3Ykhrb2NtVnpkV3gwY3l3Z2NYTmhLSE5sYkdWamRHOXlMQ0JqYjI1MFpYaDBLU2s3WEc0Z0lIMWNiaUFnY21WMGRYSnVJSEpsYzNWc2RITTdYRzU5WEc1Y2JtWjFibU4wYVc5dUlHMWhkR05vWlhNZ0tITmxiR1ZqZEc5eUxDQmxiR1Z0Wlc1MGN5a2dlMXh1SUNCeVpYUjFjbTRnYzJWcmRHOXlLSE5sYkdWamRHOXlMQ0J1ZFd4c0xDQnVkV3hzTENCbGJHVnRaVzUwY3lrN1hHNTlYRzVjYm1aMWJtTjBhVzl1SUcxaGRHTm9aWE5UWld4bFkzUnZjaUFvWld4bGJXVnVkQ3dnYzJWc1pXTjBiM0lwSUh0Y2JpQWdjbVYwZFhKdUlHMWhkR05vTG1OaGJHd29aV3hsYldWdWRDd2djMlZzWldOMGIzSXBPMXh1ZlZ4dVhHNW1kVzVqZEdsdmJpQnVaWFpsY2lBb0tTQjdJSEpsZEhWeWJpQm1ZV3h6WlRzZ2ZWeHVJbDE5IiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgZ2V0U2VsZWN0aW9uO1xudmFyIGRvYyA9IGdsb2JhbC5kb2N1bWVudDtcbnZhciBnZXRTZWxlY3Rpb25SYXcgPSByZXF1aXJlKCcuL2dldFNlbGVjdGlvblJhdycpO1xudmFyIGdldFNlbGVjdGlvbk51bGxPcCA9IHJlcXVpcmUoJy4vZ2V0U2VsZWN0aW9uTnVsbE9wJyk7XG52YXIgZ2V0U2VsZWN0aW9uU3ludGhldGljID0gcmVxdWlyZSgnLi9nZXRTZWxlY3Rpb25TeW50aGV0aWMnKTtcbnZhciBpc0hvc3QgPSByZXF1aXJlKCcuL2lzSG9zdCcpO1xuaWYgKGlzSG9zdC5tZXRob2QoZ2xvYmFsLCAnZ2V0U2VsZWN0aW9uJykpIHtcbiAgZ2V0U2VsZWN0aW9uID0gZ2V0U2VsZWN0aW9uUmF3O1xufSBlbHNlIGlmICh0eXBlb2YgZG9jLnNlbGVjdGlvbiA9PT0gJ29iamVjdCcgJiYgZG9jLnNlbGVjdGlvbikge1xuICBnZXRTZWxlY3Rpb24gPSBnZXRTZWxlY3Rpb25TeW50aGV0aWM7XG59IGVsc2Uge1xuICBnZXRTZWxlY3Rpb24gPSBnZXRTZWxlY3Rpb25OdWxsT3A7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZ2V0U2VsZWN0aW9uO1xuXG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSlcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0OnV0Zi04O2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKemIzVnlZMlZ6SWpwYkltNXZaR1ZmYlc5a2RXeGxjeTl6Wld4bFkyTnBiMjR2YzNKakwyZGxkRk5sYkdWamRHbHZiaTVxY3lKZExDSnVZVzFsY3lJNlcxMHNJbTFoY0hCcGJtZHpJam9pTzBGQlFVRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CSWl3aVptbHNaU0k2SW1kbGJtVnlZWFJsWkM1cWN5SXNJbk52ZFhKalpWSnZiM1FpT2lJaUxDSnpiM1Z5WTJWelEyOXVkR1Z1ZENJNld5SW5kWE5sSUhOMGNtbGpkQ2M3WEc1Y2JuWmhjaUJuWlhSVFpXeGxZM1JwYjI0N1hHNTJZWElnWkc5aklEMGdaMnh2WW1Gc0xtUnZZM1Z0Wlc1ME8xeHVkbUZ5SUdkbGRGTmxiR1ZqZEdsdmJsSmhkeUE5SUhKbGNYVnBjbVVvSnk0dloyVjBVMlZzWldOMGFXOXVVbUYzSnlrN1hHNTJZWElnWjJWMFUyVnNaV04wYVc5dVRuVnNiRTl3SUQwZ2NtVnhkV2x5WlNnbkxpOW5aWFJUWld4bFkzUnBiMjVPZFd4c1QzQW5LVHRjYm5aaGNpQm5aWFJUWld4bFkzUnBiMjVUZVc1MGFHVjBhV01nUFNCeVpYRjFhWEpsS0NjdUwyZGxkRk5sYkdWamRHbHZibE41Ym5Sb1pYUnBZeWNwTzF4dWRtRnlJR2x6U0c5emRDQTlJSEpsY1hWcGNtVW9KeTR2YVhOSWIzTjBKeWs3WEc1cFppQW9hWE5JYjNOMExtMWxkR2h2WkNobmJHOWlZV3dzSUNkblpYUlRaV3hsWTNScGIyNG5LU2tnZTF4dUlDQm5aWFJUWld4bFkzUnBiMjRnUFNCblpYUlRaV3hsWTNScGIyNVNZWGM3WEc1OUlHVnNjMlVnYVdZZ0tIUjVjR1Z2WmlCa2IyTXVjMlZzWldOMGFXOXVJRDA5UFNBbmIySnFaV04wSnlBbUppQmtiMk11YzJWc1pXTjBhVzl1S1NCN1hHNGdJR2RsZEZObGJHVmpkR2x2YmlBOUlHZGxkRk5sYkdWamRHbHZibE41Ym5Sb1pYUnBZenRjYm4wZ1pXeHpaU0I3WEc0Z0lHZGxkRk5sYkdWamRHbHZiaUE5SUdkbGRGTmxiR1ZqZEdsdmJrNTFiR3hQY0R0Y2JuMWNibHh1Ylc5a2RXeGxMbVY0Y0c5eWRITWdQU0JuWlhSVFpXeGxZM1JwYjI0N1hHNGlYWDA9IiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBub29wICgpIHt9XG5cbmZ1bmN0aW9uIGdldFNlbGVjdGlvbk51bGxPcCAoKSB7XG4gIHJldHVybiB7XG4gICAgcmVtb3ZlQWxsUmFuZ2VzOiBub29wLFxuICAgIGFkZFJhbmdlOiBub29wXG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZ2V0U2VsZWN0aW9uTnVsbE9wO1xuIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBnZXRTZWxlY3Rpb25SYXcgKCkge1xuICByZXR1cm4gZ2xvYmFsLmdldFNlbGVjdGlvbigpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGdldFNlbGVjdGlvblJhdztcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pXG4vLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247Y2hhcnNldDp1dGYtODtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSnpiM1Z5WTJWeklqcGJJbTV2WkdWZmJXOWtkV3hsY3k5elpXeGxZMk5wYjI0dmMzSmpMMmRsZEZObGJHVmpkR2x2YmxKaGR5NXFjeUpkTENKdVlXMWxjeUk2VzEwc0ltMWhjSEJwYm1keklqb2lPMEZCUVVFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVNJc0ltWnBiR1VpT2lKblpXNWxjbUYwWldRdWFuTWlMQ0p6YjNWeVkyVlNiMjkwSWpvaUlpd2ljMjkxY21ObGMwTnZiblJsYm5RaU9sc2lKM1Z6WlNCemRISnBZM1FuTzF4dVhHNW1kVzVqZEdsdmJpQm5aWFJUWld4bFkzUnBiMjVTWVhjZ0tDa2dlMXh1SUNCeVpYUjFjbTRnWjJ4dlltRnNMbWRsZEZObGJHVmpkR2x2YmlncE8xeHVmVnh1WEc1dGIyUjFiR1V1Wlhod2IzSjBjeUE5SUdkbGRGTmxiR1ZqZEdsdmJsSmhkenRjYmlKZGZRPT0iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciByYW5nZVRvVGV4dFJhbmdlID0gcmVxdWlyZSgnLi9yYW5nZVRvVGV4dFJhbmdlJyk7XG52YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50O1xudmFyIGJvZHkgPSBkb2MuYm9keTtcbnZhciBHZXRTZWxlY3Rpb25Qcm90byA9IEdldFNlbGVjdGlvbi5wcm90b3R5cGU7XG5cbmZ1bmN0aW9uIEdldFNlbGVjdGlvbiAoc2VsZWN0aW9uKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIHJhbmdlID0gc2VsZWN0aW9uLmNyZWF0ZVJhbmdlKCk7XG5cbiAgdGhpcy5fc2VsZWN0aW9uID0gc2VsZWN0aW9uO1xuICB0aGlzLl9yYW5nZXMgPSBbXTtcblxuICBpZiAoc2VsZWN0aW9uLnR5cGUgPT09ICdDb250cm9sJykge1xuICAgIHVwZGF0ZUNvbnRyb2xTZWxlY3Rpb24oc2VsZik7XG4gIH0gZWxzZSBpZiAoaXNUZXh0UmFuZ2UocmFuZ2UpKSB7XG4gICAgdXBkYXRlRnJvbVRleHRSYW5nZShzZWxmLCByYW5nZSk7XG4gIH0gZWxzZSB7XG4gICAgdXBkYXRlRW1wdHlTZWxlY3Rpb24oc2VsZik7XG4gIH1cbn1cblxuR2V0U2VsZWN0aW9uUHJvdG8ucmVtb3ZlQWxsUmFuZ2VzID0gZnVuY3Rpb24gKCkge1xuICB2YXIgdGV4dFJhbmdlO1xuICB0cnkge1xuICAgIHRoaXMuX3NlbGVjdGlvbi5lbXB0eSgpO1xuICAgIGlmICh0aGlzLl9zZWxlY3Rpb24udHlwZSAhPT0gJ05vbmUnKSB7XG4gICAgICB0ZXh0UmFuZ2UgPSBib2R5LmNyZWF0ZVRleHRSYW5nZSgpO1xuICAgICAgdGV4dFJhbmdlLnNlbGVjdCgpO1xuICAgICAgdGhpcy5fc2VsZWN0aW9uLmVtcHR5KCk7XG4gICAgfVxuICB9IGNhdGNoIChlKSB7XG4gIH1cbiAgdXBkYXRlRW1wdHlTZWxlY3Rpb24odGhpcyk7XG59O1xuXG5HZXRTZWxlY3Rpb25Qcm90by5hZGRSYW5nZSA9IGZ1bmN0aW9uIChyYW5nZSkge1xuICBpZiAodGhpcy5fc2VsZWN0aW9uLnR5cGUgPT09ICdDb250cm9sJykge1xuICAgIGFkZFJhbmdlVG9Db250cm9sU2VsZWN0aW9uKHRoaXMsIHJhbmdlKTtcbiAgfSBlbHNlIHtcbiAgICByYW5nZVRvVGV4dFJhbmdlKHJhbmdlKS5zZWxlY3QoKTtcbiAgICB0aGlzLl9yYW5nZXNbMF0gPSByYW5nZTtcbiAgICB0aGlzLnJhbmdlQ291bnQgPSAxO1xuICAgIHRoaXMuaXNDb2xsYXBzZWQgPSB0aGlzLl9yYW5nZXNbMF0uY29sbGFwc2VkO1xuICAgIHVwZGF0ZUFuY2hvckFuZEZvY3VzRnJvbVJhbmdlKHRoaXMsIHJhbmdlLCBmYWxzZSk7XG4gIH1cbn07XG5cbkdldFNlbGVjdGlvblByb3RvLnNldFJhbmdlcyA9IGZ1bmN0aW9uIChyYW5nZXMpIHtcbiAgdGhpcy5yZW1vdmVBbGxSYW5nZXMoKTtcbiAgdmFyIHJhbmdlQ291bnQgPSByYW5nZXMubGVuZ3RoO1xuICBpZiAocmFuZ2VDb3VudCA+IDEpIHtcbiAgICBjcmVhdGVDb250cm9sU2VsZWN0aW9uKHRoaXMsIHJhbmdlcyk7XG4gIH0gZWxzZSBpZiAocmFuZ2VDb3VudCkge1xuICAgIHRoaXMuYWRkUmFuZ2UocmFuZ2VzWzBdKTtcbiAgfVxufTtcblxuR2V0U2VsZWN0aW9uUHJvdG8uZ2V0UmFuZ2VBdCA9IGZ1bmN0aW9uIChpbmRleCkge1xuICBpZiAoaW5kZXggPCAwIHx8IGluZGV4ID49IHRoaXMucmFuZ2VDb3VudCkge1xuICAgIHRocm93IG5ldyBFcnJvcignZ2V0UmFuZ2VBdCgpOiBpbmRleCBvdXQgb2YgYm91bmRzJyk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHRoaXMuX3Jhbmdlc1tpbmRleF0uY2xvbmVSYW5nZSgpO1xuICB9XG59O1xuXG5HZXRTZWxlY3Rpb25Qcm90by5yZW1vdmVSYW5nZSA9IGZ1bmN0aW9uIChyYW5nZSkge1xuICBpZiAodGhpcy5fc2VsZWN0aW9uLnR5cGUgIT09ICdDb250cm9sJykge1xuICAgIHJlbW92ZVJhbmdlTWFudWFsbHkodGhpcywgcmFuZ2UpO1xuICAgIHJldHVybjtcbiAgfVxuICB2YXIgY29udHJvbFJhbmdlID0gdGhpcy5fc2VsZWN0aW9uLmNyZWF0ZVJhbmdlKCk7XG4gIHZhciByYW5nZUVsZW1lbnQgPSBnZXRTaW5nbGVFbGVtZW50RnJvbVJhbmdlKHJhbmdlKTtcbiAgdmFyIG5ld0NvbnRyb2xSYW5nZSA9IGJvZHkuY3JlYXRlQ29udHJvbFJhbmdlKCk7XG4gIHZhciBlbDtcbiAgdmFyIHJlbW92ZWQgPSBmYWxzZTtcbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGNvbnRyb2xSYW5nZS5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICAgIGVsID0gY29udHJvbFJhbmdlLml0ZW0oaSk7XG4gICAgaWYgKGVsICE9PSByYW5nZUVsZW1lbnQgfHwgcmVtb3ZlZCkge1xuICAgICAgbmV3Q29udHJvbFJhbmdlLmFkZChjb250cm9sUmFuZ2UuaXRlbShpKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlbW92ZWQgPSB0cnVlO1xuICAgIH1cbiAgfVxuICBuZXdDb250cm9sUmFuZ2Uuc2VsZWN0KCk7XG4gIHVwZGF0ZUNvbnRyb2xTZWxlY3Rpb24odGhpcyk7XG59O1xuXG5HZXRTZWxlY3Rpb25Qcm90by5lYWNoUmFuZ2UgPSBmdW5jdGlvbiAoZm4sIHJldHVyblZhbHVlKSB7XG4gIHZhciBpID0gMDtcbiAgdmFyIGxlbiA9IHRoaXMuX3Jhbmdlcy5sZW5ndGg7XG4gIGZvciAoaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgIGlmIChmbih0aGlzLmdldFJhbmdlQXQoaSkpKSB7XG4gICAgICByZXR1cm4gcmV0dXJuVmFsdWU7XG4gICAgfVxuICB9XG59O1xuXG5HZXRTZWxlY3Rpb25Qcm90by5nZXRBbGxSYW5nZXMgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciByYW5nZXMgPSBbXTtcbiAgdGhpcy5lYWNoUmFuZ2UoZnVuY3Rpb24gKHJhbmdlKSB7XG4gICAgcmFuZ2VzLnB1c2gocmFuZ2UpO1xuICB9KTtcbiAgcmV0dXJuIHJhbmdlcztcbn07XG5cbkdldFNlbGVjdGlvblByb3RvLnNldFNpbmdsZVJhbmdlID0gZnVuY3Rpb24gKHJhbmdlKSB7XG4gIHRoaXMucmVtb3ZlQWxsUmFuZ2VzKCk7XG4gIHRoaXMuYWRkUmFuZ2UocmFuZ2UpO1xufTtcblxuZnVuY3Rpb24gY3JlYXRlQ29udHJvbFNlbGVjdGlvbiAoc2VsLCByYW5nZXMpIHtcbiAgdmFyIGNvbnRyb2xSYW5nZSA9IGJvZHkuY3JlYXRlQ29udHJvbFJhbmdlKCk7XG4gIGZvciAodmFyIGkgPSAwLCBlbCwgbGVuID0gcmFuZ2VzLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgZWwgPSBnZXRTaW5nbGVFbGVtZW50RnJvbVJhbmdlKHJhbmdlc1tpXSk7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnRyb2xSYW5nZS5hZGQoZWwpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignc2V0UmFuZ2VzKCk6IEVsZW1lbnQgY291bGQgbm90IGJlIGFkZGVkIHRvIGNvbnRyb2wgc2VsZWN0aW9uJyk7XG4gICAgfVxuICB9XG4gIGNvbnRyb2xSYW5nZS5zZWxlY3QoKTtcbiAgdXBkYXRlQ29udHJvbFNlbGVjdGlvbihzZWwpO1xufVxuXG5mdW5jdGlvbiByZW1vdmVSYW5nZU1hbnVhbGx5IChzZWwsIHJhbmdlKSB7XG4gIHZhciByYW5nZXMgPSBzZWwuZ2V0QWxsUmFuZ2VzKCk7XG4gIHNlbC5yZW1vdmVBbGxSYW5nZXMoKTtcbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHJhbmdlcy5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICAgIGlmICghaXNTYW1lUmFuZ2UocmFuZ2UsIHJhbmdlc1tpXSkpIHtcbiAgICAgIHNlbC5hZGRSYW5nZShyYW5nZXNbaV0pO1xuICAgIH1cbiAgfVxuICBpZiAoIXNlbC5yYW5nZUNvdW50KSB7XG4gICAgdXBkYXRlRW1wdHlTZWxlY3Rpb24oc2VsKTtcbiAgfVxufVxuXG5mdW5jdGlvbiB1cGRhdGVBbmNob3JBbmRGb2N1c0Zyb21SYW5nZSAoc2VsLCByYW5nZSkge1xuICB2YXIgYW5jaG9yUHJlZml4ID0gJ3N0YXJ0JztcbiAgdmFyIGZvY3VzUHJlZml4ID0gJ2VuZCc7XG4gIHNlbC5hbmNob3JOb2RlID0gcmFuZ2VbYW5jaG9yUHJlZml4ICsgJ0NvbnRhaW5lciddO1xuICBzZWwuYW5jaG9yT2Zmc2V0ID0gcmFuZ2VbYW5jaG9yUHJlZml4ICsgJ09mZnNldCddO1xuICBzZWwuZm9jdXNOb2RlID0gcmFuZ2VbZm9jdXNQcmVmaXggKyAnQ29udGFpbmVyJ107XG4gIHNlbC5mb2N1c09mZnNldCA9IHJhbmdlW2ZvY3VzUHJlZml4ICsgJ09mZnNldCddO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVFbXB0eVNlbGVjdGlvbiAoc2VsKSB7XG4gIHNlbC5hbmNob3JOb2RlID0gc2VsLmZvY3VzTm9kZSA9IG51bGw7XG4gIHNlbC5hbmNob3JPZmZzZXQgPSBzZWwuZm9jdXNPZmZzZXQgPSAwO1xuICBzZWwucmFuZ2VDb3VudCA9IDA7XG4gIHNlbC5pc0NvbGxhcHNlZCA9IHRydWU7XG4gIHNlbC5fcmFuZ2VzLmxlbmd0aCA9IDA7XG59XG5cbmZ1bmN0aW9uIHJhbmdlQ29udGFpbnNTaW5nbGVFbGVtZW50IChyYW5nZU5vZGVzKSB7XG4gIGlmICghcmFuZ2VOb2Rlcy5sZW5ndGggfHwgcmFuZ2VOb2Rlc1swXS5ub2RlVHlwZSAhPT0gMSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBmb3IgKHZhciBpID0gMSwgbGVuID0gcmFuZ2VOb2Rlcy5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICAgIGlmICghaXNBbmNlc3Rvck9mKHJhbmdlTm9kZXNbMF0sIHJhbmdlTm9kZXNbaV0pKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBnZXRTaW5nbGVFbGVtZW50RnJvbVJhbmdlIChyYW5nZSkge1xuICB2YXIgbm9kZXMgPSByYW5nZS5nZXROb2RlcygpO1xuICBpZiAoIXJhbmdlQ29udGFpbnNTaW5nbGVFbGVtZW50KG5vZGVzKSkge1xuICAgIHRocm93IG5ldyBFcnJvcignZ2V0U2luZ2xlRWxlbWVudEZyb21SYW5nZSgpOiByYW5nZSBkaWQgbm90IGNvbnNpc3Qgb2YgYSBzaW5nbGUgZWxlbWVudCcpO1xuICB9XG4gIHJldHVybiBub2Rlc1swXTtcbn1cblxuZnVuY3Rpb24gaXNUZXh0UmFuZ2UgKHJhbmdlKSB7XG4gIHJldHVybiByYW5nZSAmJiByYW5nZS50ZXh0ICE9PSB2b2lkIDA7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUZyb21UZXh0UmFuZ2UgKHNlbCwgcmFuZ2UpIHtcbiAgc2VsLl9yYW5nZXMgPSBbcmFuZ2VdO1xuICB1cGRhdGVBbmNob3JBbmRGb2N1c0Zyb21SYW5nZShzZWwsIHJhbmdlLCBmYWxzZSk7XG4gIHNlbC5yYW5nZUNvdW50ID0gMTtcbiAgc2VsLmlzQ29sbGFwc2VkID0gcmFuZ2UuY29sbGFwc2VkO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVDb250cm9sU2VsZWN0aW9uIChzZWwpIHtcbiAgc2VsLl9yYW5nZXMubGVuZ3RoID0gMDtcbiAgaWYgKHNlbC5fc2VsZWN0aW9uLnR5cGUgPT09ICdOb25lJykge1xuICAgIHVwZGF0ZUVtcHR5U2VsZWN0aW9uKHNlbCk7XG4gIH0gZWxzZSB7XG4gICAgdmFyIGNvbnRyb2xSYW5nZSA9IHNlbC5fc2VsZWN0aW9uLmNyZWF0ZVJhbmdlKCk7XG4gICAgaWYgKGlzVGV4dFJhbmdlKGNvbnRyb2xSYW5nZSkpIHtcbiAgICAgIHVwZGF0ZUZyb21UZXh0UmFuZ2Uoc2VsLCBjb250cm9sUmFuZ2UpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzZWwucmFuZ2VDb3VudCA9IGNvbnRyb2xSYW5nZS5sZW5ndGg7XG4gICAgICB2YXIgcmFuZ2U7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNlbC5yYW5nZUNvdW50OyArK2kpIHtcbiAgICAgICAgcmFuZ2UgPSBkb2MuY3JlYXRlUmFuZ2UoKTtcbiAgICAgICAgcmFuZ2Uuc2VsZWN0Tm9kZShjb250cm9sUmFuZ2UuaXRlbShpKSk7XG4gICAgICAgIHNlbC5fcmFuZ2VzLnB1c2gocmFuZ2UpO1xuICAgICAgfVxuICAgICAgc2VsLmlzQ29sbGFwc2VkID0gc2VsLnJhbmdlQ291bnQgPT09IDEgJiYgc2VsLl9yYW5nZXNbMF0uY29sbGFwc2VkO1xuICAgICAgdXBkYXRlQW5jaG9yQW5kRm9jdXNGcm9tUmFuZ2Uoc2VsLCBzZWwuX3Jhbmdlc1tzZWwucmFuZ2VDb3VudCAtIDFdLCBmYWxzZSk7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGFkZFJhbmdlVG9Db250cm9sU2VsZWN0aW9uIChzZWwsIHJhbmdlKSB7XG4gIHZhciBjb250cm9sUmFuZ2UgPSBzZWwuX3NlbGVjdGlvbi5jcmVhdGVSYW5nZSgpO1xuICB2YXIgcmFuZ2VFbGVtZW50ID0gZ2V0U2luZ2xlRWxlbWVudEZyb21SYW5nZShyYW5nZSk7XG4gIHZhciBuZXdDb250cm9sUmFuZ2UgPSBib2R5LmNyZWF0ZUNvbnRyb2xSYW5nZSgpO1xuICBmb3IgKHZhciBpID0gMCwgbGVuID0gY29udHJvbFJhbmdlLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgbmV3Q29udHJvbFJhbmdlLmFkZChjb250cm9sUmFuZ2UuaXRlbShpKSk7XG4gIH1cbiAgdHJ5IHtcbiAgICBuZXdDb250cm9sUmFuZ2UuYWRkKHJhbmdlRWxlbWVudCk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2FkZFJhbmdlKCk6IEVsZW1lbnQgY291bGQgbm90IGJlIGFkZGVkIHRvIGNvbnRyb2wgc2VsZWN0aW9uJyk7XG4gIH1cbiAgbmV3Q29udHJvbFJhbmdlLnNlbGVjdCgpO1xuICB1cGRhdGVDb250cm9sU2VsZWN0aW9uKHNlbCk7XG59XG5cbmZ1bmN0aW9uIGlzU2FtZVJhbmdlIChsZWZ0LCByaWdodCkge1xuICByZXR1cm4gKFxuICAgIGxlZnQuc3RhcnRDb250YWluZXIgPT09IHJpZ2h0LnN0YXJ0Q29udGFpbmVyICYmXG4gICAgbGVmdC5zdGFydE9mZnNldCA9PT0gcmlnaHQuc3RhcnRPZmZzZXQgJiZcbiAgICBsZWZ0LmVuZENvbnRhaW5lciA9PT0gcmlnaHQuZW5kQ29udGFpbmVyICYmXG4gICAgbGVmdC5lbmRPZmZzZXQgPT09IHJpZ2h0LmVuZE9mZnNldFxuICApO1xufVxuXG5mdW5jdGlvbiBpc0FuY2VzdG9yT2YgKGFuY2VzdG9yLCBkZXNjZW5kYW50KSB7XG4gIHZhciBub2RlID0gZGVzY2VuZGFudDtcbiAgd2hpbGUgKG5vZGUucGFyZW50Tm9kZSkge1xuICAgIGlmIChub2RlLnBhcmVudE5vZGUgPT09IGFuY2VzdG9yKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgbm9kZSA9IG5vZGUucGFyZW50Tm9kZTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIGdldFNlbGVjdGlvbiAoKSB7XG4gIHJldHVybiBuZXcgR2V0U2VsZWN0aW9uKGdsb2JhbC5kb2N1bWVudC5zZWxlY3Rpb24pO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGdldFNlbGVjdGlvbjtcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pXG4vLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247Y2hhcnNldDp1dGYtODtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSnpiM1Z5WTJWeklqcGJJbTV2WkdWZmJXOWtkV3hsY3k5elpXeGxZMk5wYjI0dmMzSmpMMmRsZEZObGJHVmpkR2x2YmxONWJuUm9aWFJwWXk1cWN5SmRMQ0p1WVcxbGN5STZXMTBzSW0xaGNIQnBibWR6SWpvaU8wRkJRVUU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRU0lzSW1acGJHVWlPaUpuWlc1bGNtRjBaV1F1YW5NaUxDSnpiM1Z5WTJWU2IyOTBJam9pSWl3aWMyOTFjbU5sYzBOdmJuUmxiblFpT2xzaUozVnpaU0J6ZEhKcFkzUW5PMXh1WEc1MllYSWdjbUZ1WjJWVWIxUmxlSFJTWVc1blpTQTlJSEpsY1hWcGNtVW9KeTR2Y21GdVoyVlViMVJsZUhSU1lXNW5aU2NwTzF4dWRtRnlJR1J2WXlBOUlHZHNiMkpoYkM1a2IyTjFiV1Z1ZER0Y2JuWmhjaUJpYjJSNUlEMGdaRzlqTG1KdlpIazdYRzUyWVhJZ1IyVjBVMlZzWldOMGFXOXVVSEp2ZEc4Z1BTQkhaWFJUWld4bFkzUnBiMjR1Y0hKdmRHOTBlWEJsTzF4dVhHNW1kVzVqZEdsdmJpQkhaWFJUWld4bFkzUnBiMjRnS0hObGJHVmpkR2x2YmlrZ2UxeHVJQ0IyWVhJZ2MyVnNaaUE5SUhSb2FYTTdYRzRnSUhaaGNpQnlZVzVuWlNBOUlITmxiR1ZqZEdsdmJpNWpjbVZoZEdWU1lXNW5aU2dwTzF4dVhHNGdJSFJvYVhNdVgzTmxiR1ZqZEdsdmJpQTlJSE5sYkdWamRHbHZianRjYmlBZ2RHaHBjeTVmY21GdVoyVnpJRDBnVzEwN1hHNWNiaUFnYVdZZ0tITmxiR1ZqZEdsdmJpNTBlWEJsSUQwOVBTQW5RMjl1ZEhKdmJDY3BJSHRjYmlBZ0lDQjFjR1JoZEdWRGIyNTBjbTlzVTJWc1pXTjBhVzl1S0hObGJHWXBPMXh1SUNCOUlHVnNjMlVnYVdZZ0tHbHpWR1Y0ZEZKaGJtZGxLSEpoYm1kbEtTa2dlMXh1SUNBZ0lIVndaR0YwWlVaeWIyMVVaWGgwVW1GdVoyVW9jMlZzWml3Z2NtRnVaMlVwTzF4dUlDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUhWd1pHRjBaVVZ0Y0hSNVUyVnNaV04wYVc5dUtITmxiR1lwTzF4dUlDQjlYRzU5WEc1Y2JrZGxkRk5sYkdWamRHbHZibEJ5YjNSdkxuSmxiVzkyWlVGc2JGSmhibWRsY3lBOUlHWjFibU4wYVc5dUlDZ3BJSHRjYmlBZ2RtRnlJSFJsZUhSU1lXNW5aVHRjYmlBZ2RISjVJSHRjYmlBZ0lDQjBhR2x6TGw5elpXeGxZM1JwYjI0dVpXMXdkSGtvS1R0Y2JpQWdJQ0JwWmlBb2RHaHBjeTVmYzJWc1pXTjBhVzl1TG5SNWNHVWdJVDA5SUNkT2IyNWxKeWtnZTF4dUlDQWdJQ0FnZEdWNGRGSmhibWRsSUQwZ1ltOWtlUzVqY21WaGRHVlVaWGgwVW1GdVoyVW9LVHRjYmlBZ0lDQWdJSFJsZUhSU1lXNW5aUzV6Wld4bFkzUW9LVHRjYmlBZ0lDQWdJSFJvYVhNdVgzTmxiR1ZqZEdsdmJpNWxiWEIwZVNncE8xeHVJQ0FnSUgxY2JpQWdmU0JqWVhSamFDQW9aU2tnZTF4dUlDQjlYRzRnSUhWd1pHRjBaVVZ0Y0hSNVUyVnNaV04wYVc5dUtIUm9hWE1wTzF4dWZUdGNibHh1UjJWMFUyVnNaV04wYVc5dVVISnZkRzh1WVdSa1VtRnVaMlVnUFNCbWRXNWpkR2x2YmlBb2NtRnVaMlVwSUh0Y2JpQWdhV1lnS0hSb2FYTXVYM05sYkdWamRHbHZiaTUwZVhCbElEMDlQU0FuUTI5dWRISnZiQ2NwSUh0Y2JpQWdJQ0JoWkdSU1lXNW5aVlJ2UTI5dWRISnZiRk5sYkdWamRHbHZiaWgwYUdsekxDQnlZVzVuWlNrN1hHNGdJSDBnWld4elpTQjdYRzRnSUNBZ2NtRnVaMlZVYjFSbGVIUlNZVzVuWlNoeVlXNW5aU2t1YzJWc1pXTjBLQ2s3WEc0Z0lDQWdkR2hwY3k1ZmNtRnVaMlZ6V3pCZElEMGdjbUZ1WjJVN1hHNGdJQ0FnZEdocGN5NXlZVzVuWlVOdmRXNTBJRDBnTVR0Y2JpQWdJQ0IwYUdsekxtbHpRMjlzYkdGd2MyVmtJRDBnZEdocGN5NWZjbUZ1WjJWeld6QmRMbU52Ykd4aGNITmxaRHRjYmlBZ0lDQjFjR1JoZEdWQmJtTm9iM0pCYm1SR2IyTjFjMFp5YjIxU1lXNW5aU2gwYUdsekxDQnlZVzVuWlN3Z1ptRnNjMlVwTzF4dUlDQjlYRzU5TzF4dVhHNUhaWFJUWld4bFkzUnBiMjVRY205MGJ5NXpaWFJTWVc1blpYTWdQU0JtZFc1amRHbHZiaUFvY21GdVoyVnpLU0I3WEc0Z0lIUm9hWE11Y21WdGIzWmxRV3hzVW1GdVoyVnpLQ2s3WEc0Z0lIWmhjaUJ5WVc1blpVTnZkVzUwSUQwZ2NtRnVaMlZ6TG14bGJtZDBhRHRjYmlBZ2FXWWdLSEpoYm1kbFEyOTFiblFnUGlBeEtTQjdYRzRnSUNBZ1kzSmxZWFJsUTI5dWRISnZiRk5sYkdWamRHbHZiaWgwYUdsekxDQnlZVzVuWlhNcE8xeHVJQ0I5SUdWc2MyVWdhV1lnS0hKaGJtZGxRMjkxYm5RcElIdGNiaUFnSUNCMGFHbHpMbUZrWkZKaGJtZGxLSEpoYm1kbGMxc3dYU2s3WEc0Z0lIMWNibjA3WEc1Y2JrZGxkRk5sYkdWamRHbHZibEJ5YjNSdkxtZGxkRkpoYm1kbFFYUWdQU0JtZFc1amRHbHZiaUFvYVc1a1pYZ3BJSHRjYmlBZ2FXWWdLR2x1WkdWNElEd2dNQ0I4ZkNCcGJtUmxlQ0ErUFNCMGFHbHpMbkpoYm1kbFEyOTFiblFwSUh0Y2JpQWdJQ0IwYUhKdmR5QnVaWGNnUlhKeWIzSW9KMmRsZEZKaGJtZGxRWFFvS1RvZ2FXNWtaWGdnYjNWMElHOW1JR0p2ZFc1a2N5Y3BPMXh1SUNCOUlHVnNjMlVnZTF4dUlDQWdJSEpsZEhWeWJpQjBhR2x6TGw5eVlXNW5aWE5iYVc1a1pYaGRMbU5zYjI1bFVtRnVaMlVvS1R0Y2JpQWdmVnh1ZlR0Y2JseHVSMlYwVTJWc1pXTjBhVzl1VUhKdmRHOHVjbVZ0YjNabFVtRnVaMlVnUFNCbWRXNWpkR2x2YmlBb2NtRnVaMlVwSUh0Y2JpQWdhV1lnS0hSb2FYTXVYM05sYkdWamRHbHZiaTUwZVhCbElDRTlQU0FuUTI5dWRISnZiQ2NwSUh0Y2JpQWdJQ0J5WlcxdmRtVlNZVzVuWlUxaGJuVmhiR3g1S0hSb2FYTXNJSEpoYm1kbEtUdGNiaUFnSUNCeVpYUjFjbTQ3WEc0Z0lIMWNiaUFnZG1GeUlHTnZiblJ5YjJ4U1lXNW5aU0E5SUhSb2FYTXVYM05sYkdWamRHbHZiaTVqY21WaGRHVlNZVzVuWlNncE8xeHVJQ0IyWVhJZ2NtRnVaMlZGYkdWdFpXNTBJRDBnWjJWMFUybHVaMnhsUld4bGJXVnVkRVp5YjIxU1lXNW5aU2h5WVc1blpTazdYRzRnSUhaaGNpQnVaWGREYjI1MGNtOXNVbUZ1WjJVZ1BTQmliMlI1TG1OeVpXRjBaVU52Ym5SeWIyeFNZVzVuWlNncE8xeHVJQ0IyWVhJZ1pXdzdYRzRnSUhaaGNpQnlaVzF2ZG1Wa0lEMGdabUZzYzJVN1hHNGdJR1p2Y2lBb2RtRnlJR2tnUFNBd0xDQnNaVzRnUFNCamIyNTBjbTlzVW1GdVoyVXViR1Z1WjNSb095QnBJRHdnYkdWdU95QXJLMmtwSUh0Y2JpQWdJQ0JsYkNBOUlHTnZiblJ5YjJ4U1lXNW5aUzVwZEdWdEtHa3BPMXh1SUNBZ0lHbG1JQ2hsYkNBaFBUMGdjbUZ1WjJWRmJHVnRaVzUwSUh4OElISmxiVzkyWldRcElIdGNiaUFnSUNBZ0lHNWxkME52Ym5SeWIyeFNZVzVuWlM1aFpHUW9ZMjl1ZEhKdmJGSmhibWRsTG1sMFpXMG9hU2twTzF4dUlDQWdJSDBnWld4elpTQjdYRzRnSUNBZ0lDQnlaVzF2ZG1Wa0lEMGdkSEoxWlR0Y2JpQWdJQ0I5WEc0Z0lIMWNiaUFnYm1WM1EyOXVkSEp2YkZKaGJtZGxMbk5sYkdWamRDZ3BPMXh1SUNCMWNHUmhkR1ZEYjI1MGNtOXNVMlZzWldOMGFXOXVLSFJvYVhNcE8xeHVmVHRjYmx4dVIyVjBVMlZzWldOMGFXOXVVSEp2ZEc4dVpXRmphRkpoYm1kbElEMGdablZ1WTNScGIyNGdLR1p1TENCeVpYUjFjbTVXWVd4MVpTa2dlMXh1SUNCMllYSWdhU0E5SURBN1hHNGdJSFpoY2lCc1pXNGdQU0IwYUdsekxsOXlZVzVuWlhNdWJHVnVaM1JvTzF4dUlDQm1iM0lnS0drZ1BTQXdPeUJwSUR3Z2JHVnVPeUFySzJrcElIdGNiaUFnSUNCcFppQW9abTRvZEdocGN5NW5aWFJTWVc1blpVRjBLR2twS1NrZ2UxeHVJQ0FnSUNBZ2NtVjBkWEp1SUhKbGRIVnlibFpoYkhWbE8xeHVJQ0FnSUgxY2JpQWdmVnh1ZlR0Y2JseHVSMlYwVTJWc1pXTjBhVzl1VUhKdmRHOHVaMlYwUVd4c1VtRnVaMlZ6SUQwZ1puVnVZM1JwYjI0Z0tDa2dlMXh1SUNCMllYSWdjbUZ1WjJWeklEMGdXMTA3WEc0Z0lIUm9hWE11WldGamFGSmhibWRsS0daMWJtTjBhVzl1SUNoeVlXNW5aU2tnZTF4dUlDQWdJSEpoYm1kbGN5NXdkWE5vS0hKaGJtZGxLVHRjYmlBZ2ZTazdYRzRnSUhKbGRIVnliaUJ5WVc1blpYTTdYRzU5TzF4dVhHNUhaWFJUWld4bFkzUnBiMjVRY205MGJ5NXpaWFJUYVc1bmJHVlNZVzVuWlNBOUlHWjFibU4wYVc5dUlDaHlZVzVuWlNrZ2UxeHVJQ0IwYUdsekxuSmxiVzkyWlVGc2JGSmhibWRsY3lncE8xeHVJQ0IwYUdsekxtRmtaRkpoYm1kbEtISmhibWRsS1R0Y2JuMDdYRzVjYm1aMWJtTjBhVzl1SUdOeVpXRjBaVU52Ym5SeWIyeFRaV3hsWTNScGIyNGdLSE5sYkN3Z2NtRnVaMlZ6S1NCN1hHNGdJSFpoY2lCamIyNTBjbTlzVW1GdVoyVWdQU0JpYjJSNUxtTnlaV0YwWlVOdmJuUnliMnhTWVc1blpTZ3BPMXh1SUNCbWIzSWdLSFpoY2lCcElEMGdNQ3dnWld3c0lHeGxiaUE5SUhKaGJtZGxjeTVzWlc1bmRHZzdJR2tnUENCc1pXNDdJQ3NyYVNrZ2UxeHVJQ0FnSUdWc0lEMGdaMlYwVTJsdVoyeGxSV3hsYldWdWRFWnliMjFTWVc1blpTaHlZVzVuWlhOYmFWMHBPMXh1SUNBZ0lIUnllU0I3WEc0Z0lDQWdJQ0JqYjI1MGNtOXNVbUZ1WjJVdVlXUmtLR1ZzS1R0Y2JpQWdJQ0I5SUdOaGRHTm9JQ2hsS1NCN1hHNGdJQ0FnSUNCMGFISnZkeUJ1WlhjZ1JYSnliM0lvSjNObGRGSmhibWRsY3lncE9pQkZiR1Z0Wlc1MElHTnZkV3hrSUc1dmRDQmlaU0JoWkdSbFpDQjBieUJqYjI1MGNtOXNJSE5sYkdWamRHbHZiaWNwTzF4dUlDQWdJSDFjYmlBZ2ZWeHVJQ0JqYjI1MGNtOXNVbUZ1WjJVdWMyVnNaV04wS0NrN1hHNGdJSFZ3WkdGMFpVTnZiblJ5YjJ4VFpXeGxZM1JwYjI0b2MyVnNLVHRjYm4xY2JseHVablZ1WTNScGIyNGdjbVZ0YjNabFVtRnVaMlZOWVc1MVlXeHNlU0FvYzJWc0xDQnlZVzVuWlNrZ2UxeHVJQ0IyWVhJZ2NtRnVaMlZ6SUQwZ2MyVnNMbWRsZEVGc2JGSmhibWRsY3lncE8xeHVJQ0J6Wld3dWNtVnRiM1psUVd4c1VtRnVaMlZ6S0NrN1hHNGdJR1p2Y2lBb2RtRnlJR2tnUFNBd0xDQnNaVzRnUFNCeVlXNW5aWE11YkdWdVozUm9PeUJwSUR3Z2JHVnVPeUFySzJrcElIdGNiaUFnSUNCcFppQW9JV2x6VTJGdFpWSmhibWRsS0hKaGJtZGxMQ0J5WVc1blpYTmJhVjBwS1NCN1hHNGdJQ0FnSUNCelpXd3VZV1JrVW1GdVoyVW9jbUZ1WjJWelcybGRLVHRjYmlBZ0lDQjlYRzRnSUgxY2JpQWdhV1lnS0NGelpXd3VjbUZ1WjJWRGIzVnVkQ2tnZTF4dUlDQWdJSFZ3WkdGMFpVVnRjSFI1VTJWc1pXTjBhVzl1S0hObGJDazdYRzRnSUgxY2JuMWNibHh1Wm5WdVkzUnBiMjRnZFhCa1lYUmxRVzVqYUc5eVFXNWtSbTlqZFhOR2NtOXRVbUZ1WjJVZ0tITmxiQ3dnY21GdVoyVXBJSHRjYmlBZ2RtRnlJR0Z1WTJodmNsQnlaV1pwZUNBOUlDZHpkR0Z5ZENjN1hHNGdJSFpoY2lCbWIyTjFjMUJ5WldacGVDQTlJQ2RsYm1Rbk8xeHVJQ0J6Wld3dVlXNWphRzl5VG05a1pTQTlJSEpoYm1kbFcyRnVZMmh2Y2xCeVpXWnBlQ0FySUNkRGIyNTBZV2x1WlhJblhUdGNiaUFnYzJWc0xtRnVZMmh2Y2s5bVpuTmxkQ0E5SUhKaGJtZGxXMkZ1WTJodmNsQnlaV1pwZUNBcklDZFBabVp6WlhRblhUdGNiaUFnYzJWc0xtWnZZM1Z6VG05a1pTQTlJSEpoYm1kbFcyWnZZM1Z6VUhKbFptbDRJQ3NnSjBOdmJuUmhhVzVsY2lkZE8xeHVJQ0J6Wld3dVptOWpkWE5QWm1aelpYUWdQU0J5WVc1blpWdG1iMk4xYzFCeVpXWnBlQ0FySUNkUFptWnpaWFFuWFR0Y2JuMWNibHh1Wm5WdVkzUnBiMjRnZFhCa1lYUmxSVzF3ZEhsVFpXeGxZM1JwYjI0Z0tITmxiQ2tnZTF4dUlDQnpaV3d1WVc1amFHOXlUbTlrWlNBOUlITmxiQzVtYjJOMWMwNXZaR1VnUFNCdWRXeHNPMXh1SUNCelpXd3VZVzVqYUc5eVQyWm1jMlYwSUQwZ2MyVnNMbVp2WTNWelQyWm1jMlYwSUQwZ01EdGNiaUFnYzJWc0xuSmhibWRsUTI5MWJuUWdQU0F3TzF4dUlDQnpaV3d1YVhORGIyeHNZWEJ6WldRZ1BTQjBjblZsTzF4dUlDQnpaV3d1WDNKaGJtZGxjeTVzWlc1bmRHZ2dQU0F3TzF4dWZWeHVYRzVtZFc1amRHbHZiaUJ5WVc1blpVTnZiblJoYVc1elUybHVaMnhsUld4bGJXVnVkQ0FvY21GdVoyVk9iMlJsY3lrZ2UxeHVJQ0JwWmlBb0lYSmhibWRsVG05a1pYTXViR1Z1WjNSb0lIeDhJSEpoYm1kbFRtOWtaWE5iTUYwdWJtOWtaVlI1Y0dVZ0lUMDlJREVwSUh0Y2JpQWdJQ0J5WlhSMWNtNGdabUZzYzJVN1hHNGdJSDFjYmlBZ1ptOXlJQ2gyWVhJZ2FTQTlJREVzSUd4bGJpQTlJSEpoYm1kbFRtOWtaWE11YkdWdVozUm9PeUJwSUR3Z2JHVnVPeUFySzJrcElIdGNiaUFnSUNCcFppQW9JV2x6UVc1alpYTjBiM0pQWmloeVlXNW5aVTV2WkdWeld6QmRMQ0J5WVc1blpVNXZaR1Z6VzJsZEtTa2dlMXh1SUNBZ0lDQWdjbVYwZFhKdUlHWmhiSE5sTzF4dUlDQWdJSDFjYmlBZ2ZWeHVJQ0J5WlhSMWNtNGdkSEoxWlR0Y2JuMWNibHh1Wm5WdVkzUnBiMjRnWjJWMFUybHVaMnhsUld4bGJXVnVkRVp5YjIxU1lXNW5aU0FvY21GdVoyVXBJSHRjYmlBZ2RtRnlJRzV2WkdWeklEMGdjbUZ1WjJVdVoyVjBUbTlrWlhNb0tUdGNiaUFnYVdZZ0tDRnlZVzVuWlVOdmJuUmhhVzV6VTJsdVoyeGxSV3hsYldWdWRDaHViMlJsY3lrcElIdGNiaUFnSUNCMGFISnZkeUJ1WlhjZ1JYSnliM0lvSjJkbGRGTnBibWRzWlVWc1pXMWxiblJHY205dFVtRnVaMlVvS1RvZ2NtRnVaMlVnWkdsa0lHNXZkQ0JqYjI1emFYTjBJRzltSUdFZ2MybHVaMnhsSUdWc1pXMWxiblFuS1R0Y2JpQWdmVnh1SUNCeVpYUjFjbTRnYm05a1pYTmJNRjA3WEc1OVhHNWNibVoxYm1OMGFXOXVJR2x6VkdWNGRGSmhibWRsSUNoeVlXNW5aU2tnZTF4dUlDQnlaWFIxY200Z2NtRnVaMlVnSmlZZ2NtRnVaMlV1ZEdWNGRDQWhQVDBnZG05cFpDQXdPMXh1ZlZ4dVhHNW1kVzVqZEdsdmJpQjFjR1JoZEdWR2NtOXRWR1Y0ZEZKaGJtZGxJQ2h6Wld3c0lISmhibWRsS1NCN1hHNGdJSE5sYkM1ZmNtRnVaMlZ6SUQwZ1czSmhibWRsWFR0Y2JpQWdkWEJrWVhSbFFXNWphRzl5UVc1a1JtOWpkWE5HY205dFVtRnVaMlVvYzJWc0xDQnlZVzVuWlN3Z1ptRnNjMlVwTzF4dUlDQnpaV3d1Y21GdVoyVkRiM1Z1ZENBOUlERTdYRzRnSUhObGJDNXBjME52Ykd4aGNITmxaQ0E5SUhKaGJtZGxMbU52Ykd4aGNITmxaRHRjYm4xY2JseHVablZ1WTNScGIyNGdkWEJrWVhSbFEyOXVkSEp2YkZObGJHVmpkR2x2YmlBb2MyVnNLU0I3WEc0Z0lITmxiQzVmY21GdVoyVnpMbXhsYm1kMGFDQTlJREE3WEc0Z0lHbG1JQ2h6Wld3dVgzTmxiR1ZqZEdsdmJpNTBlWEJsSUQwOVBTQW5UbTl1WlNjcElIdGNiaUFnSUNCMWNHUmhkR1ZGYlhCMGVWTmxiR1ZqZEdsdmJpaHpaV3dwTzF4dUlDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUhaaGNpQmpiMjUwY205c1VtRnVaMlVnUFNCelpXd3VYM05sYkdWamRHbHZiaTVqY21WaGRHVlNZVzVuWlNncE8xeHVJQ0FnSUdsbUlDaHBjMVJsZUhSU1lXNW5aU2hqYjI1MGNtOXNVbUZ1WjJVcEtTQjdYRzRnSUNBZ0lDQjFjR1JoZEdWR2NtOXRWR1Y0ZEZKaGJtZGxLSE5sYkN3Z1kyOXVkSEp2YkZKaGJtZGxLVHRjYmlBZ0lDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUNBZ2MyVnNMbkpoYm1kbFEyOTFiblFnUFNCamIyNTBjbTlzVW1GdVoyVXViR1Z1WjNSb08xeHVJQ0FnSUNBZ2RtRnlJSEpoYm1kbE8xeHVJQ0FnSUNBZ1ptOXlJQ2gyWVhJZ2FTQTlJREE3SUdrZ1BDQnpaV3d1Y21GdVoyVkRiM1Z1ZERzZ0t5dHBLU0I3WEc0Z0lDQWdJQ0FnSUhKaGJtZGxJRDBnWkc5akxtTnlaV0YwWlZKaGJtZGxLQ2s3WEc0Z0lDQWdJQ0FnSUhKaGJtZGxMbk5sYkdWamRFNXZaR1VvWTI5dWRISnZiRkpoYm1kbExtbDBaVzBvYVNrcE8xeHVJQ0FnSUNBZ0lDQnpaV3d1WDNKaGJtZGxjeTV3ZFhOb0tISmhibWRsS1R0Y2JpQWdJQ0FnSUgxY2JpQWdJQ0FnSUhObGJDNXBjME52Ykd4aGNITmxaQ0E5SUhObGJDNXlZVzVuWlVOdmRXNTBJRDA5UFNBeElDWW1JSE5sYkM1ZmNtRnVaMlZ6V3pCZExtTnZiR3hoY0hObFpEdGNiaUFnSUNBZ0lIVndaR0YwWlVGdVkyaHZja0Z1WkVadlkzVnpSbkp2YlZKaGJtZGxLSE5sYkN3Z2MyVnNMbDl5WVc1blpYTmJjMlZzTG5KaGJtZGxRMjkxYm5RZ0xTQXhYU3dnWm1Gc2MyVXBPMXh1SUNBZ0lIMWNiaUFnZlZ4dWZWeHVYRzVtZFc1amRHbHZiaUJoWkdSU1lXNW5aVlJ2UTI5dWRISnZiRk5sYkdWamRHbHZiaUFvYzJWc0xDQnlZVzVuWlNrZ2UxeHVJQ0IyWVhJZ1kyOXVkSEp2YkZKaGJtZGxJRDBnYzJWc0xsOXpaV3hsWTNScGIyNHVZM0psWVhSbFVtRnVaMlVvS1R0Y2JpQWdkbUZ5SUhKaGJtZGxSV3hsYldWdWRDQTlJR2RsZEZOcGJtZHNaVVZzWlcxbGJuUkdjbTl0VW1GdVoyVW9jbUZ1WjJVcE8xeHVJQ0IyWVhJZ2JtVjNRMjl1ZEhKdmJGSmhibWRsSUQwZ1ltOWtlUzVqY21WaGRHVkRiMjUwY205c1VtRnVaMlVvS1R0Y2JpQWdabTl5SUNoMllYSWdhU0E5SURBc0lHeGxiaUE5SUdOdmJuUnliMnhTWVc1blpTNXNaVzVuZEdnN0lHa2dQQ0JzWlc0N0lDc3JhU2tnZTF4dUlDQWdJRzVsZDBOdmJuUnliMnhTWVc1blpTNWhaR1FvWTI5dWRISnZiRkpoYm1kbExtbDBaVzBvYVNrcE8xeHVJQ0I5WEc0Z0lIUnllU0I3WEc0Z0lDQWdibVYzUTI5dWRISnZiRkpoYm1kbExtRmtaQ2h5WVc1blpVVnNaVzFsYm5RcE8xeHVJQ0I5SUdOaGRHTm9JQ2hsS1NCN1hHNGdJQ0FnZEdoeWIzY2dibVYzSUVWeWNtOXlLQ2RoWkdSU1lXNW5aU2dwT2lCRmJHVnRaVzUwSUdOdmRXeGtJRzV2ZENCaVpTQmhaR1JsWkNCMGJ5QmpiMjUwY205c0lITmxiR1ZqZEdsdmJpY3BPMXh1SUNCOVhHNGdJRzVsZDBOdmJuUnliMnhTWVc1blpTNXpaV3hsWTNRb0tUdGNiaUFnZFhCa1lYUmxRMjl1ZEhKdmJGTmxiR1ZqZEdsdmJpaHpaV3dwTzF4dWZWeHVYRzVtZFc1amRHbHZiaUJwYzFOaGJXVlNZVzVuWlNBb2JHVm1kQ3dnY21sbmFIUXBJSHRjYmlBZ2NtVjBkWEp1SUNoY2JpQWdJQ0JzWldaMExuTjBZWEowUTI5dWRHRnBibVZ5SUQwOVBTQnlhV2RvZEM1emRHRnlkRU52Ym5SaGFXNWxjaUFtSmx4dUlDQWdJR3hsWm5RdWMzUmhjblJQWm1aelpYUWdQVDA5SUhKcFoyaDBMbk4wWVhKMFQyWm1jMlYwSUNZbVhHNGdJQ0FnYkdWbWRDNWxibVJEYjI1MFlXbHVaWElnUFQwOUlISnBaMmgwTG1WdVpFTnZiblJoYVc1bGNpQW1KbHh1SUNBZ0lHeGxablF1Wlc1a1QyWm1jMlYwSUQwOVBTQnlhV2RvZEM1bGJtUlBabVp6WlhSY2JpQWdLVHRjYm4xY2JseHVablZ1WTNScGIyNGdhWE5CYm1ObGMzUnZjazltSUNoaGJtTmxjM1J2Y2l3Z1pHVnpZMlZ1WkdGdWRDa2dlMXh1SUNCMllYSWdibTlrWlNBOUlHUmxjMk5sYm1SaGJuUTdYRzRnSUhkb2FXeGxJQ2h1YjJSbExuQmhjbVZ1ZEU1dlpHVXBJSHRjYmlBZ0lDQnBaaUFvYm05a1pTNXdZWEpsYm5ST2IyUmxJRDA5UFNCaGJtTmxjM1J2Y2lrZ2UxeHVJQ0FnSUNBZ2NtVjBkWEp1SUhSeWRXVTdYRzRnSUNBZ2ZWeHVJQ0FnSUc1dlpHVWdQU0J1YjJSbExuQmhjbVZ1ZEU1dlpHVTdYRzRnSUgxY2JpQWdjbVYwZFhKdUlHWmhiSE5sTzF4dWZWeHVYRzVtZFc1amRHbHZiaUJuWlhSVFpXeGxZM1JwYjI0Z0tDa2dlMXh1SUNCeVpYUjFjbTRnYm1WM0lFZGxkRk5sYkdWamRHbHZiaWhuYkc5aVlXd3VaRzlqZFcxbGJuUXVjMlZzWldOMGFXOXVLVHRjYm4xY2JseHViVzlrZFd4bExtVjRjRzl5ZEhNZ1BTQm5aWFJUWld4bFkzUnBiMjQ3WEc0aVhYMD0iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGlzSG9zdE1ldGhvZCAoaG9zdCwgcHJvcCkge1xuICB2YXIgdHlwZSA9IHR5cGVvZiBob3N0W3Byb3BdO1xuICByZXR1cm4gdHlwZSA9PT0gJ2Z1bmN0aW9uJyB8fCAhISh0eXBlID09PSAnb2JqZWN0JyAmJiBob3N0W3Byb3BdKSB8fCB0eXBlID09PSAndW5rbm93bic7XG59XG5cbmZ1bmN0aW9uIGlzSG9zdFByb3BlcnR5IChob3N0LCBwcm9wKSB7XG4gIHJldHVybiB0eXBlb2YgaG9zdFtwcm9wXSAhPT0gJ3VuZGVmaW5lZCc7XG59XG5cbmZ1bmN0aW9uIG1hbnkgKGZuKSB7XG4gIHJldHVybiBmdW5jdGlvbiBhcmVIb3N0ZWQgKGhvc3QsIHByb3BzKSB7XG4gICAgdmFyIGkgPSBwcm9wcy5sZW5ndGg7XG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgaWYgKCFmbihob3N0LCBwcm9wc1tpXSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIG1ldGhvZDogaXNIb3N0TWV0aG9kLFxuICBtZXRob2RzOiBtYW55KGlzSG9zdE1ldGhvZCksXG4gIHByb3BlcnR5OiBpc0hvc3RQcm9wZXJ0eSxcbiAgcHJvcGVydGllczogbWFueShpc0hvc3RQcm9wZXJ0eSlcbn07XG4iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBkb2MgPSBnbG9iYWwuZG9jdW1lbnQ7XG52YXIgYm9keSA9IGRvYy5ib2R5O1xuXG5mdW5jdGlvbiByYW5nZVRvVGV4dFJhbmdlIChwKSB7XG4gIGlmIChwLmNvbGxhcHNlZCkge1xuICAgIHJldHVybiBjcmVhdGVCb3VuZGFyeVRleHRSYW5nZSh7IG5vZGU6IHAuc3RhcnRDb250YWluZXIsIG9mZnNldDogcC5zdGFydE9mZnNldCB9LCB0cnVlKTtcbiAgfVxuICB2YXIgc3RhcnRSYW5nZSA9IGNyZWF0ZUJvdW5kYXJ5VGV4dFJhbmdlKHsgbm9kZTogcC5zdGFydENvbnRhaW5lciwgb2Zmc2V0OiBwLnN0YXJ0T2Zmc2V0IH0sIHRydWUpO1xuICB2YXIgZW5kUmFuZ2UgPSBjcmVhdGVCb3VuZGFyeVRleHRSYW5nZSh7IG5vZGU6IHAuZW5kQ29udGFpbmVyLCBvZmZzZXQ6IHAuZW5kT2Zmc2V0IH0sIGZhbHNlKTtcbiAgdmFyIHRleHRSYW5nZSA9IGJvZHkuY3JlYXRlVGV4dFJhbmdlKCk7XG4gIHRleHRSYW5nZS5zZXRFbmRQb2ludCgnU3RhcnRUb1N0YXJ0Jywgc3RhcnRSYW5nZSk7XG4gIHRleHRSYW5nZS5zZXRFbmRQb2ludCgnRW5kVG9FbmQnLCBlbmRSYW5nZSk7XG4gIHJldHVybiB0ZXh0UmFuZ2U7XG59XG5cbmZ1bmN0aW9uIGlzQ2hhcmFjdGVyRGF0YU5vZGUgKG5vZGUpIHtcbiAgdmFyIHQgPSBub2RlLm5vZGVUeXBlO1xuICByZXR1cm4gdCA9PT0gMyB8fCB0ID09PSA0IHx8IHQgPT09IDggO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVCb3VuZGFyeVRleHRSYW5nZSAocCwgc3RhcnRpbmcpIHtcbiAgdmFyIGJvdW5kO1xuICB2YXIgcGFyZW50O1xuICB2YXIgb2Zmc2V0ID0gcC5vZmZzZXQ7XG4gIHZhciB3b3JraW5nTm9kZTtcbiAgdmFyIGNoaWxkTm9kZXM7XG4gIHZhciByYW5nZSA9IGJvZHkuY3JlYXRlVGV4dFJhbmdlKCk7XG4gIHZhciBkYXRhID0gaXNDaGFyYWN0ZXJEYXRhTm9kZShwLm5vZGUpO1xuXG4gIGlmIChkYXRhKSB7XG4gICAgYm91bmQgPSBwLm5vZGU7XG4gICAgcGFyZW50ID0gYm91bmQucGFyZW50Tm9kZTtcbiAgfSBlbHNlIHtcbiAgICBjaGlsZE5vZGVzID0gcC5ub2RlLmNoaWxkTm9kZXM7XG4gICAgYm91bmQgPSBvZmZzZXQgPCBjaGlsZE5vZGVzLmxlbmd0aCA/IGNoaWxkTm9kZXNbb2Zmc2V0XSA6IG51bGw7XG4gICAgcGFyZW50ID0gcC5ub2RlO1xuICB9XG5cbiAgd29ya2luZ05vZGUgPSBkb2MuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICB3b3JraW5nTm9kZS5pbm5lckhUTUwgPSAnJiNmZWZmOyc7XG5cbiAgaWYgKGJvdW5kKSB7XG4gICAgcGFyZW50Lmluc2VydEJlZm9yZSh3b3JraW5nTm9kZSwgYm91bmQpO1xuICB9IGVsc2Uge1xuICAgIHBhcmVudC5hcHBlbmRDaGlsZCh3b3JraW5nTm9kZSk7XG4gIH1cblxuICByYW5nZS5tb3ZlVG9FbGVtZW50VGV4dCh3b3JraW5nTm9kZSk7XG4gIHJhbmdlLmNvbGxhcHNlKCFzdGFydGluZyk7XG4gIHBhcmVudC5yZW1vdmVDaGlsZCh3b3JraW5nTm9kZSk7XG5cbiAgaWYgKGRhdGEpIHtcbiAgICByYW5nZVtzdGFydGluZyA/ICdtb3ZlU3RhcnQnIDogJ21vdmVFbmQnXSgnY2hhcmFjdGVyJywgb2Zmc2V0KTtcbiAgfVxuICByZXR1cm4gcmFuZ2U7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gcmFuZ2VUb1RleHRSYW5nZTtcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pXG4vLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247Y2hhcnNldDp1dGYtODtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSnpiM1Z5WTJWeklqcGJJbTV2WkdWZmJXOWtkV3hsY3k5elpXeGxZMk5wYjI0dmMzSmpMM0poYm1kbFZHOVVaWGgwVW1GdVoyVXVhbk1pWFN3aWJtRnRaWE1pT2x0ZExDSnRZWEJ3YVc1bmN5STZJanRCUVVGQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJJaXdpWm1sc1pTSTZJbWRsYm1WeVlYUmxaQzVxY3lJc0luTnZkWEpqWlZKdmIzUWlPaUlpTENKemIzVnlZMlZ6UTI5dWRHVnVkQ0k2V3lJbmRYTmxJSE4wY21samRDYzdYRzVjYm5aaGNpQmtiMk1nUFNCbmJHOWlZV3d1Wkc5amRXMWxiblE3WEc1MllYSWdZbTlrZVNBOUlHUnZZeTVpYjJSNU8xeHVYRzVtZFc1amRHbHZiaUJ5WVc1blpWUnZWR1Y0ZEZKaGJtZGxJQ2h3S1NCN1hHNGdJR2xtSUNod0xtTnZiR3hoY0hObFpDa2dlMXh1SUNBZ0lISmxkSFZ5YmlCamNtVmhkR1ZDYjNWdVpHRnllVlJsZUhSU1lXNW5aU2g3SUc1dlpHVTZJSEF1YzNSaGNuUkRiMjUwWVdsdVpYSXNJRzltWm5ObGREb2djQzV6ZEdGeWRFOW1abk5sZENCOUxDQjBjblZsS1R0Y2JpQWdmVnh1SUNCMllYSWdjM1JoY25SU1lXNW5aU0E5SUdOeVpXRjBaVUp2ZFc1a1lYSjVWR1Y0ZEZKaGJtZGxLSHNnYm05a1pUb2djQzV6ZEdGeWRFTnZiblJoYVc1bGNpd2diMlptYzJWME9pQndMbk4wWVhKMFQyWm1jMlYwSUgwc0lIUnlkV1VwTzF4dUlDQjJZWElnWlc1a1VtRnVaMlVnUFNCamNtVmhkR1ZDYjNWdVpHRnllVlJsZUhSU1lXNW5aU2g3SUc1dlpHVTZJSEF1Wlc1a1EyOXVkR0ZwYm1WeUxDQnZabVp6WlhRNklIQXVaVzVrVDJabWMyVjBJSDBzSUdaaGJITmxLVHRjYmlBZ2RtRnlJSFJsZUhSU1lXNW5aU0E5SUdKdlpIa3VZM0psWVhSbFZHVjRkRkpoYm1kbEtDazdYRzRnSUhSbGVIUlNZVzVuWlM1elpYUkZibVJRYjJsdWRDZ25VM1JoY25SVWIxTjBZWEowSnl3Z2MzUmhjblJTWVc1blpTazdYRzRnSUhSbGVIUlNZVzVuWlM1elpYUkZibVJRYjJsdWRDZ25SVzVrVkc5RmJtUW5MQ0JsYm1SU1lXNW5aU2s3WEc0Z0lISmxkSFZ5YmlCMFpYaDBVbUZ1WjJVN1hHNTlYRzVjYm1aMWJtTjBhVzl1SUdselEyaGhjbUZqZEdWeVJHRjBZVTV2WkdVZ0tHNXZaR1VwSUh0Y2JpQWdkbUZ5SUhRZ1BTQnViMlJsTG01dlpHVlVlWEJsTzF4dUlDQnlaWFIxY200Z2RDQTlQVDBnTXlCOGZDQjBJRDA5UFNBMElIeDhJSFFnUFQwOUlEZ2dPMXh1ZlZ4dVhHNW1kVzVqZEdsdmJpQmpjbVZoZEdWQ2IzVnVaR0Z5ZVZSbGVIUlNZVzVuWlNBb2NDd2djM1JoY25ScGJtY3BJSHRjYmlBZ2RtRnlJR0p2ZFc1a08xeHVJQ0IyWVhJZ2NHRnlaVzUwTzF4dUlDQjJZWElnYjJabWMyVjBJRDBnY0M1dlptWnpaWFE3WEc0Z0lIWmhjaUIzYjNKcmFXNW5UbTlrWlR0Y2JpQWdkbUZ5SUdOb2FXeGtUbTlrWlhNN1hHNGdJSFpoY2lCeVlXNW5aU0E5SUdKdlpIa3VZM0psWVhSbFZHVjRkRkpoYm1kbEtDazdYRzRnSUhaaGNpQmtZWFJoSUQwZ2FYTkRhR0Z5WVdOMFpYSkVZWFJoVG05a1pTaHdMbTV2WkdVcE8xeHVYRzRnSUdsbUlDaGtZWFJoS1NCN1hHNGdJQ0FnWW05MWJtUWdQU0J3TG01dlpHVTdYRzRnSUNBZ2NHRnlaVzUwSUQwZ1ltOTFibVF1Y0dGeVpXNTBUbTlrWlR0Y2JpQWdmU0JsYkhObElIdGNiaUFnSUNCamFHbHNaRTV2WkdWeklEMGdjQzV1YjJSbExtTm9hV3hrVG05a1pYTTdYRzRnSUNBZ1ltOTFibVFnUFNCdlptWnpaWFFnUENCamFHbHNaRTV2WkdWekxteGxibWQwYUNBL0lHTm9hV3hrVG05a1pYTmJiMlptYzJWMFhTQTZJRzUxYkd3N1hHNGdJQ0FnY0dGeVpXNTBJRDBnY0M1dWIyUmxPMXh1SUNCOVhHNWNiaUFnZDI5eWEybHVaMDV2WkdVZ1BTQmtiMk11WTNKbFlYUmxSV3hsYldWdWRDZ25jM0JoYmljcE8xeHVJQ0IzYjNKcmFXNW5UbTlrWlM1cGJtNWxja2hVVFV3Z1BTQW5KaU5tWldabU95YzdYRzVjYmlBZ2FXWWdLR0p2ZFc1a0tTQjdYRzRnSUNBZ2NHRnlaVzUwTG1sdWMyVnlkRUpsWm05eVpTaDNiM0pyYVc1blRtOWtaU3dnWW05MWJtUXBPMXh1SUNCOUlHVnNjMlVnZTF4dUlDQWdJSEJoY21WdWRDNWhjSEJsYm1SRGFHbHNaQ2gzYjNKcmFXNW5UbTlrWlNrN1hHNGdJSDFjYmx4dUlDQnlZVzVuWlM1dGIzWmxWRzlGYkdWdFpXNTBWR1Y0ZENoM2IzSnJhVzVuVG05a1pTazdYRzRnSUhKaGJtZGxMbU52Ykd4aGNITmxLQ0Z6ZEdGeWRHbHVaeWs3WEc0Z0lIQmhjbVZ1ZEM1eVpXMXZkbVZEYUdsc1pDaDNiM0pyYVc1blRtOWtaU2s3WEc1Y2JpQWdhV1lnS0dSaGRHRXBJSHRjYmlBZ0lDQnlZVzVuWlZ0emRHRnlkR2x1WnlBL0lDZHRiM1psVTNSaGNuUW5JRG9nSjIxdmRtVkZibVFuWFNnblkyaGhjbUZqZEdWeUp5d2diMlptYzJWMEtUdGNiaUFnZlZ4dUlDQnlaWFIxY200Z2NtRnVaMlU3WEc1OVhHNWNibTF2WkhWc1pTNWxlSEJ2Y25SeklEMGdjbUZ1WjJWVWIxUmxlSFJTWVc1blpUdGNiaUpkZlE9PSIsIid1c2Ugc3RyaWN0JztcblxudmFyIGdldFNlbGVjdGlvbiA9IHJlcXVpcmUoJy4vZ2V0U2VsZWN0aW9uJyk7XG52YXIgc2V0U2VsZWN0aW9uID0gcmVxdWlyZSgnLi9zZXRTZWxlY3Rpb24nKTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGdldDogZ2V0U2VsZWN0aW9uLFxuICBzZXQ6IHNldFNlbGVjdGlvblxufTtcbiIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIGdldFNlbGVjdGlvbiA9IHJlcXVpcmUoJy4vZ2V0U2VsZWN0aW9uJyk7XG52YXIgcmFuZ2VUb1RleHRSYW5nZSA9IHJlcXVpcmUoJy4vcmFuZ2VUb1RleHRSYW5nZScpO1xudmFyIGRvYyA9IGdsb2JhbC5kb2N1bWVudDtcblxuZnVuY3Rpb24gc2V0U2VsZWN0aW9uIChwKSB7XG4gIGlmIChkb2MuY3JlYXRlUmFuZ2UpIHtcbiAgICBtb2Rlcm5TZWxlY3Rpb24oKTtcbiAgfSBlbHNlIHtcbiAgICBvbGRTZWxlY3Rpb24oKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG1vZGVyblNlbGVjdGlvbiAoKSB7XG4gICAgdmFyIHNlbCA9IGdldFNlbGVjdGlvbigpO1xuICAgIHZhciByYW5nZSA9IGRvYy5jcmVhdGVSYW5nZSgpO1xuICAgIGlmICghcC5zdGFydENvbnRhaW5lcikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAocC5lbmRDb250YWluZXIpIHtcbiAgICAgIHJhbmdlLnNldEVuZChwLmVuZENvbnRhaW5lciwgcC5lbmRPZmZzZXQpO1xuICAgIH0gZWxzZSB7XG4gICAgICByYW5nZS5zZXRFbmQocC5zdGFydENvbnRhaW5lciwgcC5zdGFydE9mZnNldCk7XG4gICAgfVxuICAgIHJhbmdlLnNldFN0YXJ0KHAuc3RhcnRDb250YWluZXIsIHAuc3RhcnRPZmZzZXQpO1xuICAgIHNlbC5yZW1vdmVBbGxSYW5nZXMoKTtcbiAgICBzZWwuYWRkUmFuZ2UocmFuZ2UpO1xuICB9XG5cbiAgZnVuY3Rpb24gb2xkU2VsZWN0aW9uICgpIHtcbiAgICByYW5nZVRvVGV4dFJhbmdlKHApLnNlbGVjdCgpO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gc2V0U2VsZWN0aW9uO1xuXG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSlcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0OnV0Zi04O2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKemIzVnlZMlZ6SWpwYkltNXZaR1ZmYlc5a2RXeGxjeTl6Wld4bFkyTnBiMjR2YzNKakwzTmxkRk5sYkdWamRHbHZiaTVxY3lKZExDSnVZVzFsY3lJNlcxMHNJbTFoY0hCcGJtZHpJam9pTzBGQlFVRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CSWl3aVptbHNaU0k2SW1kbGJtVnlZWFJsWkM1cWN5SXNJbk52ZFhKalpWSnZiM1FpT2lJaUxDSnpiM1Z5WTJWelEyOXVkR1Z1ZENJNld5SW5kWE5sSUhOMGNtbGpkQ2M3WEc1Y2JuWmhjaUJuWlhSVFpXeGxZM1JwYjI0Z1BTQnlaWEYxYVhKbEtDY3VMMmRsZEZObGJHVmpkR2x2YmljcE8xeHVkbUZ5SUhKaGJtZGxWRzlVWlhoMFVtRnVaMlVnUFNCeVpYRjFhWEpsS0NjdUwzSmhibWRsVkc5VVpYaDBVbUZ1WjJVbktUdGNiblpoY2lCa2IyTWdQU0JuYkc5aVlXd3VaRzlqZFcxbGJuUTdYRzVjYm1aMWJtTjBhVzl1SUhObGRGTmxiR1ZqZEdsdmJpQW9jQ2tnZTF4dUlDQnBaaUFvWkc5akxtTnlaV0YwWlZKaGJtZGxLU0I3WEc0Z0lDQWdiVzlrWlhKdVUyVnNaV04wYVc5dUtDazdYRzRnSUgwZ1pXeHpaU0I3WEc0Z0lDQWdiMnhrVTJWc1pXTjBhVzl1S0NrN1hHNGdJSDFjYmx4dUlDQm1kVzVqZEdsdmJpQnRiMlJsY201VFpXeGxZM1JwYjI0Z0tDa2dlMXh1SUNBZ0lIWmhjaUJ6Wld3Z1BTQm5aWFJUWld4bFkzUnBiMjRvS1R0Y2JpQWdJQ0IyWVhJZ2NtRnVaMlVnUFNCa2IyTXVZM0psWVhSbFVtRnVaMlVvS1R0Y2JpQWdJQ0JwWmlBb0lYQXVjM1JoY25SRGIyNTBZV2x1WlhJcElIdGNiaUFnSUNBZ0lISmxkSFZ5Ymp0Y2JpQWdJQ0I5WEc0Z0lDQWdhV1lnS0hBdVpXNWtRMjl1ZEdGcGJtVnlLU0I3WEc0Z0lDQWdJQ0J5WVc1blpTNXpaWFJGYm1Rb2NDNWxibVJEYjI1MFlXbHVaWElzSUhBdVpXNWtUMlptYzJWMEtUdGNiaUFnSUNCOUlHVnNjMlVnZTF4dUlDQWdJQ0FnY21GdVoyVXVjMlYwUlc1a0tIQXVjM1JoY25SRGIyNTBZV2x1WlhJc0lIQXVjM1JoY25SUFptWnpaWFFwTzF4dUlDQWdJSDFjYmlBZ0lDQnlZVzVuWlM1elpYUlRkR0Z5ZENod0xuTjBZWEowUTI5dWRHRnBibVZ5TENCd0xuTjBZWEowVDJabWMyVjBLVHRjYmlBZ0lDQnpaV3d1Y21WdGIzWmxRV3hzVW1GdVoyVnpLQ2s3WEc0Z0lDQWdjMlZzTG1Ga1pGSmhibWRsS0hKaGJtZGxLVHRjYmlBZ2ZWeHVYRzRnSUdaMWJtTjBhVzl1SUc5c1pGTmxiR1ZqZEdsdmJpQW9LU0I3WEc0Z0lDQWdjbUZ1WjJWVWIxUmxlSFJTWVc1blpTaHdLUzV6Wld4bFkzUW9LVHRjYmlBZ2ZWeHVmVnh1WEc1dGIyUjFiR1V1Wlhod2IzSjBjeUE5SUhObGRGTmxiR1ZqZEdsdmJqdGNiaUpkZlE9PSIsIid1c2Ugc3RyaWN0JztcblxudmFyIGdldCA9IGVhc3lHZXQ7XG52YXIgc2V0ID0gZWFzeVNldDtcblxuaWYgKGRvY3VtZW50LnNlbGVjdGlvbiAmJiBkb2N1bWVudC5zZWxlY3Rpb24uY3JlYXRlUmFuZ2UpIHtcbiAgZ2V0ID0gaGFyZEdldDtcbiAgc2V0ID0gaGFyZFNldDtcbn1cblxuZnVuY3Rpb24gZWFzeUdldCAoZWwpIHtcbiAgcmV0dXJuIHtcbiAgICBzdGFydDogZWwuc2VsZWN0aW9uU3RhcnQsXG4gICAgZW5kOiBlbC5zZWxlY3Rpb25FbmRcbiAgfTtcbn1cblxuZnVuY3Rpb24gaGFyZEdldCAoZWwpIHtcbiAgdmFyIGFjdGl2ZSA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gIGlmIChhY3RpdmUgIT09IGVsKSB7XG4gICAgZWwuZm9jdXMoKTtcbiAgfVxuXG4gIHZhciByYW5nZSA9IGRvY3VtZW50LnNlbGVjdGlvbi5jcmVhdGVSYW5nZSgpO1xuICB2YXIgYm9va21hcmsgPSByYW5nZS5nZXRCb29rbWFyaygpO1xuICB2YXIgb3JpZ2luYWwgPSBlbC52YWx1ZTtcbiAgdmFyIG1hcmtlciA9IGdldFVuaXF1ZU1hcmtlcihvcmlnaW5hbCk7XG4gIHZhciBwYXJlbnQgPSByYW5nZS5wYXJlbnRFbGVtZW50KCk7XG4gIGlmIChwYXJlbnQgPT09IG51bGwgfHwgIWlucHV0cyhwYXJlbnQpKSB7XG4gICAgcmV0dXJuIHJlc3VsdCgwLCAwKTtcbiAgfVxuICByYW5nZS50ZXh0ID0gbWFya2VyICsgcmFuZ2UudGV4dCArIG1hcmtlcjtcblxuICB2YXIgY29udGVudHMgPSBlbC52YWx1ZTtcblxuICBlbC52YWx1ZSA9IG9yaWdpbmFsO1xuICByYW5nZS5tb3ZlVG9Cb29rbWFyayhib29rbWFyayk7XG4gIHJhbmdlLnNlbGVjdCgpO1xuXG4gIHJldHVybiByZXN1bHQoY29udGVudHMuaW5kZXhPZihtYXJrZXIpLCBjb250ZW50cy5sYXN0SW5kZXhPZihtYXJrZXIpIC0gbWFya2VyLmxlbmd0aCk7XG5cbiAgZnVuY3Rpb24gcmVzdWx0IChzdGFydCwgZW5kKSB7XG4gICAgaWYgKGFjdGl2ZSAhPT0gZWwpIHsgLy8gZG9uJ3QgZGlzcnVwdCBwcmUtZXhpc3Rpbmcgc3RhdGVcbiAgICAgIGlmIChhY3RpdmUpIHtcbiAgICAgICAgYWN0aXZlLmZvY3VzKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlbC5ibHVyKCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7IHN0YXJ0OiBzdGFydCwgZW5kOiBlbmQgfTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRVbmlxdWVNYXJrZXIgKGNvbnRlbnRzKSB7XG4gIHZhciBtYXJrZXI7XG4gIGRvIHtcbiAgICBtYXJrZXIgPSAnQEBtYXJrZXIuJyArIE1hdGgucmFuZG9tKCkgKiBuZXcgRGF0ZSgpO1xuICB9IHdoaWxlIChjb250ZW50cy5pbmRleE9mKG1hcmtlcikgIT09IC0xKTtcbiAgcmV0dXJuIG1hcmtlcjtcbn1cblxuZnVuY3Rpb24gaW5wdXRzIChlbCkge1xuICByZXR1cm4gKChlbC50YWdOYW1lID09PSAnSU5QVVQnICYmIGVsLnR5cGUgPT09ICd0ZXh0JykgfHwgZWwudGFnTmFtZSA9PT0gJ1RFWFRBUkVBJyk7XG59XG5cbmZ1bmN0aW9uIGVhc3lTZXQgKGVsLCBwKSB7XG4gIGVsLnNlbGVjdGlvblN0YXJ0ID0gcGFyc2UoZWwsIHAuc3RhcnQpO1xuICBlbC5zZWxlY3Rpb25FbmQgPSBwYXJzZShlbCwgcC5lbmQpO1xufVxuXG5mdW5jdGlvbiBoYXJkU2V0IChlbCwgcCkge1xuICB2YXIgcmFuZ2UgPSBlbC5jcmVhdGVUZXh0UmFuZ2UoKTtcblxuICBpZiAocC5zdGFydCA9PT0gJ2VuZCcgJiYgcC5lbmQgPT09ICdlbmQnKSB7XG4gICAgcmFuZ2UuY29sbGFwc2UoZmFsc2UpO1xuICAgIHJhbmdlLnNlbGVjdCgpO1xuICB9IGVsc2Uge1xuICAgIHJhbmdlLmNvbGxhcHNlKHRydWUpO1xuICAgIHJhbmdlLm1vdmVFbmQoJ2NoYXJhY3RlcicsIHBhcnNlKGVsLCBwLmVuZCkpO1xuICAgIHJhbmdlLm1vdmVTdGFydCgnY2hhcmFjdGVyJywgcGFyc2UoZWwsIHAuc3RhcnQpKTtcbiAgICByYW5nZS5zZWxlY3QoKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBwYXJzZSAoZWwsIHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSA9PT0gJ2VuZCcgPyBlbC52YWx1ZS5sZW5ndGggOiB2YWx1ZSB8fCAwO1xufVxuXG5mdW5jdGlvbiBzZWxsIChlbCwgcCkge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMikge1xuICAgIHNldChlbCwgcCk7XG4gIH1cbiAgcmV0dXJuIGdldChlbCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gc2VsbDtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGNyb3NzdmVudCA9IHJlcXVpcmUoJ2Nyb3NzdmVudCcpO1xudmFyIElucHV0U3RhdGUgPSByZXF1aXJlKCcuL0lucHV0U3RhdGUnKTtcblxuZnVuY3Rpb24gSW5wdXRIaXN0b3J5IChzdXJmYWNlLCBtb2RlKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXM7XG5cbiAgc3RhdGUuaW5wdXRNb2RlID0gbW9kZTtcbiAgc3RhdGUuc3VyZmFjZSA9IHN1cmZhY2U7XG4gIHN0YXRlLnJlc2V0KCk7XG5cbiAgbGlzdGVuKHN1cmZhY2UudGV4dGFyZWEpO1xuICBsaXN0ZW4oc3VyZmFjZS5lZGl0YWJsZSk7XG5cbiAgZnVuY3Rpb24gbGlzdGVuIChlbCkge1xuICAgIHZhciBwYXN0ZUhhbmRsZXIgPSBzZWxmaWUoaGFuZGxlUGFzdGUpO1xuICAgIGNyb3NzdmVudC5hZGQoZWwsICdrZXlwcmVzcycsIHByZXZlbnRDdHJsWVopO1xuICAgIGNyb3NzdmVudC5hZGQoZWwsICdrZXlkb3duJywgc2VsZmllKGhhbmRsZUN0cmxZWikpO1xuICAgIGNyb3NzdmVudC5hZGQoZWwsICdrZXlkb3duJywgc2VsZmllKGhhbmRsZU1vZGVDaGFuZ2UpKTtcbiAgICBjcm9zc3ZlbnQuYWRkKGVsLCAnbW91c2Vkb3duJywgc2V0TW92aW5nKTtcbiAgICBlbC5vbnBhc3RlID0gcGFzdGVIYW5kbGVyO1xuICAgIGVsLm9uZHJvcCA9IHBhc3RlSGFuZGxlcjtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldE1vdmluZyAoKSB7XG4gICAgc3RhdGUuc2V0TW9kZSgnbW92aW5nJyk7XG4gIH1cblxuICBmdW5jdGlvbiBzZWxmaWUgKGZuKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIGhhbmRsZXIgKGUpIHsgcmV0dXJuIGZuLmNhbGwobnVsbCwgc3RhdGUsIGUpOyB9O1xuICB9XG59XG5cbklucHV0SGlzdG9yeS5wcm90b3R5cGUuc2V0SW5wdXRNb2RlID0gZnVuY3Rpb24gKG1vZGUpIHtcbiAgdmFyIHN0YXRlID0gdGhpcztcbiAgc3RhdGUuaW5wdXRNb2RlID0gbW9kZTtcbiAgc3RhdGUucmVzZXQoKTtcbn07XG5cbklucHV0SGlzdG9yeS5wcm90b3R5cGUucmVzZXQgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXM7XG4gIHN0YXRlLmlucHV0U3RhdGUgPSBudWxsO1xuICBzdGF0ZS5sYXN0U3RhdGUgPSBudWxsO1xuICBzdGF0ZS5oaXN0b3J5ID0gW107XG4gIHN0YXRlLmhpc3RvcnlQb2ludGVyID0gMDtcbiAgc3RhdGUuaGlzdG9yeU1vZGUgPSAnbm9uZSc7XG4gIHN0YXRlLnJlZnJlc2hpbmcgPSBudWxsO1xuICBzdGF0ZS5yZWZyZXNoU3RhdGUodHJ1ZSk7XG4gIHN0YXRlLnNhdmVTdGF0ZSgpO1xuICByZXR1cm4gc3RhdGU7XG59O1xuXG5JbnB1dEhpc3RvcnkucHJvdG90eXBlLnNldENvbW1hbmRNb2RlID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc3RhdGUgPSB0aGlzO1xuICBzdGF0ZS5oaXN0b3J5TW9kZSA9ICdjb21tYW5kJztcbiAgc3RhdGUuc2F2ZVN0YXRlKCk7XG4gIHN0YXRlLnJlZnJlc2hpbmcgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICBzdGF0ZS5yZWZyZXNoU3RhdGUoKTtcbiAgfSwgMCk7XG59O1xuXG5JbnB1dEhpc3RvcnkucHJvdG90eXBlLmNhblVuZG8gPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLmhpc3RvcnlQb2ludGVyID4gMTtcbn07XG5cbklucHV0SGlzdG9yeS5wcm90b3R5cGUuY2FuUmVkbyA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMuaGlzdG9yeVt0aGlzLmhpc3RvcnlQb2ludGVyICsgMV07XG59O1xuXG5JbnB1dEhpc3RvcnkucHJvdG90eXBlLnVuZG8gPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXM7XG4gIGlmIChzdGF0ZS5jYW5VbmRvKCkpIHtcbiAgICBpZiAoc3RhdGUubGFzdFN0YXRlKSB7XG4gICAgICBzdGF0ZS5sYXN0U3RhdGUucmVzdG9yZSgpO1xuICAgICAgc3RhdGUubGFzdFN0YXRlID0gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RhdGUuaGlzdG9yeVtzdGF0ZS5oaXN0b3J5UG9pbnRlcl0gPSBuZXcgSW5wdXRTdGF0ZShzdGF0ZS5zdXJmYWNlLCBzdGF0ZS5pbnB1dE1vZGUpO1xuICAgICAgc3RhdGUuaGlzdG9yeVstLXN0YXRlLmhpc3RvcnlQb2ludGVyXS5yZXN0b3JlKCk7XG4gICAgfVxuICB9XG4gIHN0YXRlLmhpc3RvcnlNb2RlID0gJ25vbmUnO1xuICBzdGF0ZS5zdXJmYWNlLmZvY3VzKHN0YXRlLmlucHV0TW9kZSk7XG4gIHN0YXRlLnJlZnJlc2hTdGF0ZSgpO1xufTtcblxuSW5wdXRIaXN0b3J5LnByb3RvdHlwZS5yZWRvID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc3RhdGUgPSB0aGlzO1xuICBpZiAoc3RhdGUuY2FuUmVkbygpKSB7XG4gICAgc3RhdGUuaGlzdG9yeVsrK3N0YXRlLmhpc3RvcnlQb2ludGVyXS5yZXN0b3JlKCk7XG4gIH1cblxuICBzdGF0ZS5oaXN0b3J5TW9kZSA9ICdub25lJztcbiAgc3RhdGUuc3VyZmFjZS5mb2N1cyhzdGF0ZS5pbnB1dE1vZGUpO1xuICBzdGF0ZS5yZWZyZXNoU3RhdGUoKTtcbn07XG5cbklucHV0SGlzdG9yeS5wcm90b3R5cGUuc2V0TW9kZSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICB2YXIgc3RhdGUgPSB0aGlzO1xuICBpZiAoc3RhdGUuaGlzdG9yeU1vZGUgIT09IHZhbHVlKSB7XG4gICAgc3RhdGUuaGlzdG9yeU1vZGUgPSB2YWx1ZTtcbiAgICBzdGF0ZS5zYXZlU3RhdGUoKTtcbiAgfVxuICBzdGF0ZS5yZWZyZXNoaW5nID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgc3RhdGUucmVmcmVzaFN0YXRlKCk7XG4gIH0sIDEpO1xufTtcblxuSW5wdXRIaXN0b3J5LnByb3RvdHlwZS5yZWZyZXNoU3RhdGUgPSBmdW5jdGlvbiAoaW5pdGlhbFN0YXRlKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXM7XG4gIHN0YXRlLmlucHV0U3RhdGUgPSBuZXcgSW5wdXRTdGF0ZShzdGF0ZS5zdXJmYWNlLCBzdGF0ZS5pbnB1dE1vZGUsIGluaXRpYWxTdGF0ZSk7XG4gIHN0YXRlLnJlZnJlc2hpbmcgPSBudWxsO1xufTtcblxuSW5wdXRIaXN0b3J5LnByb3RvdHlwZS5zYXZlU3RhdGUgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXM7XG4gIHZhciBjdXJyZW50ID0gc3RhdGUuaW5wdXRTdGF0ZSB8fCBuZXcgSW5wdXRTdGF0ZShzdGF0ZS5zdXJmYWNlLCBzdGF0ZS5pbnB1dE1vZGUpO1xuXG4gIGlmIChzdGF0ZS5oaXN0b3J5TW9kZSA9PT0gJ21vdmluZycpIHtcbiAgICBpZiAoIXN0YXRlLmxhc3RTdGF0ZSkge1xuICAgICAgc3RhdGUubGFzdFN0YXRlID0gY3VycmVudDtcbiAgICB9XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChzdGF0ZS5sYXN0U3RhdGUpIHtcbiAgICBpZiAoc3RhdGUuaGlzdG9yeVtzdGF0ZS5oaXN0b3J5UG9pbnRlciAtIDFdLnRleHQgIT09IHN0YXRlLmxhc3RTdGF0ZS50ZXh0KSB7XG4gICAgICBzdGF0ZS5oaXN0b3J5W3N0YXRlLmhpc3RvcnlQb2ludGVyKytdID0gc3RhdGUubGFzdFN0YXRlO1xuICAgIH1cbiAgICBzdGF0ZS5sYXN0U3RhdGUgPSBudWxsO1xuICB9XG4gIHN0YXRlLmhpc3Rvcnlbc3RhdGUuaGlzdG9yeVBvaW50ZXIrK10gPSBjdXJyZW50O1xuICBzdGF0ZS5oaXN0b3J5W3N0YXRlLmhpc3RvcnlQb2ludGVyICsgMV0gPSBudWxsO1xufTtcblxuZnVuY3Rpb24gaGFuZGxlQ3RybFlaIChzdGF0ZSwgZSkge1xuICB2YXIgaGFuZGxlZCA9IGZhbHNlO1xuICB2YXIga2V5Q29kZSA9IGUuY2hhckNvZGUgfHwgZS5rZXlDb2RlO1xuICB2YXIga2V5Q29kZUNoYXIgPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGtleUNvZGUpO1xuXG4gIGlmIChlLmN0cmxLZXkgfHwgZS5tZXRhS2V5KSB7XG4gICAgc3dpdGNoIChrZXlDb2RlQ2hhci50b0xvd2VyQ2FzZSgpKSB7XG4gICAgICBjYXNlICd5JzpcbiAgICAgICAgc3RhdGUucmVkbygpO1xuICAgICAgICBoYW5kbGVkID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgJ3onOlxuICAgICAgICBpZiAoZS5zaGlmdEtleSkge1xuICAgICAgICAgIHN0YXRlLnJlZG8oKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzdGF0ZS51bmRvKCk7XG4gICAgICAgIH1cbiAgICAgICAgaGFuZGxlZCA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIGlmIChoYW5kbGVkICYmIGUucHJldmVudERlZmF1bHQpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaGFuZGxlTW9kZUNoYW5nZSAoc3RhdGUsIGUpIHtcbiAgaWYgKGUuY3RybEtleSB8fCBlLm1ldGFLZXkpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICB2YXIga2V5Q29kZSA9IGUua2V5Q29kZTtcblxuICBpZiAoKGtleUNvZGUgPj0gMzMgJiYga2V5Q29kZSA8PSA0MCkgfHwgKGtleUNvZGUgPj0gNjMyMzIgJiYga2V5Q29kZSA8PSA2MzIzNSkpIHtcbiAgICBzdGF0ZS5zZXRNb2RlKCdtb3ZpbmcnKTtcbiAgfSBlbHNlIGlmIChrZXlDb2RlID09PSA4IHx8IGtleUNvZGUgPT09IDQ2IHx8IGtleUNvZGUgPT09IDEyNykge1xuICAgIHN0YXRlLnNldE1vZGUoJ2RlbGV0aW5nJyk7XG4gIH0gZWxzZSBpZiAoa2V5Q29kZSA9PT0gMTMpIHtcbiAgICBzdGF0ZS5zZXRNb2RlKCduZXdsaW5lcycpO1xuICB9IGVsc2UgaWYgKGtleUNvZGUgPT09IDI3KSB7XG4gICAgc3RhdGUuc2V0TW9kZSgnZXNjYXBlJyk7XG4gIH0gZWxzZSBpZiAoKGtleUNvZGUgPCAxNiB8fCBrZXlDb2RlID4gMjApICYmIGtleUNvZGUgIT09IDkxKSB7XG4gICAgc3RhdGUuc2V0TW9kZSgndHlwaW5nJyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaGFuZGxlUGFzdGUgKHN0YXRlKSB7XG4gIGlmIChzdGF0ZS5pbnB1dFN0YXRlICYmIHN0YXRlLmlucHV0U3RhdGUudGV4dCAhPT0gc3RhdGUuc3VyZmFjZS5yZWFkKHN0YXRlLmlucHV0TW9kZSkgJiYgc3RhdGUucmVmcmVzaGluZyA9PT0gbnVsbCkge1xuICAgIHN0YXRlLmhpc3RvcnlNb2RlID0gJ3Bhc3RlJztcbiAgICBzdGF0ZS5zYXZlU3RhdGUoKTtcbiAgICBzdGF0ZS5yZWZyZXNoU3RhdGUoKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBwcmV2ZW50Q3RybFlaIChlKSB7XG4gIHZhciBrZXlDb2RlID0gZS5jaGFyQ29kZSB8fCBlLmtleUNvZGU7XG4gIHZhciB5eiA9IGtleUNvZGUgPT09IDg5IHx8IGtleUNvZGUgPT09IDkwO1xuICB2YXIgY3RybCA9IGUuY3RybEtleSB8fCBlLm1ldGFLZXk7XG4gIGlmIChjdHJsICYmIHl6KSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gSW5wdXRIaXN0b3J5O1xuIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50O1xudmFyIGlzVmlzaWJsZUVsZW1lbnQgPSByZXF1aXJlKCcuL2lzVmlzaWJsZUVsZW1lbnQnKTtcbnZhciBmaXhFT0wgPSByZXF1aXJlKCcuL2ZpeEVPTCcpO1xudmFyIE1hcmtkb3duQ2h1bmtzID0gcmVxdWlyZSgnLi9tYXJrZG93bi9NYXJrZG93bkNodW5rcycpO1xudmFyIEh0bWxDaHVua3MgPSByZXF1aXJlKCcuL2h0bWwvSHRtbENodW5rcycpO1xudmFyIGNodW5rcyA9IHtcbiAgbWFya2Rvd246IE1hcmtkb3duQ2h1bmtzLFxuICBodG1sOiBIdG1sQ2h1bmtzLFxuICB3eXNpd3lnOiBIdG1sQ2h1bmtzXG59O1xuXG5mdW5jdGlvbiBJbnB1dFN0YXRlIChzdXJmYWNlLCBtb2RlLCBpbml0aWFsU3RhdGUpIHtcbiAgdGhpcy5tb2RlID0gbW9kZTtcbiAgdGhpcy5zdXJmYWNlID0gc3VyZmFjZTtcbiAgdGhpcy5pbml0aWFsU3RhdGUgPSBpbml0aWFsU3RhdGUgfHwgZmFsc2U7XG4gIHRoaXMuaW5pdCgpO1xufVxuXG5JbnB1dFN0YXRlLnByb3RvdHlwZS5pbml0ID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciBlbCA9IHNlbGYuc3VyZmFjZS5jdXJyZW50KHNlbGYubW9kZSk7XG4gIGlmICghaXNWaXNpYmxlRWxlbWVudChlbCkpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKCF0aGlzLmluaXRpYWxTdGF0ZSAmJiBkb2MuYWN0aXZlRWxlbWVudCAmJiBkb2MuYWN0aXZlRWxlbWVudCAhPT0gZWwpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgc2VsZi5zdXJmYWNlLnJlYWRTZWxlY3Rpb24oc2VsZik7XG4gIHNlbGYuc2Nyb2xsVG9wID0gZWwuc2Nyb2xsVG9wO1xuICBpZiAoIXNlbGYudGV4dCkge1xuICAgIHNlbGYudGV4dCA9IHNlbGYuc3VyZmFjZS5yZWFkKHNlbGYubW9kZSk7XG4gIH1cbn07XG5cbklucHV0U3RhdGUucHJvdG90eXBlLnNlbGVjdCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgZWwgPSBzZWxmLnN1cmZhY2UuY3VycmVudChzZWxmLm1vZGUpO1xuICBpZiAoIWlzVmlzaWJsZUVsZW1lbnQoZWwpKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIHNlbGYuc3VyZmFjZS53cml0ZVNlbGVjdGlvbihzZWxmKTtcbn07XG5cbklucHV0U3RhdGUucHJvdG90eXBlLnJlc3RvcmUgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIGVsID0gc2VsZi5zdXJmYWNlLmN1cnJlbnQoc2VsZi5tb2RlKTtcbiAgaWYgKHR5cGVvZiBzZWxmLnRleHQgPT09ICdzdHJpbmcnICYmIHNlbGYudGV4dCAhPT0gc2VsZi5zdXJmYWNlLnJlYWQoc2VsZi5tb2RlKSkge1xuICAgIHNlbGYuc3VyZmFjZS53cml0ZShzZWxmLm1vZGUsIHNlbGYudGV4dCk7XG4gIH1cbiAgc2VsZi5zZWxlY3QoKTtcbiAgZWwuc2Nyb2xsVG9wID0gc2VsZi5zY3JvbGxUb3A7XG59O1xuXG5JbnB1dFN0YXRlLnByb3RvdHlwZS5nZXRDaHVua3MgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIGNodW5rID0gbmV3IGNodW5rc1tzZWxmLm1vZGVdKCk7XG4gIGNodW5rLmJlZm9yZSA9IGZpeEVPTChzZWxmLnRleHQuc3Vic3RyaW5nKDAsIHNlbGYuc3RhcnQpKTtcbiAgY2h1bmsuc3RhcnRUYWcgPSAnJztcbiAgY2h1bmsuc2VsZWN0aW9uID0gZml4RU9MKHNlbGYudGV4dC5zdWJzdHJpbmcoc2VsZi5zdGFydCwgc2VsZi5lbmQpKTtcbiAgY2h1bmsuZW5kVGFnID0gJyc7XG4gIGNodW5rLmFmdGVyID0gZml4RU9MKHNlbGYudGV4dC5zdWJzdHJpbmcoc2VsZi5lbmQpKTtcbiAgY2h1bmsuc2Nyb2xsVG9wID0gc2VsZi5zY3JvbGxUb3A7XG4gIHNlbGYuY2FjaGVkQ2h1bmtzID0gY2h1bms7XG4gIHJldHVybiBjaHVuaztcbn07XG5cbklucHV0U3RhdGUucHJvdG90eXBlLnNldENodW5rcyA9IGZ1bmN0aW9uIChjaHVuaykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIGNodW5rLmJlZm9yZSA9IGNodW5rLmJlZm9yZSArIGNodW5rLnN0YXJ0VGFnO1xuICBjaHVuay5hZnRlciA9IGNodW5rLmVuZFRhZyArIGNodW5rLmFmdGVyO1xuICBzZWxmLnN0YXJ0ID0gY2h1bmsuYmVmb3JlLmxlbmd0aDtcbiAgc2VsZi5lbmQgPSBjaHVuay5iZWZvcmUubGVuZ3RoICsgY2h1bmsuc2VsZWN0aW9uLmxlbmd0aDtcbiAgc2VsZi50ZXh0ID0gY2h1bmsuYmVmb3JlICsgY2h1bmsuc2VsZWN0aW9uICsgY2h1bmsuYWZ0ZXI7XG4gIHNlbGYuc2Nyb2xsVG9wID0gY2h1bmsuc2Nyb2xsVG9wO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBJbnB1dFN0YXRlO1xuXG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSlcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0OnV0Zi04O2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKemIzVnlZMlZ6SWpwYkluTnlZeTlKYm5CMWRGTjBZWFJsTG1weklsMHNJbTVoYldWeklqcGJYU3dpYldGd2NHbHVaM01pT2lJN1FVRkJRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJJaXdpWm1sc1pTSTZJbWRsYm1WeVlYUmxaQzVxY3lJc0luTnZkWEpqWlZKdmIzUWlPaUlpTENKemIzVnlZMlZ6UTI5dWRHVnVkQ0k2V3lJbmRYTmxJSE4wY21samRDYzdYRzVjYm5aaGNpQmtiMk1nUFNCbmJHOWlZV3d1Wkc5amRXMWxiblE3WEc1MllYSWdhWE5XYVhOcFlteGxSV3hsYldWdWRDQTlJSEpsY1hWcGNtVW9KeTR2YVhOV2FYTnBZbXhsUld4bGJXVnVkQ2NwTzF4dWRtRnlJR1pwZUVWUFRDQTlJSEpsY1hWcGNtVW9KeTR2Wm1sNFJVOU1KeWs3WEc1MllYSWdUV0Z5YTJSdmQyNURhSFZ1YTNNZ1BTQnlaWEYxYVhKbEtDY3VMMjFoY210a2IzZHVMMDFoY210a2IzZHVRMmgxYm10ekp5azdYRzUyWVhJZ1NIUnRiRU5vZFc1cmN5QTlJSEpsY1hWcGNtVW9KeTR2YUhSdGJDOUlkRzFzUTJoMWJtdHpKeWs3WEc1MllYSWdZMmgxYm10eklEMGdlMXh1SUNCdFlYSnJaRzkzYmpvZ1RXRnlhMlJ2ZDI1RGFIVnVhM01zWEc0Z0lHaDBiV3c2SUVoMGJXeERhSFZ1YTNNc1hHNGdJSGQ1YzJsM2VXYzZJRWgwYld4RGFIVnVhM05jYm4wN1hHNWNibVoxYm1OMGFXOXVJRWx1Y0hWMFUzUmhkR1VnS0hOMWNtWmhZMlVzSUcxdlpHVXNJR2x1YVhScFlXeFRkR0YwWlNrZ2UxeHVJQ0IwYUdsekxtMXZaR1VnUFNCdGIyUmxPMXh1SUNCMGFHbHpMbk4xY21aaFkyVWdQU0J6ZFhKbVlXTmxPMXh1SUNCMGFHbHpMbWx1YVhScFlXeFRkR0YwWlNBOUlHbHVhWFJwWVd4VGRHRjBaU0I4ZkNCbVlXeHpaVHRjYmlBZ2RHaHBjeTVwYm1sMEtDazdYRzU5WEc1Y2JrbHVjSFYwVTNSaGRHVXVjSEp2ZEc5MGVYQmxMbWx1YVhRZ1BTQm1kVzVqZEdsdmJpQW9LU0I3WEc0Z0lIWmhjaUJ6Wld4bUlEMGdkR2hwY3p0Y2JpQWdkbUZ5SUdWc0lEMGdjMlZzWmk1emRYSm1ZV05sTG1OMWNuSmxiblFvYzJWc1ppNXRiMlJsS1R0Y2JpQWdhV1lnS0NGcGMxWnBjMmxpYkdWRmJHVnRaVzUwS0dWc0tTa2dlMXh1SUNBZ0lISmxkSFZ5Ymp0Y2JpQWdmVnh1SUNCcFppQW9JWFJvYVhNdWFXNXBkR2xoYkZOMFlYUmxJQ1ltSUdSdll5NWhZM1JwZG1WRmJHVnRaVzUwSUNZbUlHUnZZeTVoWTNScGRtVkZiR1Z0Wlc1MElDRTlQU0JsYkNrZ2UxeHVJQ0FnSUhKbGRIVnlianRjYmlBZ2ZWeHVJQ0J6Wld4bUxuTjFjbVpoWTJVdWNtVmhaRk5sYkdWamRHbHZiaWh6Wld4bUtUdGNiaUFnYzJWc1ppNXpZM0p2Ykd4VWIzQWdQU0JsYkM1elkzSnZiR3hVYjNBN1hHNGdJR2xtSUNnaGMyVnNaaTUwWlhoMEtTQjdYRzRnSUNBZ2MyVnNaaTUwWlhoMElEMGdjMlZzWmk1emRYSm1ZV05sTG5KbFlXUW9jMlZzWmk1dGIyUmxLVHRjYmlBZ2ZWeHVmVHRjYmx4dVNXNXdkWFJUZEdGMFpTNXdjbTkwYjNSNWNHVXVjMlZzWldOMElEMGdablZ1WTNScGIyNGdLQ2tnZTF4dUlDQjJZWElnYzJWc1ppQTlJSFJvYVhNN1hHNGdJSFpoY2lCbGJDQTlJSE5sYkdZdWMzVnlabUZqWlM1amRYSnlaVzUwS0hObGJHWXViVzlrWlNrN1hHNGdJR2xtSUNnaGFYTldhWE5wWW14bFJXeGxiV1Z1ZENobGJDa3BJSHRjYmlBZ0lDQnlaWFIxY200N1hHNGdJSDFjYmlBZ2MyVnNaaTV6ZFhKbVlXTmxMbmR5YVhSbFUyVnNaV04wYVc5dUtITmxiR1lwTzF4dWZUdGNibHh1U1c1d2RYUlRkR0YwWlM1d2NtOTBiM1I1Y0dVdWNtVnpkRzl5WlNBOUlHWjFibU4wYVc5dUlDZ3BJSHRjYmlBZ2RtRnlJSE5sYkdZZ1BTQjBhR2x6TzF4dUlDQjJZWElnWld3Z1BTQnpaV3htTG5OMWNtWmhZMlV1WTNWeWNtVnVkQ2h6Wld4bUxtMXZaR1VwTzF4dUlDQnBaaUFvZEhsd1pXOW1JSE5sYkdZdWRHVjRkQ0E5UFQwZ0ozTjBjbWx1WnljZ0ppWWdjMlZzWmk1MFpYaDBJQ0U5UFNCelpXeG1Mbk4xY21aaFkyVXVjbVZoWkNoelpXeG1MbTF2WkdVcEtTQjdYRzRnSUNBZ2MyVnNaaTV6ZFhKbVlXTmxMbmR5YVhSbEtITmxiR1l1Ylc5a1pTd2djMlZzWmk1MFpYaDBLVHRjYmlBZ2ZWeHVJQ0J6Wld4bUxuTmxiR1ZqZENncE8xeHVJQ0JsYkM1elkzSnZiR3hVYjNBZ1BTQnpaV3htTG5OamNtOXNiRlJ2Y0R0Y2JuMDdYRzVjYmtsdWNIVjBVM1JoZEdVdWNISnZkRzkwZVhCbExtZGxkRU5vZFc1cmN5QTlJR1oxYm1OMGFXOXVJQ2dwSUh0Y2JpQWdkbUZ5SUhObGJHWWdQU0IwYUdsek8xeHVJQ0IyWVhJZ1kyaDFibXNnUFNCdVpYY2dZMmgxYm10elczTmxiR1l1Ylc5a1pWMG9LVHRjYmlBZ1kyaDFibXN1WW1WbWIzSmxJRDBnWm1sNFJVOU1LSE5sYkdZdWRHVjRkQzV6ZFdKemRISnBibWNvTUN3Z2MyVnNaaTV6ZEdGeWRDa3BPMXh1SUNCamFIVnVheTV6ZEdGeWRGUmhaeUE5SUNjbk8xeHVJQ0JqYUhWdWF5NXpaV3hsWTNScGIyNGdQU0JtYVhoRlQwd29jMlZzWmk1MFpYaDBMbk4xWW5OMGNtbHVaeWh6Wld4bUxuTjBZWEowTENCelpXeG1MbVZ1WkNrcE8xeHVJQ0JqYUhWdWF5NWxibVJVWVdjZ1BTQW5KenRjYmlBZ1kyaDFibXN1WVdaMFpYSWdQU0JtYVhoRlQwd29jMlZzWmk1MFpYaDBMbk4xWW5OMGNtbHVaeWh6Wld4bUxtVnVaQ2twTzF4dUlDQmphSFZ1YXk1elkzSnZiR3hVYjNBZ1BTQnpaV3htTG5OamNtOXNiRlJ2Y0R0Y2JpQWdjMlZzWmk1allXTm9aV1JEYUhWdWEzTWdQU0JqYUhWdWF6dGNiaUFnY21WMGRYSnVJR05vZFc1ck8xeHVmVHRjYmx4dVNXNXdkWFJUZEdGMFpTNXdjbTkwYjNSNWNHVXVjMlYwUTJoMWJtdHpJRDBnWm5WdVkzUnBiMjRnS0dOb2RXNXJLU0I3WEc0Z0lIWmhjaUJ6Wld4bUlEMGdkR2hwY3p0Y2JpQWdZMmgxYm1zdVltVm1iM0psSUQwZ1kyaDFibXN1WW1WbWIzSmxJQ3NnWTJoMWJtc3VjM1JoY25SVVlXYzdYRzRnSUdOb2RXNXJMbUZtZEdWeUlEMGdZMmgxYm1zdVpXNWtWR0ZuSUNzZ1kyaDFibXN1WVdaMFpYSTdYRzRnSUhObGJHWXVjM1JoY25RZ1BTQmphSFZ1YXk1aVpXWnZjbVV1YkdWdVozUm9PMXh1SUNCelpXeG1MbVZ1WkNBOUlHTm9kVzVyTG1KbFptOXlaUzVzWlc1bmRHZ2dLeUJqYUhWdWF5NXpaV3hsWTNScGIyNHViR1Z1WjNSb08xeHVJQ0J6Wld4bUxuUmxlSFFnUFNCamFIVnVheTVpWldadmNtVWdLeUJqYUhWdWF5NXpaV3hsWTNScGIyNGdLeUJqYUhWdWF5NWhablJsY2p0Y2JpQWdjMlZzWmk1elkzSnZiR3hVYjNBZ1BTQmphSFZ1YXk1elkzSnZiR3hVYjNBN1hHNTlPMXh1WEc1dGIyUjFiR1V1Wlhod2IzSjBjeUE5SUVsdWNIVjBVM1JoZEdVN1hHNGlYWDA9IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgY3Jvc3N2ZW50ID0gcmVxdWlyZSgnY3Jvc3N2ZW50Jyk7XG52YXIgY29tbWFuZHMgPSB7XG4gIG1hcmtkb3duOiB7XG4gICAgYm9sZE9ySXRhbGljOiByZXF1aXJlKCcuL21hcmtkb3duL2JvbGRPckl0YWxpYycpLFxuICAgIGxpbmtPckltYWdlT3JBdHRhY2htZW50OiByZXF1aXJlKCcuL21hcmtkb3duL2xpbmtPckltYWdlT3JBdHRhY2htZW50JyksXG4gICAgYmxvY2txdW90ZTogcmVxdWlyZSgnLi9tYXJrZG93bi9ibG9ja3F1b3RlJyksXG4gICAgY29kZWJsb2NrOiByZXF1aXJlKCcuL21hcmtkb3duL2NvZGVibG9jaycpLFxuICAgIGhlYWRpbmc6IHJlcXVpcmUoJy4vbWFya2Rvd24vaGVhZGluZycpLFxuICAgIGxpc3Q6IHJlcXVpcmUoJy4vbWFya2Rvd24vbGlzdCcpLFxuICAgIGhyOiByZXF1aXJlKCcuL21hcmtkb3duL2hyJylcbiAgfSxcbiAgaHRtbDoge1xuICAgIGJvbGRPckl0YWxpYzogcmVxdWlyZSgnLi9odG1sL2JvbGRPckl0YWxpYycpLFxuICAgIGxpbmtPckltYWdlT3JBdHRhY2htZW50OiByZXF1aXJlKCcuL2h0bWwvbGlua09ySW1hZ2VPckF0dGFjaG1lbnQnKSxcbiAgICBibG9ja3F1b3RlOiByZXF1aXJlKCcuL2h0bWwvYmxvY2txdW90ZScpLFxuICAgIGNvZGVibG9jazogcmVxdWlyZSgnLi9odG1sL2NvZGVibG9jaycpLFxuICAgIGhlYWRpbmc6IHJlcXVpcmUoJy4vaHRtbC9oZWFkaW5nJyksXG4gICAgbGlzdDogcmVxdWlyZSgnLi9odG1sL2xpc3QnKSxcbiAgICBocjogcmVxdWlyZSgnLi9odG1sL2hyJylcbiAgfVxufTtcblxuY29tbWFuZHMud3lzaXd5ZyA9IGNvbW1hbmRzLmh0bWw7XG5cbmZ1bmN0aW9uIGJpbmRDb21tYW5kcyAoc3VyZmFjZSwgb3B0aW9ucywgZWRpdG9yKSB7XG4gIGJpbmQoJ2JvbGQnLCAnY21kK2InLCBib2xkKTtcbiAgYmluZCgnaXRhbGljJywgJ2NtZCtpJywgaXRhbGljKTtcbiAgYmluZCgncXVvdGUnLCAnY21kK2onLCByb3V0ZXIoJ2Jsb2NrcXVvdGUnKSk7XG4gIGJpbmQoJ2NvZGUnLCAnY21kK2UnLCBjb2RlKTtcbiAgYmluZCgnb2wnLCAnY21kK28nLCBvbCk7XG4gIGJpbmQoJ3VsJywgJ2NtZCt1JywgdWwpO1xuICBiaW5kKCdoZWFkaW5nJywgJ2NtZCtkJywgcm91dGVyKCdoZWFkaW5nJykpO1xuICBlZGl0b3Iuc2hvd0xpbmtEaWFsb2cgPSBmYWJyaWNhdG9yKGJpbmQoJ2xpbmsnLCAnY21kK2snLCBsaW5rT3JJbWFnZU9yQXR0YWNobWVudCgnbGluaycpKSk7XG4gIGVkaXRvci5zaG93SW1hZ2VEaWFsb2cgPSBmYWJyaWNhdG9yKGJpbmQoJ2ltYWdlJywgJ2NtZCtnJywgbGlua09ySW1hZ2VPckF0dGFjaG1lbnQoJ2ltYWdlJykpKTtcbiAgZWRpdG9yLmxpbmtPckltYWdlT3JBdHRhY2htZW50ID0gbGlua09ySW1hZ2VPckF0dGFjaG1lbnQ7XG5cbiAgaWYgKG9wdGlvbnMuYXR0YWNobWVudHMpIHtcbiAgICBlZGl0b3Iuc2hvd0F0dGFjaG1lbnREaWFsb2cgPSBmYWJyaWNhdG9yKGJpbmQoJ2F0dGFjaG1lbnQnLCAnY21kK3NoaWZ0K2snLCBsaW5rT3JJbWFnZU9yQXR0YWNobWVudCgnYXR0YWNobWVudCcpKSk7XG4gIH1cbiAgaWYgKG9wdGlvbnMuaHIpIHsgYmluZCgnaHInLCAnY21kK24nLCByb3V0ZXIoJ2hyJykpOyB9XG5cbiAgZnVuY3Rpb24gZmFicmljYXRvciAoZWwpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gb3BlbiAoKSB7XG4gICAgICBjcm9zc3ZlbnQuZmFicmljYXRlKGVsLCAnY2xpY2snKTtcbiAgICB9O1xuICB9XG4gIGZ1bmN0aW9uIGJvbGQgKG1vZGUsIGNodW5rcykge1xuICAgIGNvbW1hbmRzW21vZGVdLmJvbGRPckl0YWxpYyhjaHVua3MsICdib2xkJyk7XG4gIH1cbiAgZnVuY3Rpb24gaXRhbGljIChtb2RlLCBjaHVua3MpIHtcbiAgICBjb21tYW5kc1ttb2RlXS5ib2xkT3JJdGFsaWMoY2h1bmtzLCAnaXRhbGljJyk7XG4gIH1cbiAgZnVuY3Rpb24gY29kZSAobW9kZSwgY2h1bmtzKSB7XG4gICAgY29tbWFuZHNbbW9kZV0uY29kZWJsb2NrKGNodW5rcywgeyBmZW5jaW5nOiBvcHRpb25zLmZlbmNpbmcgfSk7XG4gIH1cbiAgZnVuY3Rpb24gdWwgKG1vZGUsIGNodW5rcykge1xuICAgIGNvbW1hbmRzW21vZGVdLmxpc3QoY2h1bmtzLCBmYWxzZSk7XG4gIH1cbiAgZnVuY3Rpb24gb2wgKG1vZGUsIGNodW5rcykge1xuICAgIGNvbW1hbmRzW21vZGVdLmxpc3QoY2h1bmtzLCB0cnVlKTtcbiAgfVxuICBmdW5jdGlvbiBsaW5rT3JJbWFnZU9yQXR0YWNobWVudCAodHlwZSwgYXV0b1VwbG9hZCkge1xuICAgIHJldHVybiBmdW5jdGlvbiBsaW5rT3JJbWFnZU9yQXR0YWNobWVudEludm9rZSAobW9kZSwgY2h1bmtzKSB7XG4gICAgICBjb21tYW5kc1ttb2RlXS5saW5rT3JJbWFnZU9yQXR0YWNobWVudC5jYWxsKHRoaXMsIGNodW5rcywge1xuICAgICAgICBlZGl0b3I6IGVkaXRvcixcbiAgICAgICAgbW9kZTogbW9kZSxcbiAgICAgICAgdHlwZTogdHlwZSxcbiAgICAgICAgc3VyZmFjZTogc3VyZmFjZSxcbiAgICAgICAgcHJvbXB0czogb3B0aW9ucy5wcm9tcHRzLFxuICAgICAgICB4aHI6IG9wdGlvbnMueGhyLFxuICAgICAgICB1cGxvYWQ6IG9wdGlvbnNbdHlwZSArICdzJ10sXG4gICAgICAgIGNsYXNzZXM6IG9wdGlvbnMuY2xhc3NlcyxcbiAgICAgICAgbWVyZ2VIdG1sQW5kQXR0YWNobWVudDogb3B0aW9ucy5tZXJnZUh0bWxBbmRBdHRhY2htZW50LFxuICAgICAgICBhdXRvVXBsb2FkOiBhdXRvVXBsb2FkXG4gICAgICB9KTtcbiAgICB9O1xuICB9XG4gIGZ1bmN0aW9uIGJpbmQgKGlkLCBjb21ibywgZm4pIHtcbiAgICByZXR1cm4gZWRpdG9yLmFkZENvbW1hbmRCdXR0b24oaWQsIGNvbWJvLCBzdXBwcmVzcyhmbikpO1xuICB9XG4gIGZ1bmN0aW9uIHJvdXRlciAobWV0aG9kKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIHJvdXRlZCAobW9kZSwgY2h1bmtzKSB7IGNvbW1hbmRzW21vZGVdW21ldGhvZF0uY2FsbCh0aGlzLCBjaHVua3MpOyB9O1xuICB9XG4gIGZ1bmN0aW9uIHN0b3AgKGUpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7IGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gIH1cbiAgZnVuY3Rpb24gc3VwcHJlc3MgKGZuKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIHN1cHByZXNzb3IgKGUsIG1vZGUsIGNodW5rcykgeyBzdG9wKGUpOyBmbi5jYWxsKHRoaXMsIG1vZGUsIGNodW5rcyk7IH07XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBiaW5kQ29tbWFuZHM7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGNhc3QgKGNvbGxlY3Rpb24pIHtcbiAgdmFyIHJlc3VsdCA9IFtdO1xuICB2YXIgaTtcbiAgdmFyIGxlbiA9IGNvbGxlY3Rpb24ubGVuZ3RoO1xuICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICByZXN1bHQucHVzaChjb2xsZWN0aW9uW2ldKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNhc3Q7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciByaW5wdXQgPSAvXlxccyooLio/KSg/OlxccytcIiguKylcIik/XFxzKiQvO1xudmFyIHJmdWxsID0gL14oPzpodHRwcz98ZnRwKTpcXC9cXC8vO1xuXG5mdW5jdGlvbiBwYXJzZUxpbmtJbnB1dCAoaW5wdXQpIHtcbiAgcmV0dXJuIHBhcnNlci5hcHBseShudWxsLCBpbnB1dC5tYXRjaChyaW5wdXQpKTtcblxuICBmdW5jdGlvbiBwYXJzZXIgKGFsbCwgbGluaywgdGl0bGUpIHtcbiAgICB2YXIgaHJlZiA9IGxpbmsucmVwbGFjZSgvXFw/LiokLywgcXVlcnlVbmVuY29kZWRSZXBsYWNlcik7XG4gICAgaHJlZiA9IGRlY29kZVVSSUNvbXBvbmVudChocmVmKTtcbiAgICBocmVmID0gZW5jb2RlVVJJKGhyZWYpLnJlcGxhY2UoLycvZywgJyUyNycpLnJlcGxhY2UoL1xcKC9nLCAnJTI4JykucmVwbGFjZSgvXFwpL2csICclMjknKTtcbiAgICBocmVmID0gaHJlZi5yZXBsYWNlKC9cXD8uKiQvLCBxdWVyeUVuY29kZWRSZXBsYWNlcik7XG5cbiAgICByZXR1cm4ge1xuICAgICAgaHJlZjogZm9ybWF0SHJlZihocmVmKSwgdGl0bGU6IGZvcm1hdFRpdGxlKHRpdGxlKVxuICAgIH07XG4gIH1cbn1cblxuZnVuY3Rpb24gcXVlcnlVbmVuY29kZWRSZXBsYWNlciAocXVlcnkpIHtcbiAgcmV0dXJuIHF1ZXJ5LnJlcGxhY2UoL1xcKy9nLCAnICcpO1xufVxuXG5mdW5jdGlvbiBxdWVyeUVuY29kZWRSZXBsYWNlciAocXVlcnkpIHtcbiAgcmV0dXJuIHF1ZXJ5LnJlcGxhY2UoL1xcKy9nLCAnJTJiJyk7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdFRpdGxlICh0aXRsZSkge1xuICBpZiAoIXRpdGxlKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICByZXR1cm4gdGl0bGVcbiAgICAucmVwbGFjZSgvXlxccyt8XFxzKyQvZywgJycpXG4gICAgLnJlcGxhY2UoL1wiL2csICcmcXVvdDsnKVxuICAgIC5yZXBsYWNlKC88L2csICcmbHQ7JylcbiAgICAucmVwbGFjZSgvPi9nLCAnJmd0OycpO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRIcmVmICh1cmwpIHtcbiAgdmFyIGhyZWYgPSB1cmwucmVwbGFjZSgvXlxccyt8XFxzKyQvZywgJycpO1xuICBpZiAoaHJlZi5sZW5ndGggJiYgaHJlZlswXSAhPT0gJy8nICYmICFyZnVsbC50ZXN0KGhyZWYpKSB7XG4gICAgcmV0dXJuICdodHRwOi8vJyArIGhyZWY7XG4gIH1cbiAgcmV0dXJuIGhyZWY7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gcGFyc2VMaW5rSW5wdXQ7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIHRyaW0gKHJlbW92ZSkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgaWYgKHJlbW92ZSkge1xuICAgIGJlZm9yZVJlcGxhY2VyID0gYWZ0ZXJSZXBsYWNlciA9ICcnO1xuICB9XG4gIHNlbGYuc2VsZWN0aW9uID0gc2VsZi5zZWxlY3Rpb24ucmVwbGFjZSgvXihcXHMqKS8sIGJlZm9yZVJlcGxhY2VyKS5yZXBsYWNlKC8oXFxzKikkLywgYWZ0ZXJSZXBsYWNlcik7XG5cbiAgZnVuY3Rpb24gYmVmb3JlUmVwbGFjZXIgKHRleHQpIHtcbiAgICBzZWxmLmJlZm9yZSArPSB0ZXh0OyByZXR1cm4gJyc7XG4gIH1cbiAgZnVuY3Rpb24gYWZ0ZXJSZXBsYWNlciAodGV4dCkge1xuICAgIHNlbGYuYWZ0ZXIgPSB0ZXh0ICsgc2VsZi5hZnRlcjsgcmV0dXJuICcnO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gdHJpbTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHJ0cmltID0gL15cXHMrfFxccyskL2c7XG52YXIgcnNwYWNlcyA9IC9cXHMrL2c7XG5cbmZ1bmN0aW9uIGFkZENsYXNzIChlbCwgY2xzKSB7XG4gIHZhciBjdXJyZW50ID0gZWwuY2xhc3NOYW1lO1xuICBpZiAoY3VycmVudC5pbmRleE9mKGNscykgPT09IC0xKSB7XG4gICAgZWwuY2xhc3NOYW1lID0gKGN1cnJlbnQgKyAnICcgKyBjbHMpLnJlcGxhY2UocnRyaW0sICcnKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBybUNsYXNzIChlbCwgY2xzKSB7XG4gIGVsLmNsYXNzTmFtZSA9IGVsLmNsYXNzTmFtZS5yZXBsYWNlKGNscywgJycpLnJlcGxhY2UocnRyaW0sICcnKS5yZXBsYWNlKHJzcGFjZXMsICcgJyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBhZGQ6IGFkZENsYXNzLFxuICBybTogcm1DbGFzc1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gZXh0ZW5kUmVnRXhwIChyZWdleCwgcHJlLCBwb3N0KSB7XG4gIHZhciBwYXR0ZXJuID0gcmVnZXgudG9TdHJpbmcoKTtcbiAgdmFyIGZsYWdzO1xuXG4gIHBhdHRlcm4gPSBwYXR0ZXJuLnJlcGxhY2UoL1xcLyhbZ2ltXSopJC8sIGNhcHR1cmVGbGFncyk7XG4gIHBhdHRlcm4gPSBwYXR0ZXJuLnJlcGxhY2UoLyheXFwvfFxcLyQpL2csICcnKTtcbiAgcGF0dGVybiA9IHByZSArIHBhdHRlcm4gKyBwb3N0O1xuICByZXR1cm4gbmV3IFJlZ0V4cChwYXR0ZXJuLCBmbGFncyk7XG5cbiAgZnVuY3Rpb24gY2FwdHVyZUZsYWdzIChhbGwsIGYpIHtcbiAgICBmbGFncyA9IGY7XG4gICAgcmV0dXJuICcnO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZXh0ZW5kUmVnRXhwO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBmaXhFT0wgKHRleHQpIHtcbiAgcmV0dXJuIHRleHQucmVwbGFjZSgvXFxyXFxuL2csICdcXG4nKS5yZXBsYWNlKC9cXHIvZywgJ1xcbicpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZpeEVPTDtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIElucHV0U3RhdGUgPSByZXF1aXJlKCcuL0lucHV0U3RhdGUnKTtcblxuZnVuY3Rpb24gZ2V0Q29tbWFuZEhhbmRsZXIgKHN1cmZhY2UsIGhpc3RvcnksIGZuKSB7XG4gIHJldHVybiBmdW5jdGlvbiBoYW5kbGVDb21tYW5kIChlKSB7XG4gICAgc3VyZmFjZS5mb2N1cyhoaXN0b3J5LmlucHV0TW9kZSk7XG4gICAgaGlzdG9yeS5zZXRDb21tYW5kTW9kZSgpO1xuXG4gICAgdmFyIHN0YXRlID0gbmV3IElucHV0U3RhdGUoc3VyZmFjZSwgaGlzdG9yeS5pbnB1dE1vZGUpO1xuICAgIHZhciBjaHVua3MgPSBzdGF0ZS5nZXRDaHVua3MoKTtcbiAgICB2YXIgYXN5bmNIYW5kbGVyID0ge1xuICAgICAgYXN5bmM6IGFzeW5jLCBpbW1lZGlhdGU6IHRydWVcbiAgICB9O1xuXG4gICAgZm4uY2FsbChhc3luY0hhbmRsZXIsIGUsIGhpc3RvcnkuaW5wdXRNb2RlLCBjaHVua3MpO1xuXG4gICAgaWYgKGFzeW5jSGFuZGxlci5pbW1lZGlhdGUpIHtcbiAgICAgIGRvbmUoKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhc3luYyAoKSB7XG4gICAgICBhc3luY0hhbmRsZXIuaW1tZWRpYXRlID0gZmFsc2U7XG4gICAgICByZXR1cm4gZG9uZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkb25lICgpIHtcbiAgICAgIHN1cmZhY2UuZm9jdXMoaGlzdG9yeS5pbnB1dE1vZGUpO1xuICAgICAgc3RhdGUuc2V0Q2h1bmtzKGNodW5rcyk7XG4gICAgICBzdGF0ZS5yZXN0b3JlKCk7XG4gICAgfVxuICB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGdldENvbW1hbmRIYW5kbGVyO1xuIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50O1xudmFyIHNlbGVjY2lvbiA9IHJlcXVpcmUoJ3NlbGVjY2lvbicpO1xudmFyIGZpeEVPTCA9IHJlcXVpcmUoJy4vZml4RU9MJyk7XG52YXIgbWFueSA9IHJlcXVpcmUoJy4vbWFueScpO1xudmFyIGNhc3QgPSByZXF1aXJlKCcuL2Nhc3QnKTtcbnZhciBnZXRTZWxlY3Rpb24gPSBzZWxlY2Npb24uZ2V0O1xudmFyIHNldFNlbGVjdGlvbiA9IHNlbGVjY2lvbi5zZXQ7XG52YXIgcm9wZW4gPSAvXig8W14+XSsoPzogW14+XSopPz4pLztcbnZhciByY2xvc2UgPSAvKDxcXC9bXj5dKz4pJC87XG5cbmZ1bmN0aW9uIHN1cmZhY2UgKHRleHRhcmVhLCBlZGl0YWJsZSwgZHJvcGFyZWEpIHtcbiAgcmV0dXJuIHtcbiAgICB0ZXh0YXJlYTogdGV4dGFyZWEsXG4gICAgZWRpdGFibGU6IGVkaXRhYmxlLFxuICAgIGRyb3BhcmVhOiBkcm9wYXJlYSxcbiAgICBmb2N1czogc2V0Rm9jdXMsXG4gICAgcmVhZDogcmVhZCxcbiAgICB3cml0ZTogd3JpdGUsXG4gICAgY3VycmVudDogY3VycmVudCxcbiAgICB3cml0ZVNlbGVjdGlvbjogd3JpdGVTZWxlY3Rpb24sXG4gICAgcmVhZFNlbGVjdGlvbjogcmVhZFNlbGVjdGlvblxuICB9O1xuXG4gIGZ1bmN0aW9uIHNldEZvY3VzIChtb2RlKSB7XG4gICAgY3VycmVudChtb2RlKS5mb2N1cygpO1xuICB9XG5cbiAgZnVuY3Rpb24gY3VycmVudCAobW9kZSkge1xuICAgIHJldHVybiBtb2RlID09PSAnd3lzaXd5ZycgPyBlZGl0YWJsZSA6IHRleHRhcmVhO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVhZCAobW9kZSkge1xuICAgIGlmIChtb2RlID09PSAnd3lzaXd5ZycpIHtcbiAgICAgIHJldHVybiBlZGl0YWJsZS5pbm5lckhUTUw7XG4gICAgfVxuICAgIHJldHVybiB0ZXh0YXJlYS52YWx1ZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHdyaXRlIChtb2RlLCB2YWx1ZSkge1xuICAgIGlmIChtb2RlID09PSAnd3lzaXd5ZycpIHtcbiAgICAgIGVkaXRhYmxlLmlubmVySFRNTCA9IHZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0ZXh0YXJlYS52YWx1ZSA9IHZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHdyaXRlU2VsZWN0aW9uIChzdGF0ZSkge1xuICAgIGlmIChzdGF0ZS5tb2RlID09PSAnd3lzaXd5ZycpIHtcbiAgICAgIHdyaXRlU2VsZWN0aW9uRWRpdGFibGUoc3RhdGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICB3cml0ZVNlbGVjdGlvblRleHRhcmVhKHN0YXRlKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZWFkU2VsZWN0aW9uIChzdGF0ZSkge1xuICAgIGlmIChzdGF0ZS5tb2RlID09PSAnd3lzaXd5ZycpIHtcbiAgICAgIHJlYWRTZWxlY3Rpb25FZGl0YWJsZShzdGF0ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlYWRTZWxlY3Rpb25UZXh0YXJlYShzdGF0ZSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gd3JpdGVTZWxlY3Rpb25UZXh0YXJlYSAoc3RhdGUpIHtcbiAgICB2YXIgcmFuZ2U7XG4gICAgaWYgKHRleHRhcmVhLnNlbGVjdGlvblN0YXJ0ICE9PSB2b2lkIDApIHtcbiAgICAgIHRleHRhcmVhLmZvY3VzKCk7XG4gICAgICB0ZXh0YXJlYS5zZWxlY3Rpb25TdGFydCA9IHN0YXRlLnN0YXJ0O1xuICAgICAgdGV4dGFyZWEuc2VsZWN0aW9uRW5kID0gc3RhdGUuZW5kO1xuICAgICAgdGV4dGFyZWEuc2Nyb2xsVG9wID0gc3RhdGUuc2Nyb2xsVG9wO1xuICAgIH0gZWxzZSBpZiAoZG9jLnNlbGVjdGlvbikge1xuICAgICAgaWYgKGRvYy5hY3RpdmVFbGVtZW50ICYmIGRvYy5hY3RpdmVFbGVtZW50ICE9PSB0ZXh0YXJlYSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0ZXh0YXJlYS5mb2N1cygpO1xuICAgICAgcmFuZ2UgPSB0ZXh0YXJlYS5jcmVhdGVUZXh0UmFuZ2UoKTtcbiAgICAgIHJhbmdlLm1vdmVTdGFydCgnY2hhcmFjdGVyJywgLXRleHRhcmVhLnZhbHVlLmxlbmd0aCk7XG4gICAgICByYW5nZS5tb3ZlRW5kKCdjaGFyYWN0ZXInLCAtdGV4dGFyZWEudmFsdWUubGVuZ3RoKTtcbiAgICAgIHJhbmdlLm1vdmVFbmQoJ2NoYXJhY3RlcicsIHN0YXRlLmVuZCk7XG4gICAgICByYW5nZS5tb3ZlU3RhcnQoJ2NoYXJhY3RlcicsIHN0YXRlLnN0YXJ0KTtcbiAgICAgIHJhbmdlLnNlbGVjdCgpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWRTZWxlY3Rpb25UZXh0YXJlYSAoc3RhdGUpIHtcbiAgICBpZiAodGV4dGFyZWEuc2VsZWN0aW9uU3RhcnQgIT09IHZvaWQgMCkge1xuICAgICAgc3RhdGUuc3RhcnQgPSB0ZXh0YXJlYS5zZWxlY3Rpb25TdGFydDtcbiAgICAgIHN0YXRlLmVuZCA9IHRleHRhcmVhLnNlbGVjdGlvbkVuZDtcbiAgICB9IGVsc2UgaWYgKGRvYy5zZWxlY3Rpb24pIHtcbiAgICAgIGFuY2llbnRseVJlYWRTZWxlY3Rpb25UZXh0YXJlYShzdGF0ZSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gYW5jaWVudGx5UmVhZFNlbGVjdGlvblRleHRhcmVhIChzdGF0ZSkge1xuICAgIGlmIChkb2MuYWN0aXZlRWxlbWVudCAmJiBkb2MuYWN0aXZlRWxlbWVudCAhPT0gdGV4dGFyZWEpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBzdGF0ZS50ZXh0ID0gZml4RU9MKHRleHRhcmVhLnZhbHVlKTtcblxuICAgIHZhciByYW5nZSA9IGRvYy5zZWxlY3Rpb24uY3JlYXRlUmFuZ2UoKTtcbiAgICB2YXIgZml4ZWRSYW5nZSA9IGZpeEVPTChyYW5nZS50ZXh0KTtcbiAgICB2YXIgbWFya2VyID0gJ1xceDA3JztcbiAgICB2YXIgbWFya2VkUmFuZ2UgPSBtYXJrZXIgKyBmaXhlZFJhbmdlICsgbWFya2VyO1xuXG4gICAgcmFuZ2UudGV4dCA9IG1hcmtlZFJhbmdlO1xuXG4gICAgdmFyIGlucHV0VGV4dCA9IGZpeEVPTCh0ZXh0YXJlYS52YWx1ZSk7XG5cbiAgICByYW5nZS5tb3ZlU3RhcnQoJ2NoYXJhY3RlcicsIC1tYXJrZWRSYW5nZS5sZW5ndGgpO1xuICAgIHJhbmdlLnRleHQgPSBmaXhlZFJhbmdlO1xuICAgIHN0YXRlLnN0YXJ0ID0gaW5wdXRUZXh0LmluZGV4T2YobWFya2VyKTtcbiAgICBzdGF0ZS5lbmQgPSBpbnB1dFRleHQubGFzdEluZGV4T2YobWFya2VyKSAtIG1hcmtlci5sZW5ndGg7XG5cbiAgICB2YXIgZGlmZiA9IHN0YXRlLnRleHQubGVuZ3RoIC0gZml4RU9MKHRleHRhcmVhLnZhbHVlKS5sZW5ndGg7XG4gICAgaWYgKGRpZmYpIHtcbiAgICAgIHJhbmdlLm1vdmVTdGFydCgnY2hhcmFjdGVyJywgLWZpeGVkUmFuZ2UubGVuZ3RoKTtcbiAgICAgIGZpeGVkUmFuZ2UgKz0gbWFueSgnXFxuJywgZGlmZik7XG4gICAgICBzdGF0ZS5lbmQgKz0gZGlmZjtcbiAgICAgIHJhbmdlLnRleHQgPSBmaXhlZFJhbmdlO1xuICAgIH1cbiAgICBzdGF0ZS5zZWxlY3QoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHdyaXRlU2VsZWN0aW9uRWRpdGFibGUgKHN0YXRlKSB7XG4gICAgdmFyIGNodW5rcyA9IHN0YXRlLmNhY2hlZENodW5rcyB8fCBzdGF0ZS5nZXRDaHVua3MoKTtcbiAgICB2YXIgc3RhcnQgPSBjaHVua3MuYmVmb3JlLmxlbmd0aDtcbiAgICB2YXIgZW5kID0gc3RhcnQgKyBjaHVua3Muc2VsZWN0aW9uLmxlbmd0aDtcbiAgICB2YXIgcCA9IHt9O1xuXG4gICAgd2FsayhlZGl0YWJsZS5maXJzdENoaWxkLCBwZWVrKTtcbiAgICBlZGl0YWJsZS5mb2N1cygpO1xuICAgIHNldFNlbGVjdGlvbihwKTtcblxuICAgIGZ1bmN0aW9uIHBlZWsgKGNvbnRleHQsIGVsKSB7XG4gICAgICB2YXIgY3Vyc29yID0gY29udGV4dC50ZXh0Lmxlbmd0aDtcbiAgICAgIHZhciBjb250ZW50ID0gcmVhZE5vZGUoZWwpLmxlbmd0aDtcbiAgICAgIHZhciBzdW0gPSBjdXJzb3IgKyBjb250ZW50O1xuICAgICAgaWYgKCFwLnN0YXJ0Q29udGFpbmVyICYmIHN1bSA+PSBzdGFydCkge1xuICAgICAgICBwLnN0YXJ0Q29udGFpbmVyID0gZWw7XG4gICAgICAgIHAuc3RhcnRPZmZzZXQgPSBib3VuZGVkKHN0YXJ0IC0gY3Vyc29yKTtcbiAgICAgIH1cbiAgICAgIGlmICghcC5lbmRDb250YWluZXIgJiYgc3VtID49IGVuZCkge1xuICAgICAgICBwLmVuZENvbnRhaW5lciA9IGVsO1xuICAgICAgICBwLmVuZE9mZnNldCA9IGJvdW5kZWQoZW5kIC0gY3Vyc29yKTtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gYm91bmRlZCAob2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiBNYXRoLm1heCgwLCBNYXRoLm1pbihjb250ZW50LCBvZmZzZXQpKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZWFkU2VsZWN0aW9uRWRpdGFibGUgKHN0YXRlKSB7XG4gICAgdmFyIHNlbCA9IGdldFNlbGVjdGlvbigpO1xuICAgIHZhciBkaXN0YW5jZSA9IHdhbGsoZWRpdGFibGUuZmlyc3RDaGlsZCwgcGVlayk7XG4gICAgdmFyIHN0YXJ0ID0gZGlzdGFuY2Uuc3RhcnQgfHwgMDtcbiAgICB2YXIgZW5kID0gZGlzdGFuY2UuZW5kIHx8IDA7XG5cbiAgICBzdGF0ZS50ZXh0ID0gZGlzdGFuY2UudGV4dDtcblxuICAgIGlmIChlbmQgPiBzdGFydCkge1xuICAgICAgc3RhdGUuc3RhcnQgPSBzdGFydDtcbiAgICAgIHN0YXRlLmVuZCA9IGVuZDtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RhdGUuc3RhcnQgPSBlbmQ7XG4gICAgICBzdGF0ZS5lbmQgPSBzdGFydDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWVrIChjb250ZXh0LCBlbCkge1xuICAgICAgaWYgKGVsID09PSBzZWwuYW5jaG9yTm9kZSkge1xuICAgICAgICBjb250ZXh0LnN0YXJ0ID0gY29udGV4dC50ZXh0Lmxlbmd0aCArIHNlbC5hbmNob3JPZmZzZXQ7XG4gICAgICB9XG4gICAgICBpZiAoZWwgPT09IHNlbC5mb2N1c05vZGUpIHtcbiAgICAgICAgY29udGV4dC5lbmQgPSBjb250ZXh0LnRleHQubGVuZ3RoICsgc2VsLmZvY3VzT2Zmc2V0O1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHdhbGsgKGVsLCBwZWVrLCBjdHgsIHNpYmxpbmdzKSB7XG4gICAgdmFyIGNvbnRleHQgPSBjdHggfHwgeyB0ZXh0OiAnJyB9O1xuXG4gICAgaWYgKCFlbCkge1xuICAgICAgcmV0dXJuIGNvbnRleHQ7XG4gICAgfVxuXG4gICAgdmFyIGVsTm9kZSA9IGVsLm5vZGVUeXBlID09PSAxO1xuICAgIHZhciB0ZXh0Tm9kZSA9IGVsLm5vZGVUeXBlID09PSAzO1xuXG4gICAgcGVlayhjb250ZXh0LCBlbCk7XG5cbiAgICBpZiAodGV4dE5vZGUpIHtcbiAgICAgIGNvbnRleHQudGV4dCArPSByZWFkTm9kZShlbCk7XG4gICAgfVxuICAgIGlmIChlbE5vZGUpIHtcbiAgICAgIGlmIChlbC5vdXRlckhUTUwubWF0Y2gocm9wZW4pKSB7IGNvbnRleHQudGV4dCArPSBSZWdFeHAuJDE7IH1cbiAgICAgIGNhc3QoZWwuY2hpbGROb2RlcykuZm9yRWFjaCh3YWxrQ2hpbGRyZW4pO1xuICAgICAgaWYgKGVsLm91dGVySFRNTC5tYXRjaChyY2xvc2UpKSB7IGNvbnRleHQudGV4dCArPSBSZWdFeHAuJDE7IH1cbiAgICB9XG4gICAgaWYgKHNpYmxpbmdzICE9PSBmYWxzZSAmJiBlbC5uZXh0U2libGluZykge1xuICAgICAgcmV0dXJuIHdhbGsoZWwubmV4dFNpYmxpbmcsIHBlZWssIGNvbnRleHQpO1xuICAgIH1cbiAgICByZXR1cm4gY29udGV4dDtcblxuICAgIGZ1bmN0aW9uIHdhbGtDaGlsZHJlbiAoY2hpbGQpIHtcbiAgICAgIHdhbGsoY2hpbGQsIHBlZWssIGNvbnRleHQsIGZhbHNlKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZWFkTm9kZSAoZWwpIHtcbiAgICByZXR1cm4gZWwubm9kZVR5cGUgPT09IDMgPyBmaXhFT0woZWwudGV4dENvbnRlbnQgfHwgZWwuaW5uZXJUZXh0IHx8ICcnKSA6ICcnO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gc3VyZmFjZTtcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pXG4vLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247Y2hhcnNldDp1dGYtODtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSnpiM1Z5WTJWeklqcGJJbk55WXk5blpYUlRkWEptWVdObExtcHpJbDBzSW01aGJXVnpJanBiWFN3aWJXRndjR2x1WjNNaU9pSTdRVUZCUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVNJc0ltWnBiR1VpT2lKblpXNWxjbUYwWldRdWFuTWlMQ0p6YjNWeVkyVlNiMjkwSWpvaUlpd2ljMjkxY21ObGMwTnZiblJsYm5RaU9sc2lKM1Z6WlNCemRISnBZM1FuTzF4dVhHNTJZWElnWkc5aklEMGdaMnh2WW1Gc0xtUnZZM1Z0Wlc1ME8xeHVkbUZ5SUhObGJHVmpZMmx2YmlBOUlISmxjWFZwY21Vb0ozTmxiR1ZqWTJsdmJpY3BPMXh1ZG1GeUlHWnBlRVZQVENBOUlISmxjWFZwY21Vb0p5NHZabWw0UlU5TUp5azdYRzUyWVhJZ2JXRnVlU0E5SUhKbGNYVnBjbVVvSnk0dmJXRnVlU2NwTzF4dWRtRnlJR05oYzNRZ1BTQnlaWEYxYVhKbEtDY3VMMk5oYzNRbktUdGNiblpoY2lCblpYUlRaV3hsWTNScGIyNGdQU0J6Wld4bFkyTnBiMjR1WjJWME8xeHVkbUZ5SUhObGRGTmxiR1ZqZEdsdmJpQTlJSE5sYkdWalkybHZiaTV6WlhRN1hHNTJZWElnY205d1pXNGdQU0F2WGlnOFcxNCtYU3NvUHpvZ1cxNCtYU29wUHo0cEx6dGNiblpoY2lCeVkyeHZjMlVnUFNBdktEeGNYQzliWGo1ZEt6NHBKQzg3WEc1Y2JtWjFibU4wYVc5dUlITjFjbVpoWTJVZ0tIUmxlSFJoY21WaExDQmxaR2wwWVdKc1pTd2daSEp2Y0dGeVpXRXBJSHRjYmlBZ2NtVjBkWEp1SUh0Y2JpQWdJQ0IwWlhoMFlYSmxZVG9nZEdWNGRHRnlaV0VzWEc0Z0lDQWdaV1JwZEdGaWJHVTZJR1ZrYVhSaFlteGxMRnh1SUNBZ0lHUnliM0JoY21WaE9pQmtjbTl3WVhKbFlTeGNiaUFnSUNCbWIyTjFjem9nYzJWMFJtOWpkWE1zWEc0Z0lDQWdjbVZoWkRvZ2NtVmhaQ3hjYmlBZ0lDQjNjbWwwWlRvZ2QzSnBkR1VzWEc0Z0lDQWdZM1Z5Y21WdWREb2dZM1Z5Y21WdWRDeGNiaUFnSUNCM2NtbDBaVk5sYkdWamRHbHZiam9nZDNKcGRHVlRaV3hsWTNScGIyNHNYRzRnSUNBZ2NtVmhaRk5sYkdWamRHbHZiam9nY21WaFpGTmxiR1ZqZEdsdmJseHVJQ0I5TzF4dVhHNGdJR1oxYm1OMGFXOXVJSE5sZEVadlkzVnpJQ2h0YjJSbEtTQjdYRzRnSUNBZ1kzVnljbVZ1ZENodGIyUmxLUzVtYjJOMWN5Z3BPMXh1SUNCOVhHNWNiaUFnWm5WdVkzUnBiMjRnWTNWeWNtVnVkQ0FvYlc5a1pTa2dlMXh1SUNBZ0lISmxkSFZ5YmlCdGIyUmxJRDA5UFNBbmQzbHphWGQ1WnljZ1B5QmxaR2wwWVdKc1pTQTZJSFJsZUhSaGNtVmhPMXh1SUNCOVhHNWNiaUFnWm5WdVkzUnBiMjRnY21WaFpDQW9iVzlrWlNrZ2UxeHVJQ0FnSUdsbUlDaHRiMlJsSUQwOVBTQW5kM2x6YVhkNVp5Y3BJSHRjYmlBZ0lDQWdJSEpsZEhWeWJpQmxaR2wwWVdKc1pTNXBibTVsY2toVVRVdzdYRzRnSUNBZ2ZWeHVJQ0FnSUhKbGRIVnliaUIwWlhoMFlYSmxZUzUyWVd4MVpUdGNiaUFnZlZ4dVhHNGdJR1oxYm1OMGFXOXVJSGR5YVhSbElDaHRiMlJsTENCMllXeDFaU2tnZTF4dUlDQWdJR2xtSUNodGIyUmxJRDA5UFNBbmQzbHphWGQ1WnljcElIdGNiaUFnSUNBZ0lHVmthWFJoWW14bExtbHVibVZ5U0ZSTlRDQTlJSFpoYkhWbE8xeHVJQ0FnSUgwZ1pXeHpaU0I3WEc0Z0lDQWdJQ0IwWlhoMFlYSmxZUzUyWVd4MVpTQTlJSFpoYkhWbE8xeHVJQ0FnSUgxY2JpQWdmVnh1WEc0Z0lHWjFibU4wYVc5dUlIZHlhWFJsVTJWc1pXTjBhVzl1SUNoemRHRjBaU2tnZTF4dUlDQWdJR2xtSUNoemRHRjBaUzV0YjJSbElEMDlQU0FuZDNsemFYZDVaeWNwSUh0Y2JpQWdJQ0FnSUhkeWFYUmxVMlZzWldOMGFXOXVSV1JwZEdGaWJHVW9jM1JoZEdVcE8xeHVJQ0FnSUgwZ1pXeHpaU0I3WEc0Z0lDQWdJQ0IzY21sMFpWTmxiR1ZqZEdsdmJsUmxlSFJoY21WaEtITjBZWFJsS1R0Y2JpQWdJQ0I5WEc0Z0lIMWNibHh1SUNCbWRXNWpkR2x2YmlCeVpXRmtVMlZzWldOMGFXOXVJQ2h6ZEdGMFpTa2dlMXh1SUNBZ0lHbG1JQ2h6ZEdGMFpTNXRiMlJsSUQwOVBTQW5kM2x6YVhkNVp5Y3BJSHRjYmlBZ0lDQWdJSEpsWVdSVFpXeGxZM1JwYjI1RlpHbDBZV0pzWlNoemRHRjBaU2s3WEc0Z0lDQWdmU0JsYkhObElIdGNiaUFnSUNBZ0lISmxZV1JUWld4bFkzUnBiMjVVWlhoMFlYSmxZU2h6ZEdGMFpTazdYRzRnSUNBZ2ZWeHVJQ0I5WEc1Y2JpQWdablZ1WTNScGIyNGdkM0pwZEdWVFpXeGxZM1JwYjI1VVpYaDBZWEpsWVNBb2MzUmhkR1VwSUh0Y2JpQWdJQ0IyWVhJZ2NtRnVaMlU3WEc0Z0lDQWdhV1lnS0hSbGVIUmhjbVZoTG5ObGJHVmpkR2x2YmxOMFlYSjBJQ0U5UFNCMmIybGtJREFwSUh0Y2JpQWdJQ0FnSUhSbGVIUmhjbVZoTG1adlkzVnpLQ2s3WEc0Z0lDQWdJQ0IwWlhoMFlYSmxZUzV6Wld4bFkzUnBiMjVUZEdGeWRDQTlJSE4wWVhSbExuTjBZWEowTzF4dUlDQWdJQ0FnZEdWNGRHRnlaV0V1YzJWc1pXTjBhVzl1Ulc1a0lEMGdjM1JoZEdVdVpXNWtPMXh1SUNBZ0lDQWdkR1Y0ZEdGeVpXRXVjMk55YjJ4c1ZHOXdJRDBnYzNSaGRHVXVjMk55YjJ4c1ZHOXdPMXh1SUNBZ0lIMGdaV3h6WlNCcFppQW9aRzlqTG5ObGJHVmpkR2x2YmlrZ2UxeHVJQ0FnSUNBZ2FXWWdLR1J2WXk1aFkzUnBkbVZGYkdWdFpXNTBJQ1ltSUdSdll5NWhZM1JwZG1WRmJHVnRaVzUwSUNFOVBTQjBaWGgwWVhKbFlTa2dlMXh1SUNBZ0lDQWdJQ0J5WlhSMWNtNDdYRzRnSUNBZ0lDQjlYRzRnSUNBZ0lDQjBaWGgwWVhKbFlTNW1iMk4xY3lncE8xeHVJQ0FnSUNBZ2NtRnVaMlVnUFNCMFpYaDBZWEpsWVM1amNtVmhkR1ZVWlhoMFVtRnVaMlVvS1R0Y2JpQWdJQ0FnSUhKaGJtZGxMbTF2ZG1WVGRHRnlkQ2duWTJoaGNtRmpkR1Z5Snl3Z0xYUmxlSFJoY21WaExuWmhiSFZsTG14bGJtZDBhQ2s3WEc0Z0lDQWdJQ0J5WVc1blpTNXRiM1psUlc1a0tDZGphR0Z5WVdOMFpYSW5MQ0F0ZEdWNGRHRnlaV0V1ZG1Gc2RXVXViR1Z1WjNSb0tUdGNiaUFnSUNBZ0lISmhibWRsTG0xdmRtVkZibVFvSjJOb1lYSmhZM1JsY2ljc0lITjBZWFJsTG1WdVpDazdYRzRnSUNBZ0lDQnlZVzVuWlM1dGIzWmxVM1JoY25Rb0oyTm9ZWEpoWTNSbGNpY3NJSE4wWVhSbExuTjBZWEowS1R0Y2JpQWdJQ0FnSUhKaGJtZGxMbk5sYkdWamRDZ3BPMXh1SUNBZ0lIMWNiaUFnZlZ4dVhHNGdJR1oxYm1OMGFXOXVJSEpsWVdSVFpXeGxZM1JwYjI1VVpYaDBZWEpsWVNBb2MzUmhkR1VwSUh0Y2JpQWdJQ0JwWmlBb2RHVjRkR0Z5WldFdWMyVnNaV04wYVc5dVUzUmhjblFnSVQwOUlIWnZhV1FnTUNrZ2UxeHVJQ0FnSUNBZ2MzUmhkR1V1YzNSaGNuUWdQU0IwWlhoMFlYSmxZUzV6Wld4bFkzUnBiMjVUZEdGeWREdGNiaUFnSUNBZ0lITjBZWFJsTG1WdVpDQTlJSFJsZUhSaGNtVmhMbk5sYkdWamRHbHZia1Z1WkR0Y2JpQWdJQ0I5SUdWc2MyVWdhV1lnS0dSdll5NXpaV3hsWTNScGIyNHBJSHRjYmlBZ0lDQWdJR0Z1WTJsbGJuUnNlVkpsWVdSVFpXeGxZM1JwYjI1VVpYaDBZWEpsWVNoemRHRjBaU2s3WEc0Z0lDQWdmVnh1SUNCOVhHNWNiaUFnWm5WdVkzUnBiMjRnWVc1amFXVnVkR3g1VW1WaFpGTmxiR1ZqZEdsdmJsUmxlSFJoY21WaElDaHpkR0YwWlNrZ2UxeHVJQ0FnSUdsbUlDaGtiMk11WVdOMGFYWmxSV3hsYldWdWRDQW1KaUJrYjJNdVlXTjBhWFpsUld4bGJXVnVkQ0FoUFQwZ2RHVjRkR0Z5WldFcElIdGNiaUFnSUNBZ0lISmxkSFZ5Ymp0Y2JpQWdJQ0I5WEc1Y2JpQWdJQ0J6ZEdGMFpTNTBaWGgwSUQwZ1ptbDRSVTlNS0hSbGVIUmhjbVZoTG5aaGJIVmxLVHRjYmx4dUlDQWdJSFpoY2lCeVlXNW5aU0E5SUdSdll5NXpaV3hsWTNScGIyNHVZM0psWVhSbFVtRnVaMlVvS1R0Y2JpQWdJQ0IyWVhJZ1ptbDRaV1JTWVc1blpTQTlJR1pwZUVWUFRDaHlZVzVuWlM1MFpYaDBLVHRjYmlBZ0lDQjJZWElnYldGeWEyVnlJRDBnSjF4Y2VEQTNKenRjYmlBZ0lDQjJZWElnYldGeWEyVmtVbUZ1WjJVZ1BTQnRZWEpyWlhJZ0t5Qm1hWGhsWkZKaGJtZGxJQ3NnYldGeWEyVnlPMXh1WEc0Z0lDQWdjbUZ1WjJVdWRHVjRkQ0E5SUcxaGNtdGxaRkpoYm1kbE8xeHVYRzRnSUNBZ2RtRnlJR2x1Y0hWMFZHVjRkQ0E5SUdacGVFVlBUQ2gwWlhoMFlYSmxZUzUyWVd4MVpTazdYRzVjYmlBZ0lDQnlZVzVuWlM1dGIzWmxVM1JoY25Rb0oyTm9ZWEpoWTNSbGNpY3NJQzF0WVhKclpXUlNZVzVuWlM1c1pXNW5kR2dwTzF4dUlDQWdJSEpoYm1kbExuUmxlSFFnUFNCbWFYaGxaRkpoYm1kbE8xeHVJQ0FnSUhOMFlYUmxMbk4wWVhKMElEMGdhVzV3ZFhSVVpYaDBMbWx1WkdWNFQyWW9iV0Z5YTJWeUtUdGNiaUFnSUNCemRHRjBaUzVsYm1RZ1BTQnBibkIxZEZSbGVIUXViR0Z6ZEVsdVpHVjRUMllvYldGeWEyVnlLU0F0SUcxaGNtdGxjaTVzWlc1bmRHZzdYRzVjYmlBZ0lDQjJZWElnWkdsbVppQTlJSE4wWVhSbExuUmxlSFF1YkdWdVozUm9JQzBnWm1sNFJVOU1LSFJsZUhSaGNtVmhMblpoYkhWbEtTNXNaVzVuZEdnN1hHNGdJQ0FnYVdZZ0tHUnBabVlwSUh0Y2JpQWdJQ0FnSUhKaGJtZGxMbTF2ZG1WVGRHRnlkQ2duWTJoaGNtRmpkR1Z5Snl3Z0xXWnBlR1ZrVW1GdVoyVXViR1Z1WjNSb0tUdGNiaUFnSUNBZ0lHWnBlR1ZrVW1GdVoyVWdLejBnYldGdWVTZ25YRnh1Snl3Z1pHbG1aaWs3WEc0Z0lDQWdJQ0J6ZEdGMFpTNWxibVFnS3owZ1pHbG1aanRjYmlBZ0lDQWdJSEpoYm1kbExuUmxlSFFnUFNCbWFYaGxaRkpoYm1kbE8xeHVJQ0FnSUgxY2JpQWdJQ0J6ZEdGMFpTNXpaV3hsWTNRb0tUdGNiaUFnZlZ4dVhHNGdJR1oxYm1OMGFXOXVJSGR5YVhSbFUyVnNaV04wYVc5dVJXUnBkR0ZpYkdVZ0tITjBZWFJsS1NCN1hHNGdJQ0FnZG1GeUlHTm9kVzVyY3lBOUlITjBZWFJsTG1OaFkyaGxaRU5vZFc1cmN5QjhmQ0J6ZEdGMFpTNW5aWFJEYUhWdWEzTW9LVHRjYmlBZ0lDQjJZWElnYzNSaGNuUWdQU0JqYUhWdWEzTXVZbVZtYjNKbExteGxibWQwYUR0Y2JpQWdJQ0IyWVhJZ1pXNWtJRDBnYzNSaGNuUWdLeUJqYUhWdWEzTXVjMlZzWldOMGFXOXVMbXhsYm1kMGFEdGNiaUFnSUNCMllYSWdjQ0E5SUh0OU8xeHVYRzRnSUNBZ2QyRnNheWhsWkdsMFlXSnNaUzVtYVhKemRFTm9hV3hrTENCd1pXVnJLVHRjYmlBZ0lDQmxaR2wwWVdKc1pTNW1iMk4xY3lncE8xeHVJQ0FnSUhObGRGTmxiR1ZqZEdsdmJpaHdLVHRjYmx4dUlDQWdJR1oxYm1OMGFXOXVJSEJsWldzZ0tHTnZiblJsZUhRc0lHVnNLU0I3WEc0Z0lDQWdJQ0IyWVhJZ1kzVnljMjl5SUQwZ1kyOXVkR1Y0ZEM1MFpYaDBMbXhsYm1kMGFEdGNiaUFnSUNBZ0lIWmhjaUJqYjI1MFpXNTBJRDBnY21WaFpFNXZaR1VvWld3cExteGxibWQwYUR0Y2JpQWdJQ0FnSUhaaGNpQnpkVzBnUFNCamRYSnpiM0lnS3lCamIyNTBaVzUwTzF4dUlDQWdJQ0FnYVdZZ0tDRndMbk4wWVhKMFEyOXVkR0ZwYm1WeUlDWW1JSE4xYlNBK1BTQnpkR0Z5ZENrZ2UxeHVJQ0FnSUNBZ0lDQndMbk4wWVhKMFEyOXVkR0ZwYm1WeUlEMGdaV3c3WEc0Z0lDQWdJQ0FnSUhBdWMzUmhjblJQWm1aelpYUWdQU0JpYjNWdVpHVmtLSE4wWVhKMElDMGdZM1Z5YzI5eUtUdGNiaUFnSUNBZ0lIMWNiaUFnSUNBZ0lHbG1JQ2doY0M1bGJtUkRiMjUwWVdsdVpYSWdKaVlnYzNWdElENDlJR1Z1WkNrZ2UxeHVJQ0FnSUNBZ0lDQndMbVZ1WkVOdmJuUmhhVzVsY2lBOUlHVnNPMXh1SUNBZ0lDQWdJQ0J3TG1WdVpFOW1abk5sZENBOUlHSnZkVzVrWldRb1pXNWtJQzBnWTNWeWMyOXlLVHRjYmlBZ0lDQWdJSDFjYmx4dUlDQWdJQ0FnWm5WdVkzUnBiMjRnWW05MWJtUmxaQ0FvYjJabWMyVjBLU0I3WEc0Z0lDQWdJQ0FnSUhKbGRIVnliaUJOWVhSb0xtMWhlQ2d3TENCTllYUm9MbTFwYmloamIyNTBaVzUwTENCdlptWnpaWFFwS1R0Y2JpQWdJQ0FnSUgxY2JpQWdJQ0I5WEc0Z0lIMWNibHh1SUNCbWRXNWpkR2x2YmlCeVpXRmtVMlZzWldOMGFXOXVSV1JwZEdGaWJHVWdLSE4wWVhSbEtTQjdYRzRnSUNBZ2RtRnlJSE5sYkNBOUlHZGxkRk5sYkdWamRHbHZiaWdwTzF4dUlDQWdJSFpoY2lCa2FYTjBZVzVqWlNBOUlIZGhiR3NvWldScGRHRmliR1V1Wm1seWMzUkRhR2xzWkN3Z2NHVmxheWs3WEc0Z0lDQWdkbUZ5SUhOMFlYSjBJRDBnWkdsemRHRnVZMlV1YzNSaGNuUWdmSHdnTUR0Y2JpQWdJQ0IyWVhJZ1pXNWtJRDBnWkdsemRHRnVZMlV1Wlc1a0lIeDhJREE3WEc1Y2JpQWdJQ0J6ZEdGMFpTNTBaWGgwSUQwZ1pHbHpkR0Z1WTJVdWRHVjRkRHRjYmx4dUlDQWdJR2xtSUNobGJtUWdQaUJ6ZEdGeWRDa2dlMXh1SUNBZ0lDQWdjM1JoZEdVdWMzUmhjblFnUFNCemRHRnlkRHRjYmlBZ0lDQWdJSE4wWVhSbExtVnVaQ0E5SUdWdVpEdGNiaUFnSUNCOUlHVnNjMlVnZTF4dUlDQWdJQ0FnYzNSaGRHVXVjM1JoY25RZ1BTQmxibVE3WEc0Z0lDQWdJQ0J6ZEdGMFpTNWxibVFnUFNCemRHRnlkRHRjYmlBZ0lDQjlYRzVjYmlBZ0lDQm1kVzVqZEdsdmJpQndaV1ZySUNoamIyNTBaWGgwTENCbGJDa2dlMXh1SUNBZ0lDQWdhV1lnS0dWc0lEMDlQU0J6Wld3dVlXNWphRzl5VG05a1pTa2dlMXh1SUNBZ0lDQWdJQ0JqYjI1MFpYaDBMbk4wWVhKMElEMGdZMjl1ZEdWNGRDNTBaWGgwTG14bGJtZDBhQ0FySUhObGJDNWhibU5vYjNKUFptWnpaWFE3WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdJQ0JwWmlBb1pXd2dQVDA5SUhObGJDNW1iMk4xYzA1dlpHVXBJSHRjYmlBZ0lDQWdJQ0FnWTI5dWRHVjRkQzVsYm1RZ1BTQmpiMjUwWlhoMExuUmxlSFF1YkdWdVozUm9JQ3NnYzJWc0xtWnZZM1Z6VDJabWMyVjBPMXh1SUNBZ0lDQWdmVnh1SUNBZ0lIMWNiaUFnZlZ4dVhHNGdJR1oxYm1OMGFXOXVJSGRoYkdzZ0tHVnNMQ0J3WldWckxDQmpkSGdzSUhOcFlteHBibWR6S1NCN1hHNGdJQ0FnZG1GeUlHTnZiblJsZUhRZ1BTQmpkSGdnZkh3Z2V5QjBaWGgwT2lBbkp5QjlPMXh1WEc0Z0lDQWdhV1lnS0NGbGJDa2dlMXh1SUNBZ0lDQWdjbVYwZFhKdUlHTnZiblJsZUhRN1hHNGdJQ0FnZlZ4dVhHNGdJQ0FnZG1GeUlHVnNUbTlrWlNBOUlHVnNMbTV2WkdWVWVYQmxJRDA5UFNBeE8xeHVJQ0FnSUhaaGNpQjBaWGgwVG05a1pTQTlJR1ZzTG01dlpHVlVlWEJsSUQwOVBTQXpPMXh1WEc0Z0lDQWdjR1ZsYXloamIyNTBaWGgwTENCbGJDazdYRzVjYmlBZ0lDQnBaaUFvZEdWNGRFNXZaR1VwSUh0Y2JpQWdJQ0FnSUdOdmJuUmxlSFF1ZEdWNGRDQXJQU0J5WldGa1RtOWtaU2hsYkNrN1hHNGdJQ0FnZlZ4dUlDQWdJR2xtSUNobGJFNXZaR1VwSUh0Y2JpQWdJQ0FnSUdsbUlDaGxiQzV2ZFhSbGNraFVUVXd1YldGMFkyZ29jbTl3Wlc0cEtTQjdJR052Ym5SbGVIUXVkR1Y0ZENBclBTQlNaV2RGZUhBdUpERTdJSDFjYmlBZ0lDQWdJR05oYzNRb1pXd3VZMmhwYkdST2IyUmxjeWt1Wm05eVJXRmphQ2gzWVd4clEyaHBiR1J5Wlc0cE8xeHVJQ0FnSUNBZ2FXWWdLR1ZzTG05MWRHVnlTRlJOVEM1dFlYUmphQ2h5WTJ4dmMyVXBLU0I3SUdOdmJuUmxlSFF1ZEdWNGRDQXJQU0JTWldkRmVIQXVKREU3SUgxY2JpQWdJQ0I5WEc0Z0lDQWdhV1lnS0hOcFlteHBibWR6SUNFOVBTQm1ZV3h6WlNBbUppQmxiQzV1WlhoMFUybGliR2x1WnlrZ2UxeHVJQ0FnSUNBZ2NtVjBkWEp1SUhkaGJHc29aV3d1Ym1WNGRGTnBZbXhwYm1jc0lIQmxaV3NzSUdOdmJuUmxlSFFwTzF4dUlDQWdJSDFjYmlBZ0lDQnlaWFIxY200Z1kyOXVkR1Y0ZER0Y2JseHVJQ0FnSUdaMWJtTjBhVzl1SUhkaGJHdERhR2xzWkhKbGJpQW9ZMmhwYkdRcElIdGNiaUFnSUNBZ0lIZGhiR3NvWTJocGJHUXNJSEJsWldzc0lHTnZiblJsZUhRc0lHWmhiSE5sS1R0Y2JpQWdJQ0I5WEc0Z0lIMWNibHh1SUNCbWRXNWpkR2x2YmlCeVpXRmtUbTlrWlNBb1pXd3BJSHRjYmlBZ0lDQnlaWFIxY200Z1pXd3VibTlrWlZSNWNHVWdQVDA5SURNZ1B5Qm1hWGhGVDB3b1pXd3VkR1Y0ZEVOdmJuUmxiblFnZkh3Z1pXd3VhVzV1WlhKVVpYaDBJSHg4SUNjbktTQTZJQ2NuTzF4dUlDQjlYRzU5WEc1Y2JtMXZaSFZzWlM1bGVIQnZjblJ6SUQwZ2MzVnlabUZqWlR0Y2JpSmRmUT09IiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBnZXRUZXh0IChlbCkge1xuICByZXR1cm4gZWwuaW5uZXJUZXh0IHx8IGVsLnRleHRDb250ZW50O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGdldFRleHQ7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB0cmltQ2h1bmtzID0gcmVxdWlyZSgnLi4vY2h1bmtzL3RyaW0nKTtcblxuZnVuY3Rpb24gSHRtbENodW5rcyAoKSB7XG59XG5cbkh0bWxDaHVua3MucHJvdG90eXBlLnRyaW0gPSB0cmltQ2h1bmtzO1xuXG5IdG1sQ2h1bmtzLnByb3RvdHlwZS5maW5kVGFncyA9IGZ1bmN0aW9uICgpIHtcbn07XG5cbkh0bWxDaHVua3MucHJvdG90eXBlLnNraXAgPSBmdW5jdGlvbiAoKSB7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEh0bWxDaHVua3M7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBzdHJpbmdzID0gcmVxdWlyZSgnLi4vc3RyaW5ncycpO1xudmFyIHdyYXBwaW5nID0gcmVxdWlyZSgnLi93cmFwcGluZycpO1xuXG5mdW5jdGlvbiBibG9ja3F1b3RlIChjaHVua3MpIHtcbiAgd3JhcHBpbmcoJ2Jsb2NrcXVvdGUnLCBzdHJpbmdzLnBsYWNlaG9sZGVycy5xdW90ZSwgY2h1bmtzKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBibG9ja3F1b3RlO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgc3RyaW5ncyA9IHJlcXVpcmUoJy4uL3N0cmluZ3MnKTtcbnZhciB3cmFwcGluZyA9IHJlcXVpcmUoJy4vd3JhcHBpbmcnKTtcblxuZnVuY3Rpb24gYm9sZE9ySXRhbGljIChjaHVua3MsIHR5cGUpIHtcbiAgd3JhcHBpbmcodHlwZSA9PT0gJ2JvbGQnID8gJ3N0cm9uZycgOiAnZW0nLCBzdHJpbmdzLnBsYWNlaG9sZGVyc1t0eXBlXSwgY2h1bmtzKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBib2xkT3JJdGFsaWM7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBzdHJpbmdzID0gcmVxdWlyZSgnLi4vc3RyaW5ncycpO1xudmFyIHdyYXBwaW5nID0gcmVxdWlyZSgnLi93cmFwcGluZycpO1xuXG5mdW5jdGlvbiBjb2RlYmxvY2sgKGNodW5rcykge1xuICB3cmFwcGluZygncHJlPjxjb2RlJywgc3RyaW5ncy5wbGFjZWhvbGRlcnMuY29kZSwgY2h1bmtzKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjb2RlYmxvY2s7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBzdHJpbmdzID0gcmVxdWlyZSgnLi4vc3RyaW5ncycpO1xudmFyIHJsZWFkaW5nID0gLzxoKFsxLTZdKSggW14+XSopPz4kLztcbnZhciBydHJhaWxpbmcgPSAvXjxcXC9oKFsxLTZdKT4vO1xuXG5mdW5jdGlvbiBoZWFkaW5nIChjaHVua3MpIHtcbiAgY2h1bmtzLnRyaW0oKTtcblxuICB2YXIgdHJhaWwgPSBydHJhaWxpbmcuZXhlYyhjaHVua3MuYWZ0ZXIpO1xuICB2YXIgbGVhZCA9IHJsZWFkaW5nLmV4ZWMoY2h1bmtzLmJlZm9yZSk7XG4gIGlmIChsZWFkICYmIHRyYWlsICYmIGxlYWRbMV0gPT09IHRyYWlsWzFdKSB7XG4gICAgc3dhcCgpO1xuICB9IGVsc2Uge1xuICAgIGFkZCgpO1xuICB9IFxuXG4gIC8vIGZ1bmMgY2hhbmdlcyBoZWFkaW5nc1xuICBmdW5jdGlvbiBzd2FwICgpIHtcbiAgICB2YXIgbGV2ZWwgPSBwYXJzZUludChsZWFkWzFdLCAxMCk7XG4gICAgLy8gY2hlY2tzIGZvciB0aGUgbmV4dCBoZWFkaW5nIHNpemUuIENhbGxzIHJlbW92ZSgpIGlmIDxoND4gaXMgcmVhY2hlZC5cbiAgICB2YXIgbmV4dCA9IGxldmVsID4gMyA/IDAgOiBsZXZlbCArIDE7XG4gICAgaWYobmV4dCA9PT0gMCkge1xuICAgICAgcmVtb3ZlKCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgY2h1bmtzLmJlZm9yZSA9IGNodW5rcy5iZWZvcmUucmVwbGFjZShybGVhZGluZywgJzxoJyArIG5leHQgKyAnPicpO1xuICAgICAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2UocnRyYWlsaW5nLCAnPC9oJyArIG5leHQgKyAnPicpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbW92ZSAoKSB7XG4gICAgY2h1bmtzLmJlZm9yZSA9IGNodW5rcy5iZWZvcmUucmVwbGFjZShybGVhZGluZywgJycpO1xuICAgIGNodW5rcy5hZnRlciA9IGNodW5rcy5hZnRlci5yZXBsYWNlKHJ0cmFpbGluZywgJycpO1xuICB9XG5cbiAgLy8gZnVuYyBjYWxsZWQgdG8gZW50ZXIgYSBuZXcgaGVhZGluZ1xuICBmdW5jdGlvbiBhZGQgKCkge1xuICAgIGlmICghY2h1bmtzLnNlbGVjdGlvbikge1xuICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9IHN0cmluZ3MucGxhY2Vob2xkZXJzLmhlYWRpbmc7XG4gICAgfVxuICAgIGNodW5rcy5iZWZvcmUgKz0gJzxoMT4nO1xuICAgIGNodW5rcy5hZnRlciA9ICc8L2gxPicgKyBjaHVua3MuYWZ0ZXI7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBoZWFkaW5nO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBociAoY2h1bmtzKSB7XG4gIGNodW5rcy5iZWZvcmUgKz0gJ1xcbjxocj5cXG4nO1xuICBjaHVua3Muc2VsZWN0aW9uID0gJyc7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaHI7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBjcm9zc3ZlbnQgPSByZXF1aXJlKCdjcm9zc3ZlbnQnKTtcbnZhciBvbmNlID0gcmVxdWlyZSgnLi4vb25jZScpO1xudmFyIHN0cmluZ3MgPSByZXF1aXJlKCcuLi9zdHJpbmdzJyk7XG52YXIgcGFyc2VMaW5rSW5wdXQgPSByZXF1aXJlKCcuLi9jaHVua3MvcGFyc2VMaW5rSW5wdXQnKTtcbnZhciBybGVhZGluZyA9IC88YSggW14+XSopPz4kLztcbnZhciBydHJhaWxpbmcgPSAvXjxcXC9hPi87XG52YXIgcmltYWdlID0gLzxpbWcoIFtePl0qKT9cXC8+JC87XG5cbmZ1bmN0aW9uIGxpbmtPckltYWdlT3JBdHRhY2htZW50IChjaHVua3MsIG9wdGlvbnMpIHtcbiAgdmFyIHR5cGUgPSBvcHRpb25zLnR5cGU7XG4gIHZhciBpbWFnZSA9IHR5cGUgPT09ICdpbWFnZSc7XG4gIHZhciByZXN1bWU7XG5cbiAgaWYgKHR5cGUgIT09ICdhdHRhY2htZW50Jykge1xuICAgIGNodW5rcy50cmltKCk7XG4gIH1cblxuICBpZiAocmVtb3ZhbCgpKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgcmVzdW1lID0gdGhpcy5hc3luYygpO1xuXG4gIG9wdGlvbnMucHJvbXB0cy5jbG9zZSgpO1xuICAob3B0aW9ucy5wcm9tcHRzW3R5cGVdIHx8IG9wdGlvbnMucHJvbXB0cy5saW5rKShvcHRpb25zLCBvbmNlKHJlc29sdmVkKSk7XG5cbiAgZnVuY3Rpb24gcmVtb3ZhbCAoKSB7XG4gICAgaWYgKGltYWdlKSB7XG4gICAgICBpZiAocmltYWdlLnRlc3QoY2h1bmtzLnNlbGVjdGlvbikpIHtcbiAgICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9ICcnO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHJ0cmFpbGluZy5leGVjKGNodW5rcy5hZnRlcikgJiYgcmxlYWRpbmcuZXhlYyhjaHVua3MuYmVmb3JlKSkge1xuICAgICAgY2h1bmtzLmJlZm9yZSA9IGNodW5rcy5iZWZvcmUucmVwbGFjZShybGVhZGluZywgJycpO1xuICAgICAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2UocnRyYWlsaW5nLCAnJyk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZXNvbHZlZCAocmVzdWx0KSB7XG4gICAgdmFyIHBhcnRzO1xuICAgIHZhciBsaW5rID0gcGFyc2VMaW5rSW5wdXQocmVzdWx0LmRlZmluaXRpb24pO1xuICAgIGlmIChsaW5rLmhyZWYubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXN1bWUoKTsgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICh0eXBlID09PSAnYXR0YWNobWVudCcpIHtcbiAgICAgIHBhcnRzID0gb3B0aW9ucy5tZXJnZUh0bWxBbmRBdHRhY2htZW50KGNodW5rcy5iZWZvcmUgKyBjaHVua3Muc2VsZWN0aW9uICsgY2h1bmtzLmFmdGVyLCBsaW5rKTtcbiAgICAgIGNodW5rcy5iZWZvcmUgPSBwYXJ0cy5iZWZvcmU7XG4gICAgICBjaHVua3Muc2VsZWN0aW9uID0gcGFydHMuc2VsZWN0aW9uO1xuICAgICAgY2h1bmtzLmFmdGVyID0gcGFydHMuYWZ0ZXI7XG4gICAgICByZXN1bWUoKTtcbiAgICAgIGNyb3NzdmVudC5mYWJyaWNhdGUob3B0aW9ucy5zdXJmYWNlLnRleHRhcmVhLCAnd29vZm1hcmstbW9kZS1jaGFuZ2UnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgdGl0bGUgPSBsaW5rLnRpdGxlID8gJyB0aXRsZT1cIicgKyBsaW5rLnRpdGxlICsgJ1wiJyA6ICcnO1xuXG4gICAgaWYgKGltYWdlKSB7XG4gICAgICBpbWFnZVdyYXAoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlua1dyYXAoKTtcbiAgICB9XG5cbiAgICBpZiAoIWNodW5rcy5zZWxlY3Rpb24pIHtcbiAgICAgIGNodW5rcy5zZWxlY3Rpb24gPSBzdHJpbmdzLnBsYWNlaG9sZGVyc1t0eXBlXTtcbiAgICB9XG4gICAgcmVzdW1lKCk7XG5cbiAgICBmdW5jdGlvbiBpbWFnZVdyYXAgKCkge1xuICAgICAgY2h1bmtzLmJlZm9yZSArPSAnPGltZyBzcmM9XCInICsgbGluay5ocmVmICsgJ1wiIGFsdD1cIic7XG4gICAgICBjaHVua3MuYWZ0ZXIgPSAnXCInICsgdGl0bGUgKyAnIC8+JyArIGNodW5rcy5hZnRlcjtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaW5rV3JhcCAoKSB7XG4gICAgICB2YXIgbmFtZXMgPSBvcHRpb25zLmNsYXNzZXMuaW5wdXQubGlua3M7XG4gICAgICB2YXIgY2xhc3NlcyA9IG5hbWVzID8gJyBjbGFzcz1cIicgKyBuYW1lcyArICdcIicgOiAnJztcbiAgICAgIGNodW5rcy5iZWZvcmUgKz0gJzxhIGhyZWY9XCInICsgbGluay5ocmVmICsgJ1wiJyArIHRpdGxlICsgY2xhc3NlcyArICc+JztcbiAgICAgIGNodW5rcy5hZnRlciA9ICc8L2E+JyArIGNodW5rcy5hZnRlcjtcbiAgICB9XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBsaW5rT3JJbWFnZU9yQXR0YWNobWVudDtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHN0cmluZ3MgPSByZXF1aXJlKCcuLi9zdHJpbmdzJyk7XG52YXIgcmxlZnRzaW5nbGUgPSAvPCh1bHxvbCkoIFtePl0qKT8+XFxzKjxsaSggW14+XSopPz4kLztcbnZhciBycmlnaHRzaW5nbGUgPSAvXjxcXC9saT5cXHMqPFxcLyh1bHxvbCk+LztcbnZhciBybGVmdGl0ZW0gPSAvPGxpKCBbXj5dKik/PiQvO1xudmFyIHJyaWdodGl0ZW0gPSAvXjxcXC9saSggW14+XSopPz4vO1xudmFyIHJvcGVuID0gL148KHVsfG9sKSggW14+XSopPz4kLztcblxuZnVuY3Rpb24gbGlzdCAoY2h1bmtzLCBvcmRlcmVkKSB7XG4gIHZhciB0YWcgPSBvcmRlcmVkID8gJ29sJyA6ICd1bCc7XG4gIHZhciBvbGlzdCA9ICc8JyArIHRhZyArICc+JztcbiAgdmFyIGNsaXN0ID0gJzwvJyArIHRhZyArICc+JztcblxuICBjaHVua3MudHJpbSgpO1xuXG4gIGlmIChybGVmdHNpbmdsZS50ZXN0KGNodW5rcy5iZWZvcmUpICYmIHJyaWdodHNpbmdsZS50ZXN0KGNodW5rcy5hZnRlcikpIHtcbiAgICBpZiAodGFnID09PSBSZWdFeHAuJDEpIHtcbiAgICAgIGNodW5rcy5iZWZvcmUgPSBjaHVua3MuYmVmb3JlLnJlcGxhY2UocmxlZnRzaW5nbGUsICcnKTtcbiAgICAgIGNodW5rcy5hZnRlciA9IGNodW5rcy5hZnRlci5yZXBsYWNlKHJyaWdodHNpbmdsZSwgJycpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgfVxuXG4gIHZhciB1bFN0YXJ0ID0gY2h1bmtzLmJlZm9yZS5sYXN0SW5kZXhPZignPHVsJyk7XG4gIHZhciBvbFN0YXJ0ID0gY2h1bmtzLmJlZm9yZS5sYXN0SW5kZXhPZignPG9sJyk7XG4gIHZhciBjbG9zZVRhZyA9IGNodW5rcy5hZnRlci5pbmRleE9mKCc8L3VsPicpO1xuICBpZiAoY2xvc2VUYWcgPT09IC0xKSB7XG4gICAgY2xvc2VUYWcgPSBjaHVua3MuYWZ0ZXIuaW5kZXhPZignPC9vbD4nKTtcbiAgfVxuICBpZiAoY2xvc2VUYWcgPT09IC0xKSB7XG4gICAgYWRkKCk7IHJldHVybjtcbiAgfVxuICB2YXIgb3BlblN0YXJ0ID0gdWxTdGFydCA+IG9sU3RhcnQgPyB1bFN0YXJ0IDogb2xTdGFydDtcbiAgaWYgKG9wZW5TdGFydCA9PT0gLTEpIHtcbiAgICBhZGQoKTsgcmV0dXJuO1xuICB9XG4gIHZhciBvcGVuRW5kID0gY2h1bmtzLmJlZm9yZS5pbmRleE9mKCc+Jywgb3BlblN0YXJ0KTtcbiAgaWYgKG9wZW5FbmQgPT09IC0xKSB7XG4gICAgYWRkKCk7IHJldHVybjtcbiAgfVxuXG4gIHZhciBvcGVuVGFnID0gY2h1bmtzLmJlZm9yZS5zdWJzdHIob3BlblN0YXJ0LCBvcGVuRW5kIC0gb3BlblN0YXJ0ICsgMSk7XG4gIGlmIChyb3Blbi50ZXN0KG9wZW5UYWcpKSB7XG4gICAgaWYgKHRhZyAhPT0gUmVnRXhwLiQxKSB7XG4gICAgICBjaHVua3MuYmVmb3JlID0gY2h1bmtzLmJlZm9yZS5zdWJzdHIoMCwgb3BlblN0YXJ0KSArICc8JyArIHRhZyArIGNodW5rcy5iZWZvcmUuc3Vic3RyKG9wZW5TdGFydCArIDMpO1xuICAgICAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnN1YnN0cigwLCBjbG9zZVRhZykgKyAnPC8nICsgdGFnICsgY2h1bmtzLmFmdGVyLnN1YnN0cihjbG9zZVRhZyArIDQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAocmxlZnRpdGVtLnRlc3QoY2h1bmtzLmJlZm9yZSkgJiYgcnJpZ2h0aXRlbS50ZXN0KGNodW5rcy5hZnRlcikpIHtcbiAgICAgICAgY2h1bmtzLmJlZm9yZSA9IGNodW5rcy5iZWZvcmUucmVwbGFjZShybGVmdGl0ZW0sICcnKTtcbiAgICAgICAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2UocnJpZ2h0aXRlbSwgJycpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYWRkKHRydWUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGFkZCAobGlzdCkge1xuICAgIHZhciBvcGVuID0gbGlzdCA/ICcnIDogb2xpc3Q7XG4gICAgdmFyIGNsb3NlID0gbGlzdCA/ICcnIDogY2xpc3Q7XG5cbiAgICBjaHVua3MuYmVmb3JlICs9IG9wZW4gKyAnPGxpPic7XG4gICAgY2h1bmtzLmFmdGVyID0gJzwvbGk+JyArIGNsb3NlICsgY2h1bmtzLmFmdGVyO1xuXG4gICAgaWYgKCFjaHVua3Muc2VsZWN0aW9uKSB7XG4gICAgICBjaHVua3Muc2VsZWN0aW9uID0gc3RyaW5ncy5wbGFjZWhvbGRlcnMubGlzdGl0ZW07XG4gICAgfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gbGlzdDtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gd3JhcHBpbmcgKHRhZywgcGxhY2Vob2xkZXIsIGNodW5rcykge1xuICB2YXIgb3BlbiA9ICc8JyArIHRhZztcbiAgdmFyIGNsb3NlID0gJzwvJyArIHRhZy5yZXBsYWNlKC88L2csICc8LycpO1xuICB2YXIgcmxlYWRpbmcgPSBuZXcgUmVnRXhwKG9wZW4gKyAnKCBbXj5dKik/PiQnLCAnaScpO1xuICB2YXIgcnRyYWlsaW5nID0gbmV3IFJlZ0V4cCgnXicgKyBjbG9zZSArICc+JywgJ2knKTtcbiAgdmFyIHJvcGVuID0gbmV3IFJlZ0V4cChvcGVuICsgJyggW14+XSopPz4nLCAnaWcnKTtcbiAgdmFyIHJjbG9zZSA9IG5ldyBSZWdFeHAoY2xvc2UgKyAnKCBbXj5dKik/PicsICdpZycpO1xuXG4gIGNodW5rcy50cmltKCk7XG5cbiAgdmFyIHRyYWlsID0gcnRyYWlsaW5nLmV4ZWMoY2h1bmtzLmFmdGVyKTtcbiAgdmFyIGxlYWQgPSBybGVhZGluZy5leGVjKGNodW5rcy5iZWZvcmUpO1xuICBpZiAobGVhZCAmJiB0cmFpbCkge1xuICAgIGNodW5rcy5iZWZvcmUgPSBjaHVua3MuYmVmb3JlLnJlcGxhY2UocmxlYWRpbmcsICcnKTtcbiAgICBjaHVua3MuYWZ0ZXIgPSBjaHVua3MuYWZ0ZXIucmVwbGFjZShydHJhaWxpbmcsICcnKTtcbiAgfSBlbHNlIHtcbiAgICBpZiAoIWNodW5rcy5zZWxlY3Rpb24pIHtcbiAgICAgIGNodW5rcy5zZWxlY3Rpb24gPSBwbGFjZWhvbGRlcjtcbiAgICB9XG4gICAgdmFyIG9wZW5lZCA9IHJvcGVuLnRlc3QoY2h1bmtzLnNlbGVjdGlvbik7XG4gICAgaWYgKG9wZW5lZCkge1xuICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZShyb3BlbiwgJycpO1xuICAgICAgaWYgKCFzdXJyb3VuZGVkKGNodW5rcywgdGFnKSkge1xuICAgICAgICBjaHVua3MuYmVmb3JlICs9IG9wZW4gKyAnPic7XG4gICAgICB9XG4gICAgfVxuICAgIHZhciBjbG9zZWQgPSByY2xvc2UudGVzdChjaHVua3Muc2VsZWN0aW9uKTtcbiAgICBpZiAoY2xvc2VkKSB7XG4gICAgICBjaHVua3Muc2VsZWN0aW9uID0gY2h1bmtzLnNlbGVjdGlvbi5yZXBsYWNlKHJjbG9zZSwgJycpO1xuICAgICAgaWYgKCFzdXJyb3VuZGVkKGNodW5rcywgdGFnKSkge1xuICAgICAgICBjaHVua3MuYWZ0ZXIgPSBjbG9zZSArICc+JyArIGNodW5rcy5hZnRlcjtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKG9wZW5lZCB8fCBjbG9zZWQpIHtcbiAgICAgIHB1c2hvdmVyKCk7IHJldHVybjtcbiAgICB9XG4gICAgaWYgKHN1cnJvdW5kZWQoY2h1bmtzLCB0YWcpKSB7XG4gICAgICBpZiAocmxlYWRpbmcudGVzdChjaHVua3MuYmVmb3JlKSkge1xuICAgICAgICBjaHVua3MuYmVmb3JlID0gY2h1bmtzLmJlZm9yZS5yZXBsYWNlKHJsZWFkaW5nLCAnJyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjaHVua3MuYmVmb3JlICs9IGNsb3NlICsgJz4nO1xuICAgICAgfVxuICAgICAgaWYgKHJ0cmFpbGluZy50ZXN0KGNodW5rcy5hZnRlcikpIHtcbiAgICAgICAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2UocnRyYWlsaW5nLCAnJyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjaHVua3MuYWZ0ZXIgPSBvcGVuICsgJz4nICsgY2h1bmtzLmFmdGVyO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoIWNsb3NlYm91bmRlZChjaHVua3MsIHRhZykpIHtcbiAgICAgIGNodW5rcy5hZnRlciA9IGNsb3NlICsgJz4nICsgY2h1bmtzLmFmdGVyO1xuICAgICAgY2h1bmtzLmJlZm9yZSArPSBvcGVuICsgJz4nO1xuICAgIH1cbiAgICBwdXNob3ZlcigpO1xuICB9XG5cbiAgZnVuY3Rpb24gcHVzaG92ZXIgKCkge1xuICAgIGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZSgvPChcXC8pPyhbXj4gXSspKCBbXj5dKik/Pi9pZywgcHVzaG92ZXJPdGhlclRhZ3MpO1xuICB9XG5cbiAgZnVuY3Rpb24gcHVzaG92ZXJPdGhlclRhZ3MgKGFsbCwgY2xvc2luZywgdGFnLCBhLCBpKSB7XG4gICAgdmFyIGF0dHJzID0gYSB8fCAnJztcbiAgICB2YXIgb3BlbiA9ICFjbG9zaW5nO1xuICAgIHZhciByY2xvc2VkID0gbmV3IFJlZ0V4cCgnPFxcLycgKyB0YWcucmVwbGFjZSgvPC9nLCAnPC8nKSArICc+JywgJ2knKTtcbiAgICB2YXIgcm9wZW5lZCA9IG5ldyBSZWdFeHAoJzwnICsgdGFnICsgJyggW14+XSopPz4nLCAnaScpO1xuICAgIGlmIChvcGVuICYmICFyY2xvc2VkLnRlc3QoY2h1bmtzLnNlbGVjdGlvbi5zdWJzdHIoaSkpKSB7XG4gICAgICBjaHVua3Muc2VsZWN0aW9uICs9ICc8LycgKyB0YWcgKyAnPic7XG4gICAgICBjaHVua3MuYWZ0ZXIgPSBjaHVua3MuYWZ0ZXIucmVwbGFjZSgvXig8XFwvW14+XSs+KS8sICckMTwnICsgdGFnICsgYXR0cnMgKyAnPicpO1xuICAgIH1cblxuICAgIGlmIChjbG9zaW5nICYmICFyb3BlbmVkLnRlc3QoY2h1bmtzLnNlbGVjdGlvbi5zdWJzdHIoMCwgaSkpKSB7XG4gICAgICBjaHVua3Muc2VsZWN0aW9uID0gJzwnICsgdGFnICsgYXR0cnMgKyAnPicgKyBjaHVua3Muc2VsZWN0aW9uO1xuICAgICAgY2h1bmtzLmJlZm9yZSA9IGNodW5rcy5iZWZvcmUucmVwbGFjZSgvKDxbXj5dKyg/OiBbXj5dKik/PikkLywgJzwvJyArIHRhZyArICc+JDEnKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gY2xvc2Vib3VuZGVkIChjaHVua3MsIHRhZykge1xuICB2YXIgcmNsb3NlbGVmdCA9IG5ldyBSZWdFeHAoJzwvJyArIHRhZy5yZXBsYWNlKC88L2csICc8LycpICsgJz4kJywgJ2knKTtcbiAgdmFyIHJvcGVucmlnaHQgPSBuZXcgUmVnRXhwKCdePCcgKyB0YWcgKyAnKD86IFtePl0qKT8+JywgJ2knKTtcbiAgdmFyIGJvdW5kZWQgPSByY2xvc2VsZWZ0LnRlc3QoY2h1bmtzLmJlZm9yZSkgJiYgcm9wZW5yaWdodC50ZXN0KGNodW5rcy5hZnRlcik7XG4gIGlmIChib3VuZGVkKSB7XG4gICAgY2h1bmtzLmJlZm9yZSA9IGNodW5rcy5iZWZvcmUucmVwbGFjZShyY2xvc2VsZWZ0LCAnJyk7XG4gICAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2Uocm9wZW5yaWdodCwgJycpO1xuICB9XG4gIHJldHVybiBib3VuZGVkO1xufVxuXG5mdW5jdGlvbiBzdXJyb3VuZGVkIChjaHVua3MsIHRhZykge1xuICB2YXIgcm9wZW4gPSBuZXcgUmVnRXhwKCc8JyArIHRhZyArICcoPzogW14+XSopPz4nLCAnaWcnKTtcbiAgdmFyIHJjbG9zZSA9IG5ldyBSZWdFeHAoJzxcXC8nICsgdGFnLnJlcGxhY2UoLzwvZywgJzwvJykgKyAnPicsICdpZycpO1xuICB2YXIgb3BlbnNCZWZvcmUgPSBjb3VudChjaHVua3MuYmVmb3JlLCByb3Blbik7XG4gIHZhciBvcGVuc0FmdGVyID0gY291bnQoY2h1bmtzLmFmdGVyLCByb3Blbik7XG4gIHZhciBjbG9zZXNCZWZvcmUgPSBjb3VudChjaHVua3MuYmVmb3JlLCByY2xvc2UpO1xuICB2YXIgY2xvc2VzQWZ0ZXIgPSBjb3VudChjaHVua3MuYWZ0ZXIsIHJjbG9zZSk7XG4gIHZhciBvcGVuID0gb3BlbnNCZWZvcmUgLSBjbG9zZXNCZWZvcmUgPiAwO1xuICB2YXIgY2xvc2UgPSBjbG9zZXNBZnRlciAtIG9wZW5zQWZ0ZXIgPiAwO1xuICByZXR1cm4gb3BlbiAmJiBjbG9zZTtcblxuICBmdW5jdGlvbiBjb3VudCAodGV4dCwgcmVnZXgpIHtcbiAgICB2YXIgbWF0Y2ggPSB0ZXh0Lm1hdGNoKHJlZ2V4KTtcbiAgICBpZiAobWF0Y2gpIHtcbiAgICAgIHJldHVybiBtYXRjaC5sZW5ndGg7XG4gICAgfVxuICAgIHJldHVybiAwO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gd3JhcHBpbmc7XG4iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG4ndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGlzVmlzaWJsZUVsZW1lbnQgKGVsZW0pIHtcbiAgaWYgKGdsb2JhbC5nZXRDb21wdXRlZFN0eWxlKSB7XG4gICAgcmV0dXJuIGdsb2JhbC5nZXRDb21wdXRlZFN0eWxlKGVsZW0sIG51bGwpLmdldFByb3BlcnR5VmFsdWUoJ2Rpc3BsYXknKSAhPT0gJ25vbmUnO1xuICB9IGVsc2UgaWYgKGVsZW0uY3VycmVudFN0eWxlKSB7XG4gICAgcmV0dXJuIGVsZW0uY3VycmVudFN0eWxlLmRpc3BsYXkgIT09ICdub25lJztcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzVmlzaWJsZUVsZW1lbnQ7XG5cbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ6dXRmLTg7YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0p6YjNWeVkyVnpJanBiSW5OeVl5OXBjMVpwYzJsaWJHVkZiR1Z0Wlc1MExtcHpJbDBzSW01aGJXVnpJanBiWFN3aWJXRndjR2x1WjNNaU9pSTdRVUZCUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFaUxDSm1hV3hsSWpvaVoyVnVaWEpoZEdWa0xtcHpJaXdpYzI5MWNtTmxVbTl2ZENJNklpSXNJbk52ZFhKalpYTkRiMjUwWlc1MElqcGJJaWQxYzJVZ2MzUnlhV04wSnp0Y2JseHVablZ1WTNScGIyNGdhWE5XYVhOcFlteGxSV3hsYldWdWRDQW9aV3hsYlNrZ2UxeHVJQ0JwWmlBb1oyeHZZbUZzTG1kbGRFTnZiWEIxZEdWa1UzUjViR1VwSUh0Y2JpQWdJQ0J5WlhSMWNtNGdaMnh2WW1Gc0xtZGxkRU52YlhCMWRHVmtVM1I1YkdVb1pXeGxiU3dnYm5Wc2JDa3VaMlYwVUhKdmNHVnlkSGxXWVd4MVpTZ25aR2x6Y0d4aGVTY3BJQ0U5UFNBbmJtOXVaU2M3WEc0Z0lIMGdaV3h6WlNCcFppQW9aV3hsYlM1amRYSnlaVzUwVTNSNWJHVXBJSHRjYmlBZ0lDQnlaWFIxY200Z1pXeGxiUzVqZFhKeVpXNTBVM1I1YkdVdVpHbHpjR3hoZVNBaFBUMGdKMjV2Ym1Vbk8xeHVJQ0I5WEc1OVhHNWNibTF2WkhWc1pTNWxlSEJ2Y25SeklEMGdhWE5XYVhOcFlteGxSV3hsYldWdWREdGNiaUpkZlE9PSIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gbWFueSAodGV4dCwgdGltZXMpIHtcbiAgcmV0dXJuIG5ldyBBcnJheSh0aW1lcyArIDEpLmpvaW4odGV4dCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gbWFueTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIG1hbnkgPSByZXF1aXJlKCcuLi9tYW55Jyk7XG52YXIgZXh0ZW5kUmVnRXhwID0gcmVxdWlyZSgnLi4vZXh0ZW5kUmVnRXhwJyk7XG52YXIgdHJpbUNodW5rcyA9IHJlcXVpcmUoJy4uL2NodW5rcy90cmltJyk7XG52YXIgcmUgPSBSZWdFeHA7XG5cbmZ1bmN0aW9uIE1hcmtkb3duQ2h1bmtzICgpIHtcbn1cblxuTWFya2Rvd25DaHVua3MucHJvdG90eXBlLnRyaW0gPSB0cmltQ2h1bmtzO1xuXG5NYXJrZG93bkNodW5rcy5wcm90b3R5cGUuZmluZFRhZ3MgPSBmdW5jdGlvbiAoc3RhcnRSZWdleCwgZW5kUmVnZXgpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgcmVnZXg7XG5cbiAgaWYgKHN0YXJ0UmVnZXgpIHtcbiAgICByZWdleCA9IGV4dGVuZFJlZ0V4cChzdGFydFJlZ2V4LCAnJywgJyQnKTtcbiAgICB0aGlzLmJlZm9yZSA9IHRoaXMuYmVmb3JlLnJlcGxhY2UocmVnZXgsIHN0YXJ0UmVwbGFjZXIpO1xuICAgIHJlZ2V4ID0gZXh0ZW5kUmVnRXhwKHN0YXJ0UmVnZXgsICdeJywgJycpO1xuICAgIHRoaXMuc2VsZWN0aW9uID0gdGhpcy5zZWxlY3Rpb24ucmVwbGFjZShyZWdleCwgc3RhcnRSZXBsYWNlcik7XG4gIH1cblxuICBpZiAoZW5kUmVnZXgpIHtcbiAgICByZWdleCA9IGV4dGVuZFJlZ0V4cChlbmRSZWdleCwgJycsICckJyk7XG4gICAgdGhpcy5zZWxlY3Rpb24gPSB0aGlzLnNlbGVjdGlvbi5yZXBsYWNlKHJlZ2V4LCBlbmRSZXBsYWNlcik7XG4gICAgcmVnZXggPSBleHRlbmRSZWdFeHAoZW5kUmVnZXgsICdeJywgJycpO1xuICAgIHRoaXMuYWZ0ZXIgPSB0aGlzLmFmdGVyLnJlcGxhY2UocmVnZXgsIGVuZFJlcGxhY2VyKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHN0YXJ0UmVwbGFjZXIgKG1hdGNoKSB7XG4gICAgc2VsZi5zdGFydFRhZyA9IHNlbGYuc3RhcnRUYWcgKyBtYXRjaDsgcmV0dXJuICcnO1xuICB9XG5cbiAgZnVuY3Rpb24gZW5kUmVwbGFjZXIgKG1hdGNoKSB7XG4gICAgc2VsZi5lbmRUYWcgPSBtYXRjaCArIHNlbGYuZW5kVGFnOyByZXR1cm4gJyc7XG4gIH1cbn07XG5cbk1hcmtkb3duQ2h1bmtzLnByb3RvdHlwZS5za2lwID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgdmFyIG8gPSBvcHRpb25zIHx8IHt9O1xuICB2YXIgYmVmb3JlQ291bnQgPSAnYmVmb3JlJyBpbiBvID8gby5iZWZvcmUgOiAxO1xuICB2YXIgYWZ0ZXJDb3VudCA9ICdhZnRlcicgaW4gbyA/IG8uYWZ0ZXIgOiAxO1xuXG4gIHRoaXMuc2VsZWN0aW9uID0gdGhpcy5zZWxlY3Rpb24ucmVwbGFjZSgvKF5cXG4qKS8sICcnKTtcbiAgdGhpcy5zdGFydFRhZyA9IHRoaXMuc3RhcnRUYWcgKyByZS4kMTtcbiAgdGhpcy5zZWxlY3Rpb24gPSB0aGlzLnNlbGVjdGlvbi5yZXBsYWNlKC8oXFxuKiQpLywgJycpO1xuICB0aGlzLmVuZFRhZyA9IHRoaXMuZW5kVGFnICsgcmUuJDE7XG4gIHRoaXMuc3RhcnRUYWcgPSB0aGlzLnN0YXJ0VGFnLnJlcGxhY2UoLyheXFxuKikvLCAnJyk7XG4gIHRoaXMuYmVmb3JlID0gdGhpcy5iZWZvcmUgKyByZS4kMTtcbiAgdGhpcy5lbmRUYWcgPSB0aGlzLmVuZFRhZy5yZXBsYWNlKC8oXFxuKiQpLywgJycpO1xuICB0aGlzLmFmdGVyID0gdGhpcy5hZnRlciArIHJlLiQxO1xuXG4gIGlmICh0aGlzLmJlZm9yZSkge1xuICAgIHRoaXMuYmVmb3JlID0gcmVwbGFjZSh0aGlzLmJlZm9yZSwgKytiZWZvcmVDb3VudCwgJyQnKTtcbiAgfVxuXG4gIGlmICh0aGlzLmFmdGVyKSB7XG4gICAgdGhpcy5hZnRlciA9IHJlcGxhY2UodGhpcy5hZnRlciwgKythZnRlckNvdW50LCAnJyk7XG4gIH1cblxuICBmdW5jdGlvbiByZXBsYWNlICh0ZXh0LCBjb3VudCwgc3VmZml4KSB7XG4gICAgdmFyIHJlZ2V4ID0gby5hbnkgPyAnXFxcXG4qJyA6IG1hbnkoJ1xcXFxuPycsIGNvdW50KTtcbiAgICB2YXIgcmVwbGFjZW1lbnQgPSBtYW55KCdcXG4nLCBjb3VudCk7XG4gICAgcmV0dXJuIHRleHQucmVwbGFjZShuZXcgcmUocmVnZXggKyBzdWZmaXgpLCByZXBsYWNlbWVudCk7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gTWFya2Rvd25DaHVua3M7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBzdHJpbmdzID0gcmVxdWlyZSgnLi4vc3RyaW5ncycpO1xudmFyIHdyYXBwaW5nID0gcmVxdWlyZSgnLi93cmFwcGluZycpO1xudmFyIHNldHRpbmdzID0gcmVxdWlyZSgnLi9zZXR0aW5ncycpO1xudmFyIHJ0cmFpbGJsYW5rbGluZSA9IC8oPlsgXFx0XSopJC87XG52YXIgcmxlYWRibGFua2xpbmUgPSAvXig+WyBcXHRdKikvO1xudmFyIHJuZXdsaW5lZmVuY2luZyA9IC9eKFxcbiopKFteXFxyXSs/KShcXG4qKSQvO1xudmFyIHJlbmR0YWcgPSAvXigoKFxcbnxeKShcXG5bIFxcdF0qKSo+KC4rXFxuKSouKikrKFxcblsgXFx0XSopKikvO1xudmFyIHJsZWFkYnJhY2tldCA9IC9eXFxuKCg+fFxccykqKVxcbi87XG52YXIgcnRyYWlsYnJhY2tldCA9IC9cXG4oKD58XFxzKSopXFxuJC87XG5cbmZ1bmN0aW9uIGJsb2NrcXVvdGUgKGNodW5rcykge1xuICB2YXIgbWF0Y2ggPSAnJztcbiAgdmFyIGxlZnRPdmVyID0gJyc7XG4gIHZhciBsaW5lO1xuXG4gIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc2VsZWN0aW9uLnJlcGxhY2Uocm5ld2xpbmVmZW5jaW5nLCBuZXdsaW5lcmVwbGFjZXIpO1xuICBjaHVua3MuYmVmb3JlID0gY2h1bmtzLmJlZm9yZS5yZXBsYWNlKHJ0cmFpbGJsYW5rbGluZSwgdHJhaWxibGFua2xpbmVyZXBsYWNlcik7XG4gIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc2VsZWN0aW9uLnJlcGxhY2UoL14oXFxzfD4pKyQvLCAnJyk7XG4gIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc2VsZWN0aW9uIHx8IHN0cmluZ3MucGxhY2Vob2xkZXJzLnF1b3RlO1xuXG4gIGlmIChjaHVua3MuYmVmb3JlKSB7XG4gICAgYmVmb3JlUHJvY2Vzc2luZygpO1xuICB9XG5cbiAgY2h1bmtzLnN0YXJ0VGFnID0gbWF0Y2g7XG4gIGNodW5rcy5iZWZvcmUgPSBsZWZ0T3ZlcjtcblxuICBpZiAoY2h1bmtzLmFmdGVyKSB7XG4gICAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2UoL15cXG4/LywgJ1xcbicpO1xuICB9XG5cbiAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2UocmVuZHRhZywgZW5kdGFncmVwbGFjZXIpO1xuXG4gIGlmICgvXig/IVsgXXswLDN9PikvbS50ZXN0KGNodW5rcy5zZWxlY3Rpb24pKSB7XG4gICAgd3JhcHBpbmcud3JhcChjaHVua3MsIHNldHRpbmdzLmxpbmVMZW5ndGggLSAyKTtcbiAgICBjaHVua3Muc2VsZWN0aW9uID0gY2h1bmtzLnNlbGVjdGlvbi5yZXBsYWNlKC9eL2dtLCAnPiAnKTtcbiAgICByZXBsYWNlQmxhbmtzSW5UYWdzKHRydWUpO1xuICAgIGNodW5rcy5za2lwKCk7XG4gIH0gZWxzZSB7XG4gICAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZSgvXlsgXXswLDN9PiA/L2dtLCAnJyk7XG4gICAgd3JhcHBpbmcudW53cmFwKGNodW5rcyk7XG4gICAgcmVwbGFjZUJsYW5rc0luVGFncyhmYWxzZSk7XG5cbiAgICBpZiAoIS9eKFxcbnxeKVsgXXswLDN9Pi8udGVzdChjaHVua3Muc2VsZWN0aW9uKSAmJiBjaHVua3Muc3RhcnRUYWcpIHtcbiAgICAgIGNodW5rcy5zdGFydFRhZyA9IGNodW5rcy5zdGFydFRhZy5yZXBsYWNlKC9cXG57MCwyfSQvLCAnXFxuXFxuJyk7XG4gICAgfVxuXG4gICAgaWYgKCEvKFxcbnxeKVsgXXswLDN9Pi4qJC8udGVzdChjaHVua3Muc2VsZWN0aW9uKSAmJiBjaHVua3MuZW5kVGFnKSB7XG4gICAgICBjaHVua3MuZW5kVGFnID0gY2h1bmtzLmVuZFRhZy5yZXBsYWNlKC9eXFxuezAsMn0vLCAnXFxuXFxuJyk7XG4gICAgfVxuICB9XG5cbiAgaWYgKCEvXFxuLy50ZXN0KGNodW5rcy5zZWxlY3Rpb24pKSB7XG4gICAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZShybGVhZGJsYW5rbGluZSwgbGVhZGJsYW5rbGluZXJlcGxhY2VyKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG5ld2xpbmVyZXBsYWNlciAoYWxsLCBiZWZvcmUsIHRleHQsIGFmdGVyKSB7XG4gICAgY2h1bmtzLmJlZm9yZSArPSBiZWZvcmU7XG4gICAgY2h1bmtzLmFmdGVyID0gYWZ0ZXIgKyBjaHVua3MuYWZ0ZXI7XG4gICAgcmV0dXJuIHRleHQ7XG4gIH1cblxuICBmdW5jdGlvbiB0cmFpbGJsYW5rbGluZXJlcGxhY2VyIChhbGwsIGJsYW5rKSB7XG4gICAgY2h1bmtzLnNlbGVjdGlvbiA9IGJsYW5rICsgY2h1bmtzLnNlbGVjdGlvbjsgcmV0dXJuICcnO1xuICB9XG5cbiAgZnVuY3Rpb24gbGVhZGJsYW5rbGluZXJlcGxhY2VyIChhbGwsIGJsYW5rcykge1xuICAgIGNodW5rcy5zdGFydFRhZyArPSBibGFua3M7IHJldHVybiAnJztcbiAgfVxuXG4gIGZ1bmN0aW9uIGJlZm9yZVByb2Nlc3NpbmcgKCkge1xuICAgIHZhciBsaW5lcyA9IGNodW5rcy5iZWZvcmUucmVwbGFjZSgvXFxuJC8sICcnKS5zcGxpdCgnXFxuJyk7XG4gICAgdmFyIGNoYWluZWQgPSBmYWxzZTtcbiAgICB2YXIgZ29vZDtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGluZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGdvb2QgPSBmYWxzZTtcbiAgICAgIGxpbmUgPSBsaW5lc1tpXTtcbiAgICAgIGNoYWluZWQgPSBjaGFpbmVkICYmIGxpbmUubGVuZ3RoID4gMDtcbiAgICAgIGlmICgvXj4vLnRlc3QobGluZSkpIHtcbiAgICAgICAgZ29vZCA9IHRydWU7XG4gICAgICAgIGlmICghY2hhaW5lZCAmJiBsaW5lLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICBjaGFpbmVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICgvXlsgXFx0XSokLy50ZXN0KGxpbmUpKSB7XG4gICAgICAgIGdvb2QgPSB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZ29vZCA9IGNoYWluZWQ7XG4gICAgICB9XG4gICAgICBpZiAoZ29vZCkge1xuICAgICAgICBtYXRjaCArPSBsaW5lICsgJ1xcbic7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsZWZ0T3ZlciArPSBtYXRjaCArIGxpbmU7XG4gICAgICAgIG1hdGNoID0gJ1xcbic7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCEvKF58XFxuKT4vLnRlc3QobWF0Y2gpKSB7XG4gICAgICBsZWZ0T3ZlciArPSBtYXRjaDtcbiAgICAgIG1hdGNoID0gJyc7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZW5kdGFncmVwbGFjZXIgKGFsbCkge1xuICAgIGNodW5rcy5lbmRUYWcgPSBhbGw7IHJldHVybiAnJztcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlcGxhY2VCbGFua3NJblRhZ3MgKGJyYWNrZXQpIHtcbiAgICB2YXIgcmVwbGFjZW1lbnQgPSBicmFja2V0ID8gJz4gJyA6ICcnO1xuXG4gICAgaWYgKGNodW5rcy5zdGFydFRhZykge1xuICAgICAgY2h1bmtzLnN0YXJ0VGFnID0gY2h1bmtzLnN0YXJ0VGFnLnJlcGxhY2UocnRyYWlsYnJhY2tldCwgcmVwbGFjZXIpO1xuICAgIH1cbiAgICBpZiAoY2h1bmtzLmVuZFRhZykge1xuICAgICAgY2h1bmtzLmVuZFRhZyA9IGNodW5rcy5lbmRUYWcucmVwbGFjZShybGVhZGJyYWNrZXQsIHJlcGxhY2VyKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiByZXBsYWNlciAoYWxsLCBtYXJrZG93bikge1xuICAgICAgcmV0dXJuICdcXG4nICsgbWFya2Rvd24ucmVwbGFjZSgvXlsgXXswLDN9Pj9bIFxcdF0qJC9nbSwgcmVwbGFjZW1lbnQpICsgJ1xcbic7XG4gICAgfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYmxvY2txdW90ZTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHJsZWFkaW5nID0gL14oXFwqKikvO1xudmFyIHJ0cmFpbGluZyA9IC8oXFwqKiQpLztcbnZhciBydHJhaWxpbmdzcGFjZSA9IC8oXFxzPykkLztcbnZhciBzdHJpbmdzID0gcmVxdWlyZSgnLi4vc3RyaW5ncycpO1xuXG5mdW5jdGlvbiBib2xkT3JJdGFsaWMgKGNodW5rcywgdHlwZSkge1xuICB2YXIgcm5ld2xpbmVzID0gL1xcbnsyLH0vZztcbiAgdmFyIHN0YXJDb3VudCA9IHR5cGUgPT09ICdib2xkJyA/IDIgOiAxO1xuXG4gIGNodW5rcy50cmltKCk7XG4gIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc2VsZWN0aW9uLnJlcGxhY2Uocm5ld2xpbmVzLCAnXFxuJyk7XG5cbiAgdmFyIG1hcmt1cDtcbiAgdmFyIGxlYWRTdGFycyA9IHJ0cmFpbGluZy5leGVjKGNodW5rcy5iZWZvcmUpWzBdO1xuICB2YXIgdHJhaWxTdGFycyA9IHJsZWFkaW5nLmV4ZWMoY2h1bmtzLmFmdGVyKVswXTtcbiAgdmFyIHN0YXJzID0gJ1xcXFwqeycgKyBzdGFyQ291bnQgKyAnfSc7XG4gIHZhciBmZW5jZSA9IE1hdGgubWluKGxlYWRTdGFycy5sZW5ndGgsIHRyYWlsU3RhcnMubGVuZ3RoKTtcbiAgaWYgKGZlbmNlID49IHN0YXJDb3VudCAmJiAoZmVuY2UgIT09IDIgfHwgc3RhckNvdW50ICE9PSAxKSkge1xuICAgIGNodW5rcy5iZWZvcmUgPSBjaHVua3MuYmVmb3JlLnJlcGxhY2UobmV3IFJlZ0V4cChzdGFycyArICckJywgJycpLCAnJyk7XG4gICAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2UobmV3IFJlZ0V4cCgnXicgKyBzdGFycywgJycpLCAnJyk7XG4gIH0gZWxzZSBpZiAoIWNodW5rcy5zZWxlY3Rpb24gJiYgdHJhaWxTdGFycykge1xuICAgIGNodW5rcy5hZnRlciA9IGNodW5rcy5hZnRlci5yZXBsYWNlKHJsZWFkaW5nLCAnJyk7XG4gICAgY2h1bmtzLmJlZm9yZSA9IGNodW5rcy5iZWZvcmUucmVwbGFjZShydHJhaWxpbmdzcGFjZSwgJycpICsgdHJhaWxTdGFycyArIFJlZ0V4cC4kMTtcbiAgfSBlbHNlIHtcbiAgICBpZiAoIWNodW5rcy5zZWxlY3Rpb24gJiYgIXRyYWlsU3RhcnMpIHtcbiAgICAgIGNodW5rcy5zZWxlY3Rpb24gPSBzdHJpbmdzLnBsYWNlaG9sZGVyc1t0eXBlXTtcbiAgICB9XG5cbiAgICBtYXJrdXAgPSBzdGFyQ291bnQgPT09IDEgPyAnKicgOiAnKionO1xuICAgIGNodW5rcy5iZWZvcmUgPSBjaHVua3MuYmVmb3JlICsgbWFya3VwO1xuICAgIGNodW5rcy5hZnRlciA9IG1hcmt1cCArIGNodW5rcy5hZnRlcjtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJvbGRPckl0YWxpYztcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHN0cmluZ3MgPSByZXF1aXJlKCcuLi9zdHJpbmdzJyk7XG52YXIgcnRleHRiZWZvcmUgPSAvXFxTWyBdKiQvO1xudmFyIHJ0ZXh0YWZ0ZXIgPSAvXlsgXSpcXFMvO1xudmFyIHJuZXdsaW5lID0gL1xcbi87XG52YXIgcmJhY2t0aWNrID0gL2AvO1xudmFyIHJmZW5jZWJlZm9yZSA9IC9gYGBbYS16XSpcXG4/JC87XG52YXIgcmZlbmNlYmVmb3JlaW5zaWRlID0gL15gYGBbYS16XSpcXG4vO1xudmFyIHJmZW5jZWFmdGVyID0gL15cXG4/YGBgLztcbnZhciByZmVuY2VhZnRlcmluc2lkZSA9IC9cXG5gYGAkLztcblxuZnVuY3Rpb24gY29kZWJsb2NrIChjaHVua3MsIG9wdGlvbnMpIHtcbiAgdmFyIG5ld2xpbmVkID0gcm5ld2xpbmUudGVzdChjaHVua3Muc2VsZWN0aW9uKTtcbiAgdmFyIHRyYWlsaW5nID0gcnRleHRhZnRlci50ZXN0KGNodW5rcy5hZnRlcik7XG4gIHZhciBsZWFkaW5nID0gcnRleHRiZWZvcmUudGVzdChjaHVua3MuYmVmb3JlKTtcbiAgdmFyIG91dGZlbmNlZCA9IHJmZW5jZWJlZm9yZS50ZXN0KGNodW5rcy5iZWZvcmUpICYmIHJmZW5jZWFmdGVyLnRlc3QoY2h1bmtzLmFmdGVyKTtcbiAgaWYgKG91dGZlbmNlZCB8fCBuZXdsaW5lZCB8fCAhKGxlYWRpbmcgfHwgdHJhaWxpbmcpKSB7XG4gICAgYmxvY2sob3V0ZmVuY2VkKTtcbiAgfSBlbHNlIHtcbiAgICBpbmxpbmUoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGlubGluZSAoKSB7XG4gICAgY2h1bmtzLnRyaW0oKTtcbiAgICBjaHVua3MuZmluZFRhZ3MocmJhY2t0aWNrLCByYmFja3RpY2spO1xuXG4gICAgaWYgKCFjaHVua3Muc3RhcnRUYWcgJiYgIWNodW5rcy5lbmRUYWcpIHtcbiAgICAgIGNodW5rcy5zdGFydFRhZyA9IGNodW5rcy5lbmRUYWcgPSAnYCc7XG4gICAgICBpZiAoIWNodW5rcy5zZWxlY3Rpb24pIHtcbiAgICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9IHN0cmluZ3MucGxhY2Vob2xkZXJzLmNvZGU7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChjaHVua3MuZW5kVGFnICYmICFjaHVua3Muc3RhcnRUYWcpIHtcbiAgICAgIGNodW5rcy5iZWZvcmUgKz0gY2h1bmtzLmVuZFRhZztcbiAgICAgIGNodW5rcy5lbmRUYWcgPSAnJztcbiAgICB9IGVsc2Uge1xuICAgICAgY2h1bmtzLnN0YXJ0VGFnID0gY2h1bmtzLmVuZFRhZyA9ICcnO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGJsb2NrIChvdXRmZW5jZWQpIHtcbiAgICBpZiAob3V0ZmVuY2VkKSB7XG4gICAgICBjaHVua3MuYmVmb3JlID0gY2h1bmtzLmJlZm9yZS5yZXBsYWNlKHJmZW5jZWJlZm9yZSwgJycpO1xuICAgICAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2UocmZlbmNlYWZ0ZXIsICcnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjaHVua3MuYmVmb3JlID0gY2h1bmtzLmJlZm9yZS5yZXBsYWNlKC9bIF17NH18YGBgW2Etel0qXFxuJC8sIG1lcmdlU2VsZWN0aW9uKTtcbiAgICBjaHVua3Muc2tpcCh7XG4gICAgICBiZWZvcmU6IC8oXFxufF4pKFxcdHxbIF17NCx9fGBgYFthLXpdKlxcbikuKlxcbiQvLnRlc3QoY2h1bmtzLmJlZm9yZSkgPyAwIDogMSxcbiAgICAgIGFmdGVyOiAvXlxcbihcXHR8WyBdezQsfXxcXG5gYGApLy50ZXN0KGNodW5rcy5hZnRlcikgPyAwIDogMVxuICAgIH0pO1xuXG4gICAgaWYgKCFjaHVua3Muc2VsZWN0aW9uKSB7XG4gICAgICBpZiAob3B0aW9ucy5mZW5jaW5nKSB7XG4gICAgICAgIGNodW5rcy5zdGFydFRhZyA9ICdgYGBcXG4nO1xuICAgICAgICBjaHVua3MuZW5kVGFnID0gJ1xcbmBgYCc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjaHVua3Muc3RhcnRUYWcgPSAnICAgICc7XG4gICAgICB9XG4gICAgICBjaHVua3Muc2VsZWN0aW9uID0gc3RyaW5ncy5wbGFjZWhvbGRlcnMuY29kZTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHJmZW5jZWJlZm9yZWluc2lkZS50ZXN0KGNodW5rcy5zZWxlY3Rpb24pICYmIHJmZW5jZWFmdGVyaW5zaWRlLnRlc3QoY2h1bmtzLnNlbGVjdGlvbikpIHtcbiAgICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZSgvKF5gYGBbYS16XSpcXG4pfChgYGAkKS9nLCAnJyk7XG4gICAgICB9IGVsc2UgaWYgKC9eWyBdezAsM31cXFMvbS50ZXN0KGNodW5rcy5zZWxlY3Rpb24pKSB7XG4gICAgICAgIGlmIChvcHRpb25zLmZlbmNpbmcpIHtcbiAgICAgICAgICBjaHVua3MuYmVmb3JlICs9ICdgYGBcXG4nO1xuICAgICAgICAgIGNodW5rcy5hZnRlciA9ICdcXG5gYGAnICsgY2h1bmtzLmFmdGVyO1xuICAgICAgICB9IGVsc2UgaWYgKG5ld2xpbmVkKSB7XG4gICAgICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZSgvXi9nbSwgJyAgICAnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjaHVua3MuYmVmb3JlICs9ICcgICAgJztcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZSgvXig/OlsgXXs0fXxbIF17MCwzfVxcdHxgYGBbYS16XSopL2dtLCAnJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbWVyZ2VTZWxlY3Rpb24gKGFsbCkge1xuICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9IGFsbCArIGNodW5rcy5zZWxlY3Rpb247IHJldHVybiAnJztcbiAgICB9XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjb2RlYmxvY2s7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBtYW55ID0gcmVxdWlyZSgnLi4vbWFueScpO1xudmFyIHN0cmluZ3MgPSByZXF1aXJlKCcuLi9zdHJpbmdzJyk7XG5cbmZ1bmN0aW9uIGhlYWRpbmcgKGNodW5rcykge1xuICB2YXIgbGV2ZWwgPSAwO1xuXG4gIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc2VsZWN0aW9uXG4gICAgLnJlcGxhY2UoL1xccysvZywgJyAnKVxuICAgIC5yZXBsYWNlKC8oXlxccyt8XFxzKyQpL2csICcnKTtcblxuICBpZiAoIWNodW5rcy5zZWxlY3Rpb24pIHtcbiAgICBjaHVua3Muc3RhcnRUYWcgPSAnIyAnO1xuICAgIGNodW5rcy5zZWxlY3Rpb24gPSBzdHJpbmdzLnBsYWNlaG9sZGVycy5oZWFkaW5nO1xuICAgIGNodW5rcy5lbmRUYWcgPSAnJztcbiAgICBjaHVua3Muc2tpcCh7IGJlZm9yZTogMSwgYWZ0ZXI6IDEgfSk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY2h1bmtzLmZpbmRUYWdzKC8jK1sgXSovLCAvWyBdKiMrLyk7XG5cbiAgaWYgKC8jKy8udGVzdChjaHVua3Muc3RhcnRUYWcpKSB7XG4gICAgbGV2ZWwgPSBSZWdFeHAubGFzdE1hdGNoLmxlbmd0aDtcbiAgfVxuXG4gIGNodW5rcy5zdGFydFRhZyA9IGNodW5rcy5lbmRUYWcgPSAnJztcbiAgY2h1bmtzLmZpbmRUYWdzKG51bGwsIC9cXHM/KC0rfD0rKS8pO1xuXG4gIGlmICgvPSsvLnRlc3QoY2h1bmtzLmVuZFRhZykpIHtcbiAgICBsZXZlbCA9IDE7XG4gIH1cblxuICBpZiAoLy0rLy50ZXN0KGNodW5rcy5lbmRUYWcpKSB7XG4gICAgbGV2ZWwgPSAyO1xuICB9XG5cbiAgY2h1bmtzLnN0YXJ0VGFnID0gY2h1bmtzLmVuZFRhZyA9ICcnO1xuICBjaHVua3Muc2tpcCh7IGJlZm9yZTogMSwgYWZ0ZXI6IDEgfSk7XG5cbiAgLy8gY2hlY2tzIHRoZSBuZXh0IGhlYWRpbmcgc2l6ZSB0byBpbXBsZW1lbnQuIENoYW5nZXMgdG8gMCBpZiA0IGlzIHJlYWNoZWQuXG4gIHZhciBsZXZlbFRvQ3JlYXRlID0gbGV2ZWwgPiAzID8gMCA6IGxldmVsICsgMTtcbiAgaWYgKGxldmVsVG9DcmVhdGUgPT09IDApIHtcbiAgICBjaHVua3Muc3RhcnRUYWcgPSBjaHVua3Muc3RhcnRUYWcucmVwbGFjZSgvIysvLCAnJyk7XG4gIH1cbiAgZWxzZSB7XG4gICAgY2h1bmtzLnN0YXJ0VGFnID0gbWFueSgnIycsIGxldmVsVG9DcmVhdGUpICsgJyAnO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaGVhZGluZztcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gaHIgKGNodW5rcykge1xuICBjaHVua3Muc3RhcnRUYWcgPSAnLS0tLS0tLS0tLVxcbic7XG4gIGNodW5rcy5zZWxlY3Rpb24gPSAnJztcbiAgY2h1bmtzLnNraXAoeyBsZWZ0OiAyLCByaWdodDogMSwgYW55OiB0cnVlIH0pO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGhyO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgb25jZSA9IHJlcXVpcmUoJy4uL29uY2UnKTtcbnZhciBzdHJpbmdzID0gcmVxdWlyZSgnLi4vc3RyaW5ncycpO1xudmFyIHBhcnNlTGlua0lucHV0ID0gcmVxdWlyZSgnLi4vY2h1bmtzL3BhcnNlTGlua0lucHV0Jyk7XG52YXIgcmRlZmluaXRpb25zID0gL15bIF17MCwzfVxcWygoPzphdHRhY2htZW50LSk/XFxkKylcXF06WyBcXHRdKlxcbj9bIFxcdF0qPD8oXFxTKz8pPj9bIFxcdF0qXFxuP1sgXFx0XSooPzooXFxuKilbXCIoXSguKz8pW1wiKV1bIFxcdF0qKT8oPzpcXG4rfCQpL2dtO1xudmFyIHJhdHRhY2htZW50ID0gL15hdHRhY2htZW50LShcXGQrKSQvaTtcblxuZnVuY3Rpb24gZXh0cmFjdERlZmluaXRpb25zICh0ZXh0LCBkZWZpbml0aW9ucykge1xuICByZGVmaW5pdGlvbnMubGFzdEluZGV4ID0gMDtcbiAgcmV0dXJuIHRleHQucmVwbGFjZShyZGVmaW5pdGlvbnMsIHJlcGxhY2VyKTtcblxuICBmdW5jdGlvbiByZXBsYWNlciAoYWxsLCBpZCwgbGluaywgbmV3bGluZXMsIHRpdGxlKSB7XG4gICAgZGVmaW5pdGlvbnNbaWRdID0gYWxsLnJlcGxhY2UoL1xccyokLywgJycpO1xuICAgIGlmIChuZXdsaW5lcykge1xuICAgICAgZGVmaW5pdGlvbnNbaWRdID0gYWxsLnJlcGxhY2UoL1tcIihdKC4rPylbXCIpXSQvLCAnJyk7XG4gICAgICByZXR1cm4gbmV3bGluZXMgKyB0aXRsZTtcbiAgICB9XG4gICAgcmV0dXJuICcnO1xuICB9XG59XG5cbmZ1bmN0aW9uIHB1c2hEZWZpbml0aW9uIChjaHVua3MsIGRlZmluaXRpb24sIGF0dGFjaG1lbnQpIHtcbiAgdmFyIHJlZ2V4ID0gLyhcXFspKCg/OlxcW1teXFxdXSpcXF18W15cXFtcXF1dKSopKFxcXVsgXT8oPzpcXG5bIF0qKT9cXFspKCg/OmF0dGFjaG1lbnQtKT9cXGQrKShcXF0pL2c7XG4gIHZhciBhbmNob3IgPSAwO1xuICB2YXIgZGVmaW5pdGlvbnMgPSB7fTtcbiAgdmFyIGZvb3Rub3RlcyA9IFtdO1xuXG4gIGNodW5rcy5iZWZvcmUgPSBleHRyYWN0RGVmaW5pdGlvbnMoY2h1bmtzLmJlZm9yZSwgZGVmaW5pdGlvbnMpO1xuICBjaHVua3Muc2VsZWN0aW9uID0gZXh0cmFjdERlZmluaXRpb25zKGNodW5rcy5zZWxlY3Rpb24sIGRlZmluaXRpb25zKTtcbiAgY2h1bmtzLmFmdGVyID0gZXh0cmFjdERlZmluaXRpb25zKGNodW5rcy5hZnRlciwgZGVmaW5pdGlvbnMpO1xuICBjaHVua3MuYmVmb3JlID0gY2h1bmtzLmJlZm9yZS5yZXBsYWNlKHJlZ2V4LCBnZXRMaW5rKTtcblxuICBpZiAoZGVmaW5pdGlvbikge1xuICAgIGlmICghYXR0YWNobWVudCkgeyBwdXNoQW5jaG9yKGRlZmluaXRpb24pOyB9XG4gIH0gZWxzZSB7XG4gICAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZShyZWdleCwgZ2V0TGluayk7XG4gIH1cblxuICB2YXIgcmVzdWx0ID0gYW5jaG9yO1xuXG4gIGNodW5rcy5hZnRlciA9IGNodW5rcy5hZnRlci5yZXBsYWNlKHJlZ2V4LCBnZXRMaW5rKTtcblxuICBpZiAoY2h1bmtzLmFmdGVyKSB7XG4gICAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2UoL1xcbiokLywgJycpO1xuICB9XG4gIGlmICghY2h1bmtzLmFmdGVyKSB7XG4gICAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZSgvXFxuKiQvLCAnJyk7XG4gIH1cblxuICBhbmNob3IgPSAwO1xuICBPYmplY3Qua2V5cyhkZWZpbml0aW9ucykuZm9yRWFjaChwdXNoQXR0YWNobWVudHMpO1xuXG4gIGlmIChhdHRhY2htZW50KSB7XG4gICAgcHVzaEFuY2hvcihkZWZpbml0aW9uKTtcbiAgfVxuICBjaHVua3MuYWZ0ZXIgKz0gJ1xcblxcbicgKyBmb290bm90ZXMuam9pbignXFxuJyk7XG5cbiAgcmV0dXJuIHJlc3VsdDtcblxuICBmdW5jdGlvbiBwdXNoQXR0YWNobWVudHMgKGRlZmluaXRpb24pIHtcbiAgICBpZiAocmF0dGFjaG1lbnQudGVzdChkZWZpbml0aW9uKSkge1xuICAgICAgcHVzaEFuY2hvcihkZWZpbml0aW9uc1tkZWZpbml0aW9uXSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcHVzaEFuY2hvciAoZGVmaW5pdGlvbikge1xuICAgIGFuY2hvcisrO1xuICAgIGRlZmluaXRpb24gPSBkZWZpbml0aW9uLnJlcGxhY2UoL15bIF17MCwzfVxcWyhhdHRhY2htZW50LSk/KFxcZCspXFxdOi8sICcgIFskMScgKyBhbmNob3IgKyAnXTonKTtcbiAgICBmb290bm90ZXMucHVzaChkZWZpbml0aW9uKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldExpbmsgKGFsbCwgYmVmb3JlLCBpbm5lciwgYWZ0ZXJJbm5lciwgZGVmaW5pdGlvbiwgZW5kKSB7XG4gICAgaW5uZXIgPSBpbm5lci5yZXBsYWNlKHJlZ2V4LCBnZXRMaW5rKTtcbiAgICBpZiAoZGVmaW5pdGlvbnNbZGVmaW5pdGlvbl0pIHtcbiAgICAgIHB1c2hBbmNob3IoZGVmaW5pdGlvbnNbZGVmaW5pdGlvbl0pO1xuICAgICAgcmV0dXJuIGJlZm9yZSArIGlubmVyICsgYWZ0ZXJJbm5lciArIGFuY2hvciArIGVuZDtcbiAgICB9XG4gICAgcmV0dXJuIGFsbDtcbiAgfVxufVxuXG5mdW5jdGlvbiBsaW5rT3JJbWFnZU9yQXR0YWNobWVudCAoY2h1bmtzLCBvcHRpb25zKSB7XG4gIHZhciB0eXBlID0gb3B0aW9ucy50eXBlO1xuICB2YXIgaW1hZ2UgPSB0eXBlID09PSAnaW1hZ2UnO1xuICB2YXIgcmVzdW1lO1xuXG4gIGNodW5rcy50cmltKCk7XG4gIGNodW5rcy5maW5kVGFncygvXFxzKiE/XFxbLywgL1xcXVsgXT8oPzpcXG5bIF0qKT8oXFxbLio/XFxdKT8vKTtcblxuICBpZiAoY2h1bmtzLmVuZFRhZy5sZW5ndGggPiAxICYmIGNodW5rcy5zdGFydFRhZy5sZW5ndGggPiAwKSB7XG4gICAgY2h1bmtzLnN0YXJ0VGFnID0gY2h1bmtzLnN0YXJ0VGFnLnJlcGxhY2UoLyE/XFxbLywgJycpO1xuICAgIGNodW5rcy5lbmRUYWcgPSAnJztcbiAgICBwdXNoRGVmaW5pdGlvbihjaHVua3MpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc3RhcnRUYWcgKyBjaHVua3Muc2VsZWN0aW9uICsgY2h1bmtzLmVuZFRhZztcbiAgY2h1bmtzLnN0YXJ0VGFnID0gY2h1bmtzLmVuZFRhZyA9ICcnO1xuXG4gIGlmICgvXFxuXFxuLy50ZXN0KGNodW5rcy5zZWxlY3Rpb24pKSB7XG4gICAgcHVzaERlZmluaXRpb24oY2h1bmtzKTtcbiAgICByZXR1cm47XG4gIH1cbiAgcmVzdW1lID0gdGhpcy5hc3luYygpO1xuXG4gIG9wdGlvbnMucHJvbXB0cy5jbG9zZSgpO1xuICAob3B0aW9ucy5wcm9tcHRzW3R5cGVdIHx8IG9wdGlvbnMucHJvbXB0cy5saW5rKShvcHRpb25zLCBvbmNlKHJlc29sdmVkKSk7XG5cbiAgZnVuY3Rpb24gcmVzb2x2ZWQgKHJlc3VsdCkge1xuICAgIHZhciBsaW5rID0gcGFyc2VMaW5rSW5wdXQocmVzdWx0LmRlZmluaXRpb24pO1xuICAgIGlmIChsaW5rLmhyZWYubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXN1bWUoKTsgcmV0dXJuO1xuICAgIH1cblxuICAgIGNodW5rcy5zZWxlY3Rpb24gPSAoJyAnICsgY2h1bmtzLnNlbGVjdGlvbikucmVwbGFjZSgvKFteXFxcXF0oPzpcXFxcXFxcXCkqKSg/PVtbXFxdXSkvZywgJyQxXFxcXCcpLnN1YnN0cigxKTtcblxuICAgIHZhciBrZXkgPSByZXN1bHQuYXR0YWNobWVudCA/ICcgIFthdHRhY2htZW50LTk5OTldOiAnIDogJyBbOTk5OV06ICc7XG4gICAgdmFyIGRlZmluaXRpb24gPSBrZXkgKyBsaW5rLmhyZWYgKyAobGluay50aXRsZSA/ICcgXCInICsgbGluay50aXRsZSArICdcIicgOiAnJyk7XG4gICAgdmFyIGFuY2hvciA9IHB1c2hEZWZpbml0aW9uKGNodW5rcywgZGVmaW5pdGlvbiwgcmVzdWx0LmF0dGFjaG1lbnQpO1xuXG4gICAgaWYgKCFyZXN1bHQuYXR0YWNobWVudCkge1xuICAgICAgYWRkKCk7XG4gICAgfVxuXG4gICAgcmVzdW1lKCk7XG5cbiAgICBmdW5jdGlvbiBhZGQgKCkge1xuICAgICAgY2h1bmtzLnN0YXJ0VGFnID0gaW1hZ2UgPyAnIVsnIDogJ1snO1xuICAgICAgY2h1bmtzLmVuZFRhZyA9ICddWycgKyBhbmNob3IgKyAnXSc7XG5cbiAgICAgIGlmICghY2h1bmtzLnNlbGVjdGlvbikge1xuICAgICAgICBjaHVua3Muc2VsZWN0aW9uID0gc3RyaW5ncy5wbGFjZWhvbGRlcnNbdHlwZV07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gbGlua09ySW1hZ2VPckF0dGFjaG1lbnQ7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBtYW55ID0gcmVxdWlyZSgnLi4vbWFueScpO1xudmFyIHN0cmluZ3MgPSByZXF1aXJlKCcuLi9zdHJpbmdzJyk7XG52YXIgd3JhcHBpbmcgPSByZXF1aXJlKCcuL3dyYXBwaW5nJyk7XG52YXIgc2V0dGluZ3MgPSByZXF1aXJlKCcuL3NldHRpbmdzJyk7XG52YXIgcnByZXZpb3VzID0gLyhcXG58XikoKFsgXXswLDN9KFsqKy1dfFxcZCtbLl0pWyBcXHRdKy4qKShcXG4uK3xcXG57Mix9KFsqKy1dLip8XFxkK1suXSlbIFxcdF0rLip8XFxuezIsfVsgXFx0XStcXFMuKikqKVxcbiokLztcbnZhciBybmV4dCA9IC9eXFxuKigoWyBdezAsM30oWyorLV18XFxkK1suXSlbIFxcdF0rLiopKFxcbi4rfFxcbnsyLH0oWyorLV0uKnxcXGQrWy5dKVsgXFx0XSsuKnxcXG57Mix9WyBcXHRdK1xcUy4qKSopXFxuKi87XG52YXIgcmJ1bGxldHR5cGUgPSAvXlxccyooWyorLV0pLztcbnZhciByc2tpcHBlciA9IC9bXlxcbl1cXG5cXG5bXlxcbl0vO1xuXG5mdW5jdGlvbiBwYWQgKHRleHQpIHtcbiAgcmV0dXJuICcgJyArIHRleHQgKyAnICc7XG59XG5cbmZ1bmN0aW9uIGxpc3QgKGNodW5rcywgb3JkZXJlZCkge1xuICB2YXIgYnVsbGV0ID0gJy0nO1xuICB2YXIgbnVtID0gMTtcbiAgdmFyIGRpZ2l0YWw7XG4gIHZhciBiZWZvcmVTa2lwID0gMTtcbiAgdmFyIGFmdGVyU2tpcCA9IDE7XG5cbiAgY2h1bmtzLmZpbmRUYWdzKC8oXFxufF4pKlsgXXswLDN9KFsqKy1dfFxcZCtbLl0pXFxzKy8sIG51bGwpO1xuXG4gIGlmIChjaHVua3MuYmVmb3JlICYmICEvXFxuJC8udGVzdChjaHVua3MuYmVmb3JlKSAmJiAhL15cXG4vLnRlc3QoY2h1bmtzLnN0YXJ0VGFnKSkge1xuICAgIGNodW5rcy5iZWZvcmUgKz0gY2h1bmtzLnN0YXJ0VGFnO1xuICAgIGNodW5rcy5zdGFydFRhZyA9ICcnO1xuICB9XG5cbiAgaWYgKGNodW5rcy5zdGFydFRhZykge1xuICAgIGRpZ2l0YWwgPSAvXFxkK1suXS8udGVzdChjaHVua3Muc3RhcnRUYWcpO1xuICAgIGNodW5rcy5zdGFydFRhZyA9ICcnO1xuICAgIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc2VsZWN0aW9uLnJlcGxhY2UoL1xcblsgXXs0fS9nLCAnXFxuJyk7XG4gICAgd3JhcHBpbmcudW53cmFwKGNodW5rcyk7XG4gICAgY2h1bmtzLnNraXAoKTtcblxuICAgIGlmIChkaWdpdGFsKSB7XG4gICAgICBjaHVua3MuYWZ0ZXIgPSBjaHVua3MuYWZ0ZXIucmVwbGFjZShybmV4dCwgZ2V0UHJlZml4ZWRJdGVtKTtcbiAgICB9XG4gICAgaWYgKG9yZGVyZWQgPT09IGRpZ2l0YWwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH1cblxuICBjaHVua3MuYmVmb3JlID0gY2h1bmtzLmJlZm9yZS5yZXBsYWNlKHJwcmV2aW91cywgYmVmb3JlUmVwbGFjZXIpO1xuXG4gIGlmICghY2h1bmtzLnNlbGVjdGlvbikge1xuICAgIGNodW5rcy5zZWxlY3Rpb24gPSBzdHJpbmdzLnBsYWNlaG9sZGVycy5saXN0aXRlbTtcbiAgfVxuXG4gIHZhciBwcmVmaXggPSBuZXh0QnVsbGV0KCk7XG4gIHZhciBzcGFjZXMgPSBtYW55KCcgJywgcHJlZml4Lmxlbmd0aCk7XG5cbiAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2Uocm5leHQsIGFmdGVyUmVwbGFjZXIpO1xuICBjaHVua3MudHJpbSh0cnVlKTtcbiAgY2h1bmtzLnNraXAoeyBiZWZvcmU6IGJlZm9yZVNraXAsIGFmdGVyOiBhZnRlclNraXAsIGFueTogdHJ1ZSB9KTtcbiAgY2h1bmtzLnN0YXJ0VGFnID0gcHJlZml4O1xuICB3cmFwcGluZy53cmFwKGNodW5rcywgc2V0dGluZ3MubGluZUxlbmd0aCAtIHByZWZpeC5sZW5ndGgpO1xuICBjaHVua3Muc2VsZWN0aW9uID0gY2h1bmtzLnNlbGVjdGlvbi5yZXBsYWNlKC9cXG4vZywgJ1xcbicgKyBzcGFjZXMpO1xuXG4gIGZ1bmN0aW9uIGJlZm9yZVJlcGxhY2VyICh0ZXh0KSB7XG4gICAgaWYgKHJidWxsZXR0eXBlLnRlc3QodGV4dCkpIHtcbiAgICAgIGJ1bGxldCA9IFJlZ0V4cC4kMTtcbiAgICB9XG4gICAgYmVmb3JlU2tpcCA9IHJza2lwcGVyLnRlc3QodGV4dCkgPyAxIDogMDtcbiAgICByZXR1cm4gZ2V0UHJlZml4ZWRJdGVtKHRleHQpO1xuICB9XG5cbiAgZnVuY3Rpb24gYWZ0ZXJSZXBsYWNlciAodGV4dCkge1xuICAgIGFmdGVyU2tpcCA9IHJza2lwcGVyLnRlc3QodGV4dCkgPyAxIDogMDtcbiAgICByZXR1cm4gZ2V0UHJlZml4ZWRJdGVtKHRleHQpO1xuICB9XG5cbiAgZnVuY3Rpb24gbmV4dEJ1bGxldCAoKSB7XG4gICAgaWYgKG9yZGVyZWQpIHtcbiAgICAgIHJldHVybiBwYWQoKG51bSsrKSArICcuJyk7XG4gICAgfVxuICAgIHJldHVybiBwYWQoYnVsbGV0KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldFByZWZpeGVkSXRlbSAodGV4dCkge1xuICAgIHZhciBybWFya2VycyA9IC9eWyBdezAsM30oWyorLV18XFxkK1suXSlcXHMvZ207XG4gICAgcmV0dXJuIHRleHQucmVwbGFjZShybWFya2VycywgbmV4dEJ1bGxldCk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBsaXN0O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgbGluZUxlbmd0aDogNzJcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBwcmVmaXhlcyA9ICcoPzpcXFxcc3s0LH18XFxcXHMqPnxcXFxccyotXFxcXHMrfFxcXFxzKlxcXFxkK1xcXFwufD18XFxcXCt8LXxffFxcXFwqfCN8XFxcXHMqXFxcXFtbXlxcbl1dK1xcXFxdOiknO1xudmFyIHJsZWFkaW5ncHJlZml4ZXMgPSBuZXcgUmVnRXhwKCdeJyArIHByZWZpeGVzLCAnJyk7XG52YXIgcnRleHQgPSBuZXcgUmVnRXhwKCcoW15cXFxcbl0pXFxcXG4oPyEoXFxcXG58JyArIHByZWZpeGVzICsgJykpJywgJ2cnKTtcbnZhciBydHJhaWxpbmdzcGFjZXMgPSAvXFxzKyQvO1xuXG5mdW5jdGlvbiB3cmFwIChjaHVua3MsIGxlbikge1xuICB2YXIgcmVnZXggPSBuZXcgUmVnRXhwKCcoLnsxLCcgKyBsZW4gKyAnfSkoICt8JFxcXFxuPyknLCAnZ20nKTtcblxuICB1bndyYXAoY2h1bmtzKTtcbiAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb25cbiAgICAucmVwbGFjZShyZWdleCwgcmVwbGFjZXIpXG4gICAgLnJlcGxhY2UocnRyYWlsaW5nc3BhY2VzLCAnJyk7XG5cbiAgZnVuY3Rpb24gcmVwbGFjZXIgKGxpbmUsIG1hcmtlZCkge1xuICAgIHJldHVybiBybGVhZGluZ3ByZWZpeGVzLnRlc3QobGluZSkgPyBsaW5lIDogbWFya2VkICsgJ1xcbic7XG4gIH1cbn1cblxuZnVuY3Rpb24gdW53cmFwIChjaHVua3MpIHtcbiAgcnRleHQubGFzdEluZGV4ID0gMDtcbiAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZShydGV4dCwgJyQxICQyJyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICB3cmFwOiB3cmFwLFxuICB1bndyYXA6IHVud3JhcFxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gb25jZSAoZm4pIHtcbiAgdmFyIGRpc3Bvc2VkO1xuICByZXR1cm4gZnVuY3Rpb24gZGlzcG9zYWJsZSAoKSB7XG4gICAgaWYgKGRpc3Bvc2VkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGRpc3Bvc2VkID0gdHJ1ZTtcbiAgICByZXR1cm4gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBvbmNlO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZG9jID0gZG9jdW1lbnQ7XG5cbmZ1bmN0aW9uIGhvbWVicmV3UVNBIChjbGFzc05hbWUpIHtcbiAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgdmFyIGFsbCA9IGRvYy5nZXRFbGVtZW50c0J5VGFnTmFtZSgnKicpO1xuICB2YXIgaTtcbiAgZm9yIChpIGluIGFsbCkge1xuICAgIGlmICh3cmFwKGFsbFtpXS5jbGFzc05hbWUpLmluZGV4T2Yod3JhcChjbGFzc05hbWUpKSAhPT0gLTEpIHtcbiAgICAgIHJlc3VsdHMucHVzaChhbGxbaV0pO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzdWx0cztcbn1cblxuZnVuY3Rpb24gd3JhcCAodGV4dCkge1xuICByZXR1cm4gJyAnICsgdGV4dCArICcgJztcbn1cblxuZnVuY3Rpb24gY2xvc2VQcm9tcHRzICgpIHtcbiAgaWYgKGRvYy5ib2R5LnF1ZXJ5U2VsZWN0b3JBbGwpIHtcbiAgICByZW1vdmUoZG9jLmJvZHkucXVlcnlTZWxlY3RvckFsbCgnLndrLXByb21wdCcpKTtcbiAgfSBlbHNlIHtcbiAgICByZW1vdmUoaG9tZWJyZXdRU0EoJ3drLXByb21wdCcpKTtcbiAgfVxufVxuXG5mdW5jdGlvbiByZW1vdmUgKHByb21wdHMpIHtcbiAgdmFyIGxlbiA9IHByb21wdHMubGVuZ3RoO1xuICB2YXIgaTtcbiAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgcHJvbXB0c1tpXS5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKHByb21wdHNbaV0pO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gY2xvc2VQcm9tcHRzO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgY3Jvc3N2ZW50ID0gcmVxdWlyZSgnY3Jvc3N2ZW50Jyk7XG52YXIgcmVuZGVyID0gcmVxdWlyZSgnLi9yZW5kZXInKTtcbnZhciBjbGFzc2VzID0gcmVxdWlyZSgnLi4vY2xhc3NlcycpO1xudmFyIHN0cmluZ3MgPSByZXF1aXJlKCcuLi9zdHJpbmdzJyk7XG52YXIgdXBsb2FkcyA9IHJlcXVpcmUoJy4uL3VwbG9hZHMnKTtcbnZhciBFTlRFUl9LRVkgPSAxMztcbnZhciBFU0NBUEVfS0VZID0gMjc7XG52YXIgZHJhZ0NsYXNzID0gJ3drLWRyYWdnaW5nJztcbnZhciBkcmFnQ2xhc3NTcGVjaWZpYyA9ICd3ay1wcm9tcHQtdXBsb2FkLWRyYWdnaW5nJztcbnZhciByb290ID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50O1xuXG5mdW5jdGlvbiBhbHdheXMgKCkge1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gY2xhc3NpZnkgKGdyb3VwLCBjbGFzc2VzKSB7XG4gIE9iamVjdC5rZXlzKGdyb3VwKS5mb3JFYWNoKGN1c3RvbWl6ZSk7XG4gIGZ1bmN0aW9uIGN1c3RvbWl6ZSAoa2V5KSB7XG4gICAgaWYgKGNsYXNzZXNba2V5XSkge1xuICAgICAgZ3JvdXBba2V5XS5jbGFzc05hbWUgKz0gJyAnICsgY2xhc3Nlc1trZXldO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBwcm9tcHQgKG9wdGlvbnMsIGRvbmUpIHtcbiAgdmFyIHNjcm9sbFNpemUgPSAwOyAvLyBGb3Igd2luZG93LnNjcm9sbCBcbiAgdmFyIHRleHQgPSBzdHJpbmdzLnByb21wdHNbb3B0aW9ucy50eXBlXTtcbiAgdmFyIGRvbSA9IHJlbmRlcih7XG4gICAgaWQ6ICd3ay1wcm9tcHQtJyArIG9wdGlvbnMudHlwZSxcbiAgICB0aXRsZTogdGV4dC50aXRsZSxcbiAgICBkZXNjcmlwdGlvbjogdGV4dC5kZXNjcmlwdGlvbixcbiAgICBwbGFjZWhvbGRlcjogdGV4dC5wbGFjZWhvbGRlclxuICB9KTtcbiAgdmFyIGRvbXVwO1xuXG4gIGNyb3NzdmVudC5hZGQoZG9tLmNhbmNlbCwgJ2NsaWNrJywgcmVtb3ZlKTtcbiAgY3Jvc3N2ZW50LmFkZChyb290LCAnY2xpY2snLCByb290Q2xpY2spO1xuICBjcm9zc3ZlbnQuYWRkKGRvbS5jbG9zZSwgJ2NsaWNrJywgcmVtb3ZlKTtcbiAgY3Jvc3N2ZW50LmFkZChkb20ub2ssICdjbGljaycsIG9rKTtcbiAgY3Jvc3N2ZW50LmFkZChkb20uaW5wdXQsICdrZXlwcmVzcycsIGVudGVyKTtcbiAgY3Jvc3N2ZW50LmFkZChkb20uZGlhbG9nLCAna2V5ZG93bicsIGVzYyk7XG4gIGNsYXNzaWZ5KGRvbSwgb3B0aW9ucy5jbGFzc2VzLnByb21wdHMpO1xuXG4gIC8vIERpc2FwcGVhcmluZyB0aGUgcG9wdXAgd2hlbiBzY3JvbGxlZC5cbiAgd2luZG93Lm9uc2Nyb2xsID0gZnVuY3Rpb24gKCkge1xuICAgIHNjcm9sbFNpemUrKztcbiAgICBpZiAoc2Nyb2xsU2l6ZSA+IDEwKSB7XG4gICAgICByZW1vdmUoKTtcbiAgICB9XG4gIH07XG5cbiAgdmFyIHhociA9IG9wdGlvbnMueGhyO1xuICB2YXIgdXBsb2FkID0gb3B0aW9ucy51cGxvYWQ7XG4gIGlmICh0eXBlb2YgdXBsb2FkID09PSAnc3RyaW5nJykge1xuICAgIHVwbG9hZCA9IHsgdXJsOiB1cGxvYWQgfTtcbiAgfVxuICBpZiAodXBsb2FkKSB7XG4gICAgYXJyYW5nZVVwbG9hZHMoKTtcbiAgfVxuICBpZiAob3B0aW9ucy5hdXRvVXBsb2FkKSB7XG4gICAgc3VibWl0KG9wdGlvbnMuYXV0b1VwbG9hZCk7XG4gIH1cblxuICBzZXRUaW1lb3V0KGZvY3VzRGlhbG9nLCAwKTtcblxuICBmdW5jdGlvbiBmb2N1c0RpYWxvZyAoKSB7XG4gICAgZG9tLmlucHV0LmZvY3VzKCk7XG4gIH1cblxuICAvLyBmdW5jdGlvbiB3aWxsIGJlIGNhbGxlZCB3aGVuIGNsaWNrIGFueSBvdGhlciBwbGFjZSBleGNlcHQgdGhlIGVkaXRvciBib3ggYW5kIG9uQ2xpY2sgaXQgd2lsbCByZW1vdmUgdGhlIHBvcHVwLlxuICBmdW5jdGlvbiByb290Q2xpY2sgKGUpIHtcbiAgICB2YXIgZWRpdG9yQ2xhc3NMaXN0ID0gZS50YXJnZXQuY2xhc3NMaXN0LnZhbHVlO1xuICAgIGlmICghZWRpdG9yQ2xhc3NMaXN0LmluY2x1ZGVzKCd3ay1wcm9tcHQnKSkge1xuICAgICAgcmVtb3ZlKCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZW50ZXIgKGUpIHtcbiAgICB2YXIga2V5ID0gZS53aGljaCB8fCBlLmtleUNvZGU7XG4gICAgaWYgKGtleSA9PT0gRU5URVJfS0VZKSB7XG4gICAgICBvaygpO1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGVzYyAoZSkge1xuICAgIHZhciBrZXkgPSBlLndoaWNoIHx8IGUua2V5Q29kZTtcbiAgICBpZiAoa2V5ID09PSBFU0NBUEVfS0VZKSB7XG4gICAgICByZW1vdmUoKTtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBvayAoKSB7XG4gICAgcmVtb3ZlKCk7XG4gICAgZG9uZSh7IGRlZmluaXRpb246IGRvbS5pbnB1dC52YWx1ZSB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbW92ZSAoKSB7XG4gICAgaWYgKHVwbG9hZCkgeyBiaW5kVXBsb2FkRXZlbnRzKHRydWUpOyB9XG4gICAgaWYgKGRvbS5kaWFsb2cucGFyZW50RWxlbWVudCkgeyBkb20uZGlhbG9nLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQoZG9tLmRpYWxvZyk7IH1cbiAgICBvcHRpb25zLnN1cmZhY2UuZm9jdXMob3B0aW9ucy5tb2RlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGJpbmRVcGxvYWRFdmVudHMgKHJlbW92ZSkge1xuICAgIHZhciBvcCA9IHJlbW92ZSA/ICdyZW1vdmUnIDogJ2FkZCc7XG4gICAgY3Jvc3N2ZW50W29wXShyb290LCAnZHJhZ2VudGVyJywgZHJhZ2dpbmcpO1xuICAgIGNyb3NzdmVudFtvcF0ocm9vdCwgJ2RyYWdlbmQnLCBkcmFnc3RvcCk7XG4gICAgY3Jvc3N2ZW50W29wXShyb290LCAnbW91c2VvdXQnLCBkcmFnc3RvcCk7XG4gIH1cblxuICBmdW5jdGlvbiB3YXJuICgpIHtcbiAgICBjbGFzc2VzLmFkZChkb211cC53YXJuaW5nLCAnd2stcHJvbXB0LWVycm9yLXNob3cnKTtcbiAgfVxuICBmdW5jdGlvbiBkcmFnZ2luZyAoKSB7XG4gICAgY2xhc3Nlcy5hZGQoZG9tdXAuYXJlYSwgZHJhZ0NsYXNzKTtcbiAgICBjbGFzc2VzLmFkZChkb211cC5hcmVhLCBkcmFnQ2xhc3NTcGVjaWZpYyk7XG4gIH1cbiAgZnVuY3Rpb24gZHJhZ3N0b3AgKCkge1xuICAgIGNsYXNzZXMucm0oZG9tdXAuYXJlYSwgZHJhZ0NsYXNzKTtcbiAgICBjbGFzc2VzLnJtKGRvbXVwLmFyZWEsIGRyYWdDbGFzc1NwZWNpZmljKTtcbiAgICB1cGxvYWRzLnN0b3Aob3B0aW9ucy5zdXJmYWNlLmRyb3BhcmVhKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFycmFuZ2VVcGxvYWRzICgpIHtcbiAgICBkb211cCA9IHJlbmRlci51cGxvYWRzKGRvbSwgc3RyaW5ncy5wcm9tcHRzLnR5cGVzICsgKHVwbG9hZC5yZXN0cmljdGlvbiB8fCBvcHRpb25zLnR5cGUgKyAncycpKTtcbiAgICBiaW5kVXBsb2FkRXZlbnRzKCk7XG5cbiAgICBjcm9zc3ZlbnQuYWRkKGRvbXVwLmZpbGVpbnB1dCwgJ2NoYW5nZScsIGhhbmRsZUNoYW5nZSwgZmFsc2UpO1xuICAgIGNyb3NzdmVudC5hZGQoZG9tdXAuYXJlYSwgJ2RyYWdvdmVyJywgaGFuZGxlRHJhZ092ZXIsIGZhbHNlKTtcbiAgICBjcm9zc3ZlbnQuYWRkKGRvbXVwLmFyZWEsICdkcm9wJywgaGFuZGxlRmlsZVNlbGVjdCwgZmFsc2UpO1xuICAgIGNsYXNzaWZ5KGRvbXVwLCBvcHRpb25zLmNsYXNzZXMucHJvbXB0cyk7XG4gIH1cblxuICBmdW5jdGlvbiBoYW5kbGVDaGFuZ2UgKGUpIHtcbiAgICBzdG9wKGUpO1xuICAgIHN1Ym1pdChkb211cC5maWxlaW5wdXQuZmlsZXMpO1xuICAgIGRvbXVwLmZpbGVpbnB1dC52YWx1ZSA9ICcnO1xuICAgIGRvbXVwLmZpbGVpbnB1dC52YWx1ZSA9IG51bGw7XG4gIH1cblxuICBmdW5jdGlvbiBoYW5kbGVEcmFnT3ZlciAoZSkge1xuICAgIHN0b3AoZSk7XG4gICAgZS5kYXRhVHJhbnNmZXIuZHJvcEVmZmVjdCA9ICdjb3B5JztcbiAgfVxuXG4gIGZ1bmN0aW9uIGhhbmRsZUZpbGVTZWxlY3QgKGUpIHtcbiAgICBkcmFnc3RvcCgpO1xuICAgIHN0b3AoZSk7XG4gICAgc3VibWl0KGUuZGF0YVRyYW5zZmVyLmZpbGVzKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHN0b3AgKGUpIHtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHZhbGlkIChmaWxlcykge1xuICAgIHZhciBpO1xuICAgIGZvciAoaSA9IDA7IGkgPCBmaWxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKCh1cGxvYWQudmFsaWRhdGUgfHwgYWx3YXlzKShmaWxlc1tpXSkpIHtcbiAgICAgICAgcmV0dXJuIGZpbGVzW2ldO1xuICAgICAgfVxuICAgIH1cbiAgICB3YXJuKCk7XG4gIH1cblxuICBmdW5jdGlvbiBzdWJtaXQgKGZpbGVzKSB7XG4gICAgY2xhc3Nlcy5ybShkb211cC5mYWlsZWQsICd3ay1wcm9tcHQtZXJyb3Itc2hvdycpO1xuICAgIGNsYXNzZXMucm0oZG9tdXAud2FybmluZywgJ3drLXByb21wdC1lcnJvci1zaG93Jyk7XG4gICAgdmFyIGZpbGUgPSB2YWxpZChmaWxlcyk7XG4gICAgaWYgKCFmaWxlKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciBmb3JtID0gbmV3IEZvcm1EYXRhKCk7XG4gICAgdmFyIHJlcSA9IHtcbiAgICAgICdDb250ZW50LVR5cGUnOiAnbXVsdGlwYXJ0L2Zvcm0tZGF0YScsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgIEFjY2VwdDogJ2FwcGxpY2F0aW9uL2pzb24nXG4gICAgICB9LFxuICAgICAgbWV0aG9kOiB1cGxvYWQubWV0aG9kIHx8ICdQVVQnLFxuICAgICAgdXJsOiB1cGxvYWQudXJsLFxuICAgICAgYm9keTogZm9ybVxuICAgIH07XG5cbiAgICBmb3JtLmFwcGVuZCh1cGxvYWQua2V5IHx8ICd3b29mbWFya191cGxvYWQnLCBmaWxlLCBmaWxlLm5hbWUpO1xuICAgIGNsYXNzZXMuYWRkKGRvbXVwLmFyZWEsICd3ay1wcm9tcHQtdXBsb2FkaW5nJyk7XG4gICAgeGhyKHJlcSwgaGFuZGxlUmVzcG9uc2UpO1xuXG4gICAgZnVuY3Rpb24gaGFuZGxlUmVzcG9uc2UgKGVyciwgcmVzLCBib2R5KSB7XG4gICAgICBjbGFzc2VzLnJtKGRvbXVwLmFyZWEsICd3ay1wcm9tcHQtdXBsb2FkaW5nJyk7XG4gICAgICBpZiAoZXJyIHx8IHJlcy5zdGF0dXNDb2RlIDwgMjAwIHx8IHJlcy5zdGF0dXNDb2RlID4gMjk5KSB7XG4gICAgICAgIGNsYXNzZXMuYWRkKGRvbXVwLmZhaWxlZCwgJ3drLXByb21wdC1lcnJvci1zaG93Jyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGRvbS5pbnB1dC52YWx1ZSA9IGJvZHkuaHJlZiArICcgXCInICsgYm9keS50aXRsZSArICdcIic7XG4gICAgICByZW1vdmUoKTtcbiAgICAgIGRvbmUoeyBkZWZpbml0aW9uOiBkb20uaW5wdXQudmFsdWUsIGF0dGFjaG1lbnQ6IG9wdGlvbnMudHlwZSA9PT0gJ2F0dGFjaG1lbnQnIH0pO1xuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHByb21wdDtcbiIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIGNyb3NzdmVudCA9IHJlcXVpcmUoJ2Nyb3NzdmVudCcpO1xudmFyIGdldFRleHQgPSByZXF1aXJlKCcuLi9nZXRUZXh0Jyk7XG52YXIgc2V0VGV4dCA9IHJlcXVpcmUoJy4uL3NldFRleHQnKTtcbnZhciBjbGFzc2VzID0gcmVxdWlyZSgnLi4vY2xhc3NlcycpO1xudmFyIHN0cmluZ3MgPSByZXF1aXJlKCcuLi9zdHJpbmdzJyk7XG52YXIgYWMgPSAnYXBwZW5kQ2hpbGQnO1xudmFyIGRvYyA9IGdsb2JhbC5kb2N1bWVudDtcblxuZnVuY3Rpb24gZSAodHlwZSwgY2xzLCB0ZXh0KSB7XG4gIHZhciBlbCA9IGRvYy5jcmVhdGVFbGVtZW50KHR5cGUpO1xuICBlbC5jbGFzc05hbWUgPSBjbHM7XG4gIGlmICh0ZXh0KSB7XG4gICAgc2V0VGV4dChlbCwgdGV4dCk7XG4gIH1cbiAgcmV0dXJuIGVsO1xufVxuXG5mdW5jdGlvbiByZW5kZXIgKG9wdGlvbnMpIHtcbiAgdmFyIGRvbSA9IHtcbiAgICBkaWFsb2c6IGUoJ2FydGljbGUnLCAnd2stcHJvbXB0ICcgKyBvcHRpb25zLmlkKSxcbiAgICBjbG9zZTogZSgnYScsICd3ay1wcm9tcHQtY2xvc2UnKSxcbiAgICBoZWFkZXI6IGUoJ2hlYWRlcicsICd3ay1wcm9tcHQtaGVhZGVyJyksXG4gICAgaDE6IGUoJ2gxJywgJ3drLXByb21wdC10aXRsZScsIG9wdGlvbnMudGl0bGUpLFxuICAgIHNlY3Rpb246IGUoJ3NlY3Rpb24nLCAnd2stcHJvbXB0LWJvZHknKSxcbiAgICBkZXNjOiBlKCdwJywgJ3drLXByb21wdC1kZXNjcmlwdGlvbicsIG9wdGlvbnMuZGVzY3JpcHRpb24pLFxuICAgIGlucHV0Q29udGFpbmVyOiBlKCdkaXYnLCAnd2stcHJvbXB0LWlucHV0LWNvbnRhaW5lcicpLFxuICAgIGlucHV0OiBlKCdpbnB1dCcsICd3ay1wcm9tcHQtaW5wdXQnKSxcbiAgICBjYW5jZWw6IGUoJ2J1dHRvbicsICd3ay1wcm9tcHQtY2FuY2VsJywgJ0NhbmNlbCcpLFxuICAgIG9rOiBlKCdidXR0b24nLCAnd2stcHJvbXB0LW9rJywgJ09rJyksXG4gICAgZm9vdGVyOiBlKCdmb290ZXInLCAnd2stcHJvbXB0LWJ1dHRvbnMnKVxuICB9O1xuICBkb20ub2sudHlwZSA9ICdidXR0b24nO1xuICBkb20uaGVhZGVyW2FjXShkb20uaDEpO1xuICBkb20uc2VjdGlvblthY10oZG9tLmRlc2MpO1xuICBkb20uc2VjdGlvblthY10oZG9tLmlucHV0Q29udGFpbmVyKTtcbiAgZG9tLmlucHV0Q29udGFpbmVyW2FjXShkb20uaW5wdXQpO1xuICBkb20uaW5wdXQucGxhY2Vob2xkZXIgPSBvcHRpb25zLnBsYWNlaG9sZGVyO1xuICBkb20uY2FuY2VsLnR5cGUgPSAnYnV0dG9uJztcbiAgZG9tLmZvb3RlclthY10oZG9tLmNhbmNlbCk7XG4gIGRvbS5mb290ZXJbYWNdKGRvbS5vayk7XG4gIGRvbS5kaWFsb2dbYWNdKGRvbS5jbG9zZSk7XG4gIGRvbS5kaWFsb2dbYWNdKGRvbS5oZWFkZXIpO1xuICBkb20uZGlhbG9nW2FjXShkb20uc2VjdGlvbik7XG4gIGRvbS5kaWFsb2dbYWNdKGRvbS5mb290ZXIpO1xuICBkb2MuYm9keVthY10oZG9tLmRpYWxvZyk7XG4gIHJldHVybiBkb207XG59XG5cbmZ1bmN0aW9uIHVwbG9hZHMgKGRvbSwgd2FybmluZykge1xuICB2YXIgZnVwID0gJ3drLXByb21wdC1maWxldXBsb2FkJztcbiAgdmFyIGRvbXVwID0ge1xuICAgIGFyZWE6IGUoJ3NlY3Rpb24nLCAnd2stcHJvbXB0LXVwbG9hZC1hcmVhJyksXG4gICAgd2FybmluZzogZSgncCcsICd3ay1wcm9tcHQtZXJyb3Igd2std2FybmluZycsIHdhcm5pbmcpLFxuICAgIGZhaWxlZDogZSgncCcsICd3ay1wcm9tcHQtZXJyb3Igd2stZmFpbGVkJywgc3RyaW5ncy5wcm9tcHRzLnVwbG9hZGZhaWxlZCksXG4gICAgdXBsb2FkOiBlKCdsYWJlbCcsICd3ay1wcm9tcHQtdXBsb2FkJyksXG4gICAgdXBsb2FkaW5nOiBlKCdzcGFuJywgJ3drLXByb21wdC1wcm9ncmVzcycsIHN0cmluZ3MucHJvbXB0cy51cGxvYWRpbmcpLFxuICAgIGRyb3A6IGUoJ3NwYW4nLCAnd2stcHJvbXB0LWRyb3AnLCBzdHJpbmdzLnByb21wdHMuZHJvcCksXG4gICAgZHJvcGljb246IGUoJ3AnLCAnd2stZHJvcC1pY29uIHdrLXByb21wdC1kcm9wLWljb24nKSxcbiAgICBicm93c2U6IGUoJ3NwYW4nLCAnd2stcHJvbXB0LWJyb3dzZScsIHN0cmluZ3MucHJvbXB0cy5icm93c2UpLFxuICAgIGRyYWdkcm9wOiBlKCdwJywgJ3drLXByb21wdC1kcmFnZHJvcCcsIHN0cmluZ3MucHJvbXB0cy5kcm9waGludCksXG4gICAgZmlsZWlucHV0OiBlKCdpbnB1dCcsIGZ1cClcbiAgfTtcbiAgZG9tdXAuYXJlYVthY10oZG9tdXAuZHJvcCk7XG4gIGRvbXVwLmFyZWFbYWNdKGRvbXVwLnVwbG9hZGluZyk7XG4gIGRvbXVwLmFyZWFbYWNdKGRvbXVwLmRyb3BpY29uKTtcbiAgZG9tdXAudXBsb2FkW2FjXShkb211cC5icm93c2UpO1xuICBkb211cC51cGxvYWRbYWNdKGRvbXVwLmZpbGVpbnB1dCk7XG4gIGRvbXVwLmZpbGVpbnB1dC5pZCA9IGZ1cDtcbiAgZG9tdXAuZmlsZWlucHV0LnR5cGUgPSAnZmlsZSc7XG4gIGRvbS5kaWFsb2cuY2xhc3NOYW1lICs9ICcgd2stcHJvbXB0LXVwbG9hZHMnO1xuICBkb20uaW5wdXRDb250YWluZXIuY2xhc3NOYW1lICs9ICcgd2stcHJvbXB0LWlucHV0LWNvbnRhaW5lci11cGxvYWRzJztcbiAgZG9tLmlucHV0LmNsYXNzTmFtZSArPSAnIHdrLXByb21wdC1pbnB1dC11cGxvYWRzJztcbiAgZG9tLnNlY3Rpb24uaW5zZXJ0QmVmb3JlKGRvbXVwLndhcm5pbmcsIGRvbS5pbnB1dENvbnRhaW5lcik7XG4gIGRvbS5zZWN0aW9uLmluc2VydEJlZm9yZShkb211cC5mYWlsZWQsIGRvbS5pbnB1dENvbnRhaW5lcik7XG4gIGRvbS5zZWN0aW9uW2FjXShkb211cC51cGxvYWQpO1xuICBkb20uc2VjdGlvblthY10oZG9tdXAuZHJhZ2Ryb3ApO1xuICBkb20uc2VjdGlvblthY10oZG9tdXAuYXJlYSk7XG4gIHNldFRleHQoZG9tLmRlc2MsIGdldFRleHQoZG9tLmRlc2MpICsgc3RyaW5ncy5wcm9tcHRzLnVwbG9hZCk7XG4gIGNyb3NzdmVudC5hZGQoZG9tdXAuZmlsZWlucHV0LCAnZm9jdXMnLCBmb2N1c2VkRmlsZUlucHV0KTtcbiAgY3Jvc3N2ZW50LmFkZChkb211cC5maWxlaW5wdXQsICdibHVyJywgYmx1cnJlZEZpbGVJbnB1dCk7XG5cbiAgZnVuY3Rpb24gZm9jdXNlZEZpbGVJbnB1dCAoKSB7XG4gICAgY2xhc3Nlcy5hZGQoZG9tdXAudXBsb2FkLCAnd2stZm9jdXNlZCcpO1xuICB9XG4gIGZ1bmN0aW9uIGJsdXJyZWRGaWxlSW5wdXQgKCkge1xuICAgIGNsYXNzZXMucm0oZG9tdXAudXBsb2FkLCAnd2stZm9jdXNlZCcpO1xuICB9XG4gIHJldHVybiBkb211cDtcbn1cblxucmVuZGVyLnVwbG9hZHMgPSB1cGxvYWRzO1xubW9kdWxlLmV4cG9ydHMgPSByZW5kZXI7XG5cbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ6dXRmLTg7YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0p6YjNWeVkyVnpJanBiSW5OeVl5OXdjbTl0Y0hSekwzSmxibVJsY2k1cWN5SmRMQ0p1WVcxbGN5STZXMTBzSW0xaGNIQnBibWR6SWpvaU8wRkJRVUU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVNJc0ltWnBiR1VpT2lKblpXNWxjbUYwWldRdWFuTWlMQ0p6YjNWeVkyVlNiMjkwSWpvaUlpd2ljMjkxY21ObGMwTnZiblJsYm5RaU9sc2lKM1Z6WlNCemRISnBZM1FuTzF4dVhHNTJZWElnWTNKdmMzTjJaVzUwSUQwZ2NtVnhkV2x5WlNnblkzSnZjM04yWlc1MEp5azdYRzUyWVhJZ1oyVjBWR1Y0ZENBOUlISmxjWFZwY21Vb0p5NHVMMmRsZEZSbGVIUW5LVHRjYm5aaGNpQnpaWFJVWlhoMElEMGdjbVZ4ZFdseVpTZ25MaTR2YzJWMFZHVjRkQ2NwTzF4dWRtRnlJR05zWVhOelpYTWdQU0J5WlhGMWFYSmxLQ2N1TGk5amJHRnpjMlZ6SnlrN1hHNTJZWElnYzNSeWFXNW5jeUE5SUhKbGNYVnBjbVVvSnk0dUwzTjBjbWx1WjNNbktUdGNiblpoY2lCaFl5QTlJQ2RoY0hCbGJtUkRhR2xzWkNjN1hHNTJZWElnWkc5aklEMGdaMnh2WW1Gc0xtUnZZM1Z0Wlc1ME8xeHVYRzVtZFc1amRHbHZiaUJsSUNoMGVYQmxMQ0JqYkhNc0lIUmxlSFFwSUh0Y2JpQWdkbUZ5SUdWc0lEMGdaRzlqTG1OeVpXRjBaVVZzWlcxbGJuUW9kSGx3WlNrN1hHNGdJR1ZzTG1Oc1lYTnpUbUZ0WlNBOUlHTnNjenRjYmlBZ2FXWWdLSFJsZUhRcElIdGNiaUFnSUNCelpYUlVaWGgwS0dWc0xDQjBaWGgwS1R0Y2JpQWdmVnh1SUNCeVpYUjFjbTRnWld3N1hHNTlYRzVjYm1aMWJtTjBhVzl1SUhKbGJtUmxjaUFvYjNCMGFXOXVjeWtnZTF4dUlDQjJZWElnWkc5dElEMGdlMXh1SUNBZ0lHUnBZV3h2WnpvZ1pTZ25ZWEowYVdOc1pTY3NJQ2QzYXkxd2NtOXRjSFFnSnlBcklHOXdkR2x2Ym5NdWFXUXBMRnh1SUNBZ0lHTnNiM05sT2lCbEtDZGhKeXdnSjNkckxYQnliMjF3ZEMxamJHOXpaU2NwTEZ4dUlDQWdJR2hsWVdSbGNqb2daU2duYUdWaFpHVnlKeXdnSjNkckxYQnliMjF3ZEMxb1pXRmtaWEluS1N4Y2JpQWdJQ0JvTVRvZ1pTZ25hREVuTENBbmQyc3RjSEp2YlhCMExYUnBkR3hsSnl3Z2IzQjBhVzl1Y3k1MGFYUnNaU2tzWEc0Z0lDQWdjMlZqZEdsdmJqb2daU2duYzJWamRHbHZiaWNzSUNkM2F5MXdjbTl0Y0hRdFltOWtlU2NwTEZ4dUlDQWdJR1JsYzJNNklHVW9KM0FuTENBbmQyc3RjSEp2YlhCMExXUmxjMk55YVhCMGFXOXVKeXdnYjNCMGFXOXVjeTVrWlhOamNtbHdkR2x2Ymlrc1hHNGdJQ0FnYVc1d2RYUkRiMjUwWVdsdVpYSTZJR1VvSjJScGRpY3NJQ2QzYXkxd2NtOXRjSFF0YVc1d2RYUXRZMjl1ZEdGcGJtVnlKeWtzWEc0Z0lDQWdhVzV3ZFhRNklHVW9KMmx1Y0hWMEp5d2dKM2RyTFhCeWIyMXdkQzFwYm5CMWRDY3BMRnh1SUNBZ0lHTmhibU5sYkRvZ1pTZ25ZblYwZEc5dUp5d2dKM2RyTFhCeWIyMXdkQzFqWVc1alpXd25MQ0FuUTJGdVkyVnNKeWtzWEc0Z0lDQWdiMnM2SUdVb0oySjFkSFJ2Ymljc0lDZDNheTF3Y205dGNIUXRiMnNuTENBblQyc25LU3hjYmlBZ0lDQm1iMjkwWlhJNklHVW9KMlp2YjNSbGNpY3NJQ2QzYXkxd2NtOXRjSFF0WW5WMGRHOXVjeWNwWEc0Z0lIMDdYRzRnSUdSdmJTNXZheTUwZVhCbElEMGdKMkoxZEhSdmJpYzdYRzRnSUdSdmJTNW9aV0ZrWlhKYllXTmRLR1J2YlM1b01TazdYRzRnSUdSdmJTNXpaV04wYVc5dVcyRmpYU2hrYjIwdVpHVnpZeWs3WEc0Z0lHUnZiUzV6WldOMGFXOXVXMkZqWFNoa2IyMHVhVzV3ZFhSRGIyNTBZV2x1WlhJcE8xeHVJQ0JrYjIwdWFXNXdkWFJEYjI1MFlXbHVaWEpiWVdOZEtHUnZiUzVwYm5CMWRDazdYRzRnSUdSdmJTNXBibkIxZEM1d2JHRmpaV2h2YkdSbGNpQTlJRzl3ZEdsdmJuTXVjR3hoWTJWb2IyeGtaWEk3WEc0Z0lHUnZiUzVqWVc1alpXd3VkSGx3WlNBOUlDZGlkWFIwYjI0bk8xeHVJQ0JrYjIwdVptOXZkR1Z5VzJGalhTaGtiMjB1WTJGdVkyVnNLVHRjYmlBZ1pHOXRMbVp2YjNSbGNsdGhZMTBvWkc5dExtOXJLVHRjYmlBZ1pHOXRMbVJwWVd4dloxdGhZMTBvWkc5dExtTnNiM05sS1R0Y2JpQWdaRzl0TG1ScFlXeHZaMXRoWTEwb1pHOXRMbWhsWVdSbGNpazdYRzRnSUdSdmJTNWthV0ZzYjJkYllXTmRLR1J2YlM1elpXTjBhVzl1S1R0Y2JpQWdaRzl0TG1ScFlXeHZaMXRoWTEwb1pHOXRMbVp2YjNSbGNpazdYRzRnSUdSdll5NWliMlI1VzJGalhTaGtiMjB1WkdsaGJHOW5LVHRjYmlBZ2NtVjBkWEp1SUdSdmJUdGNibjFjYmx4dVpuVnVZM1JwYjI0Z2RYQnNiMkZrY3lBb1pHOXRMQ0IzWVhKdWFXNW5LU0I3WEc0Z0lIWmhjaUJtZFhBZ1BTQW5kMnN0Y0hKdmJYQjBMV1pwYkdWMWNHeHZZV1FuTzF4dUlDQjJZWElnWkc5dGRYQWdQU0I3WEc0Z0lDQWdZWEpsWVRvZ1pTZ25jMlZqZEdsdmJpY3NJQ2QzYXkxd2NtOXRjSFF0ZFhCc2IyRmtMV0Z5WldFbktTeGNiaUFnSUNCM1lYSnVhVzVuT2lCbEtDZHdKeXdnSjNkckxYQnliMjF3ZEMxbGNuSnZjaUIzYXkxM1lYSnVhVzVuSnl3Z2QyRnlibWx1Wnlrc1hHNGdJQ0FnWm1GcGJHVmtPaUJsS0Nkd0p5d2dKM2RyTFhCeWIyMXdkQzFsY25KdmNpQjNheTFtWVdsc1pXUW5MQ0J6ZEhKcGJtZHpMbkJ5YjIxd2RITXVkWEJzYjJGa1ptRnBiR1ZrS1N4Y2JpQWdJQ0IxY0d4dllXUTZJR1VvSjJ4aFltVnNKeXdnSjNkckxYQnliMjF3ZEMxMWNHeHZZV1FuS1N4Y2JpQWdJQ0IxY0d4dllXUnBibWM2SUdVb0ozTndZVzRuTENBbmQyc3RjSEp2YlhCMExYQnliMmR5WlhOekp5d2djM1J5YVc1bmN5NXdjbTl0Y0hSekxuVndiRzloWkdsdVp5a3NYRzRnSUNBZ1pISnZjRG9nWlNnbmMzQmhiaWNzSUNkM2F5MXdjbTl0Y0hRdFpISnZjQ2NzSUhOMGNtbHVaM011Y0hKdmJYQjBjeTVrY205d0tTeGNiaUFnSUNCa2NtOXdhV052YmpvZ1pTZ25jQ2NzSUNkM2F5MWtjbTl3TFdsamIyNGdkMnN0Y0hKdmJYQjBMV1J5YjNBdGFXTnZiaWNwTEZ4dUlDQWdJR0p5YjNkelpUb2daU2duYzNCaGJpY3NJQ2QzYXkxd2NtOXRjSFF0WW5KdmQzTmxKeXdnYzNSeWFXNW5jeTV3Y205dGNIUnpMbUp5YjNkelpTa3NYRzRnSUNBZ1pISmhaMlJ5YjNBNklHVW9KM0FuTENBbmQyc3RjSEp2YlhCMExXUnlZV2RrY205d0p5d2djM1J5YVc1bmN5NXdjbTl0Y0hSekxtUnliM0JvYVc1MEtTeGNiaUFnSUNCbWFXeGxhVzV3ZFhRNklHVW9KMmx1Y0hWMEp5d2dablZ3S1Z4dUlDQjlPMXh1SUNCa2IyMTFjQzVoY21WaFcyRmpYU2hrYjIxMWNDNWtjbTl3S1R0Y2JpQWdaRzl0ZFhBdVlYSmxZVnRoWTEwb1pHOXRkWEF1ZFhCc2IyRmthVzVuS1R0Y2JpQWdaRzl0ZFhBdVlYSmxZVnRoWTEwb1pHOXRkWEF1WkhKdmNHbGpiMjRwTzF4dUlDQmtiMjExY0M1MWNHeHZZV1JiWVdOZEtHUnZiWFZ3TG1KeWIzZHpaU2s3WEc0Z0lHUnZiWFZ3TG5Wd2JHOWhaRnRoWTEwb1pHOXRkWEF1Wm1sc1pXbHVjSFYwS1R0Y2JpQWdaRzl0ZFhBdVptbHNaV2x1Y0hWMExtbGtJRDBnWm5Wd08xeHVJQ0JrYjIxMWNDNW1hV3hsYVc1d2RYUXVkSGx3WlNBOUlDZG1hV3hsSnp0Y2JpQWdaRzl0TG1ScFlXeHZaeTVqYkdGemMwNWhiV1VnS3owZ0p5QjNheTF3Y205dGNIUXRkWEJzYjJGa2N5YzdYRzRnSUdSdmJTNXBibkIxZEVOdmJuUmhhVzVsY2k1amJHRnpjMDVoYldVZ0t6MGdKeUIzYXkxd2NtOXRjSFF0YVc1d2RYUXRZMjl1ZEdGcGJtVnlMWFZ3Ykc5aFpITW5PMXh1SUNCa2IyMHVhVzV3ZFhRdVkyeGhjM05PWVcxbElDczlJQ2NnZDJzdGNISnZiWEIwTFdsdWNIVjBMWFZ3Ykc5aFpITW5PMXh1SUNCa2IyMHVjMlZqZEdsdmJpNXBibk5sY25SQ1pXWnZjbVVvWkc5dGRYQXVkMkZ5Ym1sdVp5d2daRzl0TG1sdWNIVjBRMjl1ZEdGcGJtVnlLVHRjYmlBZ1pHOXRMbk5sWTNScGIyNHVhVzV6WlhKMFFtVm1iM0psS0dSdmJYVndMbVpoYVd4bFpDd2daRzl0TG1sdWNIVjBRMjl1ZEdGcGJtVnlLVHRjYmlBZ1pHOXRMbk5sWTNScGIyNWJZV05kS0dSdmJYVndMblZ3Ykc5aFpDazdYRzRnSUdSdmJTNXpaV04wYVc5dVcyRmpYU2hrYjIxMWNDNWtjbUZuWkhKdmNDazdYRzRnSUdSdmJTNXpaV04wYVc5dVcyRmpYU2hrYjIxMWNDNWhjbVZoS1R0Y2JpQWdjMlYwVkdWNGRDaGtiMjB1WkdWell5d2daMlYwVkdWNGRDaGtiMjB1WkdWell5a2dLeUJ6ZEhKcGJtZHpMbkJ5YjIxd2RITXVkWEJzYjJGa0tUdGNiaUFnWTNKdmMzTjJaVzUwTG1Ga1pDaGtiMjExY0M1bWFXeGxhVzV3ZFhRc0lDZG1iMk4xY3ljc0lHWnZZM1Z6WldSR2FXeGxTVzV3ZFhRcE8xeHVJQ0JqY205emMzWmxiblF1WVdSa0tHUnZiWFZ3TG1acGJHVnBibkIxZEN3Z0oySnNkWEluTENCaWJIVnljbVZrUm1sc1pVbHVjSFYwS1R0Y2JseHVJQ0JtZFc1amRHbHZiaUJtYjJOMWMyVmtSbWxzWlVsdWNIVjBJQ2dwSUh0Y2JpQWdJQ0JqYkdGemMyVnpMbUZrWkNoa2IyMTFjQzUxY0d4dllXUXNJQ2QzYXkxbWIyTjFjMlZrSnlrN1hHNGdJSDFjYmlBZ1puVnVZM1JwYjI0Z1lteDFjbkpsWkVacGJHVkpibkIxZENBb0tTQjdYRzRnSUNBZ1kyeGhjM05sY3k1eWJTaGtiMjExY0M1MWNHeHZZV1FzSUNkM2F5MW1iMk4xYzJWa0p5azdYRzRnSUgxY2JpQWdjbVYwZFhKdUlHUnZiWFZ3TzF4dWZWeHVYRzV5Wlc1a1pYSXVkWEJzYjJGa2N5QTlJSFZ3Ykc5aFpITTdYRzV0YjJSMWJHVXVaWGh3YjNKMGN5QTlJSEpsYm1SbGNqdGNiaUpkZlE9PSIsIid1c2Ugc3RyaWN0JztcblxudmFyIGJ1bGxzZXllID0gcmVxdWlyZSgnYnVsbHNleWUnKTtcblxuZnVuY3Rpb24gcmVtZW1iZXJTZWxlY3Rpb24gKGhpc3RvcnkpIHtcbiAgdmFyIGNvZGUgPSBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDE4KS5zdWJzdHIoMikucmVwbGFjZSgvXFxkKy9nLCAnJyk7XG4gIHZhciBvcGVuID0gJ1dvb2ZtYXJrU2VsZWN0aW9uT3Blbk1hcmtlcicgKyBjb2RlO1xuICB2YXIgY2xvc2UgPSAnV29vZm1hcmtTZWxlY3Rpb25DbG9zZU1hcmtlcicgKyBjb2RlO1xuICB2YXIgcm1hcmtlcnMgPSBuZXcgUmVnRXhwKG9wZW4gKyAnfCcgKyBjbG9zZSwgJ2cnKTtcbiAgcmV0dXJuIHtcbiAgICBtYXJrZXJzOiBtYXJrZXJzKCksXG4gICAgdW5tYXJrOiB1bm1hcmtcbiAgfTtcblxuICBmdW5jdGlvbiBtYXJrZXJzICgpIHtcbiAgICB2YXIgc3RhdGUgPSBoaXN0b3J5LnJlc2V0KCkuaW5wdXRTdGF0ZTtcbiAgICB2YXIgY2h1bmtzID0gc3RhdGUuZ2V0Q2h1bmtzKCk7XG4gICAgdmFyIHNlbGVjdGlvblN0YXJ0ID0gY2h1bmtzLmJlZm9yZS5sZW5ndGg7XG4gICAgdmFyIHNlbGVjdGlvbkVuZCA9IHNlbGVjdGlvblN0YXJ0ICsgY2h1bmtzLnNlbGVjdGlvbi5sZW5ndGg7XG4gICAgcmV0dXJuIFtbc2VsZWN0aW9uU3RhcnQsIG9wZW5dLCBbc2VsZWN0aW9uRW5kLCBjbG9zZV1dO1xuICB9XG5cbiAgZnVuY3Rpb24gdW5tYXJrICgpIHtcbiAgICB2YXIgc3RhdGUgPSBoaXN0b3J5LmlucHV0U3RhdGU7XG4gICAgdmFyIGNodW5rcyA9IHN0YXRlLmdldENodW5rcygpO1xuICAgIHZhciBhbGwgPSBjaHVua3MuYmVmb3JlICsgY2h1bmtzLnNlbGVjdGlvbiArIGNodW5rcy5hZnRlcjtcbiAgICB2YXIgc3RhcnQgPSBhbGwubGFzdEluZGV4T2Yob3Blbik7XG4gICAgdmFyIGVuZCA9IGFsbC5sYXN0SW5kZXhPZihjbG9zZSkgKyBjbG9zZS5sZW5ndGg7XG4gICAgdmFyIHNlbGVjdGlvblN0YXJ0ID0gc3RhcnQgPT09IC0xID8gMCA6IHN0YXJ0O1xuICAgIHZhciBzZWxlY3Rpb25FbmQgPSBlbmQgPT09IC0xID8gMCA6IGVuZDtcbiAgICBjaHVua3MuYmVmb3JlID0gYWxsLnN1YnN0cigwLCBzZWxlY3Rpb25TdGFydCkucmVwbGFjZShybWFya2VycywgJycpO1xuICAgIGNodW5rcy5zZWxlY3Rpb24gPSBhbGwuc3Vic3RyKHNlbGVjdGlvblN0YXJ0LCBzZWxlY3Rpb25FbmQgLSBzZWxlY3Rpb25TdGFydCkucmVwbGFjZShybWFya2VycywgJycpO1xuICAgIGNodW5rcy5hZnRlciA9IGFsbC5zdWJzdHIoZW5kKS5yZXBsYWNlKHJtYXJrZXJzLCAnJyk7XG4gICAgdmFyIGVsID0gaGlzdG9yeS5zdXJmYWNlLmN1cnJlbnQoaGlzdG9yeS5pbnB1dE1vZGUpO1xuICAgIHZhciBleWUgPSBidWxsc2V5ZShlbCwge1xuICAgICAgY2FyZXQ6IHRydWUsIGF1dG91cGRhdGVUb0NhcmV0OiBmYWxzZSwgdHJhY2tpbmc6IGZhbHNlXG4gICAgfSk7XG4gICAgc3RhdGUuc2V0Q2h1bmtzKGNodW5rcyk7XG4gICAgc3RhdGUucmVzdG9yZShmYWxzZSk7XG4gICAgc3RhdGUuc2Nyb2xsVG9wID0gZWwuc2Nyb2xsVG9wID0gZXllLnJlYWQoKS55IC0gZWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkudG9wIC0gNTA7XG4gICAgZXllLmRlc3Ryb3koKTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHJlbWVtYmVyU2VsZWN0aW9uO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgc2V0VGV4dCA9IHJlcXVpcmUoJy4vc2V0VGV4dCcpO1xudmFyIHN0cmluZ3MgPSByZXF1aXJlKCcuL3N0cmluZ3MnKTtcblxuZnVuY3Rpb24gY29tbWFuZHMgKGVsLCBpZCkge1xuICBzZXRUZXh0KGVsLCBzdHJpbmdzLmJ1dHRvbnNbaWRdIHx8IGlkKTtcbn1cblxuZnVuY3Rpb24gbW9kZXMgKGVsLCBpZCkge1xuICB2YXIgdGV4dHMgPSB7XG4gICAgbWFya2Rvd246ICdtXFx1MjE5MycsXG4gICAgd3lzaXd5ZzogJ3d5c2l3eWcnXG4gIH07XG4gIHNldFRleHQoZWwsIHRleHRzW2lkXSB8fCBpZCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBtb2RlczogbW9kZXMsXG4gIGNvbW1hbmRzOiBjb21tYW5kc1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gc2V0VGV4dCAoZWwsIHZhbHVlKSB7XG4gIGVsLmlubmVyVGV4dCA9IGVsLnRleHRDb250ZW50ID0gdmFsdWU7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gc2V0VGV4dDtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIHBsYWNlaG9sZGVyczoge1xuICAgIGJvbGQ6ICdzdHJvbmcgdGV4dCcsXG4gICAgaXRhbGljOiAnZW1waGFzaXplZCB0ZXh0JyxcbiAgICBxdW90ZTogJ3F1b3RlZCB0ZXh0JyxcbiAgICBjb2RlOiAnY29kZSBnb2VzIGhlcmUnLFxuICAgIGxpc3RpdGVtOiAnbGlzdCBpdGVtJyxcbiAgICBoZWFkaW5nOiAnSGVhZGluZyBUZXh0JyxcbiAgICBsaW5rOiAnbGluayB0ZXh0JyxcbiAgICBpbWFnZTogJ2ltYWdlIGRlc2NyaXB0aW9uJyxcbiAgICBhdHRhY2htZW50OiAnYXR0YWNobWVudCBkZXNjcmlwdGlvbidcbiAgfSxcbiAgdGl0bGVzOiB7XG4gICAgYm9sZDogJ1N0cm9uZyA8c3Ryb25nPiBDdHJsK0InLFxuICAgIGl0YWxpYzogJ0VtcGhhc2lzIDxlbT4gQ3RybCtJJyxcbiAgICBxdW90ZTogJ0Jsb2NrcXVvdGUgPGJsb2NrcXVvdGU+IEN0cmwrSicsXG4gICAgY29kZTogJ0NvZGUgU2FtcGxlIDxwcmU+PGNvZGU+IEN0cmwrRScsXG4gICAgb2w6ICdOdW1iZXJlZCBMaXN0IDxvbD4gQ3RybCtPJyxcbiAgICB1bDogJ0J1bGxldGVkIExpc3QgPHVsPiBDdHJsK1UnLFxuICAgIGhlYWRpbmc6ICdIZWFkaW5nIDxoMT4sIDxoMj4sIC4uLiBDdHJsK0QnLFxuICAgIGxpbms6ICdIeXBlcmxpbmsgPGE+IEN0cmwrSycsXG4gICAgaW1hZ2U6ICdJbWFnZSA8aW1nPiBDdHJsK0cnLFxuICAgIGF0dGFjaG1lbnQ6ICdBdHRhY2htZW50IEN0cmwrU2hpZnQrSycsXG4gICAgbWFya2Rvd246ICdNYXJrZG93biBNb2RlIEN0cmwrTScsXG4gICAgaHRtbDogJ0hUTUwgTW9kZSBDdHJsK0gnLFxuICAgIHd5c2l3eWc6ICdQcmV2aWV3IE1vZGUgQ3RybCtQJ1xuICB9LFxuICBidXR0b25zOiB7XG4gICAgYm9sZDogJ0InLFxuICAgIGl0YWxpYzogJ0knLFxuICAgIHF1b3RlOiAnXFx1MjAxYycsXG4gICAgY29kZTogJzwvPicsXG4gICAgb2w6ICcxLicsXG4gICAgdWw6ICdcXHUyOUJGJyxcbiAgICBoZWFkaW5nOiAnVHQnLFxuICAgIGxpbms6ICdMaW5rJyxcbiAgICBpbWFnZTogJ0ltYWdlJyxcbiAgICBhdHRhY2htZW50OiAnQXR0YWNobWVudCcsXG4gICAgaHI6ICdcXHUyMWI1J1xuICB9LFxuICBwcm9tcHRzOiB7XG4gICAgbGluazoge1xuICAgICAgdGl0bGU6ICdJbnNlcnQgTGluaycsXG4gICAgICBkZXNjcmlwdGlvbjogJ1R5cGUgb3IgcGFzdGUgdGhlIHVybCB0byB5b3VyIGxpbmsnLFxuICAgICAgcGxhY2Vob2xkZXI6ICdodHRwOi8vZXhhbXBsZS5jb20vIFwidGl0bGVcIidcbiAgICB9LFxuICAgIGltYWdlOiB7XG4gICAgICB0aXRsZTogJ0luc2VydCBJbWFnZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0VudGVyIHRoZSB1cmwgdG8geW91ciBpbWFnZScsXG4gICAgICBwbGFjZWhvbGRlcjogJ2h0dHA6Ly9leGFtcGxlLmNvbS9wdWJsaWMvaW1hZ2UucG5nIFwidGl0bGVcIidcbiAgICB9LFxuICAgIGF0dGFjaG1lbnQ6IHtcbiAgICAgIHRpdGxlOiAnQXR0YWNoIEZpbGUnLFxuICAgICAgZGVzY3JpcHRpb246ICdFbnRlciB0aGUgdXJsIHRvIHlvdXIgYXR0YWNobWVudCcsXG4gICAgICBwbGFjZWhvbGRlcjogJ2h0dHA6Ly9leGFtcGxlLmNvbS9wdWJsaWMvcmVwb3J0LnBkZiBcInRpdGxlXCInXG4gICAgfSxcbiAgICB0eXBlczogJ1lvdSBjYW4gb25seSB1cGxvYWQgJyxcbiAgICBicm93c2U6ICdCcm93c2UuLi4nLFxuICAgIGRyb3BoaW50OiAnWW91IGNhbiBhbHNvIGRyYWcgZmlsZXMgZnJvbSB5b3VyIGNvbXB1dGVyIGFuZCBkcm9wIHRoZW0gaGVyZSEnLFxuICAgIGRyb3A6ICdEcm9wIHlvdXIgZmlsZSBoZXJlIHRvIGJlZ2luIHVwbG9hZC4uLicsXG4gICAgdXBsb2FkOiAnLCBvciB1cGxvYWQgYSBmaWxlJyxcbiAgICB1cGxvYWRpbmc6ICdVcGxvYWRpbmcgeW91ciBmaWxlLi4uJyxcbiAgICB1cGxvYWRmYWlsZWQ6ICdUaGUgdXBsb2FkIGZhaWxlZCEgVGhhdFxcJ3MgYWxsIHdlIGtub3cuJ1xuICB9XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgY3Jvc3N2ZW50ID0gcmVxdWlyZSgnY3Jvc3N2ZW50Jyk7XG52YXIgY2xhc3NlcyA9IHJlcXVpcmUoJy4vY2xhc3NlcycpO1xudmFyIGRyYWdDbGFzcyA9ICd3ay1kcmFnZ2luZyc7XG52YXIgZHJhZ0NsYXNzU3BlY2lmaWMgPSAnd2stY29udGFpbmVyLWRyYWdnaW5nJztcbnZhciByb290ID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50O1xudmFyIGRyYWdnaW5Dc3MgPSAwOyAvLyB2YXJpYWJsZSB0byBjb3VudCB0aGUgZW50ZXIgYW5kIGxlYXZpbmcgbnVtYmVycy5cblxuZnVuY3Rpb24gdXBsb2FkcyAoY29udGFpbmVyLCBkcm9wYXJlYSwgZWRpdG9yLCBvcHRpb25zLCByZW1vdmUpIHtcbiAgdmFyIG9wID0gcmVtb3ZlID8gJ3JlbW92ZScgOiAnYWRkJztcbiAgY3Jvc3N2ZW50W29wXShyb290LCAnZHJhZ2VuZCcsIGRyYWdzdG9wZm9yY2UpO1xuICBjcm9zc3ZlbnRbb3BdKHJvb3QsICdtb3VzZW91dCcsIGRyYWdzdG9wZm9yY2UpO1xuICBjcm9zc3ZlbnRbb3BdKGNvbnRhaW5lciwgJ2RyYWdvdmVyJywgaGFuZGxlRHJhZ092ZXIsIGZhbHNlKTtcbiAgY3Jvc3N2ZW50W29wXShjb250YWluZXIsICdkcmFnZW50ZXInLCBkcmFnZ2luZywgZmFsc2UpOyAgLy8gd2hlbmV2ZXIgdGhlIGRyYWcgd2l0aCBjb21wb25lbnRzIGVudGVyIHRoZSBjb250YWluZXJcbiAgY3Jvc3N2ZW50W29wXShjb250YWluZXIsICdkcmFnbGVhdmUnLCBkcmFnc3RvcCwgZmFsc2UpOyAgLy8gd2hlbmV2ZXIgdGhlIGRyYWcgd2l0aCBjb21wb25lbnRzIG1vdmVzIG91dCBvZiBjb250YWluZXJcbiAgY3Jvc3N2ZW50W29wXShkcm9wYXJlYSwgJ2Ryb3AnLCBoYW5kbGVGaWxlU2VsZWN0LCBmYWxzZSk7XG5cbiAgZnVuY3Rpb24gZHJhZ2dpbmcgKCkge1xuICAgIGRyYWdnaW5Dc3MrKztcbiAgICBjbGFzc2VzLmFkZChkcm9wYXJlYSwgZHJhZ0NsYXNzKTtcbiAgICBjbGFzc2VzLmFkZChkcm9wYXJlYSwgZHJhZ0NsYXNzU3BlY2lmaWMpO1xuICB9XG4gIGZ1bmN0aW9uIGRyYWdzdG9wICgpIHtcbiAgICBkcmFnZ2luQ3NzLS07XG4gICAgaWYoZHJhZ2dpbkNzcyA9PT0gMCl7XG4gICAgICBkcmFnc3RvcHBlcihkcm9wYXJlYSk7XG4gICAgfVxuICB9XG4gIGZ1bmN0aW9uIGRyYWdzdG9wZm9yY2UgKCkge1xuICAgIGRyYWdzdG9wcGVyKGRyb3BhcmVhKTtcbiAgfVxuICBmdW5jdGlvbiBoYW5kbGVEcmFnT3ZlciAoZSkge1xuICAgIHN0b3AoZSk7XG4gICAgY2xhc3Nlcy5hZGQoZHJvcGFyZWEsIGRyYWdDbGFzcyk7XG4gICAgY2xhc3Nlcy5hZGQoZHJvcGFyZWEsIGRyYWdDbGFzc1NwZWNpZmljKTtcbiAgICBlLmRhdGFUcmFuc2Zlci5kcm9wRWZmZWN0ID0gJ2NvcHknO1xuICB9XG4gIGZ1bmN0aW9uIGhhbmRsZUZpbGVTZWxlY3QgKGUpIHtcbiAgICBkcmFnc3RvcCgpO1xuICAgIHN0b3AoZSk7XG4gICAgZWRpdG9yLnJ1bkNvbW1hbmQoZnVuY3Rpb24gcnVubmVyIChjaHVua3MsIG1vZGUpIHtcbiAgICAgIHZhciBmaWxlcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGUuZGF0YVRyYW5zZmVyLmZpbGVzKTtcbiAgICAgIHZhciB0eXBlID0gaW5mZXJUeXBlKGZpbGVzKTtcbiAgICAgIGVkaXRvci5saW5rT3JJbWFnZU9yQXR0YWNobWVudCh0eXBlLCBmaWxlcykuY2FsbCh0aGlzLCBtb2RlLCBjaHVua3MpO1xuICAgIH0pO1xuICB9XG4gIGZ1bmN0aW9uIGluZmVyVHlwZSAoZmlsZXMpIHtcbiAgICBpZiAob3B0aW9ucy5pbWFnZXMgJiYgIW9wdGlvbnMuYXR0YWNobWVudHMpIHtcbiAgICAgIHJldHVybiAnaW1hZ2UnO1xuICAgIH1cbiAgICBpZiAoIW9wdGlvbnMuaW1hZ2VzICYmIG9wdGlvbnMuYXR0YWNobWVudHMpIHtcbiAgICAgIHJldHVybiAnYXR0YWNobWVudCc7XG4gICAgfVxuICAgIGlmIChmaWxlcy5ldmVyeShtYXRjaGVzKG9wdGlvbnMuaW1hZ2VzLnZhbGlkYXRlIHx8IG5ldmVyKSkpIHtcbiAgICAgIHJldHVybiAnaW1hZ2UnO1xuICAgIH1cbiAgICByZXR1cm4gJ2F0dGFjaG1lbnQnO1xuICB9XG59XG5cbmZ1bmN0aW9uIG1hdGNoZXMgKGZuKSB7XG4gIHJldHVybiBmdW5jdGlvbiBtYXRjaGVyIChmaWxlKSB7IHJldHVybiBmbihmaWxlKTsgfTtcbn1cbmZ1bmN0aW9uIG5ldmVyICgpIHtcbiAgcmV0dXJuIGZhbHNlO1xufVxuZnVuY3Rpb24gc3RvcCAoZSkge1xuICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICBlLnByZXZlbnREZWZhdWx0KCk7XG59XG5mdW5jdGlvbiBkcmFnc3RvcHBlciAoZHJvcGFyZWEpIHtcbiAgY2xhc3Nlcy5ybShkcm9wYXJlYSwgZHJhZ0NsYXNzKTtcbiAgY2xhc3Nlcy5ybShkcm9wYXJlYSwgZHJhZ0NsYXNzU3BlY2lmaWMpO1xufVxuXG51cGxvYWRzLnN0b3AgPSBkcmFnc3RvcHBlcjtcbm1vZHVsZS5leHBvcnRzID0gdXBsb2FkcztcbiIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIGxzID0gcmVxdWlyZSgnbG9jYWwtc3RvcmFnZScpO1xudmFyIGNyb3NzdmVudCA9IHJlcXVpcmUoJ2Nyb3NzdmVudCcpO1xudmFyIGthbnllID0gcmVxdWlyZSgna2FueWUnKTtcbnZhciB1cGxvYWRzID0gcmVxdWlyZSgnLi91cGxvYWRzJyk7XG52YXIgc3RyaW5ncyA9IHJlcXVpcmUoJy4vc3RyaW5ncycpO1xudmFyIHNldFRleHQgPSByZXF1aXJlKCcuL3NldFRleHQnKTtcbnZhciByZW1lbWJlclNlbGVjdGlvbiA9IHJlcXVpcmUoJy4vcmVtZW1iZXJTZWxlY3Rpb24nKTtcbnZhciBiaW5kQ29tbWFuZHMgPSByZXF1aXJlKCcuL2JpbmRDb21tYW5kcycpO1xudmFyIElucHV0SGlzdG9yeSA9IHJlcXVpcmUoJy4vSW5wdXRIaXN0b3J5Jyk7XG52YXIgZ2V0Q29tbWFuZEhhbmRsZXIgPSByZXF1aXJlKCcuL2dldENvbW1hbmRIYW5kbGVyJyk7XG52YXIgZ2V0U3VyZmFjZSA9IHJlcXVpcmUoJy4vZ2V0U3VyZmFjZScpO1xudmFyIGNsYXNzZXMgPSByZXF1aXJlKCcuL2NsYXNzZXMnKTtcbnZhciByZW5kZXJlcnMgPSByZXF1aXJlKCcuL3JlbmRlcmVycycpO1xudmFyIHhoclN0dWIgPSByZXF1aXJlKCcuL3hoclN0dWInKTtcbnZhciBwcm9tcHQgPSByZXF1aXJlKCcuL3Byb21wdHMvcHJvbXB0Jyk7XG52YXIgY2xvc2VQcm9tcHRzID0gcmVxdWlyZSgnLi9wcm9tcHRzL2Nsb3NlJyk7XG52YXIgbW9kZU5hbWVzID0gWydtYXJrZG93bicsICdodG1sJywgJ3d5c2l3eWcnXTtcbnZhciBjYWNoZSA9IFtdO1xudmFyIG1hYyA9IC9cXGJNYWMgT1NcXGIvLnRlc3QoZ2xvYmFsLm5hdmlnYXRvci51c2VyQWdlbnQpO1xudmFyIGRvYyA9IGRvY3VtZW50O1xudmFyIHJwYXJhZ3JhcGggPSAvXjxwPjxcXC9wPlxcbj8kL2k7XG5cbmZ1bmN0aW9uIGZpbmQgKHRleHRhcmVhKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgY2FjaGUubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoY2FjaGVbaV0gJiYgY2FjaGVbaV0udGEgPT09IHRleHRhcmVhKSB7XG4gICAgICByZXR1cm4gY2FjaGVbaV0uZWRpdG9yO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gd29vZm1hcmsgKHRleHRhcmVhLCBvcHRpb25zKSB7XG4gIHZhciBjYWNoZWQgPSBmaW5kKHRleHRhcmVhKTtcbiAgaWYgKGNhY2hlZCkge1xuICAgIHJldHVybiBjYWNoZWQ7XG4gIH1cblxuICB2YXIgcGFyZW50ID0gdGV4dGFyZWEucGFyZW50RWxlbWVudDtcbiAgaWYgKHBhcmVudC5jaGlsZHJlbi5sZW5ndGggPiAxKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCd3b29mbWFyayBkZW1hbmRzIDx0ZXh0YXJlYT4gZWxlbWVudHMgdG8gaGF2ZSBubyBzaWJsaW5ncycpO1xuICB9XG5cbiAgdmFyIG8gPSBvcHRpb25zIHx8IHt9O1xuICBpZiAoby5tYXJrZG93biA9PT0gdm9pZCAwKSB7IG8ubWFya2Rvd24gPSB0cnVlOyB9XG4gIGlmIChvLmh0bWwgPT09IHZvaWQgMCkgeyBvLmh0bWwgPSB0cnVlOyB9XG4gIGlmIChvLnd5c2l3eWcgPT09IHZvaWQgMCkgeyBvLnd5c2l3eWcgPSB0cnVlOyB9XG5cbiAgaWYgKCFvLm1hcmtkb3duICYmICFvLmh0bWwgJiYgIW8ud3lzaXd5Zykge1xuICAgIHRocm93IG5ldyBFcnJvcignd29vZm1hcmsgZXhwZWN0cyBhdCBsZWFzdCBvbmUgaW5wdXQgbW9kZSB0byBiZSBhdmFpbGFibGUnKTtcbiAgfVxuXG4gIGlmIChvLmhyID09PSB2b2lkIDApIHsgby5ociA9IGZhbHNlOyB9XG4gIGlmIChvLnN0b3JhZ2UgPT09IHZvaWQgMCkgeyBvLnN0b3JhZ2UgPSB0cnVlOyB9XG4gIGlmIChvLnN0b3JhZ2UgPT09IHRydWUpIHsgby5zdG9yYWdlID0gJ3dvb2ZtYXJrX2lucHV0X21vZGUnOyB9XG4gIGlmIChvLmZlbmNpbmcgPT09IHZvaWQgMCkgeyBvLmZlbmNpbmcgPSB0cnVlOyB9XG4gIGlmIChvLnJlbmRlciA9PT0gdm9pZCAwKSB7IG8ucmVuZGVyID0ge307IH1cbiAgaWYgKG8ucmVuZGVyLm1vZGVzID09PSB2b2lkIDApIHsgby5yZW5kZXIubW9kZXMgPSB7fTsgfVxuICBpZiAoby5yZW5kZXIuY29tbWFuZHMgPT09IHZvaWQgMCkgeyBvLnJlbmRlci5jb21tYW5kcyA9IHt9OyB9XG4gIGlmIChvLnByb21wdHMgPT09IHZvaWQgMCkgeyBvLnByb21wdHMgPSB7fTsgfVxuICBpZiAoby5wcm9tcHRzLmxpbmsgPT09IHZvaWQgMCkgeyBvLnByb21wdHMubGluayA9IHByb21wdDsgfVxuICBpZiAoby5wcm9tcHRzLmltYWdlID09PSB2b2lkIDApIHsgby5wcm9tcHRzLmltYWdlID0gcHJvbXB0OyB9XG4gIGlmIChvLnByb21wdHMuYXR0YWNobWVudCA9PT0gdm9pZCAwKSB7IG8ucHJvbXB0cy5hdHRhY2htZW50ID0gcHJvbXB0OyB9XG4gIGlmIChvLnByb21wdHMuY2xvc2UgPT09IHZvaWQgMCkgeyBvLnByb21wdHMuY2xvc2UgPSBjbG9zZVByb21wdHM7IH1cbiAgaWYgKG8ueGhyID09PSB2b2lkIDApIHsgby54aHIgPSB4aHJTdHViOyB9XG4gIGlmIChvLmNsYXNzZXMgPT09IHZvaWQgMCkgeyBvLmNsYXNzZXMgPSB7fTsgfVxuICBpZiAoby5jbGFzc2VzLnd5c2l3eWcgPT09IHZvaWQgMCkgeyBvLmNsYXNzZXMud3lzaXd5ZyA9IFtdOyB9XG4gIGlmIChvLmNsYXNzZXMucHJvbXB0cyA9PT0gdm9pZCAwKSB7IG8uY2xhc3Nlcy5wcm9tcHRzID0ge307IH1cbiAgaWYgKG8uY2xhc3Nlcy5pbnB1dCA9PT0gdm9pZCAwKSB7IG8uY2xhc3Nlcy5pbnB1dCA9IHt9OyB9XG5cbiAgdmFyIHByZWZlcmVuY2UgPSBvLnN0b3JhZ2UgJiYgbHMuZ2V0KG8uc3RvcmFnZSk7XG4gIGlmIChwcmVmZXJlbmNlKSB7XG4gICAgby5kZWZhdWx0TW9kZSA9IHByZWZlcmVuY2U7XG4gIH1cblxuICB2YXIgZHJvcGFyZWEgPSB0YWcoeyBjOiAnd2stY29udGFpbmVyLWRyb3AnIH0pO1xuICB2YXIgc3dpdGNoYm9hcmQgPSB0YWcoeyBjOiAnd2stc3dpdGNoYm9hcmQnIH0pO1xuICB2YXIgY29tbWFuZHMgPSB0YWcoeyBjOiAnd2stY29tbWFuZHMnIH0pO1xuICB2YXIgZWRpdGFibGUgPSB0YWcoeyBjOiBbJ3drLXd5c2l3eWcnLCAnd2staGlkZSddLmNvbmNhdChvLmNsYXNzZXMud3lzaXd5Zykuam9pbignICcpIH0pO1xuICB2YXIgc3VyZmFjZSA9IGdldFN1cmZhY2UodGV4dGFyZWEsIGVkaXRhYmxlLCBkcm9wYXJlYSk7XG4gIHZhciBoaXN0b3J5ID0gbmV3IElucHV0SGlzdG9yeShzdXJmYWNlLCAnbWFya2Rvd24nKTtcbiAgdmFyIGVkaXRvciA9IHtcbiAgICBhZGRDb21tYW5kOiBhZGRDb21tYW5kLFxuICAgIGFkZENvbW1hbmRCdXR0b246IGFkZENvbW1hbmRCdXR0b24sXG4gICAgcnVuQ29tbWFuZDogcnVuQ29tbWFuZCxcbiAgICBwYXJzZU1hcmtkb3duOiBvLnBhcnNlTWFya2Rvd24sXG4gICAgcGFyc2VIVE1MOiBvLnBhcnNlSFRNTCxcbiAgICBkZXN0cm95OiBkZXN0cm95LFxuICAgIHZhbHVlOiBnZXRNYXJrZG93bixcbiAgICB0ZXh0YXJlYTogdGV4dGFyZWEsXG4gICAgZWRpdGFibGU6IG8ud3lzaXd5ZyA/IGVkaXRhYmxlIDogbnVsbCxcbiAgICBzZXRNb2RlOiBwZXJzaXN0TW9kZSxcbiAgICBoaXN0b3J5OiB7XG4gICAgICB1bmRvOiBoaXN0b3J5LnVuZG8sXG4gICAgICByZWRvOiBoaXN0b3J5LnJlZG8sXG4gICAgICBjYW5VbmRvOiBoaXN0b3J5LmNhblVuZG8sXG4gICAgICBjYW5SZWRvOiBoaXN0b3J5LmNhblJlZG9cbiAgICB9LFxuICAgIG1vZGU6ICdtYXJrZG93bidcbiAgfTtcbiAgdmFyIGVudHJ5ID0geyB0YTogdGV4dGFyZWEsIGVkaXRvcjogZWRpdG9yIH07XG4gIHZhciBpID0gY2FjaGUucHVzaChlbnRyeSk7XG4gIHZhciBrYW55ZUNvbnRleHQgPSAnd29vZm1hcmtfJyArIGk7XG4gIHZhciBrYW55ZU9wdGlvbnMgPSB7XG4gICAgZmlsdGVyOiBwYXJlbnQsXG4gICAgY29udGV4dDoga2FueWVDb250ZXh0XG4gIH07XG4gIHZhciBtb2RlcyA9IHtcbiAgICBtYXJrZG93bjoge1xuICAgICAgYnV0dG9uOiB0YWcoeyB0OiAnYnV0dG9uJywgYzogJ3drLW1vZGUgd2stbW9kZS1hY3RpdmUnIH0pLFxuICAgICAgc2V0OiBtYXJrZG93bk1vZGVcbiAgICB9LFxuICAgIGh0bWw6IHtcbiAgICAgIGJ1dHRvbjogdGFnKHsgdDogJ2J1dHRvbicsIGM6ICd3ay1tb2RlIHdrLW1vZGUtaW5hY3RpdmUnIH0pLFxuICAgICAgc2V0OiBodG1sTW9kZVxuICAgIH0sXG4gICAgd3lzaXd5Zzoge1xuICAgICAgYnV0dG9uOiB0YWcoeyB0OiAnYnV0dG9uJywgYzogJ3drLW1vZGUgd2stbW9kZS1pbmFjdGl2ZScgfSksXG4gICAgICBzZXQ6IHd5c2l3eWdNb2RlXG4gICAgfVxuICB9O1xuICB2YXIgcGxhY2U7XG5cbiAgdGFnKHsgdDogJ3NwYW4nLCBjOiAnd2stZHJvcC10ZXh0JywgeDogc3RyaW5ncy5wcm9tcHRzLmRyb3AsIHA6IGRyb3BhcmVhIH0pO1xuICB0YWcoeyB0OiAncCcsIGM6IFsnd2stZHJvcC1pY29uJ10uY29uY2F0KG8uY2xhc3Nlcy5kcm9waWNvbikuam9pbignICcpLCBwOiBkcm9wYXJlYSB9KTtcblxuICBlZGl0YWJsZS5jb250ZW50RWRpdGFibGUgPSB0cnVlO1xuICBtb2Rlcy5tYXJrZG93bi5idXR0b24uc2V0QXR0cmlidXRlKCdkaXNhYmxlZCcsICdkaXNhYmxlZCcpO1xuICBtb2RlTmFtZXMuZm9yRWFjaChhZGRNb2RlKTtcblxuICBpZiAoby53eXNpd3lnKSB7XG4gICAgcGxhY2UgPSB0YWcoeyBjOiAnd2std3lzaXd5Zy1wbGFjZWhvbGRlciB3ay1oaWRlJywgeDogdGV4dGFyZWEucGxhY2Vob2xkZXIgfSk7XG4gICAgY3Jvc3N2ZW50LmFkZChwbGFjZSwgJ2NsaWNrJywgZm9jdXNFZGl0YWJsZSk7XG4gIH1cblxuICBpZiAoby5kZWZhdWx0TW9kZSAmJiBvW28uZGVmYXVsdE1vZGVdKSB7XG4gICAgbW9kZXNbby5kZWZhdWx0TW9kZV0uc2V0KCk7XG4gIH0gZWxzZSBpZiAoby5tYXJrZG93bikge1xuICAgIG1vZGVzLm1hcmtkb3duLnNldCgpO1xuICB9IGVsc2UgaWYgKG8uaHRtbCkge1xuICAgIG1vZGVzLmh0bWwuc2V0KCk7XG4gIH0gZWxzZSB7XG4gICAgbW9kZXMud3lzaXd5Zy5zZXQoKTtcbiAgfVxuXG4gIGJpbmRDb21tYW5kcyhzdXJmYWNlLCBvLCBlZGl0b3IpO1xuICBiaW5kRXZlbnRzKCk7XG5cbiAgcmV0dXJuIGVkaXRvcjtcblxuICBmdW5jdGlvbiBhZGRNb2RlIChpZCkge1xuICAgIHZhciBidXR0b24gPSBtb2Rlc1tpZF0uYnV0dG9uO1xuICAgIHZhciBjdXN0b20gPSBvLnJlbmRlci5tb2RlcztcbiAgICBpZiAob1tpZF0pIHtcbiAgICAgIHN3aXRjaGJvYXJkLmFwcGVuZENoaWxkKGJ1dHRvbik7XG4gICAgICAodHlwZW9mIGN1c3RvbSA9PT0gJ2Z1bmN0aW9uJyA/IGN1c3RvbSA6IHJlbmRlcmVycy5tb2RlcykoYnV0dG9uLCBpZCk7XG4gICAgICBjcm9zc3ZlbnQuYWRkKGJ1dHRvbiwgJ2NsaWNrJywgbW9kZXNbaWRdLnNldCk7XG4gICAgICBidXR0b24udHlwZSA9ICdidXR0b24nO1xuICAgICAgYnV0dG9uLnRhYkluZGV4ID0gLTE7XG5cbiAgICAgIHZhciB0aXRsZSA9IHN0cmluZ3MudGl0bGVzW2lkXTtcbiAgICAgIGlmICh0aXRsZSkge1xuICAgICAgICBidXR0b24uc2V0QXR0cmlidXRlKCd0aXRsZScsIG1hYyA/IG1hY2lmeSh0aXRsZSkgOiB0aXRsZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gYmluZEV2ZW50cyAocmVtb3ZlKSB7XG4gICAgdmFyIGFyID0gcmVtb3ZlID8gJ3JtJyA6ICdhZGQnO1xuICAgIHZhciBtb3YgPSByZW1vdmUgPyAncmVtb3ZlQ2hpbGQnIDogJ2FwcGVuZENoaWxkJztcbiAgICBpZiAocmVtb3ZlKSB7XG4gICAgICBrYW55ZS5jbGVhcihrYW55ZUNvbnRleHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoby5tYXJrZG93bikgeyBrYW55ZS5vbignY21kK20nLCBrYW55ZU9wdGlvbnMsIG1hcmtkb3duTW9kZSk7IH1cbiAgICAgIGlmIChvLmh0bWwpIHsga2FueWUub24oJ2NtZCtoJywga2FueWVPcHRpb25zLCBodG1sTW9kZSk7IH1cbiAgICAgIGlmIChvLnd5c2l3eWcpIHsga2FueWUub24oJ2NtZCtwJywga2FueWVPcHRpb25zLCB3eXNpd3lnTW9kZSk7IH1cbiAgICB9XG4gICAgY2xhc3Nlc1thcl0ocGFyZW50LCAnd2stY29udGFpbmVyJyk7XG4gICAgcGFyZW50W21vdl0oZWRpdGFibGUpO1xuICAgIGlmIChwbGFjZSkgeyBwYXJlbnRbbW92XShwbGFjZSk7IH1cbiAgICBwYXJlbnRbbW92XShjb21tYW5kcyk7XG4gICAgcGFyZW50W21vdl0oc3dpdGNoYm9hcmQpO1xuICAgIGlmICgoby5pbWFnZXMgfHwgby5hdHRhY2htZW50cykgJiYgby54aHIpIHtcbiAgICAgIHBhcmVudFttb3ZdKGRyb3BhcmVhKTtcbiAgICAgIHVwbG9hZHMocGFyZW50LCBkcm9wYXJlYSwgZWRpdG9yLCBvLCByZW1vdmUpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGRlc3Ryb3kgKCkge1xuICAgIGlmIChlZGl0b3IubW9kZSAhPT0gJ21hcmtkb3duJykge1xuICAgICAgdGV4dGFyZWEudmFsdWUgPSBnZXRNYXJrZG93bigpO1xuICAgIH1cbiAgICBjbGFzc2VzLnJtKHRleHRhcmVhLCAnd2staGlkZScpO1xuICAgIGJpbmRFdmVudHModHJ1ZSk7XG4gICAgZGVsZXRlIGNhY2hlW2kgLSAxXTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG1hcmtkb3duTW9kZSAoZSkgeyBwZXJzaXN0TW9kZSgnbWFya2Rvd24nLCBlKTsgfVxuICBmdW5jdGlvbiBodG1sTW9kZSAoZSkgeyBwZXJzaXN0TW9kZSgnaHRtbCcsIGUpOyB9XG4gIGZ1bmN0aW9uIHd5c2l3eWdNb2RlIChlKSB7IHBlcnNpc3RNb2RlKCd3eXNpd3lnJywgZSk7IH1cblxuICBmdW5jdGlvbiBwZXJzaXN0TW9kZSAobmV4dE1vZGUsIGUpIHtcbiAgICB2YXIgcmVtZW1icmFuY2U7XG4gICAgdmFyIGN1cnJlbnRNb2RlID0gZWRpdG9yLm1vZGU7XG4gICAgdmFyIG9sZCA9IG1vZGVzW2N1cnJlbnRNb2RlXS5idXR0b247XG4gICAgdmFyIGJ1dHRvbiA9IG1vZGVzW25leHRNb2RlXS5idXR0b247XG4gICAgdmFyIGZvY3VzaW5nID0gISFlIHx8IGRvYy5hY3RpdmVFbGVtZW50ID09PSB0ZXh0YXJlYSB8fCBkb2MuYWN0aXZlRWxlbWVudCA9PT0gZWRpdGFibGU7XG5cbiAgICBzdG9wKGUpO1xuXG4gICAgaWYgKGN1cnJlbnRNb2RlID09PSBuZXh0TW9kZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHJlbWVtYnJhbmNlID0gZm9jdXNpbmcgJiYgcmVtZW1iZXJTZWxlY3Rpb24oaGlzdG9yeSwgbyk7XG4gICAgdGV4dGFyZWEuYmx1cigpOyAvLyBhdmVydCBjaHJvbWUgcmVwYWludCBidWdzXG5cbiAgICBpZiAobmV4dE1vZGUgPT09ICdtYXJrZG93bicpIHtcbiAgICAgIGlmIChjdXJyZW50TW9kZSA9PT0gJ2h0bWwnKSB7XG4gICAgICAgIHRleHRhcmVhLnZhbHVlID0gcGFyc2UoJ3BhcnNlSFRNTCcsIHRleHRhcmVhLnZhbHVlKS50cmltKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0ZXh0YXJlYS52YWx1ZSA9IHBhcnNlKCdwYXJzZUhUTUwnLCBlZGl0YWJsZSkudHJpbSgpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAobmV4dE1vZGUgPT09ICdodG1sJykge1xuICAgICAgaWYgKGN1cnJlbnRNb2RlID09PSAnbWFya2Rvd24nKSB7XG4gICAgICAgIHRleHRhcmVhLnZhbHVlID0gcGFyc2UoJ3BhcnNlTWFya2Rvd24nLCB0ZXh0YXJlYS52YWx1ZSkudHJpbSgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGV4dGFyZWEudmFsdWUgPSBlZGl0YWJsZS5pbm5lckhUTUwudHJpbSgpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAobmV4dE1vZGUgPT09ICd3eXNpd3lnJykge1xuICAgICAgaWYgKGN1cnJlbnRNb2RlID09PSAnbWFya2Rvd24nKSB7XG4gICAgICAgIGVkaXRhYmxlLmlubmVySFRNTCA9IHBhcnNlKCdwYXJzZU1hcmtkb3duJywgdGV4dGFyZWEudmFsdWUpLnJlcGxhY2UocnBhcmFncmFwaCwgJycpLnRyaW0oKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVkaXRhYmxlLmlubmVySFRNTCA9IHRleHRhcmVhLnZhbHVlLnJlcGxhY2UocnBhcmFncmFwaCwgJycpLnRyaW0oKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAobmV4dE1vZGUgPT09ICd3eXNpd3lnJykge1xuICAgICAgY2xhc3Nlcy5hZGQodGV4dGFyZWEsICd3ay1oaWRlJyk7XG4gICAgICBjbGFzc2VzLnJtKGVkaXRhYmxlLCAnd2staGlkZScpO1xuICAgICAgaWYgKHBsYWNlKSB7IGNsYXNzZXMucm0ocGxhY2UsICd3ay1oaWRlJyk7IH1cbiAgICAgIGlmIChmb2N1c2luZykgeyBzZXRUaW1lb3V0KGZvY3VzRWRpdGFibGUsIDApOyB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNsYXNzZXMucm0odGV4dGFyZWEsICd3ay1oaWRlJyk7XG4gICAgICBjbGFzc2VzLmFkZChlZGl0YWJsZSwgJ3drLWhpZGUnKTtcbiAgICAgIGlmIChwbGFjZSkgeyBjbGFzc2VzLmFkZChwbGFjZSwgJ3drLWhpZGUnKTsgfVxuICAgICAgaWYgKGZvY3VzaW5nKSB7IHRleHRhcmVhLmZvY3VzKCk7IH1cbiAgICB9XG4gICAgY2xhc3Nlcy5hZGQoYnV0dG9uLCAnd2stbW9kZS1hY3RpdmUnKTtcbiAgICBjbGFzc2VzLnJtKG9sZCwgJ3drLW1vZGUtYWN0aXZlJyk7XG4gICAgY2xhc3Nlcy5hZGQob2xkLCAnd2stbW9kZS1pbmFjdGl2ZScpO1xuICAgIGNsYXNzZXMucm0oYnV0dG9uLCAnd2stbW9kZS1pbmFjdGl2ZScpO1xuICAgIGJ1dHRvbi5zZXRBdHRyaWJ1dGUoJ2Rpc2FibGVkJywgJ2Rpc2FibGVkJyk7XG4gICAgb2xkLnJlbW92ZUF0dHJpYnV0ZSgnZGlzYWJsZWQnKTtcbiAgICBlZGl0b3IubW9kZSA9IG5leHRNb2RlO1xuXG4gICAgaWYgKG8uc3RvcmFnZSkgeyBscy5zZXQoby5zdG9yYWdlLCBuZXh0TW9kZSk7IH1cblxuICAgIGhpc3Rvcnkuc2V0SW5wdXRNb2RlKG5leHRNb2RlKTtcbiAgICBpZiAocmVtZW1icmFuY2UpIHsgcmVtZW1icmFuY2UudW5tYXJrKCk7IH1cbiAgICBmaXJlTGF0ZXIoJ3dvb2ZtYXJrLW1vZGUtY2hhbmdlJyk7XG5cbiAgICBmdW5jdGlvbiBwYXJzZSAobWV0aG9kLCBpbnB1dCkge1xuICAgICAgcmV0dXJuIG9bbWV0aG9kXShpbnB1dCwge1xuICAgICAgICBtYXJrZXJzOiByZW1lbWJyYW5jZSAmJiByZW1lbWJyYW5jZS5tYXJrZXJzIHx8IFtdXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBmaXJlTGF0ZXIgKHR5cGUpIHtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uIGZpcmUgKCkge1xuICAgICAgY3Jvc3N2ZW50LmZhYnJpY2F0ZSh0ZXh0YXJlYSwgdHlwZSk7XG4gICAgfSwgMCk7XG4gIH1cblxuICBmdW5jdGlvbiBmb2N1c0VkaXRhYmxlICgpIHtcbiAgICBlZGl0YWJsZS5mb2N1cygpO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0TWFya2Rvd24gKCkge1xuICAgIGlmIChlZGl0b3IubW9kZSA9PT0gJ3d5c2l3eWcnKSB7XG4gICAgICByZXR1cm4gby5wYXJzZUhUTUwoZWRpdGFibGUpO1xuICAgIH1cbiAgICBpZiAoZWRpdG9yLm1vZGUgPT09ICdodG1sJykge1xuICAgICAgcmV0dXJuIG8ucGFyc2VIVE1MKHRleHRhcmVhLnZhbHVlKTtcbiAgICB9XG4gICAgcmV0dXJuIHRleHRhcmVhLnZhbHVlO1xuICB9XG5cbiAgZnVuY3Rpb24gYWRkQ29tbWFuZEJ1dHRvbiAoaWQsIGNvbWJvLCBmbikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAyKSB7XG4gICAgICBmbiA9IGNvbWJvO1xuICAgICAgY29tYm8gPSBudWxsO1xuICAgIH1cbiAgICB2YXIgYnV0dG9uID0gdGFnKHsgdDogJ2J1dHRvbicsIGM6ICd3ay1jb21tYW5kJywgcDogY29tbWFuZHMgfSk7XG4gICAgdmFyIGN1c3RvbSA9IG8ucmVuZGVyLmNvbW1hbmRzO1xuICAgIHZhciByZW5kZXIgPSB0eXBlb2YgY3VzdG9tID09PSAnZnVuY3Rpb24nID8gY3VzdG9tIDogcmVuZGVyZXJzLmNvbW1hbmRzO1xuICAgIHZhciB0aXRsZSA9IHN0cmluZ3MudGl0bGVzW2lkXTtcbiAgICBpZiAodGl0bGUpIHtcbiAgICAgIGJ1dHRvbi5zZXRBdHRyaWJ1dGUoJ3RpdGxlJywgbWFjID8gbWFjaWZ5KHRpdGxlKSA6IHRpdGxlKTtcbiAgICB9XG4gICAgYnV0dG9uLnR5cGUgPSAnYnV0dG9uJztcbiAgICBidXR0b24udGFiSW5kZXggPSAtMTtcbiAgICByZW5kZXIoYnV0dG9uLCBpZCk7XG4gICAgY3Jvc3N2ZW50LmFkZChidXR0b24sICdjbGljaycsIGdldENvbW1hbmRIYW5kbGVyKHN1cmZhY2UsIGhpc3RvcnksIGZuKSk7XG4gICAgaWYgKGNvbWJvKSB7XG4gICAgICBhZGRDb21tYW5kKGNvbWJvLCBmbik7XG4gICAgfVxuICAgIHJldHVybiBidXR0b247XG4gIH1cblxuICBmdW5jdGlvbiBhZGRDb21tYW5kIChjb21ibywgZm4pIHtcbiAgICBrYW55ZS5vbihjb21ibywga2FueWVPcHRpb25zLCBnZXRDb21tYW5kSGFuZGxlcihzdXJmYWNlLCBoaXN0b3J5LCBmbikpO1xuICB9XG5cbiAgZnVuY3Rpb24gcnVuQ29tbWFuZCAoZm4pIHtcbiAgICBnZXRDb21tYW5kSGFuZGxlcihzdXJmYWNlLCBoaXN0b3J5LCByZWFycmFuZ2UpKG51bGwpO1xuICAgIGZ1bmN0aW9uIHJlYXJyYW5nZSAoZSwgbW9kZSwgY2h1bmtzKSB7XG4gICAgICByZXR1cm4gZm4uY2FsbCh0aGlzLCBjaHVua3MsIG1vZGUpO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiB0YWcgKG9wdGlvbnMpIHtcbiAgdmFyIG8gPSBvcHRpb25zIHx8IHt9O1xuICB2YXIgZWwgPSBkb2MuY3JlYXRlRWxlbWVudChvLnQgfHwgJ2RpdicpO1xuICBlbC5jbGFzc05hbWUgPSBvLmMgfHwgJyc7XG4gIHNldFRleHQoZWwsIG8ueCB8fCAnJyk7XG4gIGlmIChvLnApIHsgby5wLmFwcGVuZENoaWxkKGVsKTsgfVxuICByZXR1cm4gZWw7XG59XG5cbmZ1bmN0aW9uIHN0b3AgKGUpIHtcbiAgaWYgKGUpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyBlLnN0b3BQcm9wYWdhdGlvbigpOyB9XG59XG5cbmZ1bmN0aW9uIG1hY2lmeSAodGV4dCkge1xuICByZXR1cm4gdGV4dFxuICAgIC5yZXBsYWNlKC9cXGJjdHJsXFxiL2ksICdcXHUyMzE4JylcbiAgICAucmVwbGFjZSgvXFxiYWx0XFxiL2ksICdcXHUyMzI1JylcbiAgICAucmVwbGFjZSgvXFxic2hpZnRcXGIvaSwgJ1xcdTIxZTcnKTtcbn1cblxud29vZm1hcmsuZmluZCA9IGZpbmQ7XG53b29mbWFyay5zdHJpbmdzID0gc3RyaW5ncztcbm1vZHVsZS5leHBvcnRzID0gd29vZm1hcms7XG5cbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ6dXRmLTg7YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0p6YjNWeVkyVnpJanBiSW5OeVl5OTNiMjltYldGeWF5NXFjeUpkTENKdVlXMWxjeUk2VzEwc0ltMWhjSEJwYm1keklqb2lPMEZCUVVFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CSWl3aVptbHNaU0k2SW1kbGJtVnlZWFJsWkM1cWN5SXNJbk52ZFhKalpWSnZiM1FpT2lJaUxDSnpiM1Z5WTJWelEyOXVkR1Z1ZENJNld5SW5kWE5sSUhOMGNtbGpkQ2M3WEc1Y2JuWmhjaUJzY3lBOUlISmxjWFZwY21Vb0oyeHZZMkZzTFhOMGIzSmhaMlVuS1R0Y2JuWmhjaUJqY205emMzWmxiblFnUFNCeVpYRjFhWEpsS0NkamNtOXpjM1psYm5RbktUdGNiblpoY2lCcllXNTVaU0E5SUhKbGNYVnBjbVVvSjJ0aGJubGxKeWs3WEc1MllYSWdkWEJzYjJGa2N5QTlJSEpsY1hWcGNtVW9KeTR2ZFhCc2IyRmtjeWNwTzF4dWRtRnlJSE4wY21sdVozTWdQU0J5WlhGMWFYSmxLQ2N1TDNOMGNtbHVaM01uS1R0Y2JuWmhjaUJ6WlhSVVpYaDBJRDBnY21WeGRXbHlaU2duTGk5elpYUlVaWGgwSnlrN1hHNTJZWElnY21WdFpXMWlaWEpUWld4bFkzUnBiMjRnUFNCeVpYRjFhWEpsS0NjdUwzSmxiV1Z0WW1WeVUyVnNaV04wYVc5dUp5azdYRzUyWVhJZ1ltbHVaRU52YlcxaGJtUnpJRDBnY21WeGRXbHlaU2duTGk5aWFXNWtRMjl0YldGdVpITW5LVHRjYm5aaGNpQkpibkIxZEVocGMzUnZjbmtnUFNCeVpYRjFhWEpsS0NjdUwwbHVjSFYwU0dsemRHOXllU2NwTzF4dWRtRnlJR2RsZEVOdmJXMWhibVJJWVc1a2JHVnlJRDBnY21WeGRXbHlaU2duTGk5blpYUkRiMjF0WVc1a1NHRnVaR3hsY2ljcE8xeHVkbUZ5SUdkbGRGTjFjbVpoWTJVZ1BTQnlaWEYxYVhKbEtDY3VMMmRsZEZOMWNtWmhZMlVuS1R0Y2JuWmhjaUJqYkdGemMyVnpJRDBnY21WeGRXbHlaU2duTGk5amJHRnpjMlZ6SnlrN1hHNTJZWElnY21WdVpHVnlaWEp6SUQwZ2NtVnhkV2x5WlNnbkxpOXlaVzVrWlhKbGNuTW5LVHRjYm5aaGNpQjRhSEpUZEhWaUlEMGdjbVZ4ZFdseVpTZ25MaTk0YUhKVGRIVmlKeWs3WEc1MllYSWdjSEp2YlhCMElEMGdjbVZ4ZFdseVpTZ25MaTl3Y205dGNIUnpMM0J5YjIxd2RDY3BPMXh1ZG1GeUlHTnNiM05sVUhKdmJYQjBjeUE5SUhKbGNYVnBjbVVvSnk0dmNISnZiWEIwY3k5amJHOXpaU2NwTzF4dWRtRnlJRzF2WkdWT1lXMWxjeUE5SUZzbmJXRnlhMlJ2ZDI0bkxDQW5hSFJ0YkNjc0lDZDNlWE5wZDNsbkoxMDdYRzUyWVhJZ1kyRmphR1VnUFNCYlhUdGNiblpoY2lCdFlXTWdQU0F2WEZ4aVRXRmpJRTlUWEZ4aUx5NTBaWE4wS0dkc2IySmhiQzV1WVhacFoyRjBiM0l1ZFhObGNrRm5aVzUwS1R0Y2JuWmhjaUJrYjJNZ1BTQmtiMk4xYldWdWREdGNiblpoY2lCeWNHRnlZV2R5WVhCb0lEMGdMMTQ4Y0Q0OFhGd3ZjRDVjWEc0L0pDOXBPMXh1WEc1bWRXNWpkR2x2YmlCbWFXNWtJQ2gwWlhoMFlYSmxZU2tnZTF4dUlDQm1iM0lnS0haaGNpQnBJRDBnTURzZ2FTQThJR05oWTJobExteGxibWQwYURzZ2FTc3JLU0I3WEc0Z0lDQWdhV1lnS0dOaFkyaGxXMmxkSUNZbUlHTmhZMmhsVzJsZExuUmhJRDA5UFNCMFpYaDBZWEpsWVNrZ2UxeHVJQ0FnSUNBZ2NtVjBkWEp1SUdOaFkyaGxXMmxkTG1Wa2FYUnZjanRjYmlBZ0lDQjlYRzRnSUgxY2JpQWdjbVYwZFhKdUlHNTFiR3c3WEc1OVhHNWNibVoxYm1OMGFXOXVJSGR2YjJadFlYSnJJQ2gwWlhoMFlYSmxZU3dnYjNCMGFXOXVjeWtnZTF4dUlDQjJZWElnWTJGamFHVmtJRDBnWm1sdVpDaDBaWGgwWVhKbFlTazdYRzRnSUdsbUlDaGpZV05vWldRcElIdGNiaUFnSUNCeVpYUjFjbTRnWTJGamFHVmtPMXh1SUNCOVhHNWNiaUFnZG1GeUlIQmhjbVZ1ZENBOUlIUmxlSFJoY21WaExuQmhjbVZ1ZEVWc1pXMWxiblE3WEc0Z0lHbG1JQ2h3WVhKbGJuUXVZMmhwYkdSeVpXNHViR1Z1WjNSb0lENGdNU2tnZTF4dUlDQWdJSFJvY205M0lHNWxkeUJGY25KdmNpZ25kMjl2Wm0xaGNtc2daR1Z0WVc1a2N5QThkR1Y0ZEdGeVpXRStJR1ZzWlcxbGJuUnpJSFJ2SUdoaGRtVWdibThnYzJsaWJHbHVaM01uS1R0Y2JpQWdmVnh1WEc0Z0lIWmhjaUJ2SUQwZ2IzQjBhVzl1Y3lCOGZDQjdmVHRjYmlBZ2FXWWdLRzh1YldGeWEyUnZkMjRnUFQwOUlIWnZhV1FnTUNrZ2V5QnZMbTFoY210a2IzZHVJRDBnZEhKMVpUc2dmVnh1SUNCcFppQW9ieTVvZEcxc0lEMDlQU0IyYjJsa0lEQXBJSHNnYnk1b2RHMXNJRDBnZEhKMVpUc2dmVnh1SUNCcFppQW9ieTUzZVhOcGQzbG5JRDA5UFNCMmIybGtJREFwSUhzZ2J5NTNlWE5wZDNsbklEMGdkSEoxWlRzZ2ZWeHVYRzRnSUdsbUlDZ2hieTV0WVhKclpHOTNiaUFtSmlBaGJ5NW9kRzFzSUNZbUlDRnZMbmQ1YzJsM2VXY3BJSHRjYmlBZ0lDQjBhSEp2ZHlCdVpYY2dSWEp5YjNJb0ozZHZiMlp0WVhKcklHVjRjR1ZqZEhNZ1lYUWdiR1ZoYzNRZ2IyNWxJR2x1Y0hWMElHMXZaR1VnZEc4Z1ltVWdZWFpoYVd4aFlteGxKeWs3WEc0Z0lIMWNibHh1SUNCcFppQW9ieTVvY2lBOVBUMGdkbTlwWkNBd0tTQjdJRzh1YUhJZ1BTQm1ZV3h6WlRzZ2ZWeHVJQ0JwWmlBb2J5NXpkRzl5WVdkbElEMDlQU0IyYjJsa0lEQXBJSHNnYnk1emRHOXlZV2RsSUQwZ2RISjFaVHNnZlZ4dUlDQnBaaUFvYnk1emRHOXlZV2RsSUQwOVBTQjBjblZsS1NCN0lHOHVjM1J2Y21GblpTQTlJQ2QzYjI5bWJXRnlhMTlwYm5CMWRGOXRiMlJsSnpzZ2ZWeHVJQ0JwWmlBb2J5NW1aVzVqYVc1bklEMDlQU0IyYjJsa0lEQXBJSHNnYnk1bVpXNWphVzVuSUQwZ2RISjFaVHNnZlZ4dUlDQnBaaUFvYnk1eVpXNWtaWElnUFQwOUlIWnZhV1FnTUNrZ2V5QnZMbkpsYm1SbGNpQTlJSHQ5T3lCOVhHNGdJR2xtSUNodkxuSmxibVJsY2k1dGIyUmxjeUE5UFQwZ2RtOXBaQ0F3S1NCN0lHOHVjbVZ1WkdWeUxtMXZaR1Z6SUQwZ2UzMDdJSDFjYmlBZ2FXWWdLRzh1Y21WdVpHVnlMbU52YlcxaGJtUnpJRDA5UFNCMmIybGtJREFwSUhzZ2J5NXlaVzVrWlhJdVkyOXRiV0Z1WkhNZ1BTQjdmVHNnZlZ4dUlDQnBaaUFvYnk1d2NtOXRjSFJ6SUQwOVBTQjJiMmxrSURBcElIc2dieTV3Y205dGNIUnpJRDBnZTMwN0lIMWNiaUFnYVdZZ0tHOHVjSEp2YlhCMGN5NXNhVzVySUQwOVBTQjJiMmxrSURBcElIc2dieTV3Y205dGNIUnpMbXhwYm1zZ1BTQndjbTl0Y0hRN0lIMWNiaUFnYVdZZ0tHOHVjSEp2YlhCMGN5NXBiV0ZuWlNBOVBUMGdkbTlwWkNBd0tTQjdJRzh1Y0hKdmJYQjBjeTVwYldGblpTQTlJSEJ5YjIxd2REc2dmVnh1SUNCcFppQW9ieTV3Y205dGNIUnpMbUYwZEdGamFHMWxiblFnUFQwOUlIWnZhV1FnTUNrZ2V5QnZMbkJ5YjIxd2RITXVZWFIwWVdOb2JXVnVkQ0E5SUhCeWIyMXdkRHNnZlZ4dUlDQnBaaUFvYnk1d2NtOXRjSFJ6TG1Oc2IzTmxJRDA5UFNCMmIybGtJREFwSUhzZ2J5NXdjbTl0Y0hSekxtTnNiM05sSUQwZ1kyeHZjMlZRY205dGNIUnpPeUI5WEc0Z0lHbG1JQ2h2TG5ob2NpQTlQVDBnZG05cFpDQXdLU0I3SUc4dWVHaHlJRDBnZUdoeVUzUjFZanNnZlZ4dUlDQnBaaUFvYnk1amJHRnpjMlZ6SUQwOVBTQjJiMmxrSURBcElIc2dieTVqYkdGemMyVnpJRDBnZTMwN0lIMWNiaUFnYVdZZ0tHOHVZMnhoYzNObGN5NTNlWE5wZDNsbklEMDlQU0IyYjJsa0lEQXBJSHNnYnk1amJHRnpjMlZ6TG5kNWMybDNlV2NnUFNCYlhUc2dmVnh1SUNCcFppQW9ieTVqYkdGemMyVnpMbkJ5YjIxd2RITWdQVDA5SUhadmFXUWdNQ2tnZXlCdkxtTnNZWE56WlhNdWNISnZiWEIwY3lBOUlIdDlPeUI5WEc0Z0lHbG1JQ2h2TG1Oc1lYTnpaWE11YVc1d2RYUWdQVDA5SUhadmFXUWdNQ2tnZXlCdkxtTnNZWE56WlhNdWFXNXdkWFFnUFNCN2ZUc2dmVnh1WEc0Z0lIWmhjaUJ3Y21WbVpYSmxibU5sSUQwZ2J5NXpkRzl5WVdkbElDWW1JR3h6TG1kbGRDaHZMbk4wYjNKaFoyVXBPMXh1SUNCcFppQW9jSEpsWm1WeVpXNWpaU2tnZTF4dUlDQWdJRzh1WkdWbVlYVnNkRTF2WkdVZ1BTQndjbVZtWlhKbGJtTmxPMXh1SUNCOVhHNWNiaUFnZG1GeUlHUnliM0JoY21WaElEMGdkR0ZuS0hzZ1l6b2dKM2RyTFdOdmJuUmhhVzVsY2kxa2NtOXdKeUI5S1R0Y2JpQWdkbUZ5SUhOM2FYUmphR0p2WVhKa0lEMGdkR0ZuS0hzZ1l6b2dKM2RyTFhOM2FYUmphR0p2WVhKa0p5QjlLVHRjYmlBZ2RtRnlJR052YlcxaGJtUnpJRDBnZEdGbktIc2dZem9nSjNkckxXTnZiVzFoYm1Sekp5QjlLVHRjYmlBZ2RtRnlJR1ZrYVhSaFlteGxJRDBnZEdGbktIc2dZem9nV3lkM2F5MTNlWE5wZDNsbkp5d2dKM2RyTFdocFpHVW5YUzVqYjI1allYUW9ieTVqYkdGemMyVnpMbmQ1YzJsM2VXY3BMbXB2YVc0b0p5QW5LU0I5S1R0Y2JpQWdkbUZ5SUhOMWNtWmhZMlVnUFNCblpYUlRkWEptWVdObEtIUmxlSFJoY21WaExDQmxaR2wwWVdKc1pTd2daSEp2Y0dGeVpXRXBPMXh1SUNCMllYSWdhR2x6ZEc5eWVTQTlJRzVsZHlCSmJuQjFkRWhwYzNSdmNua29jM1Z5Wm1GalpTd2dKMjFoY210a2IzZHVKeWs3WEc0Z0lIWmhjaUJsWkdsMGIzSWdQU0I3WEc0Z0lDQWdZV1JrUTI5dGJXRnVaRG9nWVdSa1EyOXRiV0Z1WkN4Y2JpQWdJQ0JoWkdSRGIyMXRZVzVrUW5WMGRHOXVPaUJoWkdSRGIyMXRZVzVrUW5WMGRHOXVMRnh1SUNBZ0lISjFia052YlcxaGJtUTZJSEoxYmtOdmJXMWhibVFzWEc0Z0lDQWdjR0Z5YzJWTllYSnJaRzkzYmpvZ2J5NXdZWEp6WlUxaGNtdGtiM2R1TEZ4dUlDQWdJSEJoY25ObFNGUk5URG9nYnk1d1lYSnpaVWhVVFV3c1hHNGdJQ0FnWkdWemRISnZlVG9nWkdWemRISnZlU3hjYmlBZ0lDQjJZV3gxWlRvZ1oyVjBUV0Z5YTJSdmQyNHNYRzRnSUNBZ2RHVjRkR0Z5WldFNklIUmxlSFJoY21WaExGeHVJQ0FnSUdWa2FYUmhZbXhsT2lCdkxuZDVjMmwzZVdjZ1B5QmxaR2wwWVdKc1pTQTZJRzUxYkd3c1hHNGdJQ0FnYzJWMFRXOWtaVG9nY0dWeWMybHpkRTF2WkdVc1hHNGdJQ0FnYUdsemRHOXllVG9nZTF4dUlDQWdJQ0FnZFc1a2J6b2dhR2x6ZEc5eWVTNTFibVJ2TEZ4dUlDQWdJQ0FnY21Wa2J6b2dhR2x6ZEc5eWVTNXlaV1J2TEZ4dUlDQWdJQ0FnWTJGdVZXNWtiem9nYUdsemRHOXllUzVqWVc1VmJtUnZMRnh1SUNBZ0lDQWdZMkZ1VW1Wa2J6b2dhR2x6ZEc5eWVTNWpZVzVTWldSdlhHNGdJQ0FnZlN4Y2JpQWdJQ0J0YjJSbE9pQW5iV0Z5YTJSdmQyNG5YRzRnSUgwN1hHNGdJSFpoY2lCbGJuUnllU0E5SUhzZ2RHRTZJSFJsZUhSaGNtVmhMQ0JsWkdsMGIzSTZJR1ZrYVhSdmNpQjlPMXh1SUNCMllYSWdhU0E5SUdOaFkyaGxMbkIxYzJnb1pXNTBjbmtwTzF4dUlDQjJZWElnYTJGdWVXVkRiMjUwWlhoMElEMGdKM2R2YjJadFlYSnJYeWNnS3lCcE8xeHVJQ0IyWVhJZ2EyRnVlV1ZQY0hScGIyNXpJRDBnZTF4dUlDQWdJR1pwYkhSbGNqb2djR0Z5Wlc1MExGeHVJQ0FnSUdOdmJuUmxlSFE2SUd0aGJubGxRMjl1ZEdWNGRGeHVJQ0I5TzF4dUlDQjJZWElnYlc5a1pYTWdQU0I3WEc0Z0lDQWdiV0Z5YTJSdmQyNDZJSHRjYmlBZ0lDQWdJR0oxZEhSdmJqb2dkR0ZuS0hzZ2REb2dKMkoxZEhSdmJpY3NJR002SUNkM2F5MXRiMlJsSUhkckxXMXZaR1V0WVdOMGFYWmxKeUI5S1N4Y2JpQWdJQ0FnSUhObGREb2diV0Z5YTJSdmQyNU5iMlJsWEc0Z0lDQWdmU3hjYmlBZ0lDQm9kRzFzT2lCN1hHNGdJQ0FnSUNCaWRYUjBiMjQ2SUhSaFp5aDdJSFE2SUNkaWRYUjBiMjRuTENCak9pQW5kMnN0Ylc5a1pTQjNheTF0YjJSbExXbHVZV04wYVhabEp5QjlLU3hjYmlBZ0lDQWdJSE5sZERvZ2FIUnRiRTF2WkdWY2JpQWdJQ0I5TEZ4dUlDQWdJSGQ1YzJsM2VXYzZJSHRjYmlBZ0lDQWdJR0oxZEhSdmJqb2dkR0ZuS0hzZ2REb2dKMkoxZEhSdmJpY3NJR002SUNkM2F5MXRiMlJsSUhkckxXMXZaR1V0YVc1aFkzUnBkbVVuSUgwcExGeHVJQ0FnSUNBZ2MyVjBPaUIzZVhOcGQzbG5UVzlrWlZ4dUlDQWdJSDFjYmlBZ2ZUdGNiaUFnZG1GeUlIQnNZV05sTzF4dVhHNGdJSFJoWnloN0lIUTZJQ2R6Y0dGdUp5d2dZem9nSjNkckxXUnliM0F0ZEdWNGRDY3NJSGc2SUhOMGNtbHVaM011Y0hKdmJYQjBjeTVrY205d0xDQndPaUJrY205d1lYSmxZU0I5S1R0Y2JpQWdkR0ZuS0hzZ2REb2dKM0FuTENCak9pQmJKM2RyTFdSeWIzQXRhV052YmlkZExtTnZibU5oZENodkxtTnNZWE56WlhNdVpISnZjR2xqYjI0cExtcHZhVzRvSnlBbktTd2djRG9nWkhKdmNHRnlaV0VnZlNrN1hHNWNiaUFnWldScGRHRmliR1V1WTI5dWRHVnVkRVZrYVhSaFlteGxJRDBnZEhKMVpUdGNiaUFnYlc5a1pYTXViV0Z5YTJSdmQyNHVZblYwZEc5dUxuTmxkRUYwZEhKcFluVjBaU2duWkdsellXSnNaV1FuTENBblpHbHpZV0pzWldRbktUdGNiaUFnYlc5a1pVNWhiV1Z6TG1admNrVmhZMmdvWVdSa1RXOWtaU2s3WEc1Y2JpQWdhV1lnS0c4dWQzbHphWGQ1WnlrZ2UxeHVJQ0FnSUhCc1lXTmxJRDBnZEdGbktIc2dZem9nSjNkckxYZDVjMmwzZVdjdGNHeGhZMlZvYjJ4a1pYSWdkMnN0YUdsa1pTY3NJSGc2SUhSbGVIUmhjbVZoTG5Cc1lXTmxhRzlzWkdWeUlIMHBPMXh1SUNBZ0lHTnliM056ZG1WdWRDNWhaR1FvY0d4aFkyVXNJQ2RqYkdsamF5Y3NJR1p2WTNWelJXUnBkR0ZpYkdVcE8xeHVJQ0I5WEc1Y2JpQWdhV1lnS0c4dVpHVm1ZWFZzZEUxdlpHVWdKaVlnYjF0dkxtUmxabUYxYkhSTmIyUmxYU2tnZTF4dUlDQWdJRzF2WkdWelcyOHVaR1ZtWVhWc2RFMXZaR1ZkTG5ObGRDZ3BPMXh1SUNCOUlHVnNjMlVnYVdZZ0tHOHViV0Z5YTJSdmQyNHBJSHRjYmlBZ0lDQnRiMlJsY3k1dFlYSnJaRzkzYmk1elpYUW9LVHRjYmlBZ2ZTQmxiSE5sSUdsbUlDaHZMbWgwYld3cElIdGNiaUFnSUNCdGIyUmxjeTVvZEcxc0xuTmxkQ2dwTzF4dUlDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUcxdlpHVnpMbmQ1YzJsM2VXY3VjMlYwS0NrN1hHNGdJSDFjYmx4dUlDQmlhVzVrUTI5dGJXRnVaSE1vYzNWeVptRmpaU3dnYnl3Z1pXUnBkRzl5S1R0Y2JpQWdZbWx1WkVWMlpXNTBjeWdwTzF4dVhHNGdJSEpsZEhWeWJpQmxaR2wwYjNJN1hHNWNiaUFnWm5WdVkzUnBiMjRnWVdSa1RXOWtaU0FvYVdRcElIdGNiaUFnSUNCMllYSWdZblYwZEc5dUlEMGdiVzlrWlhOYmFXUmRMbUoxZEhSdmJqdGNiaUFnSUNCMllYSWdZM1Z6ZEc5dElEMGdieTV5Wlc1a1pYSXViVzlrWlhNN1hHNGdJQ0FnYVdZZ0tHOWJhV1JkS1NCN1hHNGdJQ0FnSUNCemQybDBZMmhpYjJGeVpDNWhjSEJsYm1SRGFHbHNaQ2hpZFhSMGIyNHBPMXh1SUNBZ0lDQWdLSFI1Y0dWdlppQmpkWE4wYjIwZ1BUMDlJQ2RtZFc1amRHbHZiaWNnUHlCamRYTjBiMjBnT2lCeVpXNWtaWEpsY25NdWJXOWtaWE1wS0dKMWRIUnZiaXdnYVdRcE8xeHVJQ0FnSUNBZ1kzSnZjM04yWlc1MExtRmtaQ2hpZFhSMGIyNHNJQ2RqYkdsamF5Y3NJRzF2WkdWelcybGtYUzV6WlhRcE8xeHVJQ0FnSUNBZ1luVjBkRzl1TG5SNWNHVWdQU0FuWW5WMGRHOXVKenRjYmlBZ0lDQWdJR0oxZEhSdmJpNTBZV0pKYm1SbGVDQTlJQzB4TzF4dVhHNGdJQ0FnSUNCMllYSWdkR2wwYkdVZ1BTQnpkSEpwYm1kekxuUnBkR3hsYzF0cFpGMDdYRzRnSUNBZ0lDQnBaaUFvZEdsMGJHVXBJSHRjYmlBZ0lDQWdJQ0FnWW5WMGRHOXVMbk5sZEVGMGRISnBZblYwWlNnbmRHbDBiR1VuTENCdFlXTWdQeUJ0WVdOcFpua29kR2wwYkdVcElEb2dkR2wwYkdVcE8xeHVJQ0FnSUNBZ2ZWeHVJQ0FnSUgxY2JpQWdmVnh1WEc0Z0lHWjFibU4wYVc5dUlHSnBibVJGZG1WdWRITWdLSEpsYlc5MlpTa2dlMXh1SUNBZ0lIWmhjaUJoY2lBOUlISmxiVzkyWlNBL0lDZHliU2NnT2lBbllXUmtKenRjYmlBZ0lDQjJZWElnYlc5MklEMGdjbVZ0YjNabElEOGdKM0psYlc5MlpVTm9hV3hrSnlBNklDZGhjSEJsYm1SRGFHbHNaQ2M3WEc0Z0lDQWdhV1lnS0hKbGJXOTJaU2tnZTF4dUlDQWdJQ0FnYTJGdWVXVXVZMnhsWVhJb2EyRnVlV1ZEYjI1MFpYaDBLVHRjYmlBZ0lDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUNBZ2FXWWdLRzh1YldGeWEyUnZkMjRwSUhzZ2EyRnVlV1V1YjI0b0oyTnRaQ3R0Snl3Z2EyRnVlV1ZQY0hScGIyNXpMQ0J0WVhKclpHOTNiazF2WkdVcE95QjlYRzRnSUNBZ0lDQnBaaUFvYnk1b2RHMXNLU0I3SUd0aGJubGxMbTl1S0NkamJXUXJhQ2NzSUd0aGJubGxUM0IwYVc5dWN5d2dhSFJ0YkUxdlpHVXBPeUI5WEc0Z0lDQWdJQ0JwWmlBb2J5NTNlWE5wZDNsbktTQjdJR3RoYm5sbExtOXVLQ2RqYldRcmNDY3NJR3RoYm5sbFQzQjBhVzl1Y3l3Z2QzbHphWGQ1WjAxdlpHVXBPeUI5WEc0Z0lDQWdmVnh1SUNBZ0lHTnNZWE56WlhOYllYSmRLSEJoY21WdWRDd2dKM2RyTFdOdmJuUmhhVzVsY2ljcE8xeHVJQ0FnSUhCaGNtVnVkRnR0YjNaZEtHVmthWFJoWW14bEtUdGNiaUFnSUNCcFppQW9jR3hoWTJVcElIc2djR0Z5Wlc1MFcyMXZkbDBvY0d4aFkyVXBPeUI5WEc0Z0lDQWdjR0Z5Wlc1MFcyMXZkbDBvWTI5dGJXRnVaSE1wTzF4dUlDQWdJSEJoY21WdWRGdHRiM1pkS0hOM2FYUmphR0p2WVhKa0tUdGNiaUFnSUNCcFppQW9LRzh1YVcxaFoyVnpJSHg4SUc4dVlYUjBZV05vYldWdWRITXBJQ1ltSUc4dWVHaHlLU0I3WEc0Z0lDQWdJQ0J3WVhKbGJuUmJiVzkyWFNoa2NtOXdZWEpsWVNrN1hHNGdJQ0FnSUNCMWNHeHZZV1J6S0hCaGNtVnVkQ3dnWkhKdmNHRnlaV0VzSUdWa2FYUnZjaXdnYnl3Z2NtVnRiM1psS1R0Y2JpQWdJQ0I5WEc0Z0lIMWNibHh1SUNCbWRXNWpkR2x2YmlCa1pYTjBjbTk1SUNncElIdGNiaUFnSUNCcFppQW9aV1JwZEc5eUxtMXZaR1VnSVQwOUlDZHRZWEpyWkc5M2JpY3BJSHRjYmlBZ0lDQWdJSFJsZUhSaGNtVmhMblpoYkhWbElEMGdaMlYwVFdGeWEyUnZkMjRvS1R0Y2JpQWdJQ0I5WEc0Z0lDQWdZMnhoYzNObGN5NXliU2gwWlhoMFlYSmxZU3dnSjNkckxXaHBaR1VuS1R0Y2JpQWdJQ0JpYVc1a1JYWmxiblJ6S0hSeWRXVXBPMXh1SUNBZ0lHUmxiR1YwWlNCallXTm9aVnRwSUMwZ01WMDdYRzRnSUgxY2JseHVJQ0JtZFc1amRHbHZiaUJ0WVhKclpHOTNiazF2WkdVZ0tHVXBJSHNnY0dWeWMybHpkRTF2WkdVb0oyMWhjbXRrYjNkdUp5d2daU2s3SUgxY2JpQWdablZ1WTNScGIyNGdhSFJ0YkUxdlpHVWdLR1VwSUhzZ2NHVnljMmx6ZEUxdlpHVW9KMmgwYld3bkxDQmxLVHNnZlZ4dUlDQm1kVzVqZEdsdmJpQjNlWE5wZDNsblRXOWtaU0FvWlNrZ2V5QndaWEp6YVhOMFRXOWtaU2duZDNsemFYZDVaeWNzSUdVcE95QjlYRzVjYmlBZ1puVnVZM1JwYjI0Z2NHVnljMmx6ZEUxdlpHVWdLRzVsZUhSTmIyUmxMQ0JsS1NCN1hHNGdJQ0FnZG1GeUlISmxiV1Z0WW5KaGJtTmxPMXh1SUNBZ0lIWmhjaUJqZFhKeVpXNTBUVzlrWlNBOUlHVmthWFJ2Y2k1dGIyUmxPMXh1SUNBZ0lIWmhjaUJ2YkdRZ1BTQnRiMlJsYzF0amRYSnlaVzUwVFc5a1pWMHVZblYwZEc5dU8xeHVJQ0FnSUhaaGNpQmlkWFIwYjI0Z1BTQnRiMlJsYzF0dVpYaDBUVzlrWlYwdVluVjBkRzl1TzF4dUlDQWdJSFpoY2lCbWIyTjFjMmx1WnlBOUlDRWhaU0I4ZkNCa2IyTXVZV04wYVhabFJXeGxiV1Z1ZENBOVBUMGdkR1Y0ZEdGeVpXRWdmSHdnWkc5akxtRmpkR2wyWlVWc1pXMWxiblFnUFQwOUlHVmthWFJoWW14bE8xeHVYRzRnSUNBZ2MzUnZjQ2hsS1R0Y2JseHVJQ0FnSUdsbUlDaGpkWEp5Wlc1MFRXOWtaU0E5UFQwZ2JtVjRkRTF2WkdVcElIdGNiaUFnSUNBZ0lISmxkSFZ5Ymp0Y2JpQWdJQ0I5WEc1Y2JpQWdJQ0J5WlcxbGJXSnlZVzVqWlNBOUlHWnZZM1Z6YVc1bklDWW1JSEpsYldWdFltVnlVMlZzWldOMGFXOXVLR2hwYzNSdmNua3NJRzhwTzF4dUlDQWdJSFJsZUhSaGNtVmhMbUpzZFhJb0tUc2dMeThnWVhabGNuUWdZMmh5YjIxbElISmxjR0ZwYm5RZ1luVm5jMXh1WEc0Z0lDQWdhV1lnS0c1bGVIUk5iMlJsSUQwOVBTQW5iV0Z5YTJSdmQyNG5LU0I3WEc0Z0lDQWdJQ0JwWmlBb1kzVnljbVZ1ZEUxdlpHVWdQVDA5SUNkb2RHMXNKeWtnZTF4dUlDQWdJQ0FnSUNCMFpYaDBZWEpsWVM1MllXeDFaU0E5SUhCaGNuTmxLQ2R3WVhKelpVaFVUVXduTENCMFpYaDBZWEpsWVM1MllXeDFaU2t1ZEhKcGJTZ3BPMXh1SUNBZ0lDQWdmU0JsYkhObElIdGNiaUFnSUNBZ0lDQWdkR1Y0ZEdGeVpXRXVkbUZzZFdVZ1BTQndZWEp6WlNnbmNHRnljMlZJVkUxTUp5d2daV1JwZEdGaWJHVXBMblJ5YVcwb0tUdGNiaUFnSUNBZ0lIMWNiaUFnSUNCOUlHVnNjMlVnYVdZZ0tHNWxlSFJOYjJSbElEMDlQU0FuYUhSdGJDY3BJSHRjYmlBZ0lDQWdJR2xtSUNoamRYSnlaVzUwVFc5a1pTQTlQVDBnSjIxaGNtdGtiM2R1SnlrZ2UxeHVJQ0FnSUNBZ0lDQjBaWGgwWVhKbFlTNTJZV3gxWlNBOUlIQmhjbk5sS0Nkd1lYSnpaVTFoY210a2IzZHVKeXdnZEdWNGRHRnlaV0V1ZG1Gc2RXVXBMblJ5YVcwb0tUdGNiaUFnSUNBZ0lIMGdaV3h6WlNCN1hHNGdJQ0FnSUNBZ0lIUmxlSFJoY21WaExuWmhiSFZsSUQwZ1pXUnBkR0ZpYkdVdWFXNXVaWEpJVkUxTUxuUnlhVzBvS1R0Y2JpQWdJQ0FnSUgxY2JpQWdJQ0I5SUdWc2MyVWdhV1lnS0c1bGVIUk5iMlJsSUQwOVBTQW5kM2x6YVhkNVp5Y3BJSHRjYmlBZ0lDQWdJR2xtSUNoamRYSnlaVzUwVFc5a1pTQTlQVDBnSjIxaGNtdGtiM2R1SnlrZ2UxeHVJQ0FnSUNBZ0lDQmxaR2wwWVdKc1pTNXBibTVsY2toVVRVd2dQU0J3WVhKelpTZ25jR0Z5YzJWTllYSnJaRzkzYmljc0lIUmxlSFJoY21WaExuWmhiSFZsS1M1eVpYQnNZV05sS0hKd1lYSmhaM0poY0dnc0lDY25LUzUwY21sdEtDazdYRzRnSUNBZ0lDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUNBZ0lDQmxaR2wwWVdKc1pTNXBibTVsY2toVVRVd2dQU0IwWlhoMFlYSmxZUzUyWVd4MVpTNXlaWEJzWVdObEtISndZWEpoWjNKaGNHZ3NJQ2NuS1M1MGNtbHRLQ2s3WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdmVnh1WEc0Z0lDQWdhV1lnS0c1bGVIUk5iMlJsSUQwOVBTQW5kM2x6YVhkNVp5Y3BJSHRjYmlBZ0lDQWdJR05zWVhOelpYTXVZV1JrS0hSbGVIUmhjbVZoTENBbmQyc3RhR2xrWlNjcE8xeHVJQ0FnSUNBZ1kyeGhjM05sY3k1eWJTaGxaR2wwWVdKc1pTd2dKM2RyTFdocFpHVW5LVHRjYmlBZ0lDQWdJR2xtSUNod2JHRmpaU2tnZXlCamJHRnpjMlZ6TG5KdEtIQnNZV05sTENBbmQyc3RhR2xrWlNjcE95QjlYRzRnSUNBZ0lDQnBaaUFvWm05amRYTnBibWNwSUhzZ2MyVjBWR2x0Wlc5MWRDaG1iMk4xYzBWa2FYUmhZbXhsTENBd0tUc2dmVnh1SUNBZ0lIMGdaV3h6WlNCN1hHNGdJQ0FnSUNCamJHRnpjMlZ6TG5KdEtIUmxlSFJoY21WaExDQW5kMnN0YUdsa1pTY3BPMXh1SUNBZ0lDQWdZMnhoYzNObGN5NWhaR1FvWldScGRHRmliR1VzSUNkM2F5MW9hV1JsSnlrN1hHNGdJQ0FnSUNCcFppQW9jR3hoWTJVcElIc2dZMnhoYzNObGN5NWhaR1FvY0d4aFkyVXNJQ2QzYXkxb2FXUmxKeWs3SUgxY2JpQWdJQ0FnSUdsbUlDaG1iMk4xYzJsdVp5a2dleUIwWlhoMFlYSmxZUzVtYjJOMWN5Z3BPeUI5WEc0Z0lDQWdmVnh1SUNBZ0lHTnNZWE56WlhNdVlXUmtLR0oxZEhSdmJpd2dKM2RyTFcxdlpHVXRZV04wYVhabEp5azdYRzRnSUNBZ1kyeGhjM05sY3k1eWJTaHZiR1FzSUNkM2F5MXRiMlJsTFdGamRHbDJaU2NwTzF4dUlDQWdJR05zWVhOelpYTXVZV1JrS0c5c1pDd2dKM2RyTFcxdlpHVXRhVzVoWTNScGRtVW5LVHRjYmlBZ0lDQmpiR0Z6YzJWekxuSnRLR0oxZEhSdmJpd2dKM2RyTFcxdlpHVXRhVzVoWTNScGRtVW5LVHRjYmlBZ0lDQmlkWFIwYjI0dWMyVjBRWFIwY21saWRYUmxLQ2RrYVhOaFlteGxaQ2NzSUNka2FYTmhZbXhsWkNjcE8xeHVJQ0FnSUc5c1pDNXlaVzF2ZG1WQmRIUnlhV0oxZEdVb0oyUnBjMkZpYkdWa0p5azdYRzRnSUNBZ1pXUnBkRzl5TG0xdlpHVWdQU0J1WlhoMFRXOWtaVHRjYmx4dUlDQWdJR2xtSUNodkxuTjBiM0poWjJVcElIc2diSE11YzJWMEtHOHVjM1J2Y21GblpTd2dibVY0ZEUxdlpHVXBPeUI5WEc1Y2JpQWdJQ0JvYVhOMGIzSjVMbk5sZEVsdWNIVjBUVzlrWlNodVpYaDBUVzlrWlNrN1hHNGdJQ0FnYVdZZ0tISmxiV1Z0WW5KaGJtTmxLU0I3SUhKbGJXVnRZbkpoYm1ObExuVnViV0Z5YXlncE95QjlYRzRnSUNBZ1ptbHlaVXhoZEdWeUtDZDNiMjltYldGeWF5MXRiMlJsTFdOb1lXNW5aU2NwTzF4dVhHNGdJQ0FnWm5WdVkzUnBiMjRnY0dGeWMyVWdLRzFsZEdodlpDd2dhVzV3ZFhRcElIdGNiaUFnSUNBZ0lISmxkSFZ5YmlCdlcyMWxkR2h2WkYwb2FXNXdkWFFzSUh0Y2JpQWdJQ0FnSUNBZ2JXRnlhMlZ5Y3pvZ2NtVnRaVzFpY21GdVkyVWdKaVlnY21WdFpXMWljbUZ1WTJVdWJXRnlhMlZ5Y3lCOGZDQmJYVnh1SUNBZ0lDQWdmU2s3WEc0Z0lDQWdmVnh1SUNCOVhHNWNiaUFnWm5WdVkzUnBiMjRnWm1seVpVeGhkR1Z5SUNoMGVYQmxLU0I3WEc0Z0lDQWdjMlYwVkdsdFpXOTFkQ2htZFc1amRHbHZiaUJtYVhKbElDZ3BJSHRjYmlBZ0lDQWdJR055YjNOemRtVnVkQzVtWVdKeWFXTmhkR1VvZEdWNGRHRnlaV0VzSUhSNWNHVXBPMXh1SUNBZ0lIMHNJREFwTzF4dUlDQjlYRzVjYmlBZ1puVnVZM1JwYjI0Z1ptOWpkWE5GWkdsMFlXSnNaU0FvS1NCN1hHNGdJQ0FnWldScGRHRmliR1V1Wm05amRYTW9LVHRjYmlBZ2ZWeHVYRzRnSUdaMWJtTjBhVzl1SUdkbGRFMWhjbXRrYjNkdUlDZ3BJSHRjYmlBZ0lDQnBaaUFvWldScGRHOXlMbTF2WkdVZ1BUMDlJQ2QzZVhOcGQzbG5KeWtnZTF4dUlDQWdJQ0FnY21WMGRYSnVJRzh1Y0dGeWMyVklWRTFNS0dWa2FYUmhZbXhsS1R0Y2JpQWdJQ0I5WEc0Z0lDQWdhV1lnS0dWa2FYUnZjaTV0YjJSbElEMDlQU0FuYUhSdGJDY3BJSHRjYmlBZ0lDQWdJSEpsZEhWeWJpQnZMbkJoY25ObFNGUk5UQ2gwWlhoMFlYSmxZUzUyWVd4MVpTazdYRzRnSUNBZ2ZWeHVJQ0FnSUhKbGRIVnliaUIwWlhoMFlYSmxZUzUyWVd4MVpUdGNiaUFnZlZ4dVhHNGdJR1oxYm1OMGFXOXVJR0ZrWkVOdmJXMWhibVJDZFhSMGIyNGdLR2xrTENCamIyMWlieXdnWm00cElIdGNiaUFnSUNCcFppQW9ZWEpuZFcxbGJuUnpMbXhsYm1kMGFDQTlQVDBnTWlrZ2UxeHVJQ0FnSUNBZ1ptNGdQU0JqYjIxaWJ6dGNiaUFnSUNBZ0lHTnZiV0p2SUQwZ2JuVnNiRHRjYmlBZ0lDQjlYRzRnSUNBZ2RtRnlJR0oxZEhSdmJpQTlJSFJoWnloN0lIUTZJQ2RpZFhSMGIyNG5MQ0JqT2lBbmQyc3RZMjl0YldGdVpDY3NJSEE2SUdOdmJXMWhibVJ6SUgwcE8xeHVJQ0FnSUhaaGNpQmpkWE4wYjIwZ1BTQnZMbkpsYm1SbGNpNWpiMjF0WVc1a2N6dGNiaUFnSUNCMllYSWdjbVZ1WkdWeUlEMGdkSGx3Wlc5bUlHTjFjM1J2YlNBOVBUMGdKMloxYm1OMGFXOXVKeUEvSUdOMWMzUnZiU0E2SUhKbGJtUmxjbVZ5Y3k1amIyMXRZVzVrY3p0Y2JpQWdJQ0IyWVhJZ2RHbDBiR1VnUFNCemRISnBibWR6TG5ScGRHeGxjMXRwWkYwN1hHNGdJQ0FnYVdZZ0tIUnBkR3hsS1NCN1hHNGdJQ0FnSUNCaWRYUjBiMjR1YzJWMFFYUjBjbWxpZFhSbEtDZDBhWFJzWlNjc0lHMWhZeUEvSUcxaFkybG1lU2gwYVhSc1pTa2dPaUIwYVhSc1pTazdYRzRnSUNBZ2ZWeHVJQ0FnSUdKMWRIUnZiaTUwZVhCbElEMGdKMkoxZEhSdmJpYzdYRzRnSUNBZ1luVjBkRzl1TG5SaFlrbHVaR1Y0SUQwZ0xURTdYRzRnSUNBZ2NtVnVaR1Z5S0dKMWRIUnZiaXdnYVdRcE8xeHVJQ0FnSUdOeWIzTnpkbVZ1ZEM1aFpHUW9ZblYwZEc5dUxDQW5ZMnhwWTJzbkxDQm5aWFJEYjIxdFlXNWtTR0Z1Wkd4bGNpaHpkWEptWVdObExDQm9hWE4wYjNKNUxDQm1iaWtwTzF4dUlDQWdJR2xtSUNoamIyMWlieWtnZTF4dUlDQWdJQ0FnWVdSa1EyOXRiV0Z1WkNoamIyMWlieXdnWm00cE8xeHVJQ0FnSUgxY2JpQWdJQ0J5WlhSMWNtNGdZblYwZEc5dU8xeHVJQ0I5WEc1Y2JpQWdablZ1WTNScGIyNGdZV1JrUTI5dGJXRnVaQ0FvWTI5dFltOHNJR1p1S1NCN1hHNGdJQ0FnYTJGdWVXVXViMjRvWTI5dFltOHNJR3RoYm5sbFQzQjBhVzl1Y3l3Z1oyVjBRMjl0YldGdVpFaGhibVJzWlhJb2MzVnlabUZqWlN3Z2FHbHpkRzl5ZVN3Z1ptNHBLVHRjYmlBZ2ZWeHVYRzRnSUdaMWJtTjBhVzl1SUhKMWJrTnZiVzFoYm1RZ0tHWnVLU0I3WEc0Z0lDQWdaMlYwUTI5dGJXRnVaRWhoYm1Sc1pYSW9jM1Z5Wm1GalpTd2dhR2x6ZEc5eWVTd2djbVZoY25KaGJtZGxLU2h1ZFd4c0tUdGNiaUFnSUNCbWRXNWpkR2x2YmlCeVpXRnljbUZ1WjJVZ0tHVXNJRzF2WkdVc0lHTm9kVzVyY3lrZ2UxeHVJQ0FnSUNBZ2NtVjBkWEp1SUdadUxtTmhiR3dvZEdocGN5d2dZMmgxYm10ekxDQnRiMlJsS1R0Y2JpQWdJQ0I5WEc0Z0lIMWNibjFjYmx4dVpuVnVZM1JwYjI0Z2RHRm5JQ2h2Y0hScGIyNXpLU0I3WEc0Z0lIWmhjaUJ2SUQwZ2IzQjBhVzl1Y3lCOGZDQjdmVHRjYmlBZ2RtRnlJR1ZzSUQwZ1pHOWpMbU55WldGMFpVVnNaVzFsYm5Rb2J5NTBJSHg4SUNka2FYWW5LVHRjYmlBZ1pXd3VZMnhoYzNOT1lXMWxJRDBnYnk1aklIeDhJQ2NuTzF4dUlDQnpaWFJVWlhoMEtHVnNMQ0J2TG5nZ2ZId2dKeWNwTzF4dUlDQnBaaUFvYnk1d0tTQjdJRzh1Y0M1aGNIQmxibVJEYUdsc1pDaGxiQ2s3SUgxY2JpQWdjbVYwZFhKdUlHVnNPMXh1ZlZ4dVhHNW1kVzVqZEdsdmJpQnpkRzl3SUNobEtTQjdYRzRnSUdsbUlDaGxLU0I3SUdVdWNISmxkbVZ1ZEVSbFptRjFiSFFvS1RzZ1pTNXpkRzl3VUhKdmNHRm5ZWFJwYjI0b0tUc2dmVnh1ZlZ4dVhHNW1kVzVqZEdsdmJpQnRZV05wWm5rZ0tIUmxlSFFwSUh0Y2JpQWdjbVYwZFhKdUlIUmxlSFJjYmlBZ0lDQXVjbVZ3YkdGalpTZ3ZYRnhpWTNSeWJGeGNZaTlwTENBblhGeDFNak14T0NjcFhHNGdJQ0FnTG5KbGNHeGhZMlVvTDF4Y1ltRnNkRnhjWWk5cExDQW5YRngxTWpNeU5TY3BYRzRnSUNBZ0xuSmxjR3hoWTJVb0wxeGNZbk5vYVdaMFhGeGlMMmtzSUNkY1hIVXlNV1UzSnlrN1hHNTlYRzVjYm5kdmIyWnRZWEpyTG1acGJtUWdQU0JtYVc1a08xeHVkMjl2Wm0xaGNtc3VjM1J5YVc1bmN5QTlJSE4wY21sdVozTTdYRzV0YjJSMWJHVXVaWGh3YjNKMGN5QTlJSGR2YjJadFlYSnJPMXh1SWwxOSIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24geGhyU3R1YiAob3B0aW9ucykge1xuICB0aHJvdyBuZXcgRXJyb3IoJ1dvb2ZtYXJrIGlzIG1pc3NpbmcgWEhSIGNvbmZpZ3VyYXRpb24uIENhblxcJ3QgcmVxdWVzdCAnICsgb3B0aW9ucy51cmwpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHhoclN0dWI7XG4iXX0=
