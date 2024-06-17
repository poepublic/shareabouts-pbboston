function htmlToElement(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstChild;
}


class EventTracker {
  constructor() {
    this.eventListeners = [];
  }

  add(event, el, callback) {
    el.addEventListener(event, callback);
    this.eventListeners.push({ event, el, callback });
  }

  remove(event, el, callback) {
    el.removeEventListener(event, callback);
    this.eventListeners = this.eventListeners.filter((listener) => {
      return listener.event !== event || listener.el !== el || listener.callback !== callback;
    });
  }

  clear() {
    this.eventListeners.forEach(({ event, el, callback }) => {
      el.removeEventListener(event, callback);
    });
    this.eventListeners = [];
  }
}


class Component {
  constructor(el) {
    this.el = el;
    this.events = new EventTracker();
  }

  fill() {
    return this;
  }

  empty() {
    this.el.innerHTML = '';
    return this;
  }

  bind() {
    return this;
  }

  unbind() {
    this.events.clear();
    return this;
  }

  render() {
    this.unbind();
    this.empty();
    this.fill();
    this.bind()
    return this;
  }
}


export {
  htmlToElement,
  Component,
  EventTracker,
};
