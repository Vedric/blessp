/* ==========================================================================
   Toast Notification System
   Usage: showToast('Message text', 'success|error|info|warning')
   ========================================================================== */

(function(){
    var container = null;

    function getContainer(){
        if(container) return container;
        container = document.createElement('div');
        container.id = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'false');
        container.className = 'toast-container';
        document.body.appendChild(container);
        return container;
    }

    function showToast(message, type, duration){
        type = type || 'info';
        duration = duration || 4000;

        var toast = document.createElement('div');
        toast.className = 'toast toast--' + type;
        toast.setAttribute('role', 'status');

        var icon = getIcon(type);
        var iconSpan = document.createElement('span');
        iconSpan.className = 'toast__icon';
        iconSpan.innerHTML = icon;

        var text = document.createElement('span');
        text.className = 'toast__message';
        text.textContent = message;

        var closeBtn = document.createElement('button');
        closeBtn.className = 'toast__close';
        closeBtn.innerHTML = '&times;';
        closeBtn.setAttribute('aria-label', 'Dismiss');
        closeBtn.onclick = function(){
            dismissToast(toast);
        };

        toast.appendChild(iconSpan);
        toast.appendChild(text);
        toast.appendChild(closeBtn);

        getContainer().appendChild(toast);

        requestAnimationFrame(function(){
            toast.classList.add('toast--visible');
        });

        var timer = setTimeout(function(){
            dismissToast(toast);
        }, duration);

        toast.addEventListener('mouseenter', function(){
            clearTimeout(timer);
        });

        toast.addEventListener('mouseleave', function(){
            timer = setTimeout(function(){
                dismissToast(toast);
            }, 2000);
        });
    }

    function dismissToast(toast){
        if(!toast || !toast.parentNode) return;
        toast.classList.remove('toast--visible');
        toast.classList.add('toast--leaving');
        setTimeout(function(){
            if(toast.parentNode){
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    function getIcon(type){
        switch(type){
            case 'success': return '&#10003;';
            case 'error':   return '&#10007;';
            case 'warning': return '&#9888;';
            default:        return '&#8505;';
        }
    }

    window.showToast = showToast;
})();
