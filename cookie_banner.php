<div id="cookie-banner" style="position:fixed;bottom:0;left:0;width:100%;background:#111;color:#fff;padding:20px;z-index:9999;display:none">
    <p>
        Nous utilisons des cookies pour améliorer votre expérience.
        Vous pouvez accepter ou personnaliser vos choix.
        <a href="/politique-confidentialite.php" style="color:#4ea3ff">En savoir plus</a>
    </p>

    <label>
        <input type="checkbox" id="analytics"> Cookies statistiques
    </label><br>

    <label>
        <input type="checkbox" id="marketing"> Cookies marketing
    </label><br><br>

    <button onclick="acceptCookies()">Enregistrer</button>
</div>

<script>
fetch('/cookies/get_consent.php')
    .then(r => r.json())
    .then(consent => {
        if (!consent) {
            document.getElementById('cookie-banner').style.display = 'block';
        }
    });

function acceptCookies() {
    fetch('/cookies/save_consent.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            analytics: document.getElementById('analytics').checked,
            marketing: document.getElementById('marketing').checked
        })
    }).then(() => {
        document.getElementById('cookie-banner').style.display = 'none';
        location.reload();
    });
}
</script>

