/**
 * CSRF token helper.
 * Reads the token from the <meta name="csrf-token"> tag and patches
 * the global fetch and jQuery AJAX to include X-CSRF-Token on all
 * state-changing requests (POST, PUT, PATCH, DELETE).
 */
(function () {
    function getCsrfToken() {
        var meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.getAttribute('content') : '';
    }

    var STATE_CHANGING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

    // Patch window.fetch
    var originalFetch = window.fetch;
    window.fetch = function (url, options) {
        options = options || {};
        var method = (options.method || 'GET').toUpperCase();
        if (STATE_CHANGING_METHODS.indexOf(method) !== -1) {
            var headers = options.headers || {};
            if (headers instanceof Headers) {
                if (!headers.has('X-CSRF-Token')) {
                    headers.set('X-CSRF-Token', getCsrfToken());
                }
            } else {
                if (!headers['X-CSRF-Token']) {
                    headers['X-CSRF-Token'] = getCsrfToken();
                }
            }
            options.headers = headers;
        }
        return originalFetch.call(this, url, options);
    };

    // Patch jQuery AJAX if jQuery is loaded
    if (typeof jQuery !== 'undefined') {
        jQuery(document).ajaxSend(function (event, jqXHR, settings) {
            var method = (settings.type || 'GET').toUpperCase();
            if (STATE_CHANGING_METHODS.indexOf(method) !== -1) {
                jqXHR.setRequestHeader('X-CSRF-Token', getCsrfToken());
            }
        });
    }
})();
