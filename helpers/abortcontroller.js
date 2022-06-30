'use strict';

class AbortController {
    constructor() {
        Object.defineProperty(this, 'signal', { value: {aborted: false}, writable: true, configurable: true });
    }
}
    
Object.defineProperty(global, 'AbortController', {
    writable: true,
    enumerable: false,
    configurable: true,
    value: AbortController,
});
    
Object.defineProperty(global, 'self', {
    writable: true,
    enumerable: false,
    configurable: true,
    value: global,
});