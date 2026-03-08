/* ==========================================================================
   Cookie Consent Banner
   Stores preference in localStorage. Does not load tracking scripts
   unless consent is given.
   ========================================================================== */

(function(){
    var STORAGE_KEY = 'blessp_cookie_consent';

    function getConsent(){
        try {
            return localStorage.getItem(STORAGE_KEY);
        } catch(e){
            return null;
        }
    }

    function setConsent(value){
        try {
            localStorage.setItem(STORAGE_KEY, value);
        } catch(e){
            /* localStorage unavailable */
        }
    }

    function hideBanner(){
        var banner = document.getElementById('cookieBanner');
        if(banner){
            banner.classList.remove('cookie-banner--visible');
            setTimeout(function(){
                banner.style.display = 'none';
            }, 350);
        }
    }

    function showBanner(){
        var banner = document.getElementById('cookieBanner');
        if(banner){
            banner.style.display = '';
            requestAnimationFrame(function(){
                banner.classList.add('cookie-banner--visible');
            });
        }
    }

    function acceptAll(){
        setConsent('accepted');
        hideBanner();
    }

    function rejectAll(){
        setConsent('rejected');
        hideBanner();
    }

    function init(){
        var consent = getConsent();
        if(consent){
            return;
        }
        showBanner();
    }

    window.cookieAcceptAll = acceptAll;
    window.cookieRejectAll = rejectAll;

    if(document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
