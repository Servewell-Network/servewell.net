export type Sublistener = {
  eventName: string;
  tagName: string;
  selector: string;
  handle: (matched: HTMLElement, event: Event) => void;
};

export type Delegator = {
  registerSublistener: (sublistener: Sublistener) => () => void;
};

export function createDelegator(): Delegator {
  const sublistenersByEvent: Record<string, Sublistener[]> = {};
  const dispatchersByEvent: Record<string, EventListener> = {};

  function ensureDispatcher(eventName: string) {
    if (dispatchersByEvent[eventName]) return;

    const dispatcher: EventListener = (event: Event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) return;

      const sublisteners = (sublistenersByEvent[eventName] || []).slice();
      for (const sublistener of sublisteners) {
        const matched = target.closest<HTMLElement>(sublistener.selector);
        if (!matched) continue;
        if (matched.tagName.toUpperCase() !== sublistener.tagName.toUpperCase()) continue;
        sublistener.handle(matched, event);
      }
    };

    dispatchersByEvent[eventName] = dispatcher;
    document.addEventListener(eventName, dispatcher);
  }

  function registerSublistener(sublistener: Sublistener): () => void {
    if (!sublistenersByEvent[sublistener.eventName]) {
      sublistenersByEvent[sublistener.eventName] = [];
    }

    sublistenersByEvent[sublistener.eventName].push(sublistener);
    ensureDispatcher(sublistener.eventName);

    return function deregister() {
      const bucket = sublistenersByEvent[sublistener.eventName];
      if (!bucket) return;

      const index = bucket.indexOf(sublistener);
      if (index !== -1) bucket.splice(index, 1);

      if (bucket.length === 0 && dispatchersByEvent[sublistener.eventName]) {
        document.removeEventListener(sublistener.eventName, dispatchersByEvent[sublistener.eventName]);
        delete dispatchersByEvent[sublistener.eventName];
      }
    };
  }

  return { registerSublistener };
}