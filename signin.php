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
                <h2>Connection</h2>
                <form id="registerForm">
                    <label>Email :</label><br />
                    <input type="email" id="email" required /><br /><br />

                    <label>Mot de passe :</label><br />
                    <input type="password" id="password" required /><br /><br />

                    <button class="sign" type="submit">Connection</button>
                </form>
                <span>You don't have an account? <a href="./signup.php">Create one</a></span>
            </div>
        </div>
        <?php include './footer.php'; ?>
    </body>
    <script type="text/javascript"src="/js/slidepanel.js?v=1.0.201" ></script>
	<script type="text/javascript"src="/js/header.js?v=1.0.201" ></script>
	<script type="text/javascript" src="/js/signin.js?v=1.0.201"></script>
	<script type="text/javascript">
    	var minH = window.innerHeight - 244;
    	$(".container").css('min-height',minH);
	</script>
</html>
