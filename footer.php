<footer class="footer" id="footer">
    <div class="footer__inner">
        <div class="footer__brand">
            <strong>BLE$$ P</strong>
        </div>
        <nav class="footer__nav">
            <a href="/shop.php">Shop</a>
            <a href="/signin.php">Account</a>
        </nav>
        <div class="footer__social">
            <a href="#" aria-label="Facebook"><div class="socialLink fbk_lnk"></div></a>
            <a href="#" aria-label="Instagram"><div class="socialLink inst_lnk"></div></a>
            <a href="#" aria-label="TikTok"><div class="socialLink tiktok_lnk"></div></a>
        </div>
        <p class="footer__copy">&copy; <?php echo date('Y'); ?> BLE$$ P. All rights reserved.</p>
    </div>
</footer>

<div id="cookieBanner" class="cookie-banner" role="region" aria-label="Cookie consent">
    <div class="cookie-banner__inner">
        <div class="cookie-banner__text">
            <p class="cookie-banner__title">We value your privacy</p>
            <p class="cookie-banner__desc">We use cookies to improve your browsing experience and analyze site traffic. By clicking "Accept", you consent to our use of cookies.</p>
        </div>
        <div class="cookie-banner__actions">
            <button class="btn btn--outline btn--sm" onclick="cookieRejectAll()">Reject</button>
            <button class="btn btn--primary btn--sm" onclick="cookieAcceptAll()">Accept</button>
        </div>
    </div>
</div>
<script src="/js/cookie-banner.js"></script>
