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
                <h2>Sign in</h2>
                <form id="registerForm">
                    <label for="email">Email</label>
                    <input type="email" id="email" required />

                    <label for="password">Password</label>
                    <input type="password" id="password" required />

                    <button class="sign" type="submit">Sign in</button>
                </form>
                <p class="text-center text-sm mt-4">
                    Don't have an account? <a href="./signup.php" style="text-decoration: underline;">Create one</a>
                </p>
            </div>
        </div>
        <?php include './footer.php'; ?>
    </body>
    <script type="text/javascript" src="/js/slidepanel.js?v=1.1.0"></script>
    <script type="text/javascript" src="/js/header.js?v=1.1.0"></script>
    <script type="text/javascript" src="/js/signin.js?v=1.1.0"></script>
</html>
