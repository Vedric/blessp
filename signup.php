<!doctype html>
<html lang="en">
    <head>
        <?php include './headmeta.php' ?>
    </head>
    <body>
        <?php
            include './config.php';
            include './authent.php';
            include './header.php';
        ?>
        <div id="container" class="container">
            <div class="signForm">
                <h2>Sign up</h2>
                <form id="registerForm">
                    <label for="firstname">Firstname</label>
                    <input type="text" id="firstname" required />

                    <label for="lastname">Lastname</label>
                    <input type="text" id="lastname" required />

                    <label for="email">Email</label>
                    <input type="email" id="email" required />

                    <label for="password">Password</label>
                    <div class="password-field">
                        <input type="password" id="password" required />
                        <button type="button" class="password-toggle" onclick="togglePassword('password', this)" aria-label="Show password">Show</button>
                    </div>
                    <p class="text-xs text-muted mt-1 mb-4">Minimum 8 characters</p>

                    <button class="sign" type="submit">Sign up</button>
                </form>
            </div>
        </div>
        <?php include './footer.php'; ?>
    </body>
    <script type="text/javascript" src="/js/slidepanel.js?v=1.1.0"></script>
    <script type="text/javascript" src="/js/header.js?v=1.1.0"></script>
    <script type="text/javascript" src="./js/signup.js?v=1.1.0"></script>
</html>
